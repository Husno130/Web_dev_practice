import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * True only when both public Supabase env vars are present. The rest of the
 * app uses this to decide between live data and the built-in demo dataset.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Normalise a Supabase project URL. The JS client appends `/rest/v1` itself,
 * so a value like `https://x.supabase.co/rest/v1` (a common copy/paste error)
 * must be reduced to the bare project URL.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/+$/, "");
}

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase client using the ANON key only (read-only via RLS).
 * Returns `null` when the app is running in demo mode. Safe to call from
 * Server Components and Route Handlers.
 */
export function createServerSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return cachedClient;
}
