// Pure Zameen.com HTML parser. No network, no browser: give it HTML + a base
// URL and it returns RawCard[].
//
// Zameen has shipped two markup generations:
//   1. legacy cards with stable `data-aut-id` hooks (itemBox/itemPrice/...)
//   2. current cards rendered as `li[role="article"]` with *hashed* class names
//      and no data attributes, where the useful values only exist as text.
// This parser supports both: it prefers the legacy hooks when present and
// otherwise falls back to heuristics over each card's text.

import { load } from 'cheerio';
import type { RawCard } from '../types.js';

type $Root = ReturnType<typeof load>;
type $Scope = ReturnType<$Root>;

// Card containers, most specific first. The first selector that matches any
// elements wins.
const CARD_SELECTORS = [
  '[data-aut-id="itemBox"]',
  'li[role="article"]',
  'li[aria-label="Listing"]',
  'article:has(a[href*="/Property/"])',
];

const SELECTORS = {
  priceText: ['[data-aut-id="itemPrice"]', '.price'],
  title: ['[data-aut-id="itemTitle"]', '.title', 'h3', 'h2'],
  location: ['[data-aut-id="itemLocation"]', '.location'],
  areaText: ['[data-aut-id="itemSize"]', '.size'],
  description: ['[data-aut-id="itemDescription"]', '.description'],
};

// "PKR4.85 Crore", "Rs 2.5 Crore". Price is always prefixed by PKR/Rs on Zameen.
const PRICE_RE =
  /(?:PKR|Rs\.?|₨)\s*\d[\d,]*(?:\.\d+)?\s*(?:crore|cror|cr|lakh|lac|arab|thousand|hazar)?/i;
// Bare multiplier form, used only if the prefixed form is absent.
const PRICE_MULT_RE =
  /\d[\d,]*(?:\.\d+)?\s+(?:crore|cror|cr|lakh|lac|arab|thousand|hazar)\b/i;
// "6.7 Marla", "1 Kanal", "1200 Sq. Ft." — deliberately no trailing \b because
// adjacent text is often concatenated without spaces ("6.7 MarlaEnd Your...").
const AREA_RE =
  /\d[\d,]*(?:\.\d+)?\s*(?:marla|kanal|sq\.?\s*ft|sqft|sq\.?\s*yd|sqyd|gaz|sq\.?\s*m)/i;

function textOf(value: string | undefined | null): string | null {
  if (value == null) return null;
  const t = value.replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

function pickText($scope: $Scope, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = textOf($scope.find(selector).first().text());
    if (text) return text;
  }
  return null;
}

function findHref($scope: $Scope): string | null {
  const anchor = $scope.find('a[href*="/Property/"]').first();
  const href = anchor.attr('href') ?? $scope.find('a[href]').first().attr('href') ?? $scope.attr('href');
  return href ?? null;
}

/** Extract the numeric listing id from a Zameen property URL. */
export function parseZameenListingId(url: string): string | null {
  const match =
    url.match(/-(\d{5,})(?:-\d+)*\.html/i) ??
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

interface CardTextFields {
  priceText: string | null;
  location: string | null;
  areaText: string | null;
}

/**
 * Pull price / location / area out of the concatenated text of a current
 * (hashed-class) Zameen card, e.g.
 *   "...TitaniumPKR4.85 CroreBahria Enclave - Sector C, Bahria Enclave6.7 MarlaEnd..."
 * The location is whatever sits between the price and the area tokens.
 */
export function extractZameenCardText(rawText: string): CardTextFields {
  const text = rawText.replace(/\s+/g, ' ').trim();
  const priceMatch = text.match(PRICE_RE) ?? text.match(PRICE_MULT_RE);
  const areaMatch = text.match(AREA_RE);

  let location: string | null = null;
  if (priceMatch && areaMatch && priceMatch.index != null && areaMatch.index != null) {
    const start = priceMatch.index + priceMatch[0].length;
    const end = areaMatch.index;
    if (end > start) {
      location = textOf(text.slice(start, end))?.replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '') ?? null;
    }
  }

  return {
    priceText: priceMatch ? priceMatch[0].trim() : null,
    location,
    areaText: areaMatch ? areaMatch[0].trim() : null,
  };
}

