#!/usr/bin/env node
// CLI orchestrator: parse args -> fetch+parse -> dedupe -> upsert -> deactivate
// stale -> log the run. Run with `npm run scrape -- --source zameen`.

import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

import type { ScrapedListing, ScrapeOptions, Source } from './types.js';
import { scrapeZameen } from './sources/zameen.js';
import { scrapeGraana } from './sources/graana.js';
import {
  createSupabaseClient,
  deactivateStale,
  finishScrapeRun,
  readSupabaseConfig,
  startScrapeRun,
  upsertBatch,
  type SupabaseConfig,
} from './lib/supabase.js';

const SOURCES: readonly Source[] = ['zameen', 'graana'];

export interface CliOptions extends ScrapeOptions {
  help: boolean;
}

const USAGE = `Usage: scrape --source <zameen|graana> [options]

Options:
  --source <zameen|graana>  Required. Which site to scrape.
  --city <name>             City to scrape (default: Islamabad).
  --max-pages <n>           Number of listing pages (default: 5).
  --delay-ms <n>            Politeness delay between pages (default: 1500).
  --dry-run                 Fetch + parse + print, but never touch the DB.
  --store-raw               Persist the raw card JSONB alongside each listing.
  --enrich-detail           Visit detail pages for latitude/longitude (off by default).
  -h, --help                Show this help.`;

export function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv];
  let source: string | undefined;
  let city = 'Islamabad';
  let maxPages = 5;
  let delayMs = 1500;
  let dryRun = false;
  let storeRaw = false;
  let enrichDetail = false;
  let help = false;

  const next = (i: number): string | undefined => args[i];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source') source = next(++i);
    else if (arg === '--city') city = next(++i) ?? city;
    else if (arg === '--max-pages') maxPages = Number.parseInt(next(++i) ?? '', 10);
    else if (arg === '--delay-ms') delayMs = Number.parseInt(next(++i) ?? '', 10);
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--store-raw') storeRaw = true;
    else if (arg === '--enrich-detail') enrichDetail = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg.startsWith('--source=')) source = arg.slice('--source='.length);
    else if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--max-pages='))
      maxPages = Number.parseInt(arg.slice('--max-pages='.length), 10);
    else if (arg.startsWith('--delay-ms='))
      delayMs = Number.parseInt(arg.slice('--delay-ms='.length), 10);
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`);
    else throw new Error(`Unexpected positional argument: ${arg}`);
  }

  if (!help) {
    if (!source || !SOURCES.includes(source as Source)) {
      throw new Error(`--source is required and must be one of: ${SOURCES.join(', ')}`);
    }
  }
  if (!Number.isFinite(maxPages) || maxPages < 1) maxPages = 5;
  if (!Number.isFinite(delayMs) || delayMs < 0) delayMs = 0;

  return {
    source: (source ?? 'zameen') as Source,
    city: city || 'Islamabad',
    maxPages,
    delayMs,
    dryRun,
    storeRaw,
    enrichDetail,
    help,
  };
}

/** Deduplicate listings by source_listing_id, keeping the last occurrence. */
export function dedupeListings(listings: ScrapedListing[]): ScrapedListing[] {
  const byId = new Map<string, ScrapedListing>();
  for (const listing of listings) byId.set(listing.source_listing_id, listing);
  return [...byId.values()];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printListingPreview(listings: ScrapedListing[], limit = 5): void {
  for (const listing of listings.slice(0, limit)) {
    const price = listing.price_pkr == null ? '?' : listing.price_pkr.toLocaleString('en-PK');
    const area = listing.area_sqft == null ? '?' : `${listing.area_sqft} sqft`;
    console.log(
      `  • ${listing.title ?? '(no title)'} | ${price} PKR | ${area} | ${listing.sector ?? '?'}`,
    );
  }
  if (listings.length > limit) console.log(`  … and ${listings.length - limit} more`);
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${errorMessage(error)}\n\n${USAGE}`);
    return 1;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const supabaseConfig: SupabaseConfig | null = readSupabaseConfig();
  if (!opts.dryRun && !supabaseConfig) {
    console.error(
      'Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for a real run.\n' +
        'Set them in scraper/.env (see .env.example) or pass --dry-run to scrape without writing.',
    );
    return 1;
  }

  const runStartedAt = new Date().toISOString();
  const scrape = opts.source === 'zameen' ? scrapeZameen : scrapeGraana;

  const client = supabaseConfig ? createSupabaseClient(supabaseConfig) : null;
  let runId: number | null = null;
  if (!opts.dryRun && client) {
    try {
      runId = await startScrapeRun(client, { source: opts.source, city: opts.city });
    } catch (error) {
      console.error(`Error: could not create scrape_runs row: ${errorMessage(error)}`);
      return 1;
    }
  }

  console.log(
    `Scraping ${opts.source} / ${opts.city} (max ${opts.maxPages} page(s), delay ${opts.delayMs}ms)` +
      `${opts.dryRun ? ' [dry-run]' : ''}…`,
  );

  try {
    const result = await scrape(opts);
    const unique = dedupeListings(result.listings);

    console.log(
      `Fetched ${result.pagesFetched} page(s); parsed ${result.listings.length} card(s), ` +
        `${unique.length} unique listing(s).`,
    );
    if (result.pageErrors.length > 0) {
      console.log(`Page errors (${result.pageErrors.length}):`);
      for (const err of result.pageErrors) console.log(`  ! ${err}`);
    }

    if (opts.dryRun) {
      printListingPreview(unique);
      console.log('Dry-run complete: no database writes performed.');
      return 0;
    }

    if (!client || runId == null) {
      throw new Error('internal error: database client was not initialised');
    }

    const upsert = await upsertBatch(client, opts.source, unique);
    const deactivated = await deactivateStale(client, opts.source, runStartedAt);
    const status: 'success' | 'partial' | 'failed' =
      result.pageErrors.length === 0
        ? 'success'
        : result.pagesFetched > 0
          ? 'partial'
          : 'failed';

    await finishScrapeRun(client, runId, {
      status,
      itemsFound: unique.length,
      inserted: upsert.inserted,
      updated: upsert.updated,
      deactivated,
      error: result.pageErrors.length ? result.pageErrors.join('; ').slice(0, 2000) : null,
    });

    console.log(
      `Done [${status}]. inserted=${upsert.inserted} updated=${upsert.updated} ` +
        `price_changes=${upsert.price_changes} deactivated=${deactivated} run_id=${runId}`,
    );
    return status === 'failed' ? 1 : 0;
  } catch (error) {
    const message = errorMessage(error);
    console.error(`Fatal: ${message}`);
    if (client && runId != null) {
      await finishScrapeRun(client, runId, {
        status: 'failed',
        itemsFound: 0,
        inserted: 0,
        updated: 0,
        deactivated: 0,
        error: message.slice(0, 2000),
      }).catch((finishError) => {
        console.error(`Additionally failed to update scrape_runs: ${errorMessage(finishError)}`);
      });
    }
    return 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  loadEnv();
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main };
