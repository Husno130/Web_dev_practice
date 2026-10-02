import type {
  PriceHistoryRow,
  PropertyRow,
  PropertySource,
  SectorLandRateRow,
} from "./database.types";

/**
 * Built-in demo dataset. Used whenever Supabase is not configured (or a live
 * query fails), so the app builds and renders with zero environment variables.
 * Values are illustrative, not authoritative.
 */

const SQFT_PER_MARLA = 272.25;

interface DemoSeed {
  sector: string;
  location: string;
  areaValue: number;
  areaUnit: "marla" | "kanal";
  pricePkr: number;
  propertyType: string;
  title: string;
  source: PropertySource;
  bedrooms?: number;
  bathrooms?: number;
  purpose?: "sale" | "rent";
}

const SEEDS: DemoSeed[] = [
  { sector: "DHA Defence Phase 2", location: "DHA Phase 2, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 42_000_000, propertyType: "plot", title: "10 Marla residential plot, DHA Phase 2", source: "zameen" },
  { sector: "DHA Defence Phase 5", location: "DHA Phase 5, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 88_000_000, propertyType: "plot", title: "1 Kanal prime plot, DHA Phase 5", source: "graana" },
  { sector: "DHA Defence Phase 1", location: "DHA Phase 1, Islamabad", areaValue: 8, areaUnit: "marla", pricePkr: 34_000_000, propertyType: "plot", title: "8 Marla plot on main boulevard, DHA 1", source: "zameen" },
  { sector: "Bahria Town Phase 8", location: "Bahria Town Phase 8, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 26_500_000, propertyType: "plot", title: "10 Marla developed plot, Bahria Phase 8", source: "graana" },
  { sector: "Bahria Town Phase 4", location: "Bahria Town Phase 4, Islamabad", areaValue: 7, areaUnit: "marla", pricePkr: 16_500_000, propertyType: "plot", title: "7 Marla plot near park, Bahria Phase 4", source: "zameen" },
  { sector: "Bahria Enclave", location: "Bahria Enclave, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 68_000_000, propertyType: "plot", title: "1 Kanal corner plot, Bahria Enclave", source: "graana" },
  { sector: "F-11", location: "F-11/1, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 95_000_000, propertyType: "plot", title: "1 Kanal plot in F-11/1", source: "zameen" },
  { sector: "E-11", location: "E-11/2, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 112_000_000, propertyType: "plot", title: "1 Kanal south-facing plot, E-11/2", source: "graana" },
  { sector: "D-12", location: "D-12/1, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 33_000_000, propertyType: "plot", title: "10 Marla plot, D-12/1", source: "zameen" },
  { sector: "G-13", location: "G-13/1, Islamabad", areaValue: 8, areaUnit: "marla", pricePkr: 24_000_000, propertyType: "plot", title: "8 Marla plot, G-13/1", source: "graana" },
  { sector: "G-14", location: "G-14/4, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 22_500_000, propertyType: "plot", title: "10 Marla plot, G-14/4", source: "zameen" },
  { sector: "Gulberg Greens", location: "Gulberg Greens, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 58_000_000, propertyType: "plot", title: "1 Kanal farmhouse plot, Gulberg Greens", source: "graana" },
  { sector: "Gulberg Residencia", location: "Gulberg Residencia, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 21_000_000, propertyType: "plot", title: "10 Marla plot, Gulberg Residencia", source: "zameen" },
  { sector: "B-17", location: "B-17, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 14_500_000, propertyType: "plot", title: "10 Marla plot, Multi Gardens B-17", source: "graana" },
  { sector: "Faisal Town", location: "Faisal Town Phase 1, Islamabad", areaValue: 7, areaUnit: "marla", pricePkr: 13_500_000, propertyType: "plot", title: "7 Marla plot, Faisal Town Phase 1", source: "zameen" },
  { sector: "PWD Housing Scheme", location: "PWD Housing Scheme, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 45_000_000, propertyType: "plot", title: "1 Kanal plot, PWD Housing Scheme", source: "graana" },
  { sector: "Park View City", location: "Park View City, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 29_500_000, propertyType: "plot", title: "10 Marla plot, Park View City", source: "zameen" },
  { sector: "Capital Smart City", location: "Capital Smart City, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 19_500_000, propertyType: "plot", title: "10 Marla overseas block plot, Capital Smart City", source: "graana" },
  { sector: "Top City-1", location: "Top City-1, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 17_500_000, propertyType: "plot", title: "10 Marla plot, Top City-1", source: "zameen" },
  { sector: "Mumtaz City", location: "Mumtaz City, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 38_000_000, propertyType: "plot", title: "1 Kanal plot, Mumtaz City", source: "graana" },
  { sector: "Eighteen Islamabad", location: "Eighteen, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 52_000_000, propertyType: "plot", title: "1 Kanal villa plot, Eighteen Islamabad", source: "zameen" },
  { sector: "G-13", location: "G-13/2, Islamabad", areaValue: 10, areaUnit: "marla", pricePkr: 46_000_000, propertyType: "house", title: "10 Marla double-storey house, G-13/2", source: "graana", bedrooms: 5, bathrooms: 5 },
  { sector: "F-11", location: "F-11/3, Islamabad", areaValue: 1, areaUnit: "kanal", pricePkr: 145_000_000, propertyType: "house", title: "1 Kanal brand-new house, F-11/3", source: "zameen", bedrooms: 6, bathrooms: 7 },
  { sector: "Rawalpindi Road", location: "Adiala Road, Rawalpindi", areaValue: 10, areaUnit: "marla", pricePkr: 9_500_000, propertyType: "plot", title: "10 Marla affordable plot, Adiala Road", source: "graana" },
];

function demoId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

const REFERENCE_END = Date.UTC(2026, 8, 20, 12, 0, 0); // 2026-09-20T12:00Z

export const demoProperties: PropertyRow[] = SEEDS.map((seed, index) => {
  const multiplier = seed.areaUnit === "kanal" ? 20 : 1;
  const areaSqft = Math.round(seed.areaValue * multiplier * SQFT_PER_MARLA * 100) / 100;
  const lastSeenAt = new Date(REFERENCE_END - index * 7 * 60 * 60 * 1000).toISOString();
  const firstSeenAt = new Date(REFERENCE_END - (90 + index) * 24 * 60 * 60 * 1000).toISOString();
  const typeLabel = seed.propertyType === "plot" ? "Residential plot" : "House";

  return {
    id: demoId(index),
    source: seed.source,
    source_listing_id: `demo-${index + 1}`,
    source_url: `https://example.com/listing/demo-${index + 1}`,
    title: seed.title,
    description:
      `${typeLabel} for sale in ${seed.location}. ` +
      `${seed.areaValue} ${seed.areaUnit} (${areaSqft.toLocaleString("en-US")} sqft). ` +
      `Sample listing used for the demo dataset.`,
    purpose: seed.purpose ?? "sale",
    property_type: seed.propertyType,
    price_pkr: seed.pricePkr,
    city: "Islamabad",
    location: seed.location,
    sector: seed.sector,
    area_value: seed.areaValue,
    area_unit: seed.areaUnit,
    area_sqft: areaSqft,
    bedrooms: seed.bedrooms ?? null,
    bathrooms: seed.bathrooms ?? null,
    latitude: Math.round((33.6 + index * 0.01) * 1e6) / 1e6,
    longitude: Math.round((73.02 + index * 0.01) * 1e6) / 1e6,
    content_hash: `demo-hash-${index + 1}`,
    first_seen_at: firstSeenAt,
    last_seen_at: lastSeenAt,
    is_active: true,
    raw: null,
  };
});

export const demoPriceHistory: Record<string, PriceHistoryRow[]> = (() => {
  const map: Record<string, PriceHistoryRow[]> = {};
  let id = 1;
  for (const property of demoProperties) {
    if (property.price_pkr == null) continue;
    const current = property.price_pkr;
    map[property.id] = [
      { id: id++, property_id: property.id, price_pkr: current, recorded_at: property.last_seen_at },
      {
        id: id++,
        property_id: property.id,
        price_pkr: Math.round(current * 0.97),
        recorded_at: new Date(Date.parse(property.last_seen_at) - 30 * 86_400_000).toISOString(),
      },
      {
        id: id++,
        property_id: property.id,
        price_pkr: Math.round(current * 0.94),
        recorded_at: new Date(Date.parse(property.last_seen_at) - 90 * 86_400_000).toISOString(),
      },
    ];
  }
  return map;
})();

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export const demoSectorRates: SectorLandRateRow[] = (() => {
  const groups = new Map<string, number[]>();
  for (const property of demoProperties) {
    if (
      !property.sector ||
      property.price_pkr == null ||
      property.area_sqft == null ||
      property.area_sqft <= 0
    ) {
      continue;
    }
    const perMarla = property.price_pkr / (property.area_sqft / SQFT_PER_MARLA);
    const list = groups.get(property.sector) ?? [];
    list.push(perMarla);
    groups.set(property.sector, list);
  }

  return Array.from(groups.entries())
    .map(([sector, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return {
        city: "Islamabad",
        sector,
        listing_count: values.length,
        median_price_per_marla: Math.round(median(sorted) * 100) / 100,
        avg_price_per_marla: Math.round(average),
        min_price_per_marla: Math.round(sorted[0]),
        max_price_per_marla: Math.round(sorted[sorted.length - 1]),
      } satisfies SectorLandRateRow;
    })
    .sort((a, b) => a.sector.localeCompare(b.sector));
})();
