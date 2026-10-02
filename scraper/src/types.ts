// Shared types for the scraper. `ScrapedListing` mirrors, key-for-key, the
// p_items JSON contract consumed by public.upsert_property_batch().

export type Source = 'zameen' | 'graana';
export type Purpose = 'sale' | 'rent';
export type AreaUnit = 'marla' | 'kanal' | 'sqft' | 'sqyd';

/** Parser-level representation of a single listing card (pre-normalisation). */
export interface RawCard {
  sourceListingId: string | null;
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  purpose: string | null;
  propertyType: string | null;
  /** Raw price text as it appears on the page, e.g. "Rs 2,50,00,000". */
  priceText: string | null;
  location: string | null;
  /** Raw area text as it appears on the page, e.g. "1 Kanal". */
  areaText: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  /** Original card payload; only persisted when --store-raw is set. */
  raw?: unknown;
}

export interface ParsedArea {
  area_value: number | null;
  area_unit: AreaUnit | null;
  area_sqft: number | null;
}

/** Normalised listing matching the p_items contract. */
export interface ScrapedListing {
  source_listing_id: string;
  source_url: string;
  title: string | null;
  description: string | null;
  purpose: Purpose;
  property_type: string;
  price_pkr: number | null;
  city: string;
  location: string | null;
  sector: string | null;
  area_value: number | null;
  area_unit: AreaUnit | null;
  area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  content_hash: string;
  /** Only included when --store-raw is set. */
  raw?: unknown;
}

export interface ScrapeOptions {
  source: Source;
  city: string;
  maxPages: number;
  dryRun: boolean;
  storeRaw: boolean;
  enrichDetail: boolean;
  delayMs: number;
}

/** What a source scraper returns after walking its paginated listing pages. */
export interface SourceScrapeOutput {
  listings: ScrapedListing[];
  pagesFetched: number;
  pageErrors: string[];
}