function buildLegacyCard($scope: $Scope, baseUrl: string, href: string): RawCard | null {
  const sourceUrl = resolveUrl(href, baseUrl);
  if (!sourceUrl) return null;
  const sourceListingId = parseZameenListingId(href) ?? parseZameenListingId(sourceUrl);
  if (!sourceListingId) return null;

  const title = pickText($scope, SELECTORS.title);
  const priceText = pickText($scope, SELECTORS.priceText);
  const location = pickText($scope, SELECTORS.location);
  const areaText = pickText($scope, SELECTORS.areaText);
  const description = pickText($scope, SELECTORS.description);

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

// Each field lives in its own element on the current markup, so reading leaf
// elements in document order avoids the concatenation trap (e.g. a location
// ending in "Phase 2" glued to "1 Kanal" would otherwise parse as "21 Kanal").
const PRICE_LEAF_RE =
  /^(?:PKR|Rs\.?|₨)?\s*\d[\d,]*(?:\.\d+)?\s*(?:crore|cror|cr|lakh|lac|arab|thousand|hazar)?$/i;
const PRICE_HAS_VALUE_RE = /PKR|Rs\.?|₨|crore|cror|lakh|lac|arab|thousand|hazar/i;
const AREA_LEAF_RE =
  /^\d[\d,]*(?:\.\d+)?\s*(?:marla|kanal|sq\.?\s*ft|sqft|sq\.?\s*yd|sqyd|gaz|sq\.?\s*m)$/i;
const BADGE_RE = /^(?:super hot|verified|titanium|premium|featured|hot|new|sponsored)$/i;

function leafTexts($: $Root, $scope: $Scope): string[] {
  const out: string[] = [];
  $scope.find('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return; // keep leaves only
    const tag = String((el as { tagName?: string }).tagName ?? '').toLowerCase();
    if (tag === 'script' || tag === 'style') return;
    const text = textOf($el.text());
    if (text) out.push(text);
  });
  return out;
}

function extractFromLeaves(leaves: string[]): CardTextFields {
  const areaIdx = leaves.findIndex((t) => AREA_LEAF_RE.test(t));

  let priceIdx = -1;
  const priceLimit = areaIdx === -1 ? leaves.length : areaIdx;
  for (let i = 0; i < priceLimit; i++) {
    if (/\d/.test(leaves[i]) && PRICE_LEAF_RE.test(leaves[i]) && PRICE_HAS_VALUE_RE.test(leaves[i])) {
      priceIdx = i;
      break;
    }
  }

  let location: string | null = null;
  if (areaIdx > 0) {
    for (let i = areaIdx - 1; i >= 0 && i >= areaIdx - 4; i--) {
      const candidate = leaves[i];
      if (!candidate || candidate === leaves[priceIdx]) continue;
      if (PRICE_HAS_VALUE_RE.test(candidate) || AREA_LEAF_RE.test(candidate)) continue;
      if (BADGE_RE.test(candidate)) continue;
      if (candidate.length >= 3 && /[a-zA-Z]/.test(candidate)) {
        location = candidate;
        break;
      }
    }
  }

  return {
    priceText: priceIdx !== -1 ? leaves[priceIdx] : null,
    location,
    areaText: areaIdx !== -1 ? leaves[areaIdx] : null,
  };
}

function buildTextCard($: $Root, $scope: $Scope, baseUrl: string, href: string): RawCard | null {
  const sourceUrl = resolveUrl(href, baseUrl);
  if (!sourceUrl) return null;
  const sourceListingId = parseZameenListingId(href) ?? parseZameenListingId(sourceUrl);
  if (!sourceListingId) return null;

  const anchor = $scope.find('a[href*="/Property/"]').first();
  const title =
    textOf(anchor.attr('title')) ??
    textOf($scope.find('img[alt]').first().attr('alt')) ??
    pickText($scope, SELECTORS.title);

  // Prefer per-element leaves; fall back to regex over the whole card text when
  // a field cannot be isolated (e.g. split markup).
  const fromLeaves = extractFromLeaves(leafTexts($, $scope));
  const fromText = extractZameenCardText($scope.text());
  const priceText = fromLeaves.priceText ?? fromText.priceText;
  const location = fromLeaves.location ?? fromText.location;
  const areaText = fromLeaves.areaText ?? fromText.areaText;

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

function buildCard($: $Root, $scope: $Scope, baseUrl: string, legacy: boolean): RawCard | null {
  const href = findHref($scope);
  if (!href) return null;
  return legacy
    ? buildLegacyCard($scope, baseUrl, href)
    : buildTextCard($, $scope, baseUrl, href);
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

  for (const selector of CARD_SELECTORS) {
    const legacy = selector === '[data-aut-id="itemBox"]';
    let elements: ReturnType<$Root>;
    try {
      elements = $(selector);
    } catch {
      continue; // unsupported selector for this cheerio build
    }
    elements.each((_, el) => {
      const card = buildCard($, $(el), baseUrl, legacy);
      if (!card || !card.sourceListingId || seen.has(card.sourceListingId)) return;
      seen.add(card.sourceListingId);
      cards.push(card);
    });
    if (cards.length > 0) break;
  }

  if (cards.length === 0) {
    for (const card of structuredFallback($, baseUrl)) {
      if (!card.sourceListingId || seen.has(card.sourceListingId)) continue;
      seen.add(card.sourceListingId);
      cards.push(card);
    }
  }

  return cards;
}
