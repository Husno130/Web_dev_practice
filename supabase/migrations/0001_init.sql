-- ============================================================================
-- 0001_init.sql
-- Schema for the Islamabad property scraper + build-cost estimator.
-- Targets the Supabase free/hobby tier: keeps storage small (no raw HTML by
-- default), RLS read-only for anon, writes only through service_role.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy location search

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.property_source as enum ('zameen', 'graana');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_purpose as enum ('sale', 'rent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scrape_status as enum ('running', 'success', 'partial', 'failed');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- properties
-- ----------------------------------------------------------------------------
create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  source            public.property_source not null,
  source_listing_id text not null,
  source_url        text not null,
  title             text,
  description       text,
  purpose           public.property_purpose not null default 'sale',
  property_type     text not null default 'plot',
  price_pkr         bigint,
  city              text not null default 'Islamabad',
  location          text,
  sector            text,
  area_value        numeric,
  area_unit         text,                     -- marla | kanal | sqft | sqyd
  area_sqft         numeric,                  -- normalised square feet
  bedrooms          integer,
  bathrooms         integer,
  latitude          double precision,
  longitude         double precision,
  content_hash      text,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  is_active         boolean not null default true,
  raw               jsonb,
  constraint properties_source_listing_unique unique (source, source_listing_id)
);

