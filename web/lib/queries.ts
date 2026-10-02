import {
  demoPriceHistory,
  demoProperties,
  demoSectorRates,
} from "./demo-data";
import type {
  PriceHistoryRow,
  PropertyRow,
  SectorLandRateRow,
} from "./database.types";
import { DEFAULT_RATE_CARDS, type RateCardInput } from "./estimate/rates";
import { createServerSupabaseClient } from "./supabase/server";

export const PAGE_SIZE = 20;

export interface PropertySearchParams {
  q?: string;
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Minimum area in square feet. */
  minArea?: number;
  /** Maximum area in square feet. */
  maxArea?: number;
  type?: string;
  page?: number;
}

export interface PropertySearchResult {
  rows: PropertyRow[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  demo: boolean;
}

export interface DemoFlagged<T> {
  rows: T[];
  demo: boolean;
}

/** Escape a user term before embedding it in a PostgREST `or`/`ilike` filter. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchProperties(
  params: PropertySearchParams,
): Promise<PropertySearchResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const supabase = createServerSupabaseClient();

  if (supabase) {
    try {
      let query = supabase
        .from("properties")
        .select("*", { count: "exact" })
        .eq("is_active", true);

      if (params.q) {
        const term = sanitizeSearchTerm(params.q);
        if (term) {
          query = query.or(
            `title.ilike.%${term}%,location.ilike.%${term}%,sector.ilike.%${term}%`,
          );
        }
      }
      if (params.sector) query = query.eq("sector", params.sector);
      if (params.type) query = query.eq("property_type", params.type);
      if (params.minPrice != null) query = query.gte("price_pkr", params.minPrice);
      if (params.maxPrice != null) query = query.lte("price_pkr", params.maxPrice);
      if (params.minArea != null) query = query.gte("area_sqft", params.minArea);
      if (params.maxArea != null) query = query.lte("area_sqft", params.maxArea);

      const from = (page - 1) * PAGE_SIZE;
      const { data, count, error } = await query
        .order("last_seen_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data ?? []) as PropertyRow[];
      const total = count ?? rows.length;
      return {
        rows,
        count: total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        demo: false,
      };
    } catch (error) {
      console.error("[queries] searchProperties failed; using demo data:", error);
    }
  }

  const filtered = filterDemoProperties(params);
  const total = filtered.length;
  const from = (page - 1) * PAGE_SIZE;
  return {
    rows: filtered.slice(from, from + PAGE_SIZE),
    count: total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    demo: true,
  };
}

export async function getProperty(
  id: string,
): Promise<{ property: PropertyRow | null; demo: boolean }> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return { property: (data as PropertyRow | null) ?? null, demo: false };
    } catch (error) {
      console.error("[queries] getProperty failed; using demo data:", error);
    }
  }
  return { property: getDemoProperty(id) ?? null, demo: true };
}

export async function getPriceHistory(id: string): Promise<PriceHistoryRow[]> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("price_history")
        .select("*")
        .eq("property_id", id)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceHistoryRow[];
    } catch (error) {
      console.error("[queries] getPriceHistory failed; using demo data:", error);
    }
  }
  return demoPriceHistory[id] ?? [];
}

export async function getSectorRates(): Promise<DemoFlagged<SectorLandRateRow>> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("sector_land_rates")
        .select("*")
        .order("sector", { ascending: true });
      if (error) throw error;
      return { rows: (data ?? []) as SectorLandRateRow[], demo: false };
    } catch (error) {
      console.error("[queries] getSectorRates failed; using demo data:", error);
    }
  }
  return { rows: demoSectorRates, demo: true };
}

export async function getRateCards(): Promise<DemoFlagged<RateCardInput>> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("rate_cards")
        .select("category,key,label,value,unit,quality_tier");
      if (error) throw error;
      if (data && data.length > 0) {
        return { rows: data as RateCardInput[], demo: false };
      }
    } catch (error) {
      console.error("[queries] getRateCards failed; using demo data:", error);
    }
  }
  return { rows: DEFAULT_RATE_CARDS, demo: true };
}

export async function getLatestProperties(limit = 6): Promise<{
  rows: PropertyRow[];
  total: number;
  demo: boolean;
}> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, count, error } = await supabase
        .from("properties")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .order("last_seen_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as PropertyRow[];
      return { rows, total: count ?? rows.length, demo: false };
    } catch (error) {
      console.error("[queries] getLatestProperties failed; using demo data:", error);
    }
  }
  const rows = demoProperties
    .slice()
    .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
    .slice(0, limit);
  return { rows, total: demoProperties.length, demo: true };
}

function filterDemoProperties(params: PropertySearchParams): PropertyRow[] {
  let rows = demoProperties.filter((property) => property.is_active);

  if (params.q) {
    const needle = params.q.toLowerCase();
    rows = rows.filter((property) =>
      [property.title, property.location, property.sector, property.description].some(
        (field) => field?.toLowerCase().includes(needle),
      ),
    );
  }
  if (params.sector) {
    rows = rows.filter((property) => property.sector === params.sector);
  }
  if (params.type) {
    rows = rows.filter((property) => property.property_type === params.type);
  }
  if (params.minPrice != null) {
    rows = rows.filter((property) => (property.price_pkr ?? 0) >= params.minPrice!);
  }
  if (params.maxPrice != null) {
    rows = rows.filter(
      (property) => (property.price_pkr ?? Number.POSITIVE_INFINITY) <= params.maxPrice!,
    );
  }
  if (params.minArea != null) {
    rows = rows.filter((property) => (property.area_sqft ?? 0) >= params.minArea!);
  }
  if (params.maxArea != null) {
    rows = rows.filter(
      (property) => (property.area_sqft ?? Number.POSITIVE_INFINITY) <= params.maxArea!,
    );
  }

  return rows.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
}

function getDemoProperty(id: string): PropertyRow | undefined {
  return demoProperties.find((property) => property.id === id);
}
