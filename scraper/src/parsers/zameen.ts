// Pure Zameen.com HTML parser. No network, no browser: give it HTML + a base
// URL and it returns RawCard[]. Resilient by design — multiple selector
// fallbacks, cards without an href are skipped, and if the simple selectors
// find nothing we fall back to embedded JSON (JSON-LD / __NEXT_DATA__).

import { load } from 'cheerio';
import type { RawCard } from '../types.js';

type $Root = ReturnType<typeof load>;
type $Scope = ReturnType<$Root>;

const CARD_SELECTOR = '[data-aut-id="itemBox"]';

const SELECTORS = {
  priceText: ['[data-aut-id="itemPrice"]', '.price'],
  title: ['[data-aut-id="itemTitle"]', '.title', 'h3', 'h2'],
  location: ['[data-aut-id="itemLocation"]', '.location'],
  areaText: ['[data-aut-id="itemSize"]', '.size'],
  description: ['[data-aut-id="itemDescription"]', '.description'],
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

function findHref($scope: $Scope): string | null {
  return $scope.find('a[href]').first().attr('href') ?? $scope.attr('href') ?? null;
}

/** Extract the numeric listing id from a Zameen property URL. */
export function parseZameenListingId(url: string): string | null {
  const match =
    url.match(/[-/](\d{5,})\.html/i) ??
    url.match(/[-/](\d{5,})(?:[/?#]|$)/) ??
    url.match(/(\d{5,})/);
  return match ? match[1] : null;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function buildCard($: $Root, $card: $Scope, baseUrl: string): RawCard | null {
  const href = findHref($card);
  if (!href) return null;
  const sourceUrl = resolveUrl(href, baseUrl);
  if (!sourceUrl) return null;
  const sourceListingId = parseZameenListingId(strOrEmpty(href));
  if (!sourceListingId) return null;

  const title = pickText($, $card, SELECTORS.title);
  const priceText = pickText($, $card, SELECTORS.priceText);
  const location = pickText($, $card, SELECTORS.location);
  const areaText = pickText($, $card, SELECTORS.areaText);
  const description = pickText($, $card, SELECTORS.description);

  return {
    sourceListingId,
    sourceUrl,
    title,
    description,
    purpose: null,
    propertyType: 'plot',
    priceText,
    location,
    areaText,
    bedrooms: null,
    bathrooms: null,
    latitude: null,
    longitude: null,
    raw: { href, title, priceText, location, areaText, description },
  };
}

function strOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

// ---------------------------------------------------------------------------
// Structured-data fallback (best effort, fully guarded)
// ---------------------------------------------------------------------------

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function cardFromJson(obj: Record<string, unknown>, href: string, baseUrl: string): RawCard | null {
  const sourceUrl = resolveUrl(href, baseUrl);
  if (!sourceUrl) return null;
  const sourceListingId = parseZameenListingId(sourceUrl);
  if (!sourceListingId) return null;
  return {
    sourceListingId,
    sourceUrl,
    title: firstString(obj, ['title', 'name']),
    description: firstString(obj, ['description']),
    purpose: firstString(obj, ['purpose']),
    propertyType: firstString(obj, ['propertyType', 'property_type', 'type']) ?? 'plot',
    priceText: firstString(obj, ['price', 'priceText', 'amount']),
    location: firstString(obj, ['location', 'address', 'city']),
    areaText: firstString(obj, ['area', 'size', 'areaText']),
    bedrooms: numberOrNull(obj.bedrooms),
    bathrooms: numberOrNull(obj.bathrooms),
    latitude: numberOrNull(obj.latitude ?? obj.lat),
    longitude: numberOrNull(obj.longitude ?? obj.lng ?? obj.lon),
    raw: obj,
  };
}

function collectFromJson(value: unknown, baseUrl: string, out: RawCard[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectFromJson(item, baseUrl, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;

  const href = firstString(obj, ['url', 'link', 'href', 'detailUrl', 'detail_url']);
  if (href && /\/(?:property|Property)\//.test(href)) {
    const card = cardFromJson(obj, href, baseUrl);
    if (card && !out.some((c) => c.sourceListingId === card.sourceListingId)) {
      out.push(card);
    }
  }
  for (const nested of Object.values(obj)) collectFromJson(nested, baseUrl, out);
}

function structuredFallback($: $Root, baseUrl: string): RawCard[] {
  const out: RawCard[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      collectFromJson(JSON.parse(raw), baseUrl, out);
    } catch {
      // ignore malformed JSON-LD
    }
  });
  const nextData = $('#__NEXT_DATA__').contents().text();
  if (nextData) {
    try {
      collectFromJson(JSON.parse(nextData), baseUrl, out);
    } catch {
      // ignore malformed __NEXT_DATA__
    }
  }
  return out;
}

/**
 * Parse a Zameen search-results page into listing cards.
 * @param html   raw HTML of the search page
 * @param baseUrl absolute URL the HTML was fetched from (used to resolve hrefs)
 */
export function parseZameenHtml(html: string, baseUrl: string): RawCard[] {
  const $ = load(html);
  const cards: RawCard[] = [];
  const seen = new Set<string>();

  $(CARD_SELECTOR).each((_, el) => {
    const card = buildCard($, $(el), baseUrl);
    if (!card) return;
    if (seen.has(card.sourceListingId!)) return;
    seen.add(card.sourceListingId!);
    cards.push(card);
  });

  if (cards.length === 0) {
    for (const card of structuredFallback($, baseUrl)) {
      if (!card.sourceListingId || seen.has(card.sourceListingId)) continue;
      seen.add(card.sourceListingId);
      cards.push(card);
    }
  }

  return cards;
}
