import Link from "next/link";

import DemoBadge from "@/components/DemoBadge";
import PropertyCard from "@/components/PropertyCard";
import SearchFilters from "@/components/SearchFilters";
import { getSectorRates, searchProperties } from "@/lib/queries";
import { SQFT_PER_MARLA } from "@/lib/estimate/engine";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search Islamabad plots",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function toNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildHref(
  base: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value != null && value !== "") params.set(key, value);
  }
  params.set("page", String(page));
  return `/properties?${params.toString()}`;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const q = first(sp.q)?.trim() || undefined;
  const sector = first(sp.sector)?.trim() || undefined;
  const type = first(sp.type)?.trim() || undefined;
  const minPrice = toNumber(first(sp.minPrice));
  const maxPrice = toNumber(first(sp.maxPrice));
  const minAreaMarla = toNumber(first(sp.minArea));
  const maxAreaMarla = toNumber(first(sp.maxArea));
  const page = Math.max(1, Math.floor(toNumber(first(sp.page)) ?? 1));

  const [{ rows, count, totalPages, page: currentPage, demo }, { rows: sectorRates }] =
    await Promise.all([
      searchProperties({
        q,
        sector,
        type,
        minPrice,
        maxPrice,
        minArea: minAreaMarla != null ? minAreaMarla * SQFT_PER_MARLA : undefined,
        maxArea: maxAreaMarla != null ? maxAreaMarla * SQFT_PER_MARLA : undefined,
        page,
      }),
      getSectorRates(),
    ]);

  const sectorNames = Array.from(
    new Set(
      sectorRates
        .map((rate) => rate.sector)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const baseParams: Record<string, string | undefined> = {
    q,
    sector,
    type,
    minPrice: first(sp.minPrice),
    maxPrice: first(sp.maxPrice),
    minArea: first(sp.minArea),
    maxArea: first(sp.maxArea),
  };

  const hasFilters = Object.values(baseParams).some(
    (value) => value != null && value !== "",
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Islamabad properties
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filter plots and houses, then estimate the build cost per listing.
          </p>
        </div>
        {demo ? <DemoBadge /> : null}
      </div>

      <div className="mt-6">
        <SearchFilters
          sectors={sectorNames}
          values={{
            q: first(sp.q),
            sector: first(sp.sector),
            type: first(sp.type),
            minPrice: first(sp.minPrice),
            maxPrice: first(sp.maxPrice),
            minArea: first(sp.minArea),
            maxArea: first(sp.maxArea),
          }}
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-400">
        <p>
          <span className="font-medium text-slate-200">{count.toLocaleString("en-US")}</span>{" "}
          {count === 1 ? "result" : "results"}
          {hasFilters ? " for your filters" : ""}
        </p>
        {totalPages > 1 ? (
          <p>
            Page {currentPage} of {totalPages}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-300">No properties matched your filters.</p>
          <p className="mt-1 text-sm text-slate-500">
            Try widening the price range or clearing the search term.
          </p>
          <Link
            href="/properties"
            className="mt-4 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-center gap-2"
        >
          {currentPage > 1 ? (
            <Link
              href={buildHref(baseParams, currentPage - 1)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              ← Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-white/5 px-3 py-2 text-sm text-slate-600">
              ← Previous
            </span>
          )}

          <span className="px-2 text-sm text-slate-400">
            {currentPage} / {totalPages}
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildHref(baseParams, currentPage + 1)}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-lg border border-white/5 px-3 py-2 text-sm text-slate-600">
              Next →
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
