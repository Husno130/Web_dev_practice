# Islamabad Property Scraper

Scrapes **residential plot listings** in Islamabad from
[Zameen.com](https://www.zameen.com) and [Graana.com](https://www.graana.com)
and upserts them into Supabase via the RPCs defined in
[`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql):

- `upsert_property_batch(p_source text, p_items jsonb)` — batch insert/update
  (also records price changes in `price_history`).
- `deactivate_stale_properties(p_source text, p_seen_before timestamptz)` —
  marks listings not seen in the current run inactive.
- `scrape_runs` — one row per run, updated with final counts/status.

## Requirements

- Node.js 22+
- npm

## Install

```bash
cd scraper
npm install
npx playwright install chromium   # downloads the browser binary
```

If the Playwright browser download is blocked by the network, the parsers and
unit tests still work offline; only live scraping needs the browser.

## Configuration

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | for real runs | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for real runs | Service-role key (writes bypass RLS) |
| `PROXY_SERVER` | optional | Outbound proxy for Playwright, e.g. `http://user:pass@host:port` |

Without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, only `--dry-run` is
allowed.

## Usage

```bash
# Dry run: fetch + parse + print, no database writes
npm run scrape -- --source zameen --dry-run

# Real run (writes to Supabase)
npm run scrape -- --source zameen --city Islamabad --max-pages 5

# Graana, storing the raw card JSONB
npm run scrape -- --source graana --store-raw
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--source <zameen\|graana>` | — (required) | Which site to scrape |
| `--city <name>` | `Islamabad` | City to scrape |
| `--max-pages <n>` | `5` | Number of listing pages |
| `--delay-ms <n>` | `1500` | Politeness delay between pages |
| `--dry-run` | off | Fetch + parse + print, never touch the DB |
| `--store-raw` | off | Persist the raw card JSONB in `properties.raw` |
| `--enrich-detail` | off | Visit detail pages to fill latitude/longitude |
| `-h`, `--help` | | Show help |

### Run behaviour

1. Insert a `running` row into `scrape_runs` (unless `--dry-run`).
2. Fetch each listing page with Playwright, parse with cheerio.
3. Normalise prices/areas/sectors, dedupe by `source_listing_id` within the run.
4. `upsert_property_batch(...)`.
5. `deactivate_stale_properties(source, runStartedAt)`.
6. Update the run row with counts and status (`success` / `partial` / `failed`).
7. Print a summary; exit non-zero on fatal error.

## Architecture

```
src/
  index.ts            CLI orchestrator (arg parsing, run lifecycle, summary)
  types.ts            RawCard / ScrapedListing / ScrapeOptions types
  lib/
    units.ts          parseArea() + unit conversion constants
    normalize.ts      parsePricePkr(), extractSector(), content hash, mapping
    supabase.ts       Supabase client + upsertBatch/deactivateStale/run logging
    browser.ts        Playwright launch, resource blocking, retrying fetch
  parsers/
    zameen.ts         parseZameenHtml(html, baseUrl) -> RawCard[]   (pure)
    graana.ts         parseGraanaHtml(html, baseUrl) -> RawCard[]   (pure)
  sources/
    zameen.ts         URL building + fetch + parse + map
    graana.ts         URL building + fetch + parse + map
test/
  fixtures/           Invented but realistic HTML for offline parser tests
  normalize.test.ts   Units, prices, sectors, hashing
  parsers.test.ts     Fixture parsing + normalisation integration
```

The **parsers are pure functions** (HTML in, `RawCard[]` out) so they can be
tested offline with fixtures. Only `sources/` touch the network/browser.

### Unit conversions

| Unit | sq ft |
| --- | --- |
| 1 marla | 272.25 |
| 1 kanal | 5445 (= 20 marla) |
| 1 sq yd (gaz) | 9 |
| 1 sq m | 10.7639 |

### `p_items` contract

Each object passed to `upsert_property_batch` has exactly these keys (null when
unknown): `source_listing_id`, `source_url`, `title`, `description`, `purpose`,
`property_type`, `price_pkr`, `city`, `location`, `sector`, `area_value`,
`area_unit`, `area_sqft`, `bedrooms`, `bathrooms`, `latitude`, `longitude`,
`content_hash`, and `raw` (only with `--store-raw`).

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test via tsx
npm run build       # emit JS + d.ts to dist/ (optional; runtime uses tsx)
```

## Notes & caveats

- Site markup changes frequently. The parsers use multiple selector fallbacks
  and (for Zameen) a JSON-LD / `__NEXT_DATA__` fallback; Graana is explicitly
  best-effort.
- Be polite: keep `--delay-ms` at 1500ms or higher and scrape at a modest pace.
- Respect each site's Terms of Service and `robots.txt`.
