"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";

import DemoBadge from "@/components/DemoBadge";
import EstimateBreakdown from "@/components/EstimateBreakdown";
import type { SectorLandRateRow } from "@/lib/database.types";
import { formatPkr } from "@/lib/estimate/format";
import type { EstimateResult, QualityTier } from "@/lib/estimate/types";

interface PropertySummary {
  id: string;
  title: string | null;
  sector: string | null;
  area_sqft: number | null;
  area_value: number | null;
  area_unit: string | null;
  price_pkr: number | null;
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";

const TOGGLE_OVERRIDES = [
  { key: "grey_structure_rate_per_sqft", label: "Grey structure (PKR/sqft)" },
  { key: "finishing_rate_per_sqft", label: "Finishing (PKR/sqft)" },
  { key: "contingency_pct", label: "Contingency (%)" },
] as const;

function CalculatorInner() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") ?? undefined;
  const sectorParam = searchParams.get("sector") ?? undefined;

  const [sectors, setSectors] = useState<SectorLandRateRow[]>([]);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [demo, setDemo] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [mode, setMode] = useState<"property" | "manual">(
    propertyId ? "property" : "manual",
  );
  const [sector, setSector] = useState(sectorParam ?? "");
  const [plotAreaMarla, setPlotAreaMarla] = useState("10");
  const [coveredAreaSqft, setCoveredAreaSqft] = useState("");
  const [qualityTier, setQualityTier] = useState<QualityTier>("standard");
  const [timelineMonths, setTimelineMonths] = useState("12");
  const [includeLand, setIncludeLand] = useState(true);
  const [includeApprovals, setIncludeApprovals] = useState(true);
  const [applyProfessionalFees, setApplyProfessionalFees] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingMeta(true);
      try {
        const params = new URLSearchParams();
        if (propertyId) params.set("propertyId", propertyId);
        if (sectorParam) params.set("sector", sectorParam);
        const query = params.toString();
        const response = await fetch(`/api/estimate${query ? `?${query}` : ""}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;

        setSectors((data.sectors ?? []) as SectorLandRateRow[]);
        setDemo(Boolean(data.demo));

        if (data.property) {
          const summary = data.property as PropertySummary;
          setProperty(summary);
          setMode("property");
          if (summary.sector) setSector(summary.sector);
          const marla = summary.area_sqft
            ? summary.area_sqft / 272.25
            : summary.area_unit === "marla" && summary.area_value
              ? summary.area_value
              : null;
          if (marla) setPlotAreaMarla(String(Math.round(marla * 100) / 100));
        } else if (sectorParam) {
          setSector(sectorParam);
        }
      } catch {
        if (!cancelled) setMetaError("Could not load reference data.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, sectorParam]);

  const selectedSector = useMemo(
    () => sectors.find((row) => row.sector === sector) ?? null,
    [sectors, sector],
  );

  const sectorOptions = useMemo(() => {
    const names = sectors.map((row) => row.sector);
    if (sector && !names.includes(sector)) names.unshift(sector);
    return names;
  }, [sectors, sector]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const numericOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value.trim() === "") continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) numericOverrides[key] = parsed;
    }

    const payload = {
      mode,
      propertyId: mode === "property" ? propertyId : undefined,
      sector: sector || undefined,
      plotAreaMarla: Number(plotAreaMarla),
      coveredAreaSqft: coveredAreaSqft.trim() === "" ? undefined : Number(coveredAreaSqft),
      qualityTier,
      timelineMonths: Number(timelineMonths),
      includeLand,
      includeApprovals,
      applyProfessionalFees,
      overrides: Object.keys(numericOverrides).length > 0 ? numericOverrides : undefined,
    };

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Estimate request failed.",
        );
      }
      setResult(data as EstimateResult);
      setDemo(Boolean((data as { demo?: boolean }).demo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Estimate request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Cost to build a house
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Itemised estimate covering land, transfer costs, approvals, construction,
            professional fees, contingency and escalation.
          </p>
        </div>
        {demo ? <DemoBadge /> : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/50 p-5 lg:sticky lg:top-20 lg:self-start"
        >
          {property ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
              <p className="font-medium text-emerald-200">
                {property.title ?? "Selected property"}
              </p>
              <p className="mt-0.5 text-xs text-emerald-200/80">
                {property.sector ?? "—"} · {formatPkr(property.price_pkr)} listed
              </p>
            </div>
          ) : null}

          <fieldset>
            <legend className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Land source
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                  mode === "manual"
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="manual"
                  checked={mode === "manual"}
                  onChange={() => setMode("manual")}
                  className="sr-only"
                />
                Sector / manual
              </label>
              <label
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                  mode === "property"
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 text-slate-300"
                } ${propertyId ? "" : "cursor-not-allowed opacity-50"}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="property"
                  checked={mode === "property"}
                  disabled={!propertyId}
                  onChange={() => setMode("property")}
                  className="sr-only"
                />
                Listed property
              </label>
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Sector
            </span>
            <select
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className={inputClass}
              disabled={loadingMeta}
            >
              <option value="">Fallback rate (no sector)</option>
              {sectorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {selectedSector?.median_price_per_marla != null ? (
              <span className="mt-1 block text-xs text-slate-500">
                Median {formatPkr(selectedSector.median_price_per_marla)} / marla
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Plot area (marla)
              </span>
              <input
                type="number"
                min={0}
                step="0.5"
                required
                value={plotAreaMarla}
                onChange={(event) => setPlotAreaMarla(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Timeline (months)
              </span>
              <input
                type="number"
                min={0}
                step="1"
                value={timelineMonths}
                onChange={(event) => setTimelineMonths(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Covered area (sqft) — optional
            </span>
            <input
              type="number"
              min={0}
              step="10"
              value={coveredAreaSqft}
              onChange={(event) => setCoveredAreaSqft(event.target.value)}
              placeholder="Defaults to 90% of plot area"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Finishing quality
            </span>
            <select
              value={qualityTier}
              onChange={(event) => setQualityTier(event.target.value as QualityTier)}
              className={inputClass}
            >
              <option value="economy">Economy</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Include
            </legend>
            <Toggle
              label="Land purchase cost"
              checked={includeLand}
              onChange={setIncludeLand}
            />
            <Toggle
              label="Approvals & utility connections"
              checked={includeApprovals}
              onChange={setIncludeApprovals}
            />
            <Toggle
              label="Professional fees"
              checked={applyProfessionalFees}
              onChange={setApplyProfessionalFees}
            />
          </fieldset>

          <details className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">
              Advanced rate overrides
            </summary>
            <div className="mt-3 space-y-3">
              {TOGGLE_OVERRIDES.map((item) => (
                <label key={item.key} className="block">
                  <span className="mb-1 block text-xs text-slate-500">{item.label}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={overrides[item.key] ?? ""}
                    onChange={(event) =>
                      setOverrides((previous) => ({
                        ...previous,
                        [item.key]: event.target.value,
                      }))
                    }
                    placeholder="Use stored rate"
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </details>

          {error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {metaError ? (
            <p className="text-xs text-amber-300">{metaError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Estimating…" : "Estimate build cost"}
          </button>

          <p className="text-xs leading-relaxed text-slate-500">
            Disclaimer: all rates are editable estimates, not quotations. Verify current
            market rates, taxes and society charges before making financial decisions.
          </p>
        </form>

        <div>
          {result ? (
            <EstimateBreakdown result={result} />
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center">
              <div>
                <p className="text-slate-300">Your itemised estimate appears here.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Pick a sector or open a listing, then press &ldquo;Estimate build cost&rdquo;.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-slate-950 text-emerald-500 focus:ring-emerald-400/30"
      />
      {label}
    </label>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-slate-400">Loading calculator…</p>
        </div>
      }
    >
      <CalculatorInner />
    </Suspense>
  );
}
