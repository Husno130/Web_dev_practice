import type { QualityTier } from "./types";

/**
 * Minimal shape the estimator needs from a `rate_cards` row. Both live DB rows
 * (`RateCardRow`) and the built-in defaults satisfy this structurally.
 */
export interface RateCardInput {
  category: string;
  key: string;
  label: string;
  value: number;
  unit?: string | null;
  quality_tier?: string | null;
}

export interface RateSet {
  /** Scalar (non tiered) rates keyed by `rate_cards.key`. */
  values: Record<string, number>;
  /** Resolved `finishing_rate_per_sqft` per quality tier. */
  finishing: Record<QualityTier, number>;
}

export const QUALITY_TIERS: QualityTier[] = ["economy", "standard", "premium"];

export const DEFAULT_FINISHING: Record<QualityTier, number> = {
  economy: 2500,
  standard: 4200,
  premium: 8000,
};

/**
 * Built-in defaults mirroring `supabase/seed.sql`. Used when Supabase is not
 * configured, or when a live query fails / omits a required key.
 */
export const DEFAULT_RATE_CARDS: RateCardInput[] = [
  // Land fallback (overridden per-sector by `sector_land_rates`) -------------
  {
    category: "land",
    key: "fallback_price_per_marla",
    label: "Fallback land price (per marla)",
    value: 2000000,
    unit: "PKR/marla",
    quality_tier: null,
  },

  // Transaction / acquisition costs -----------------------------------------
  { category: "transaction", key: "stamp_duty_pct", label: "Stamp duty", value: 3, unit: "%", quality_tier: null },
  { category: "transaction", key: "registration_pct", label: "Registration fee", value: 1, unit: "%", quality_tier: null },
  { category: "transaction", key: "cvtt_pct", label: "Capital value tax on transfer", value: 1, unit: "%", quality_tier: null },
  { category: "transaction", key: "agent_commission_pct", label: "Agent commission", value: 1.5, unit: "%", quality_tier: null },
  {
    category: "transaction",
    key: "legal_documentation_flat",
    label: "Legal & documentation",
    value: 75000,
    unit: "PKR",
    quality_tier: null,
  },

  // Approvals & utilities ----------------------------------------------------
  {
    category: "approvals",
    key: "building_plan_approval_per_sqft",
    label: "Building plan approval",
    value: 60,
    unit: "PKR/sqft",
    quality_tier: null,
  },
  { category: "approvals", key: "noc_flat", label: "NOC / society charges", value: 25000, unit: "PKR", quality_tier: null },
  {
    category: "approvals",
    key: "development_charges_flat",
    label: "Development charges",
    value: 300000,
    unit: "PKR",
    quality_tier: null,
  },
  {
    category: "approvals",
    key: "electricity_connection_flat",
    label: "Electricity connection",
    value: 250000,
    unit: "PKR",
    quality_tier: null,
  },
  { category: "approvals", key: "gas_connection_flat", label: "Gas connection", value: 150000, unit: "PKR", quality_tier: null },
  { category: "approvals", key: "water_connection_flat", label: "Water connection", value: 100000, unit: "PKR", quality_tier: null },

  // Construction (per covered sqft) ------------------------------------------
  {
    category: "construction",
    key: "grey_structure_rate_per_sqft",
    label: "Grey structure",
    value: 4000,
    unit: "PKR/sqft",
    quality_tier: null,
  },
  {
    category: "construction",
    key: "finishing_rate_per_sqft",
    label: "Finishing — economy",
    value: 2500,
    unit: "PKR/sqft",
    quality_tier: "economy",
  },
  {
    category: "construction",
    key: "finishing_rate_per_sqft",
    label: "Finishing — standard",
    value: 4200,
    unit: "PKR/sqft",
    quality_tier: "standard",
  },
  {
    category: "construction",
    key: "finishing_rate_per_sqft",
    label: "Finishing — premium",
    value: 8000,
    unit: "PKR/sqft",
    quality_tier: "premium",
  },
  { category: "construction", key: "material_share_pct", label: "Material share of construction", value: 60, unit: "%", quality_tier: null },
  { category: "construction", key: "labour_share_pct", label: "Labour share of construction", value: 40, unit: "%", quality_tier: null },

  // Professional fees --------------------------------------------------------
  { category: "professional", key: "architect_pct", label: "Architect fee", value: 2, unit: "%", quality_tier: null },
  {
    category: "professional",
    key: "structural_engineer_pct",
    label: "Structural engineer fee",
    value: 1,
    unit: "%",
    quality_tier: null,
  },
  {
    category: "professional",
    key: "project_management_pct",
    label: "Project management",
    value: 2,
    unit: "%",
    quality_tier: null,
  },

  // Contingency & escalation -------------------------------------------------
  { category: "contingency", key: "contingency_pct", label: "Contingency", value: 12, unit: "%", quality_tier: null },
  {
    category: "escalation",
    key: "annual_inflation_pct",
    label: "Construction inflation",
    value: 8,
    unit: "%/yr",
    quality_tier: null,
  },
  {
    category: "misc",
    key: "default_covered_area_ratio",
    label: "Covered area ratio",
    value: 0.9,
    unit: "ratio",
    quality_tier: null,
  },
];

/**
 * Collapse raw `rate_cards` rows into a lookup the engine can consume.
 *
 * - Tiered `finishing_rate_per_sqft` rows populate `finishing[<tier>]`.
 * - Every other row is treated as a scalar; the last non-tier row wins.
 * - Missing scalar keys are backfilled from `DEFAULT_RATE_CARDS` so the engine
 *   never has to deal with `undefined` rates.
 */
export function resolveRateCards(rows: RateCardInput[]): RateSet {
  const values: Record<string, number> = {};
  const finishing: Record<QualityTier, number> = { ...DEFAULT_FINISHING };

  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;

    const tier = (row.quality_tier ?? "").trim().toLowerCase();
    if (row.key === "finishing_rate_per_sqft" && isQualityTier(tier)) {
      finishing[tier] = value;
      continue;
    }
    if (!row.quality_tier) {
      values[row.key] = value;
    }
  }

  for (const fallback of DEFAULT_RATE_CARDS) {
    if (!fallback.quality_tier && values[fallback.key] === undefined) {
      values[fallback.key] = fallback.value;
    }
  }

  return { values, finishing };
}

export function isQualityTier(value: string): value is QualityTier {
  return (QUALITY_TIERS as string[]).includes(value);
}

/** Convenience accessor used inside the engine. */
export function rateOf(rateSet: RateSet, key: string): number {
  const value = rateSet.values[key];
  return Number.isFinite(value) ? value : 0;
}
