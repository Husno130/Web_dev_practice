# PlotCost PK — web app

Next.js (App Router) + TypeScript + Tailwind CSS v4 front end for the Islamabad
property-data project.

Two things it does:

1. **Search Islamabad property plots** stored in Supabase (`/properties`), with a
   detail page per listing (`/properties/[id]`) including price history.
2. **Estimate the cost to build a house** (`/calculator`) from editable rate
   cards: land, transfer costs, approvals, construction, professional fees,
   contingency and escalation.

Reads use the Supabase **anon key only** and are never write operations. See
`../supabase/migrations/0001_init.sql` for the schema and `../supabase/seed.sql`
for the seeded rate cards.

## Works with and without Supabase

Set these to read live data:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

When either is missing (or a live query fails) the app automatically falls back
to the built-in dataset in `lib/demo-data.ts` and shows a subtle **demo data**
badge. This means `npm run build` succeeds with **no environment variables** —
important for preview/Vercel builds. Copy `.env.example` to `.env.local` to
configure.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (works with zero env vars)
npm run start      # serve the production build
npm run lint       # ESLint (flat config)
npm run typecheck  # tsc --noEmit
```

> Next.js 16 removed the `next lint` command; linting runs through ESLint
> directly (`eslint .`).

## Routes

| Route | Description |
| --- | --- |
| `/` | Hero search, newest listings, "how the estimate works" |
| `/properties` | Filterable, paginated search (20/page) |
| `/properties/[id]` | Full listing detail + price history |
| `/calculator` | Client-side estimator form + itemised breakdown |
| `POST /api/estimate` | Runs the pure estimator over rate cards |
| `GET /api/estimate` | Reference data (sectors, optional property) for the form |

### Search query params

`q`, `sector`, `minPrice`, `maxPrice`, `minArea` (marla), `maxArea` (marla),
`type`, `page`.

### Estimator request

```jsonc
{
  "mode": "property",          // or "manual"
  "propertyId": "…",           // when mode=property
  "sector": "DHA Defence Phase 2",
  "plotAreaMarla": 10,
  "coveredAreaSqft": 2450,     // optional; defaults to plot * ratio
  "qualityTier": "standard",   // economy | standard | premium
  "timelineMonths": 12,
  "includeLand": true,
  "includeApprovals": true,
  "applyProfessionalFees": true,
  "overrides": { "grey_structure_rate_per_sqft": 4300 }
}
```

`overrides` win over stored rate-card values. All money is returned as integer
PKR.

## Structure

```
app/                     routes (App Router)
  api/estimate/route.ts  estimator endpoint
components/              shared UI
lib/
  supabase/server.ts     anon-key client + isSupabaseConfigured
  database.types.ts      hand-written types matching the schema
  queries.ts             all Supabase reads + demo fallback
  estimate/              types, rate resolution, pure engine, formatting
  demo-data.ts           built-in sample listings, history and sector rates
```

The estimator engine (`lib/estimate/engine.ts`) is a pure function with no I/O,
which makes it straightforward to unit test and reuse.
