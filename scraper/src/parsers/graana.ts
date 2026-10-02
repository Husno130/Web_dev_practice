// Pure Graana.com HTML parser. Graana's markup is less stable than Zameen's,
// so this is intentionally defensive: it looks for known card containers, then
// falls back to anchoring every /property/ link, and uses class-name guesses
// plus text heuristics for the individual fields.

import { load } from 'cheerio';
import type { RawCard } from '../types.js';

type $Root = ReturnType<typeof load>;
type $Scope = ReturnType<$Root>;

const CONTAINER_SELECTORS = [
  '[data-testid="property-card"]',
  '[data-testid*="property"]',
  '[class*="property-card"]',
  '[class*="PropertyCard"]',
  '[class*="listing-card"]',
  '[class*="ListingCard"]',
  'article',
];

const SELECTORS = {
  title: [
    'h1',
    'h2',
    'h3',
    'h4',
    '[class*="title"]',
    '[class*="Title"]',
    '[data-testid*="title"]',
  ],
  priceText: ['[class*="price"]', '[class*="Price"]', '[data-testid*="price"]'],
  location: [
    '[class*="location"]',
    '[class*="Location"]',
    '[class*="address"]',
    '[class*="Address"]',
  ],
  areaText: ['[class*="area"]', '[class*="Area"]', '[class*="size"]', '[class*="Size"]'],
};

function textOf(value: string | undefined | null): string | null {
  if (value == null) return null;
  const t = value.replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

function pickText($: $Root, $scope: $Scope, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = textOf($scope.find(selector).first().text());
    if (text) return text;
  }
  return null;
}

/** Extract the numeric listing id from a Graana property URL. */
export function parseGraanaListingId(url: string): string | null {
  const match =
    url.match(/[-/](\d{5,})(?:[/?#]|$)/) ?? url.match(/(\d{5,})/) ?? url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function findAnchor($: $Root, $container: $Scope): $Scope | null {
  if ($container.is('a[href*="/property/"]')) return $container;
  const inner = $container.find('a[href*="/property/"]').first();
  if (inner.length) return inner;
  const anyLink = $container.find('a[href]').first();
  const href = anyLink.attr('href');
  if (href && href.includes('/property/')) return anyLink;
  return null;
}

function buildCard($: $Root, $container: $Scope, baseUrl: string): RawCard | null {
  const $anchor = findAnchor($, $container);
  if (!$anchor) return null;
  const href = $anchor.attr('href');
  if (!href || !href.includes('/property/')) return null;

  const sourceUrl = resolveUrl(href, baseUrl);
  if (!sourceUrl) return null;
  const sourceListingId = parseGraanaListingId(sourceUrl);
  if (!sourceListingId) return null;

  const containerText = textOf($container.text());
  const title = pickText($, $container, SELECTORS.title) ?? textOf($anchor.text());
  const priceText = pickText($, $container, SELECTORS.priceText);
  const location = pickText($, $container, SELECTORS.location);
  // No dedicated area element? Hand the whole card text to parseArea, which
  // only picks out "<number> <unit>" pairs and ignores the price.
  const areaText = pickText($, $container, SELECTORS.areaText) ?? containerText;

  return {
    sourceListingId,
    sourceUrl,
    title,
    description: null,
    purpose: null,
    propertyType: 'plot',
    priceText,
    location,
    areaText,
    bedrooms: null,
    bathrooms: null,
    latitude: null,
    longitude: null,
    raw: { href, title, priceText, location, areaText },
  };
}

/**
 * Parse a Graana search-results page into listing cards.
 * @param html   raw HTML of the search page
 * @param baseUrl absolute URL the HTML was fetched from (used to resolve hrefs)
 */
export function parseGraanaHtml(html: string, baseUrl: string): RawCard[] {
  const $ = load(html);
  const cards: RawCard[] = [];
  const seenIds = new Set<string>();

  const containers: $Scope[] = [];
  for (const selector of CONTAINER_SELECTORS) {
    $(selector).each((_, el) => {
      const $el = $(el);
      if ($el.find('a[href*="/property/"]').length || $el.is('a[href*="/property/"]')) {
        containers.push($el);
      }
    });
    if (containers.length) break;
  }

  // Fallback: treat each property link itself as a card container.
  if (containers.length === 0) {
    $('a[href*="/property/"]').each((_, el) => {
      containers.push($(el));
    });
  }

  for (const $container of containers) {
    const card = buildCard($, $container, baseUrl);
    if (!card || !card.sourceListingId) continue;
    if (seenIds.has(card.sourceListingId)) continue;
    seenIds.add(card.sourceListingId);
    cards.push(card);
  }

  return cards;
}
