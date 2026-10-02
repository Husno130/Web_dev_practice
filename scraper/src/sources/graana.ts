// Graana.com source.
//
// Graana server-renders only the first results page and paginates on the client
// by calling its Next.js data endpoint:
//   /_next/data/<buildId>/sale/plot-sale-islamabad-1.json?purpose=sale&id=plot-sale-islamabad-1&pageSize=30&page=N
// We therefore load page 1 in the browser (which also satisfies Cloudflare and
// gives us a same-origin context), read the embedded __NEXT_DATA__ for the
// buildId + first 30 listings, then fetch subsequent pages as JSON from inside
// that page. The older HTML parser is kept as a fallback.

import type { Page } from 'playwright';
import type { ScrapedListing, ScrapeOptions, SourceScrapeOutput } from '../types.js';
import {
  extractGraanaNextData,
  parseGraanaHtml,
  parseGraanaProperties,
  type GraanaNextData,
} from '../parsers/graana.js';
import { extractCoordinates, toScrapedListing } from '../lib/normalize.js';
import { createBrowserSession, fetchHtml } from '../lib/browser.js';

const BASE = 'https://www.graana.com';
const PAGE_SIZE = 30;

/** Known Graana purpose+type+city slugs. Islamabad is the supported city. */
const CITY_SLUGS: Record<string, string> = {
  islamabad: 'plot-sale-islamabad-1',
};

function citySlug(city: string): string {
  const key = city.trim().toLowerCase();
  return CITY_SLUGS[key] ?? `plot-sale-${key.replace(/\s+/g, '-')}-1`;
}

/** Human-facing search URL, e.g. https://www.graana.com/sale/plot-sale-islamabad-1/ */
export function buildGraanaSearchUrl(city: string): string {
  return `${BASE}/sale/${citySlug(city)}/`;
}

/** Relative search path used by the Next data endpoint, e.g. "sale/plot-sale-islamabad-1". */
export function graanaSearchPath(city: string): string {
  return `sale/${citySlug(city)}`;
}

/** Paginated Next.js data endpoint for page N (N >= 1). */
export function buildGraanaDataUrl(buildId: string, searchPath: string, page: number): string {
  const id = searchPath.split('/').pop() ?? searchPath;
  const params = new URLSearchParams({
    purpose: 'sale',
    id,
    pageSize: String(PAGE_SIZE),
    page: String(page),
  });
  return `${BASE}/_next/data/${buildId}/${searchPath}.json?${params.toString()}`;
}

/** Page N of the plain HTML route (only page 1 carries data server-side). */
export function buildGraanaUrl(city: string, _page: number): string {
  return buildGraanaSearchUrl(city);
}

function propertiesFromEndpointJson(parsed: unknown): Record<string, unknown>[] {
  const asRecord = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const root = asRecord(parsed);
  if (!root) return [];
  // The _next/data response is `{ pageProps, __N_SSP }`; guard the wrapped shape too.
  const direct = asRecord(root.pageProps)?.properties;
  if (Array.isArray(direct)) return direct as Record<string, unknown>[];
  const wrapped = asRecord(asRecord(root.props)?.pageProps)?.properties;
  return Array.isArray(wrapped) ? (wrapped as Record<string, unknown>[]) : [];
}

async function fetchJsonViaPage(page: Page, url: string): Promise<Record<string, unknown>[]> {
  const text = await page.evaluate(async (target) => {
    const response = await fetch(target, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${target}`);
    return response.text();
  }, url);
  return propertiesFromEndpointJson(JSON.parse(text));
}

async function enrichListings(page: Page, listings: ScrapedListing[], delayMs: number): Promise<void> {
  for (const listing of listings) {
    try {
      const html = await fetchHtml(page, listing.source_url, { attempts: 2 });
      const coords = extractCoordinates(html);
      if (coords) {
        listing.latitude = coords.latitude;
        listing.longitude = coords.longitude;
      }
    } catch {
      // best effort only
    }
    if (delayMs > 0) await page.waitForTimeout(delayMs);
  }
}

function collectCards(
  cards: ReturnType<typeof parseGraanaProperties>,
  city: string,
  storeRaw: boolean,
  listings: ScrapedListing[],
): void {
  for (const card of cards) {
    const listing = toScrapedListing(card, { source: 'graana', city, storeRaw });
    if (listing) listings.push(listing);
  }
}

export async function scrapeGraana(opts: ScrapeOptions): Promise<SourceScrapeOutput> {
  const session = await createBrowserSession();
  const listings: ScrapedListing[] = [];
  const pageErrors: string[] = [];
  let pagesFetched = 0;

  try {
    const page = await session.context.newPage();
    const searchUrl = buildGraanaSearchUrl(opts.city);
    const searchPath = graanaSearchPath(opts.city);

    let nextData: GraanaNextData | null = null;
    try {
      const html = await fetchHtml(page, searchUrl);
      pagesFetched++;
      nextData = extractGraanaNextData(html);

      if (nextData && nextData.properties.length > 0) {
        collectCards(parseGraanaProperties(nextData.properties), opts.city, opts.storeRaw, listings);
      } else {
        // Fallback: no embedded payload, scrape the rendered DOM.
        collectCards(parseGraanaHtml(html, searchUrl), opts.city, opts.storeRaw, listings);
      }
    } catch (error) {
      pageErrors.push(`${searchUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Subsequent pages via the Next data endpoint (client-side pagination).
    if (nextData?.buildId) {
      for (let current = 2; current <= opts.maxPages; current++) {
        const dataUrl = buildGraanaDataUrl(nextData.buildId, searchPath, current);
        try {
          const properties = await fetchJsonViaPage(page, dataUrl);
          if (properties.length === 0) break;
          pagesFetched++;
          collectCards(parseGraanaProperties(properties), opts.city, opts.storeRaw, listings);
        } catch (error) {
          pageErrors.push(`${dataUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (current < opts.maxPages && opts.delayMs > 0) {
          await page.waitForTimeout(opts.delayMs);
        }
      }
    }

    if (opts.enrichDetail && listings.length > 0) {
      await enrichListings(page, listings, opts.delayMs);
    }
  } finally {
    await session.close();
  }

  return { listings, pagesFetched, pageErrors };
}
