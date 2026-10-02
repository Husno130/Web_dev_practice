// Graana.com source: paginated search URL (?page=N), Playwright fetch, pure
// parser and mapping to ScrapedListing. Graana is treated as best-effort.

import type { Page } from 'playwright';
import type { ScrapedListing, ScrapeOptions, SourceScrapeOutput } from '../types.js';
import { parseGraanaHtml } from '../parsers/graana.js';
import { extractCoordinates, toScrapedListing } from '../lib/normalize.js';
import { createBrowserSession, fetchHtml } from '../lib/browser.js';

const BASE = 'https://www.graana.com';

/** https://www.graana.com/sale/islamabad/plots/ and ?page=N for later pages. */
export function buildGraanaUrl(city: string, page: number): string {
  const slug = city.trim().toLowerCase().replace(/\s+/g, '-');
  const base = `${BASE}/sale/${slug}/plots/`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

async function enrichListings(
  page: Page,
  listings: ScrapedListing[],
  delayMs: number,
): Promise<void> {
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

export async function scrapeGraana(opts: ScrapeOptions): Promise<SourceScrapeOutput> {
  const session = await createBrowserSession();
  const listings: ScrapedListing[] = [];
  const pageErrors: string[] = [];
  let pagesFetched = 0;

  try {
    const page = await session.context.newPage();
    for (let current = 1; current <= opts.maxPages; current++) {
      const url = buildGraanaUrl(opts.city, current);
      try {
        const html = await fetchHtml(page, url);
        pagesFetched++;
        for (const card of parseGraanaHtml(html, url)) {
          const listing = toScrapedListing(card, {
            source: 'graana',
            city: opts.city,
            storeRaw: opts.storeRaw,
          });
          if (listing) listings.push(listing);
        }
      } catch (error) {
        pageErrors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (current < opts.maxPages && opts.delayMs > 0) {
        await page.waitForTimeout(opts.delayMs);
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
