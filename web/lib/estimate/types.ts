export type QualityTier = "economy" | "standard" | "premium";

export type EstimateMode = "property" | "manual";

/** Request body accepted by `POST /api/estimate` and consumed by `estimate()`. */
export interface EstimateInput {
  mode: EstimateMode;
  propertyId?: string;
  sector?: string;
  /** Plot size in marla. 1 marla = 272.25 sqft. */
  plotAreaMarla: number;
  /** Optional explicit covered area, in sqft. Defaults to plot * covered ratio. */
  coveredAreaSqft?: number;
  qualityTier: QualityTier;
  /** Build timeline in months, used for escalation. */
  timelineMonths: number;
  /** Include land purchase cost. Default: true. */
  includeLand?: boolean;
  /** Include approvals & utility connection costs. Default: true. */
  includeApprovals?: boolean;
  /** Include architect / engineer / PM fees. Default: true. */
  applyProfessionalFees?: boolean;
  /** Rate overrides keyed by `rate_cards.key`. Overrides win over DB values. */
  overrides?: Record<string, number>;
}

/** Normalised inputs echoed back on the estimate result. */
export interface ResolvedInputs extends EstimateInput {
  plotAreaSqft: number;
  coveredAreaSqft: number;
  includeLand: boolean;
  includeApprovals: boolean;
  applyProfessionalFees: boolean;
}

export interface EstimateLine {
  category: string;
  label: string;
  amountPkr: number;
  detail?: string;
}

export interface EstimateResult {
  inputs: ResolvedInputs;
  lines: EstimateLine[];
  subtotalPkr: number;
  contingencyPkr: number;
  escalationPkr: number;
  totalPkr: number;
  lowPkr: number;
  highPkr: number;
  perSqftPkr: number;
  ratesUsed: Record<string, number>;
}

/** Lightweight property shape passed into the pure estimator. */
export interface EstimatePropertyContext {
  id: string;
  price_pkr: number | null;
  sector: string | null;
}

/** Lightweight sector-rate shape passed into the pure estimator. */
export interface EstimateSectorContext {
  sector: string;
  median_price_per_marla: number | null;
}

export interface EstimateContext {
  property?: EstimatePropertyContext | null;
  sectorRate?: EstimateSectorContext | null;
}
