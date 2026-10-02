import { NextResponse } from "next/server";

import { estimate } from "@/lib/estimate/engine";
import { resolveRateCards } from "@/lib/estimate/rates";
import type { EstimateInput, QualityTier } from "@/lib/estimate/types";
import { getProperty, getRateCards, getSectorRates } from "@/lib/queries";

export const dynamic = "force-dynamic";

const QUALITY_TIERS: QualityTier[] = ["economy", "standard", "premium"];

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sanitizeOverrides(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z0-9_]+$/i.test(key)) continue;
    const parsed = toNumber(raw);
    if (parsed != null) result[key] = parsed;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Reference data for the calculator form: sectors and (optionally) a property. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  const [{ rows: sectors, demo: sectorsDemo }, propertyResult] = await Promise.all([
    getSectorRates(),
    propertyId ? getProperty(propertyId) : Promise.resolve({ property: null, demo: false }),
  ]);

  const property = propertyResult.property;

  return NextResponse.json({
    demo: sectorsDemo || propertyResult.demo,
    sectors,
    property: property
      ? {
          id: property.id,
          title: property.title,
          sector: property.sector,
          area_sqft: property.area_sqft,
          area_value: property.area_value,
          area_unit: property.area_unit,
          price_pkr: property.price_pkr,
        }
      : null,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode = body.mode === "property" ? "property" : "manual";
  const requestedTier = typeof body.qualityTier === "string" ? body.qualityTier : "";
  const qualityTier: QualityTier = (QUALITY_TIERS as string[]).includes(requestedTier)
    ? (requestedTier as QualityTier)
    : "standard";

  const propertyId = typeof body.propertyId === "string" ? body.propertyId : undefined;
  const sector = typeof body.sector === "string" && body.sector ? body.sector : undefined;

  const [{ rows: rateRows, demo: ratesDemo }, { rows: sectorRows, demo: sectorsDemo }] =
    await Promise.all([getRateCards(), getSectorRates()]);

  const rateSet = resolveRateCards(rateRows);
  const sectorRate = sector
    ? (sectorRows.find((row) => row.sector === sector) ?? null)
    : null;

  const propertyResult =
    mode === "property" && propertyId
      ? await getProperty(propertyId)
      : { property: null, demo: false };

  let plotAreaMarla = toNumber(body.plotAreaMarla) ?? 0;
  if (plotAreaMarla <= 0 && propertyResult.property) {
    const property = propertyResult.property;
    if (property.area_sqft && property.area_sqft > 0) {
      plotAreaMarla = property.area_sqft / 272.25;
    } else if (property.area_unit === "marla" && property.area_value) {
      plotAreaMarla = property.area_value;
    }
  }

  if (!Number.isFinite(plotAreaMarla) || plotAreaMarla <= 0) {
    return NextResponse.json(
      { error: "A positive plot area (plotAreaMarla) is required." },
      { status: 400 },
    );
  }

  const input: EstimateInput = {
    mode,
    propertyId,
    sector,
    plotAreaMarla,
    coveredAreaSqft: toNumber(body.coveredAreaSqft),
    qualityTier,
    timelineMonths: toNumber(body.timelineMonths) ?? 12,
    includeLand: body.includeLand !== false,
    includeApprovals: body.includeApprovals !== false,
    applyProfessionalFees: body.applyProfessionalFees !== false,
    overrides: sanitizeOverrides(body.overrides),
  };

  const result = estimate(input, rateSet, {
    property: propertyResult.property,
    sectorRate,
  });

  return NextResponse.json({
    ...result,
    demo: ratesDemo || sectorsDemo || propertyResult.demo,
  });
}
