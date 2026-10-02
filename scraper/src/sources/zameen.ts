// Zameen.com source: builds paginated search URLs, fetches them through
// Playwright, runs the pure parser and maps cards to ScrapedListing.

import type { Page } from 'playwright';
import type { ScrapedListing, ScrapeOptions, SourceScrapeOutput } from '../types.js';
import { parseZameenHtml } from '../parsers/zameen.js';
import { extractCoordinates, toScrapedListing } from '../lib/normalize.js';
import { createBrowserSession, fetchHtml } from '../lib/browser.js';

const BASE = 'https://www.zameen.com';

/** Islamabad plots: https://www.zameen.com/Plots/Islamabad-3-1.html */
export function buildZameenUrl(city: string, page: number): string {
  const slug = city.trim().replace(/\s+/g, '-');
  const citySlug = slug.charAt(0).toUpperCase() + slug.slice(1);
  return `${BASE}/Plots/${citySlug}-3-${page}.html`;
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

export async function scrapeZameen(opts: ScrapeOptions): Promise<SourceScrapeOutput> {
  const session = await createBrowserSession();
  const listings: ScrapedListing[] = [];
  const pageErrors: string[] = [];
  let pagesFetched = 0;

  try {
    const page = await session.context.newPage();
    for (let current = 1; current <= opts.maxPages; current++) {
      const url = buildZameenUrl(opts.city, current);
      try {
        const html = await fetchHtml(page, url);
        pagesFetched++;
        for (const card of parseZameenHtml(html, url)) {
          const listing = toScrapedListing(card, {
            source: 'zameen',
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
