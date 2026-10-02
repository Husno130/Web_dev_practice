# Islamabad Property Cost Estimator

Scrapes residential **plots** in **Islamabad** from Zameen.com and Graana.com on a
schedule, stores them in Supabase, and presents a searchable site plus an
itemised **"cost to build a house on this plot"** estimator (land, taxes,
approvals, construction, professional fees, contingency and escalation).

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  GitHub Actions (cron)  │        │        Vercel            │
│  scraper/ (Node+Playwright)       │  web/ (Next.js 16)       │
│  Zameen / Graana ───────┼───┐    │  search · property page  │
└─────────────────────────┘   │    │  cost calculator         │
                              ▼    └────────────┬─────────────┘
                    ┌───────────────────────┐   │ anon key (RLS read)
                    │      Supabase         │◄──┘
                    │ properties · history  │
                    │ rate_cards · view     │
                    └───────────────────────┘
```

## Repository layout

| Path | What it is |
|---|---|
| `web/` | Next.js 16 (App Router) + TypeScript + Tailwind v4 site → deploys to Vercel |
| `scraper/` | Node 22 + TypeScript + Playwright scrapers → run by GitHub Actions |
| `supabase/migrations/` | Database schema, RLS, RPC functions |
| `supabase/seed.sql` | Editable Islamabad rate cards for the estimator |
| `.github/workflows/` | Scheduled scraping + monthly data pruning |

---

## 1. Supabase setup (free/hobby tier friendly)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the schema:
   - paste and run `supabase/migrations/0001_init.sql`
   - then paste and run `supabase/seed.sql`
3. Copy your **Project URL** and both API keys from *Project Settings → API*:
   - `anon` public key → used by the website (read-only thanks to RLS)
   - `service_role` secret key → used **only** by the scraper/CI

> The schema is designed for the free tier: no raw HTML is stored by default,
> `raw` is only written when you pass `--store-raw`, and a monthly job prunes old
> data. Frequent scraping also keeps the project from being paused for
> inactivity.

## 2. Run locally

```bash
# install everything
npm run install:all

# web — create web/.env.local from web/.env.example
cp web/.env.example web/.env.local

# scraper — create scraper/.env from scraper/.env.example
cp scraper/.env.example scraper/.env

npm run web:dev          # http://localhost:3000
npm run scrape:zameen    # dry-run first: add -- --dry-run
```

Without Supabase env vars the web app still runs in **demo mode** using bundled
sample listings, so you can work on the UI with no backend.

## 3. Deploy the website to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Set **Root Directory** to `web`.
4. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy. `next build` runs automatically.

## 4. Schedule scraping with GitHub Actions

In the GitHub repo, add **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
| `PROXY_SERVER` *(optional)* | e.g. a residential proxy URL if Cloudflare blocks CI |

Workflows:
- `scrape-zameen.yml` — every 6 hours
- `scrape-graana.yml` — every 6 hours, staggered 30 min
- `maintenance.yml` — monthly pruning

You can trigger any of them manually via **Actions → Run workflow**.

## 5. Editing the estimator rates

The calculator reads assumptions from the `rate_cards` table — no redeploy
needed. Values are seeded with illustrative Islamabad market figures
(`supabase/seed.sql`); update them as rates move:

```sql
update public.rate_cards
   set value = 4500, effective_date = current_date
 where category = 'construction' and key = 'grey_structure_rate_per_sqft';
```

Land cost is derived live from scraped listings: `sector_land_rates` gives the
median PKR/marla per sector (only sectors with ≥ 3 active listings), and the
estimator falls back to `land.fallback_price_per_marla` when a sector has too
little data.

---

## Estimator logic (transparent, itemised)

1. **Land** — sector median PKR/marla × plot size, or the listing's own price.
2. **Transaction** — stamp duty + registration + CVT + agent commission (% of land) + legal.
3. **Approvals & utilities** — plan approval (per covered sqft) + NOC + development + electricity/gas/water connections.
4. **Construction** — covered area × (grey structure + finishing for the chosen quality tier).
5. **Professional fees** — architect + structural engineer + project management (% of construction).
6. **Contingency** — % of subtotal.
7. **Escalation** — construction inflation pro-rata over the build timeline.

Output: itemised lines, subtotal, contingency, escalation, total, a low/high
range (±15%) and PKR per sqft.

## Important caveats

- **Rates are estimates**, not quotes. They are editable and auditable (each row
  has an `effective_date` and `source_note`).
- **Scraping & terms of service:** Zameen and Graana use bot protection and their
  terms likely prohibit scraping. The scraper is polite (throttled, identifiable
  user agent, respects retries) but you should review the terms before any
  commercial use, and consider an official data feed or partnership.
- **Datacenter IPs** may be blocked by Cloudflare from GitHub Actions. If so, set
  the optional `PROXY_SERVER` secret or move scraping to a scheduled container.
- Free-tier limits: 500 MB database, ~5 GB egress/month. The design keeps listing
  rows small and prunes history; monitor usage in the Supabase dashboard.

## Troubleshooting

- **`Invalid path specified in request URL` (PGRST125):** your `SUPABASE_URL`
  includes `/rest/v1`. Use the bare project URL
  (`https://<ref>.supabase.co`) — the clients normalise this automatically now,
  but it is cleaner to store it correctly. If Vercel has the suffixed value, the
  site silently falls back to demo data until it is fixed/redeployed.
- **Playwright browser download fails:** set `CHROMIUM_EXECUTABLE_PATH` to a
  system Chrome/Chromium binary (e.g. `/usr/bin/chromium`) to run locally. CI
  installs the bundled browser via `npx playwright install --with-deps chromium`.
- **Zameen/Graana block CI:** both use bot protection; GitHub's datacenter IPs
  are often challenged. Set the optional `PROXY_SERVER` secret, or run the
  scraper from a machine/container with a residential IP.

## How the scrapers work

- **Zameen** renders results with hashed CSS classes. The parser reads each
  card's individual field elements (price, location, area) in document order —
  regexing the concatenated card text would merge a location ending in a digit
  with the following area (e.g. "Phase 2" + "1 Kanal" → "21 Kanal"),
  corrupting land-price medians.
- **Graana** server-renders only the first page; later pages come from its
  Next.js data endpoint
  (`/_next/data/<buildId>/sale/plot-sale-islamabad-1.json?...&page=N`). The
  scraper reads `__NEXT_DATA__` for the `buildId` and first 30 listings, then
  fetches subsequent pages as JSON from within the browser context.

## Roadmap

- [x] Schema, rate cards, scraper package, web app, estimator, CI
- [ ] Saved estimates + auth (Supabase magic link)
- [ ] Map view (PostGIS) and price-drop alerts
- [ ] Natural-language search (pgvector)
- [ ] Admin screen for editing rate cards