create index if not exists properties_city_idx          on public.properties (city);
create index if not exists properties_sector_idx        on public.properties (sector);
create index if not exists properties_type_idx          on public.properties (property_type);
create index if not exists properties_price_idx         on public.properties (price_pkr);
create index if not exists properties_area_idx          on public.properties (area_sqft);
create index if not exists properties_active_idx        on public.properties (is_active);
create index if not exists properties_last_seen_idx     on public.properties (last_seen_at desc);
create index if not exists properties_search_idx on public.properties using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
    coalesce(location, '') || ' ' || coalesce(sector, '')
  )
);
create index if not exists properties_location_trgm_idx on public.properties using gin (location gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- price_history
-- ----------------------------------------------------------------------------
create table if not exists public.price_history (
  id          bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  price_pkr   bigint not null,
  recorded_at timestamptz not null default now()
);
create index if not exists price_history_prop_idx on public.price_history (property_id, recorded_at desc);

-- ----------------------------------------------------------------------------
-- scrape_runs  (observability, private)
-- ----------------------------------------------------------------------------
create table if not exists public.scrape_runs (
  id           bigint generated always as identity primary key,
  source       public.property_source not null,
  city         text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       public.scrape_status not null default 'running',
  items_found  integer not null default 0,
  inserted     integer not null default 0,
  updated      integer not null default 0,
  deactivated  integer not null default 0,
  error        text
);
create index if not exists scrape_runs_source_idx on public.scrape_runs (source, started_at desc);

-- ----------------------------------------------------------------------------
-- rate_cards  (editable estimator assumptions, public read)
-- ----------------------------------------------------------------------------
create table if not exists public.rate_cards (
  id            bigint generated always as identity primary key,
  category      text not null,             -- land|transaction|approvals|construction|material|professional|contingency|escalation
  key           text not null,
  label         text not null,
  value         numeric not null,
  unit          text,
  city          text default 'Islamabad',
  quality_tier  text,                      -- economy|standard|premium (nullable)
  effective_date date not null default current_date,
  source_note   text,
  city_key      text generated always as (coalesce(city, '')) stored,
  quality_key   text generated always as (coalesce(quality_tier, '')) stored
);
create unique index if not exists rate_cards_unique_idx
  on public.rate_cards (category, key, city_key, quality_key);

-- ----------------------------------------------------------------------------
-- estimates  (optional saved estimates; private until auth is added)
-- ----------------------------------------------------------------------------
create table if not exists public.estimates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  property_id uuid references public.properties (id) on delete set null,
  inputs      jsonb not null,
  breakdown   jsonb not null,
  total_pkr   bigint,
  created_at  timestamptz not null default now()
);
create index if not exists estimates_user_idx on public.estimates (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- sector_land_rates  (derived median PKR/marla per sector)
-- Only sectors with >= 3 active listings to keep medians meaningful.
-- ----------------------------------------------------------------------------
create or replace view public.sector_land_rates
with (security_invoker = true) as
select
  city,
  sector,
  count(*)::int                                                          as listing_count,
  percentile_cont(0.5) within group (
    order by price_pkr / nullif(area_sqft / 272.25, 0)
  )                                                                      as median_price_per_marla,
  round(avg(price_pkr / nullif(area_sqft / 272.25, 0)))                  as avg_price_per_marla,
  min(price_pkr / nullif(area_sqft / 272.25, 0))                         as min_price_per_marla,
  max(price_pkr / nullif(area_sqft / 272.25, 0))                         as max_price_per_marla
from public.properties
where is_active = true
  and price_pkr is not null
  and price_pkr > 0
  and area_sqft > 0
  and sector is not null
group by city, sector
having count(*) >= 3;

-- ----------------------------------------------------------------------------
-- Batch upsert RPC — called by the scraper with the service role key.
-- SECURITY DEFINER + execute revoked from anon/authenticated so it can never
-- be invoked from the browser.
-- ----------------------------------------------------------------------------
create or replace function public.upsert_property_batch(
  p_source text,
  p_items  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item         jsonb;
  v_id           uuid;
  v_existing_id  uuid;
  v_existing_price bigint;
  v_price        bigint;
  v_inserted     int := 0;
  v_updated      int := 0;
  v_price_changes int := 0;
begin
  for v_item in select jsonb_array_elements(p_items)
  loop
    v_price := nullif(v_item ->> 'price_pkr', '')::bigint;

    select id, price_pkr
      into v_existing_id, v_existing_price
      from public.properties
     where source = p_source::public.property_source
       and source_listing_id = v_item ->> 'source_listing_id';

    insert into public.properties (
      source, source_listing_id, source_url, title, description, purpose,
      property_type, price_pkr, city, location, sector, area_value, area_unit,
      area_sqft, bedrooms, bathrooms, latitude, longitude, content_hash,
      last_seen_at, is_active, raw
    ) values (
      p_source::public.property_source,
      v_item ->> 'source_listing_id',
      v_item ->> 'source_url',
      v_item ->> 'title',
      v_item ->> 'description',
      coalesce(nullif(v_item ->> 'purpose', ''), 'sale')::public.property_purpose,
      coalesce(nullif(v_item ->> 'property_type', ''), 'plot'),
      v_price,
      coalesce(nullif(v_item ->> 'city', ''), 'Islamabad'),
      v_item ->> 'location',
      v_item ->> 'sector',
      nullif(v_item ->> 'area_value', '')::numeric,
      v_item ->> 'area_unit',
      nullif(v_item ->> 'area_sqft', '')::numeric,
      nullif(v_item ->> 'bedrooms', '')::integer,
      nullif(v_item ->> 'bathrooms', '')::integer,
      nullif(v_item ->> 'latitude', '')::double precision,
      nullif(v_item ->> 'longitude', '')::double precision,
      v_item ->> 'content_hash',
      now(), true,
      case when v_item ? 'raw' then v_item -> 'raw' else null end
    )
    on conflict (source, source_listing_id) do update set
      source_url    = excluded.source_url,
      title         = excluded.title,
      description   = excluded.description,
      purpose       = excluded.purpose,
      property_type = excluded.property_type,
      price_pkr     = excluded.price_pkr,
      city          = excluded.city,
      location      = excluded.location,
      sector        = excluded.sector,
      area_value    = excluded.area_value,
      area_unit     = excluded.area_unit,
      area_sqft     = excluded.area_sqft,
      bedrooms      = excluded.bedrooms,
      bathrooms     = excluded.bathrooms,
      latitude      = excluded.latitude,
      longitude     = excluded.longitude,
      content_hash  = excluded.content_hash,
      last_seen_at  = now(),
      is_active     = true,
      raw           = coalesce(excluded.raw, public.properties.raw)
    returning id into v_id;

    if v_existing_id is null then
      v_inserted := v_inserted + 1;
      if v_price is not null then
        insert into public.price_history (property_id, price_pkr) values (v_id, v_price);
      end if;
    else
      v_updated := v_updated + 1;
      if v_price is not null and v_price is distinct from v_existing_price then
        insert into public.price_history (property_id, price_pkr) values (v_id, v_price);
        v_price_changes := v_price_changes + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'price_changes', v_price_changes
  );
end;
$$;

revoke all on function public.upsert_property_batch(text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_property_batch(text, jsonb) to service_role;

-- Mark listings not seen since p_seen_before as inactive.
create or replace function public.deactivate_stale_properties(
  p_source      text,
  p_seen_before timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.properties
     set is_active = false
   where source = p_source::public.property_source
     and is_active = true
     and last_seen_at < p_seen_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.deactivate_stale_properties(text, timestamptz) from public, anon, authenticated;
grant execute on function public.deactivate_stale_properties(text, timestamptz) to service_role;

-- ----------------------------------------------------------------------------
-- Retention helper: prune old history / run logs. Call from a scheduled job.
-- ----------------------------------------------------------------------------
create or replace function public.prune_old_data(p_history_days int default 365, p_runs_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history int;
  v_runs int;
begin
  delete from public.price_history where recorded_at < now() - (p_history_days || ' days')::interval;
  get diagnostics v_history = row_count;
  delete from public.scrape_runs where started_at < now() - (p_runs_days || ' days')::interval;
  get diagnostics v_runs = row_count;
  return jsonb_build_object('price_history_deleted', v_history, 'scrape_runs_deleted', v_runs);
end;
$$;

revoke all on function public.prune_old_data(int, int) from public, anon, authenticated;
grant execute on function public.prune_old_data(int, int) to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security — public (anon) read-only on catalogue data.
-- ----------------------------------------------------------------------------
alter table public.properties   enable row level security;
alter table public.price_history enable row level security;
alter table public.rate_cards   enable row level security;
alter table public.scrape_runs  enable row level security;
alter table public.estimates    enable row level security;

do $$ begin
  create policy "public can read properties" on public.properties
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public can read price history" on public.price_history
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public can read rate cards" on public.rate_cards
    for select using (true);
exception when duplicate_object then null; end $$;

-- No anon policies for scrape_runs / estimates: service_role only.
