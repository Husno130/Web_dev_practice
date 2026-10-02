-- ============================================================================
-- seed.sql — editable estimator assumptions for Islamabad.
--
-- NOTE: these are *illustrative market-typical* values (PKR), seeded so the
-- calculator works out of the box. They are NOT authoritative. Update them via
-- SQL, the Supabase table editor, or a future admin screen as the market moves.
-- Every row carries effective_date + source_note for auditability.
-- ============================================================================

insert into public.rate_cards (category, key, label, value, unit, city, quality_tier, source_note)
values
  -- Land fallback (overridden per-sector by the `sector_land_rates` view) -----
  ('land', 'fallback_price_per_marla', 'Fallback land price (per marla)', 2000000, 'PKR/marla', 'Islamabad', null, 'Islamabad market ballpark; sector medians from scraped listings take priority'),

  -- Transaction / acquisition costs ------------------------------------------
  ('transaction', 'stamp_duty_pct',              'Stamp duty',                    3,      '%', 'Islamabad', null, 'ICT stamp duty estimate'),
  ('transaction', 'registration_pct',             'Registration fee',              1,      '%', 'Islamabad', null, 'Registry/registration estimate'),
  ('transaction', 'cvtt_pct',                     'Capital value tax on transfer', 1,      '%', 'Islamabad', null, 'CVT estimate on transfer'),
  ('transaction', 'agent_commission_pct',         'Agent commission',              1.5,    '%', 'Islamabad', null, 'Typical brokerage'),
  ('transaction', 'legal_documentation_flat',     'Legal & documentation',         75000,  'PKR', 'Islamabad', null, 'Lawyer + paperwork lump sum'),

  -- Approvals & utilities ----------------------------------------------------
  ('approvals', 'building_plan_approval_per_sqft', 'Building plan approval',        60,     'PKR/sqft', 'Islamabad', null, 'CDA/society approval scaled by covered area'),
  ('approvals', 'noc_flat',                        'NOC / society charges',         25000,  'PKR', 'Islamabad', null, 'Society NOC lump sum'),
  ('approvals', 'development_charges_flat',        'Development charges',           300000, 'PKR', 'Islamabad', null, 'Society development charges'),
  ('approvals', 'electricity_connection_flat',     'Electricity connection',        250000, 'PKR', 'Islamabad', null, 'Meter + connection estimate'),
  ('approvals', 'gas_connection_flat',             'Gas connection',                150000, 'PKR', 'Islamabad', null, 'Sui gas connection estimate'),
  ('approvals', 'water_connection_flat',           'Water connection',              100000, 'PKR', 'Islamabad', null, 'Water connection estimate'),

  -- Construction (per covered sqft) ------------------------------------------
  ('construction', 'grey_structure_rate_per_sqft', 'Grey structure',                4000,   'PKR/sqft', 'Islamabad', null,        'Structure, slab, brickwork, plaster, roofing'),
  ('construction', 'finishing_rate_per_sqft',      'Finishing — economy',           2500,   'PKR/sqft', 'Islamabad', 'economy',  'Basic finishing, flooring, paint, fittings'),
  ('construction', 'finishing_rate_per_sqft',      'Finishing — standard',          4200,   'PKR/sqft', 'Islamabad', 'standard', 'Mid-range finishing'),
  ('construction', 'finishing_rate_per_sqft',      'Finishing — premium',           8000,   'PKR/sqft', 'Islamabad', 'premium',  'High-end finishing, imported fixtures'),
  ('construction', 'material_share_pct',           'Material share of construction',60,     '%', 'Islamabad', null, 'Split for display: materials vs labour'),
  ('construction', 'labour_share_pct',             'Labour share of construction',  40,     '%', 'Islamabad', null, 'Split for display: materials vs labour'),

  -- Material reference unit rates (informational breakdown) ------------------
  ('material', 'cement_per_bag',       'Cement (50kg bag)',      1450,  'PKR/bag',    'Islamabad', null, 'Reference unit rate'),
  ('material', 'steel_per_kg',         'Steel / rebar',          280,   'PKR/kg',     'Islamabad', null, 'Reference unit rate'),
  ('material', 'bricks_per_thousand',  'Bricks',                 18000, 'PKR/1000',   'Islamabad', null, 'Reference unit rate'),
  ('material', 'sand_per_cft',         'Sand',                   90,    'PKR/cft',    'Islamabad', null, 'Reference unit rate'),
  ('material', 'aggregate_per_cft',    'Crush / aggregate',      110,   'PKR/cft',    'Islamabad', null, 'Reference unit rate'),
  ('material', 'tiles_per_sqft',       'Tiles / flooring',       250,   'PKR/sqft',   'Islamabad', null, 'Reference unit rate'),
  ('material', 'paint_per_sqft',       'Paint',                  70,    'PKR/sqft',   'Islamabad', null, 'Reference unit rate'),
  ('material', 'electrical_per_sqft',  'Electrical works',       250,   'PKR/sqft',   'Islamabad', null, 'Reference unit rate'),
  ('material', 'plumbing_per_sqft',    'Plumbing works',         200,   'PKR/sqft',   'Islamabad', null, 'Reference unit rate'),
  ('material', 'sanitary_flat',        'Sanitary & bathroom',    400000,'PKR',        'Islamabad', null, 'Lump sum estimate'),
  ('material', 'kitchen_flat',         'Kitchen',                600000,'PKR',        'Islamabad', null, 'Lump sum estimate'),

  -- Professional fees --------------------------------------------------------
  ('professional', 'architect_pct',            'Architect fee',          2, '%', 'Islamabad', null, 'Percentage of construction cost'),
  ('professional', 'structural_engineer_pct',  'Structural engineer fee',1, '%', 'Islamabad', null, 'Percentage of construction cost'),
  ('professional', 'project_management_pct',   'Project management',     2, '%', 'Islamabad', null, 'Percentage of construction cost'),

  -- Contingency & escalation -------------------------------------------------
  ('contingency', 'contingency_pct',      'Contingency',              12, '%', 'Islamabad', null, 'Buffer for price changes and extras'),
  ('escalation',  'annual_inflation_pct', 'Construction inflation',   8,  '%/yr', 'Islamabad', null, 'Applied pro-rata over the build timeline'),
  ('misc',        'default_covered_area_ratio', 'Covered area ratio',  0.9, 'ratio', 'Islamabad', null, 'Default built area as fraction of plot area')
on conflict (category, key, city_key, quality_key) do update set
  label          = excluded.label,
  value          = excluded.value,
  unit           = excluded.unit,
  effective_date = excluded.effective_date,
  source_note    = excluded.source_note;
