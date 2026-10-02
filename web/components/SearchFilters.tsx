import Link from "next/link";

export interface SearchFilterValues {
  q?: string;
  sector?: string;
  type?: string;
  minPrice?: string;
  maxPrice?: string;
  minArea?: string;
  maxArea?: string;
}

export interface SearchFiltersProps {
  sectors: string[];
  values: SearchFilterValues;
}

const PROPERTY_TYPES = ["plot", "house", "flat", "shop", "office", "building"];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";

export default function SearchFilters({ sectors, values }: SearchFiltersProps) {
  return (
    <form
      method="get"
      action="/properties"
      className="rounded-2xl border border-white/10 bg-slate-900/50 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Search
          </span>
          <input
            type="search"
            name="q"
            defaultValue={values.q ?? ""}
            placeholder="Title, location or sector (e.g. DHA Phase 2)"
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Sector
          </span>
          <select name="sector" defaultValue={values.sector ?? ""} className={inputClass}>
            <option value="">All sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Type
          </span>
          <select name="type" defaultValue={values.type ?? ""} className={inputClass}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Min price (PKR)
          </span>
          <input
            type="number"
            name="minPrice"
            min={0}
            defaultValue={values.minPrice ?? ""}
            placeholder="e.g. 15000000"
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Max price (PKR)
          </span>
          <input
            type="number"
            name="maxPrice"
            min={0}
            defaultValue={values.maxPrice ?? ""}
            placeholder="e.g. 90000000"
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Min area (marla)
          </span>
          <input
            type="number"
            name="minArea"
            min={0}
            step="0.5"
            defaultValue={values.minArea ?? ""}
            placeholder="e.g. 8"
            className={inputClass}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Max area (marla)
          </span>
          <input
            type="number"
            name="maxArea"
            min={0}
            step="0.5"
            defaultValue={values.maxArea ?? ""}
            placeholder="e.g. 20"
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Apply filters
        </button>
        <Link
          href="/properties"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
