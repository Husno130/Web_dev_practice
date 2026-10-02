import Link from "next/link";

import DemoBadge from "@/components/DemoBadge";
import PropertyCard from "@/components/PropertyCard";
import Stat from "@/components/Stat";
import { getLatestProperties, getSectorRates } from "@/lib/queries";
import { formatPkr } from "@/lib/estimate/format";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Land",
    body: "The listed plot price, or the sector median price per marla when browsing manually.",
  },
  {
    title: "Transfer & approvals",
    body: "Stamp duty, registration, CVT, brokerage, society NOCs, development charges and utility connections.",
  },
  {
    title: "Construction",
    body: "Grey structure plus finishing scaled by covered area and your economy / standard / premium tier.",
  },
  {
    title: "Buffer & time",
    body: "Professional fees, a contingency buffer and construction inflation over your build timeline.",
  },
];

export default async function HomePage() {
  const [{ rows: latest, total: totalListings, demo }, { rows: sectors }] =
    await Promise.all([getLatestProperties(6), getSectorRates()]);

  const medianMarla = sectors
    .map((sector) => sector.median_price_per_marla)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const marketMedian =
    medianMarla.length > 0
      ? medianMarla.slice().sort((a, b) => a - b)[Math.floor(medianMarla.length / 2)]
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <section className="max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Islamabad · plots &amp; build cost
          </span>
          {demo ? <DemoBadge /> : null}
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Know the true cost of building on your plot.
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Search Islamabad property plots, then estimate everything beyond the land
          price — transfer costs, approvals, construction and fees.
        </p>

        <form
          action="/properties"
          method="get"
          className="mt-8 flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-2 sm:flex-row"
        >
          <input
            type="search"
            name="q"
            placeholder="Search by sector, location or title…"
            className="flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            aria-label="Search properties"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Search plots
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/properties"
            className="rounded-lg border border-white/10 px-4 py-2 text-slate-300 transition hover:bg-white/5"
          >
            Browse all properties →
          </Link>
          <Link
            href="/calculator"
            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 font-medium text-emerald-300 transition hover:bg-emerald-400/20"
          >
            Open cost calculator →
          </Link>
        </div>
      </section>

      <dl className="mt-12 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Listings indexed"
          value={totalListings.toLocaleString("en-US")}
          hint="Active listings, newest first"
        />
        <Stat label="Sectors tracked" value={sectors.length} hint="Sector medians power manual estimates" />
        <Stat
          label="Median land price"
          value={marketMedian != null ? formatPkr(marketMedian) : "—"}
          hint="Per marla, across tracked sectors"
        />
      </dl>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Newest listings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ordered by when the listing was last seen.
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            View all →
          </Link>
        </div>

        {latest.length === 0 ? (
          <p className="mt-6 rounded-xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">
            No listings yet. Run the scraper, or set Supabase env vars to load live data.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16 rounded-3xl border border-white/10 bg-slate-900/40 p-6 sm:p-10">
        <h2 className="text-2xl font-semibold text-white">How the estimate works</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          The calculator builds a line-by-line budget from editable rate cards, so you can
          see exactly where the money goes and adjust assumptions as the market moves.
        </p>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-300">
                {index + 1}
              </span>
              <h3 className="mt-3 font-medium text-slate-100">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
