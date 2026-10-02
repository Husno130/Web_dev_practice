// Supabase helpers. All writes go through the service-role key and the
// SECURITY DEFINER RPCs defined in supabase/migrations/0001_init.sql.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedListing, Source } from '../types.js';

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  price_changes: number;
}

export interface StartRunInput {
  source: Source;
  city: string;
}

export interface FinishRunInput {
  status: 'success' | 'partial' | 'failed';
  itemsFound: number;
  inserted: number;
  updated: number;
  deactivated: number;
  error?: string | null;
}

/**
 * Normalise a Supabase project URL. The JS client appends `/rest/v1` itself,
 * so a value like `https://x.supabase.co/rest/v1` (a common copy/paste error)
 * must be reduced to the bare project URL.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/+$/, '');
}

/** Read Supabase credentials from an environment object, or null when absent. */
export function readSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url: normalizeSupabaseUrl(url), serviceRoleKey };
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Call upsert_property_batch(p_source, p_items) and return its counters. */
export async function upsertBatch(
  client: SupabaseClient,
  source: Source,
  items: ScrapedListing[],
): Promise<UpsertResult> {
  const { data, error } = await client.rpc('upsert_property_batch', {
    p_source: source,
    p_items: items,
  });
  if (error) throw new Error(`upsert_property_batch failed: ${error.message}`);
  const result = (data ?? {}) as Partial<UpsertResult>;
  return {
    inserted: result.inserted ?? 0,
    updated: result.updated ?? 0,
    price_changes: result.price_changes ?? 0,
  };
}

/** Mark listings for a source not seen since `seenBefore` as inactive. */
export async function deactivateStale(
  client: SupabaseClient,
  source: Source,
  seenBefore: string,
): Promise<number> {
  const { data, error } = await client.rpc('deactivate_stale_properties', {
    p_source: source,
    p_seen_before: seenBefore,
  });
  if (error) throw new Error(`deactivate_stale_properties failed: ${error.message}`);
  return typeof data === 'number' ? data : Number(data ?? 0) || 0;
}

/** Insert a 'running' scrape_runs row and return its id. */
export async function startScrapeRun(
  client: SupabaseClient,
  input: StartRunInput,
): Promise<number> {
  const { data, error } = await client
    .from('scrape_runs')
    .insert({ source: input.source, city: input.city, status: 'running' })
    .select('id')
    .single();
  if (error) throw new Error(`could not start scrape run: ${error.message}`);
  const id = (data as { id: number } | null)?.id;
  if (typeof id !== 'number') throw new Error('scrape_runs insert returned no id');
  return id;
}

/** Mark a scrape run finished with final counts/status. */
export async function finishScrapeRun(
  client: SupabaseClient,
  id: number,
  input: FinishRunInput,
): Promise<void> {
  const { error } = await client
    .from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: input.status,
      items_found: input.itemsFound,
      inserted: input.inserted,
      updated: input.updated,
      deactivated: input.deactivated,
      error: input.error ?? null,
    })
    .eq('id', id);
  if (error) throw new Error(`could not finish scrape run ${id}: ${error.message}`);
}
