import { formatMonths, formatPkr } from "./format";
import { rateOf, type RateSet } from "./rates";
import type {
  EstimateContext,
  EstimateInput,
  EstimateLine,
  EstimateResult,
  QualityTier,
} from "./types";

export const SQFT_PER_MARLA = 272.25;

/**
 * Pure, deterministic build-cost estimator. No I/O, no clock reads.
 *
 * Implements the itemised algorithm from the project spec: land acquisition,
 * transfer costs, approvals & utilities, construction (grey structure +
 * finishing), professional fees, contingency and time-based escalation.
 */
export function estimate(
  input: EstimateInput,
  rates: RateSet,
  context: EstimateContext = {},
): EstimateResult {
  const overrides = input.overrides ?? {};

  const scalar = (key: string): number => {
    const override = overrides[key];
    if (typeof override === "number" && Number.isFinite(override)) return override;
    return rateOf(rates, key);
  };

  const finishingRate = (tier: QualityTier): number => {
    const override = overrides.finishing_rate_per_sqft;
    if (typeof override === "number" && Number.isFinite(override)) return override;
    const value = rates.finishing[tier];
    return Number.isFinite(value) ? value : 0;
  };

  const includeLand = input.includeLand !== false;
  const includeApprovals = input.includeApprovals !== false;
  const applyProfessionalFees = input.applyProfessionalFees !== false;
  const qualityTier: QualityTier = input.qualityTier;

  // 1. Areas -----------------------------------------------------------------
  const plotAreaMarla = Math.max(0, toFinite(input.plotAreaMarla));
  const plotAreaSqft = plotAreaMarla * SQFT_PER_MARLA;

  // 2. Covered area ----------------------------------------------------------
  const providedCovered = toOptionalFinite(input.coveredAreaSqft);
  const coveredAreaSqft = Math.max(
    0,
    providedCovered ?? plotAreaSqft * scalar("default_covered_area_ratio"),
  );

  // 3. Land ------------------------------------------------------------------
  let land = 0;
  let landLabel = "Land purchase";
  let landDetail = "";

  if (includeLand) {
    const listedPrice = context.property ? toOptionalFinite(context.property.price_pkr) : undefined;
    const median = context.sectorRate ? toOptionalFinite(context.sectorRate.median_price_per_marla) : undefined;

    if (input.mode === "property" && context.property && listedPrice !== undefined) {
      land = listedPrice;
      landLabel = "Land purchase (listed price)";
      landDetail = `${context.property.sector ?? "Listing"} · ${formatPkr(listedPrice)}`;
    } else if (context.sectorRate && median !== undefined) {
      land = median * plotAreaMarla;
      landLabel = `Land purchase (${context.sectorRate.sector} median)`;
      landDetail = `${formatPkr(median)}/marla × ${formatMarla(plotAreaMarla)}`;
    } else {
      const fallback = scalar("fallback_price_per_marla");
      land = fallback * plotAreaMarla;
      landLabel = "Land purchase (fallback rate)";
      landDetail = `${formatPkr(fallback)}/marla × ${formatMarla(plotAreaMarla)}`;
    }
  } else {
    landLabel = "Land purchase (excluded)";
    landDetail = "Land cost not included";
  }
  land = Math.round(land);

  // 4. Transaction costs (only when land > 0) --------------------------------
  const transferPct =
    scalar("stamp_duty_pct") +
    scalar("registration_pct") +
    scalar("cvtt_pct") +
    scalar("agent_commission_pct");
  const legalFlat = scalar("legal_documentation_flat");

  let transaction = 0;
  if (land > 0) {
    transaction = Math.round((land * transferPct) / 100 + legalFlat);
  }

  // 5. Approvals & utilities -------------------------------------------------
  let approvals = 0;
  if (includeApprovals) {
    approvals = Math.round(
      scalar("building_plan_approval_per_sqft") * coveredAreaSqft +
        scalar("noc_flat") +
        scalar("development_charges_flat") +
        scalar("electricity_connection_flat") +
        scalar("gas_connection_flat") +
        scalar("water_connection_flat"),
    );
  }

  // 6. Construction ----------------------------------------------------------
  const greyRate = scalar("grey_structure_rate_per_sqft");
  const finishRate = finishingRate(qualityTier);
  const constructionRate = greyRate + finishRate;
  const construction = Math.round(constructionRate * coveredAreaSqft);

  const materialSharePct = scalar("material_share_pct");
  const labourSharePct = scalar("labour_share_pct");
  const materialCost = Math.round((construction * materialSharePct) / 100);
  const labourCost = Math.round((construction * labourSharePct) / 100);

  // 7. Professional fees -----------------------------------------------------
  const professionalPct =
    scalar("architect_pct") +
    scalar("structural_engineer_pct") +
    scalar("project_management_pct");

  let professional = 0;
  if (applyProfessionalFees) {
    professional = Math.round((construction * professionalPct) / 100);
  }

  // 8. Subtotal --------------------------------------------------------------
  const subtotal = land + transaction + approvals + construction + professional;

  // 9. Contingency -----------------------------------------------------------
  const contingencyPct = scalar("contingency_pct");
  const contingency = Math.round((subtotal * contingencyPct) / 100);

  // 10. Escalation -----------------------------------------------------------
  const timelineMonths = Math.max(0, toFinite(input.timelineMonths));
  const annualInflationPct = scalar("annual_inflation_pct");
  const escalation = Math.round(
    ((construction * annualInflationPct) / 100) * (timelineMonths / 12),
  );

  // 11. Totals ---------------------------------------------------------------
  const total = subtotal + contingency + escalation;
  const low = Math.round(total * 0.85);
  const high = Math.round(total * 1.15);
  const perSqft = coveredAreaSqft > 0 ? Math.round(total / coveredAreaSqft) : 0;

  const lines: EstimateLine[] = [
    { category: "land", label: landLabel, amountPkr: land, detail: landDetail },
    {
      category: "transaction",
      label: "Transfer, duty & documentation",
      amountPkr: transaction,
      detail:
        land > 0
          ? `${round2(transferPct)}% of land + ${formatPkr(legalFlat)} legal`
          : "No land cost included",
    },
    {
      category: "approvals",
      label: "Approvals & utility connections",
      amountPkr: approvals,
      detail: includeApprovals
        ? `${formatSqft(coveredAreaSqft)} covered · ${formatPkr(scalar("building_plan_approval_per_sqft"))}/sqft + lump sums`
        : "Approvals excluded",
    },
    {
      category: "construction",
      label: `Construction (grey + ${qualityTier} finishing)`,
      amountPkr: construction,
      detail: `${formatSqft(coveredAreaSqft)} × ${formatPkr(constructionRate)}/sqft · materials ${formatPkr(
        materialCost,
      )} (${round2(materialSharePct)}%) / labour ${formatPkr(labourCost)} (${round2(labourSharePct)}%)`,
    },
    {
      category: "professional",
      label: "Professional fees",
      amountPkr: professional,
      detail: applyProfessionalFees
        ? `${round2(professionalPct)}% of construction (architect, structural, PM)`
        : "Professional fees excluded",
    },
    {
      category: "contingency",
      label: `Contingency (${round2(contingencyPct)}%)`,
      amountPkr: contingency,
      detail: "Buffer for price changes and extras",
    },
    {
      category: "escalation",
      label: `Escalation over ${formatMonths(timelineMonths)}`,
      amountPkr: escalation,
      detail: `${round2(annualInflationPct)}%/yr construction inflation`,
    },
  ];

  const ratesUsed: Record<string, number> = {
    plot_area_sqft_per_marla: SQFT_PER_MARLA,
    default_covered_area_ratio: scalar("default_covered_area_ratio"),
    fallback_price_per_marla: scalar("fallback_price_per_marla"),
    stamp_duty_pct: scalar("stamp_duty_pct"),
    registration_pct: scalar("registration_pct"),
    cvtt_pct: scalar("cvtt_pct"),
    agent_commission_pct: scalar("agent_commission_pct"),
    legal_documentation_flat: legalFlat,
    building_plan_approval_per_sqft: scalar("building_plan_approval_per_sqft"),
    noc_flat: scalar("noc_flat"),
    development_charges_flat: scalar("development_charges_flat"),
    electricity_connection_flat: scalar("electricity_connection_flat"),
    gas_connection_flat: scalar("gas_connection_flat"),
    water_connection_flat: scalar("water_connection_flat"),
    grey_structure_rate_per_sqft: greyRate,
    finishing_rate_per_sqft: finishRate,
    material_share_pct: materialSharePct,
    labour_share_pct: labourSharePct,
    architect_pct: scalar("architect_pct"),
    structural_engineer_pct: scalar("structural_engineer_pct"),
    project_management_pct: scalar("project_management_pct"),
    contingency_pct: contingencyPct,
    annual_inflation_pct: annualInflationPct,
  };

  return {
    inputs: {
      ...input,
      includeLand,
      includeApprovals,
      applyProfessionalFees,
      plotAreaSqft: round4(plotAreaSqft),
      coveredAreaSqft: round4(coveredAreaSqft),
    },
    lines,
    subtotalPkr: subtotal,
    contingencyPkr: contingency,
    escalationPkr: escalation,
    totalPkr: total,
    lowPkr: low,
    highPkr: high,
    perSqftPkr: perSqft,
    ratesUsed,
  };
}

function toFinite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toOptionalFinite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatSqft(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} sqft`;
}

function formatMarla(value: number): string {
  return `${round2(value).toLocaleString("en-US")} marla`;
}
