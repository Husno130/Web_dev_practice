/**
 * Hand-written types mirroring `supabase/migrations/0001_init.sql`.
 *
 * These are intentionally a small subset shaped for read-only use from the web
 * app (anon key, public SELECT only). The `Database` type is compatible with
 * `@supabase/supabase-js` v2 generics.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PropertySource = "zameen" | "graana";
export type PropertyPurpose = "sale" | "rent";
export type ScrapeStatus = "running" | "success" | "partial" | "failed";

/** `public.properties` */
export interface PropertyRow {
  id: string;
  source: PropertySource;
  source_listing_id: string;
  source_url: string;
  title: string | null;
  description: string | null;
  purpose: PropertyPurpose;
  property_type: string;
  price_pkr: number | null;
  city: string;
  location: string | null;
  sector: string | null;
  area_value: number | null;
  area_unit: string | null;
  area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  content_hash: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  raw: Json | null;
}

export type PropertyInsert = Omit<PropertyRow, "id" | "first_seen_at" | "last_seen_at"> &
  Partial<Pick<PropertyRow, "id" | "first_seen_at" | "last_seen_at">> & {
    source_listing_id: string;
    source_url: string;
    source: PropertySource;
  };

export type PropertyUpdate = Partial<PropertyRow>;

/** `public.price_history` */
export interface PriceHistoryRow {
  id: number;
  property_id: string;
  price_pkr: number;
  recorded_at: string;
}

export type PriceHistoryInsert = Omit<PriceHistoryRow, "id" | "recorded_at"> &
  Partial<Pick<PriceHistoryRow, "id" | "recorded_at">>;

export type PriceHistoryUpdate = Partial<PriceHistoryRow>;

/** `public.rate_cards` */
export interface RateCardRow {
  id: number;
  category: string;
  key: string;
  label: string;
  value: number;
  unit: string | null;
  city: string | null;
  quality_tier: string | null;
  effective_date: string;
  source_note: string | null;
  city_key: string;
  quality_key: string;
}

export type RateCardInsert = Omit<RateCardRow, "id" | "effective_date" | "city_key" | "quality_key"> &
  Partial<Pick<RateCardRow, "id" | "effective_date" | "city_key" | "quality_key">>;

export type RateCardUpdate = Partial<RateCardRow>;

/** `public.sector_land_rates` (view, security_invoker) */
export interface SectorLandRateRow {
  city: string;
  sector: string;
  listing_count: number;
  median_price_per_marla: number | null;
  avg_price_per_marla: number | null;
  min_price_per_marla: number | null;
  max_price_per_marla: number | null;
}

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: PropertyRow;
        Insert: PropertyInsert;
        Update: PropertyUpdate;
        Relationships: [];
      };
      price_history: {
        Row: PriceHistoryRow;
        Insert: PriceHistoryInsert;
        Update: PriceHistoryUpdate;
        Relationships: [];
      };
      rate_cards: {
        Row: RateCardRow;
        Insert: RateCardInsert;
        Update: RateCardUpdate;
        Relationships: [];
      };
    };
    Views: {
      sector_land_rates: {
        Row: SectorLandRateRow;
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      property_source: PropertySource;
      property_purpose: PropertyPurpose;
      scrape_status: ScrapeStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
