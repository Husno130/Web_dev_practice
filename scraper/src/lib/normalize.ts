// Normalisation helpers: price parsing, sector extraction, content hashing,
// coordinate extraction and raw-card -> ScrapedListing mapping.

import { createHash } from 'node:crypto';
import type { Purpose, RawCard, ScrapedListing, Source } from '../types.js';
import { parseArea } from './units.js';

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

// Exact word matches (not substrings) so e.g. "Kanal" can never be mistaken
// for the "k" multiplier.
const MULTIPLIERS: Array<{ words: string[]; factor: number }> = [
  { words: ['crore', 'cr', 'cror', 'karor'], factor: 10_000_000 },
  { words: ['lakh', 'lac', 'lacs', 'lakhs'], factor: 100_000 },
  // 1 Arab = 100 crore = 10^9 (Pakistani/Indian convention).
  { words: ['arab'], factor: 1_000_000_000 },
  { words: ['thousand', 'hazar', 'k'], factor: 1_000 },
];

function multiplierFor(word: string): number | null {
  const w = word.toLowerCase();
  for (const { words, factor } of MULTIPLIERS) {
    if (words.includes(w)) return factor;
  }
  return null;
}

/**
 * Parse a Pakistani/Indian-style price string into integer rupees.
 *
 * Handles colloquial multipliers ("1.5 Crore", "45 Lakh", "2 Arab"), currency
 * prefixes and Indian digit grouping ("PKR 2,50,00,000"). When a full,
 * explicitly grouped number is present it is preferred over multipliers.
 * Returns null when no number can be recovered.
 */
export function parsePricePkr(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = String(text).toLowerCase();
  if (!/\d/.test(s)) return null;

  // 1. Prefer an explicit number (>= 4 digits) with no decimal point.
  const groups = s.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  let bestPlain = 0;
  let foundPlain = false;
  for (const group of groups) {
    if (group.includes('.')) continue;
    const digits = group.replace(/,/g, '');
    if (digits.length >= 4) {
      const n = Number.parseInt(digits, 10);
      if (Number.isFinite(n)) {
        bestPlain = foundPlain ? Math.max(bestPlain, n) : n;
        foundPlain = true;
      }
    }
  }
  if (foundPlain) return bestPlain;

  // 2. Colloquial multiplier notation; sum multiple chunks (e.g. "5 Crore 50 Lakh").
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)) {
    const value = Number.parseFloat(m[1]);
    const factor = multiplierFor(m[2]);
    if (factor != null && Number.isFinite(value)) {
      total += value * factor;
      matched = true;
    }
  }
  if (matched) return Math.round(total);

  // 3. Fallback: strip everything that is not a digit.
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Sector / society extraction
// ---------------------------------------------------------------------------

const SOCIETIES: Array<{ re: RegExp; label: string }> = [
  { re: /\bbahria\b/i, label: 'Bahria Town' },
  { re: /\bdha\b/i, label: 'DHA Islamabad' },
  { re: /\bcapital\s+smart\s+city\b/i, label: 'Capital Smart City' },
  { re: /\btop\s+city\b/i, label: 'Top City' },
  { re: /\bmulti\s+gardens\b/i, label: 'Multi Gardens' },
  { re: /\bairport\s+enclave\b/i, label: 'Airport Enclave' },
  { re: /\bgulberg\b/i, label: 'Gulberg' },
  { re: /\bpwd\b/i, label: 'PWD' },
];

/**
 * Recognise a common Islamabad sector code ("G-13", "F-11/3", "I-8") or a
 * named society from a free-text location. Returns a normalised label or null.
 */
export function extractSector(location: string | null | undefined): string | null {
  if (!location) return null;
  const s = String(location);

  for (const { re, label } of SOCIETIES) {
    if (re.test(s)) return label;
  }

  const sector = s.match(/\b([a-z])\s*-\s*(\d{1,2})(?:\b|\/)/i);
  if (sector) return `${sector[1].toUpperCase()}-${Number(sector[2])}`;

  // "B17" / "B 17" without a hyphen.
  const b17 = s.match(/\bb\s*-?\s*17\b/i);
  if (b17) return 'B-17';

  return null;
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Deterministic short hash over the stable fields of a listing. */
export function computeContentHash(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------------------
// Detail-page coordinates (used by --enrich-detail)
// ---------------------------------------------------------------------------

export function extractCoordinates(
  html: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!html) return null;
  const latFirst = html.match(
    /["']?latitude["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)["']?[\s\S]{0,160}?["']?longitude["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)/i,
  );
  if (latFirst) {
    return { latitude: Number(latFirst[1]), longitude: Number(latFirst[2]) };
  }
  const lngFirst = html.match(
    /["']?longitude["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)["']?[\s\S]{0,160}?["']?latitude["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)/i,
  );
  if (lngFirst) {
    return { latitude: Number(lngFirst[2]), longitude: Number(lngFirst[1]) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Raw card -> ScrapedListing
// ---------------------------------------------------------------------------

const RENT_RE = /\b(rent|rented|rental)\b/i;

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

function inferPurpose(card: RawCard, fallback: Purpose): Purpose {
  const explicit = (card.purpose ?? '').toLowerCase();
  if (explicit.includes('rent')) return 'rent';
  if (explicit.includes('sale') || explicit.includes('sell')) return 'sale';

  const haystack = `${card.title ?? ''} ${card.description ?? ''} ${card.sourceUrl ?? ''}`;
  if (RENT_RE.test(haystack)) return 'rent';
  return fallback;
}

export interface ToScrapedOptions {
  source: Source;
  city: string;
  defaultPurpose?: Purpose;
  storeRaw?: boolean;
}

/**
 * Turn a parser-level RawCard into the normalised ScrapedListing shape.
 * Returns null when the card lacks the identity fields the schema requires.
 */
export function toScrapedListing(
  card: RawCard,
  opts: ToScrapedOptions,
): ScrapedListing | null {
  if (!card.sourceListingId || !card.sourceUrl) return null;

  const purpose = inferPurpose(card, opts.defaultPurpose ?? 'sale');
  const area = parseArea(card.areaText);
  const price = parsePricePkr(card.priceText);
  const location = clean(card.location);
  const sector = extractSector(location);
  const title = clean(card.title);
  const description = clean(card.description);

  const contentHash = computeContentHash({
    title,
    description,
    purpose,
    location,
    sector,
    price,
    area_sqft: area.area_sqft,
    area_unit: area.area_unit,
  });

  const listing: ScrapedListing = {
    source_listing_id: card.sourceListingId,
    source_url: card.sourceUrl,
    title,
    description,
    purpose,
    property_type: clean(card.propertyType) ?? 'plot',
    price_pkr: price,
    city: opts.city,
    location,
    sector,
    area_value: area.area_value,
    area_unit: area.area_unit,
    area_sqft: area.area_sqft,
    bedrooms: card.bedrooms ?? null,
    bathrooms: card.bathrooms ?? null,
    latitude: card.latitude ?? null,
    longitude: card.longitude ?? null,
    content_hash: contentHash,
  };

  if (opts.storeRaw && card.raw !== undefined) listing.raw = card.raw;
  return listing;
}
