-- Products / Inventory v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against any production database.

create extension if not exists pgcrypto;

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint product_categories_slug_not_blank check (length(btrim(slug)) > 0)
);

create table if not exists inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_code text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_locations_name_not_blank check (length(btrim(name)) > 0),
  constraint inventory_locations_code_not_blank check (length(btrim(location_code)) > 0)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references product_categories(id) on delete set null,
  name text not null,
  internal_sku text,
  brand text,
  manufacturer text,
  model text,
  product_type text not null default 'physical_product',
  status text not null default 'draft',
  short_description text,
  staff_notes text,
  stock_unit text not null default 'each',
  inventory_tracking_enabled boolean not null default false,
  is_taxable boolean not null default true,
  cost_cents integer,
  retail_price_cents integer,
  msrp_cents integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_product_type_valid check (
    product_type in (
      'physical_product',
      'part',
      'consumable',
      'accessory',
      'cloth',
      'cue',
      'service_related_item',
      'special_order_item',
      'other'
    )
  ),
  constraint products_status_valid check (
    status in (
      'draft',
      'active',
      'inactive',
      'special_order',
      'discontinued',
      'archived',
      'review_needed'
    )
  ),
  constraint products_stock_unit_not_blank check (length(btrim(stock_unit)) > 0),
  constraint products_cost_cents_nonnegative check (cost_cents is null or cost_cents >= 0),
  constraint products_retail_price_cents_nonnegative check (retail_price_cents is null or retail_price_cents >= 0),
  constraint products_msrp_cents_nonnegative check (msrp_cents is null or msrp_cents >= 0)
);

create table if not exists product_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  location_id uuid not null references inventory_locations(id) on delete restrict,
  quantity_on_hand numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2),
  inventory_confidence text not null default 'unverified',
  last_counted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_inventory_product_location_unique unique (product_id, location_id),
  constraint product_inventory_quantity_nonnegative check (quantity_on_hand >= 0),
  constraint product_inventory_low_stock_nonnegative check (
    low_stock_threshold is null or low_stock_threshold >= 0
  ),
  constraint product_inventory_confidence_valid check (
    inventory_confidence in ('unverified', 'estimated', 'counted', 'review_needed')
  )
);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  location_id uuid not null references inventory_locations(id) on delete restrict,
  adjustment_type text not null,
  quantity_before numeric(12,2) not null,
  quantity_delta numeric(12,2) not null,
  quantity_after numeric(12,2) not null,
  reason text not null,
  notes text,
  adjustment_group_id uuid,
  adjusted_by text,
  created_at timestamptz not null default now(),
  constraint inventory_adjustments_type_valid check (
    adjustment_type in (
      'initial_count',
      'manual_increase',
      'manual_decrease',
      'count_correction',
      'stock_received',
      'sale_or_customer_out',
      'service_use',
      'damaged_or_scrapped',
      'returned_to_stock',
      'location_transfer',
      'lost_or_missing',
      'review_adjustment'
    )
  ),
  constraint inventory_adjustments_reason_not_blank check (length(btrim(reason)) > 0),
  constraint inventory_adjustments_before_nonnegative check (quantity_before >= 0),
  constraint inventory_adjustments_after_nonnegative check (quantity_after >= 0),
  constraint inventory_adjustments_quantity_math check (
    quantity_before + quantity_delta = quantity_after
  )
);

create index if not exists product_categories_slug_idx
  on product_categories (slug);

create index if not exists product_categories_active_sort_idx
  on product_categories (is_active, sort_order, lower(name));

create index if not exists inventory_locations_code_idx
  on inventory_locations (location_code);

create index if not exists inventory_locations_active_sort_idx
  on inventory_locations (is_active, sort_order, lower(name));

create index if not exists products_category_id_idx
  on products (category_id);

create index if not exists products_status_idx
  on products (status);

create index if not exists products_product_type_idx
  on products (product_type);

create index if not exists products_internal_sku_idx
  on products (lower(internal_sku));

create unique index if not exists products_internal_sku_unique_idx
  on products (lower(internal_sku))
  where internal_sku is not null and length(btrim(internal_sku)) > 0;

create index if not exists products_search_helpers_idx
  on products (
    lower(name),
    lower(coalesce(brand, '')),
    lower(coalesce(manufacturer, '')),
    lower(coalesce(model, ''))
  );

create index if not exists products_archived_at_idx
  on products (archived_at);

create index if not exists product_inventory_product_id_idx
  on product_inventory (product_id);

create index if not exists product_inventory_location_id_idx
  on product_inventory (location_id);

create index if not exists product_inventory_confidence_idx
  on product_inventory (inventory_confidence);

create index if not exists inventory_adjustments_product_created_idx
  on inventory_adjustments (product_id, created_at desc);

create index if not exists inventory_adjustments_location_created_idx
  on inventory_adjustments (location_id, created_at desc);

create index if not exists inventory_adjustments_type_idx
  on inventory_adjustments (adjustment_type);

create index if not exists inventory_adjustments_group_idx
  on inventory_adjustments (adjustment_group_id);

create or replace function products_inventory_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists product_categories_touch_updated_at on product_categories;
create trigger product_categories_touch_updated_at
  before update on product_categories
  for each row
  execute function products_inventory_touch_updated_at();

drop trigger if exists inventory_locations_touch_updated_at on inventory_locations;
create trigger inventory_locations_touch_updated_at
  before update on inventory_locations
  for each row
  execute function products_inventory_touch_updated_at();

drop trigger if exists products_touch_updated_at on products;
create trigger products_touch_updated_at
  before update on products
  for each row
  execute function products_inventory_touch_updated_at();

drop trigger if exists product_inventory_touch_updated_at on product_inventory;
create trigger product_inventory_touch_updated_at
  before update on product_inventory
  for each row
  execute function products_inventory_touch_updated_at();

create or replace function products_inventory_prevent_adjustment_changes()
returns trigger as $$
begin
  raise exception 'inventory_adjustments are immutable; create a correction adjustment instead';
end;
$$ language plpgsql;

drop trigger if exists inventory_adjustments_no_update on inventory_adjustments;
create trigger inventory_adjustments_no_update
  before update on inventory_adjustments
  for each row
  execute function products_inventory_prevent_adjustment_changes();

drop trigger if exists inventory_adjustments_no_delete on inventory_adjustments;
create trigger inventory_adjustments_no_delete
  before delete on inventory_adjustments
  for each row
  execute function products_inventory_prevent_adjustment_changes();

-- Optional demo/test seed data only.
-- Product names are intentionally labeled "Demo -" and use placeholder CAD cents only.
-- No customer records, real inventory counts, or live stock availability are inserted here.
-- Review or remove this section before using production data.
insert into product_categories (name, slug, description, sort_order)
values
  ('Game Tables', 'game-tables', 'Demo category for table-style game products.', 10),
  ('Cues & Cue Accessories', 'cues-cue-accessories', 'Demo category for cues and cue accessory products.', 20),
  ('Cloth & Table Materials', 'cloth-table-materials', 'Demo category for cloth, cushions, pockets, and table materials.', 30),
  ('Game Room Accessories', 'game-room-accessories', 'Demo category for general game room accessory products.', 40),
  ('Service-Related Items', 'service-related-items', 'Demo category for service supplies and installation materials.', 50),
  ('Other / Uncategorized', 'other-uncategorized', 'Demo category for products that need review.', 90)
on conflict (slug) do nothing;

insert into inventory_locations (name, location_code, description, sort_order)
values
  ('Showroom', 'SHOWROOM', 'Demo inventory location for showroom awareness.', 10),
  ('Warehouse', 'WAREHOUSE', 'Demo inventory location for warehouse awareness.', 20),
  ('Service Truck', 'SERVICE_TRUCK', 'Demo inventory location for service vehicle awareness.', 30),
  ('Office', 'OFFICE', 'Demo inventory location for office supplies or review items.', 40),
  ('Unknown / Review Needed', 'UNKNOWN_REVIEW', 'Demo inventory location for stock that needs a physical check.', 90)
on conflict (location_code) do nothing;

with seed_products as (
  select *
  from (
    values
      ('game-tables', 'Demo - Pool Table', 'DEMO-POOL-TABLE', 'Demo Brand', 'Demo Manufacturing', 'HB-8', 'physical_product', 'active', 'Demo placeholder pool table product.', 'Demo seed only. Not real stock.', 'each', true, true, 125000, 249900, 299900, 10),
      ('game-tables', 'Demo - Shuffleboard', 'DEMO-SHUFFLEBOARD', 'Demo Brand', 'Demo Manufacturing', 'SB-12', 'physical_product', 'active', 'Demo placeholder shuffleboard product.', 'Demo seed only. Not real stock.', 'each', true, true, 98000, 189900, 219900, 20),
      ('game-tables', 'Demo - Foosball Table', 'DEMO-FOOSBALL', 'Demo Play', 'Demo Manufacturing', 'FB-1', 'physical_product', 'active', 'Demo placeholder foosball product.', 'Demo seed only. Not real stock.', 'each', true, true, 35000, 79900, 89900, 30),
      ('game-tables', 'Demo - Ping Pong Table', 'DEMO-PING-PONG', 'Demo Play', 'Demo Manufacturing', 'PP-2', 'physical_product', 'draft', 'Demo placeholder table tennis product.', 'Demo seed only. Not real stock.', 'each', false, true, 28000, 59900, 69900, 40),
      ('game-tables', 'Demo - Air Hockey Table', 'DEMO-AIR-HOCKEY', 'Demo Play', 'Demo Manufacturing', 'AH-4', 'physical_product', 'review_needed', 'Demo placeholder air hockey product.', 'Demo seed only. Not real stock.', 'each', true, true, 42000, 94900, 109900, 50),
      ('cues-cue-accessories', 'Demo - Pool Cue', 'DEMO-POOL-CUE', 'Demo Cue Co.', 'Demo Cue Works', 'DC-19', 'cue', 'active', 'Demo placeholder cue product.', 'Demo seed only. Not real stock.', 'each', true, true, 4500, 12900, 15900, 60),
      ('cues-cue-accessories', 'Demo - Cue Tip', 'DEMO-CUE-TIP', 'Demo Cue Co.', 'Demo Cue Works', 'TIP-13', 'part', 'active', 'Demo placeholder cue tip product.', 'Demo seed only. Not real stock.', 'each', true, true, 150, 500, 700, 70),
      ('cues-cue-accessories', 'Demo - Cue Chalk', 'DEMO-CUE-CHALK', 'Demo Chalk', 'Demo Supplies', 'CHALK-CUBE', 'consumable', 'active', 'Demo placeholder cue chalk product.', 'Demo seed only. Not real stock.', 'cube', true, true, 75, 250, 300, 80),
      ('cues-cue-accessories', 'Demo - Cue Glove', 'DEMO-CUE-GLOVE', 'Demo Cue Co.', 'Demo Apparel', 'GLOVE-L', 'accessory', 'inactive', 'Demo placeholder cue glove product.', 'Demo seed only. Not real stock.', 'each', true, true, 650, 1795, 2195, 90),
      ('cloth-table-materials', 'Demo - Pool Table Cloth', 'DEMO-CLOTH', 'Demo Cloth', 'Demo Textiles', '860-GRN', 'cloth', 'active', 'Demo placeholder table cloth product.', 'Demo seed only. Not real stock.', 'yard', true, true, 1800, 3495, 3995, 100),
      ('cloth-table-materials', 'Demo - Cushion Rubber', 'DEMO-CUSHION-RUBBER', 'Demo Rail', 'Demo Materials', 'K66', 'part', 'active', 'Demo placeholder cushion rubber product.', 'Demo seed only. Not real stock.', 'set', true, true, 5200, 11900, 13900, 110),
      ('cloth-table-materials', 'Demo - Pocket Set', 'DEMO-POCKET-SET', 'Demo Rail', 'Demo Materials', 'PKT-6', 'part', 'special_order', 'Demo placeholder pocket set product.', 'Demo seed only. Not real stock.', 'set', true, true, 2100, 6995, 7995, 120),
      ('game-room-accessories', 'Demo - Dartboard', 'DEMO-DARTBOARD', 'Demo Games', 'Demo Manufacturing', 'DB-18', 'accessory', 'active', 'Demo placeholder dartboard product.', 'Demo seed only. Not real stock.', 'each', true, true, 2200, 5995, 6995, 130),
      ('game-room-accessories', 'Demo - Table Cover', 'DEMO-TABLE-COVER', 'Demo Covers', 'Demo Textiles', 'COVER-8', 'accessory', 'active', 'Demo placeholder table cover product.', 'Demo seed only. Not real stock.', 'each', true, true, 3200, 7995, 8995, 140),
      ('game-room-accessories', 'Demo - Scoreboard', 'DEMO-SCOREBOARD', 'Demo Games', 'Demo Manufacturing', 'SCORE-1', 'accessory', 'discontinued', 'Demo placeholder scoreboard product.', 'Demo seed only. Not real stock.', 'each', false, true, 1100, 2495, 2995, 150),
      ('service-related-items', 'Demo - Moving Blanket', 'DEMO-MOVING-BLANKET', 'Demo Supplies', 'Demo Textiles', 'MB-72', 'service_related_item', 'active', 'Demo placeholder moving blanket product.', 'Demo seed only. Not real stock.', 'each', true, true, 900, 1995, 2495, 160),
      ('service-related-items', 'Demo - Leveling Shims', 'DEMO-LEVELING-SHIMS', 'Demo Supplies', 'Demo Materials', 'SHIM-PACK', 'service_related_item', 'active', 'Demo placeholder leveling shims product.', 'Demo seed only. Not real stock.', 'pack', true, true, 250, 895, 1095, 170),
      ('service-related-items', 'Demo - Installation Hardware Kit', 'DEMO-HARDWARE-KIT', 'Demo Supplies', 'Demo Materials', 'KIT-INS', 'service_related_item', 'review_needed', 'Demo placeholder installation hardware kit.', 'Demo seed only. Not real stock.', 'kit', true, true, 800, 2495, 2995, 180)
  ) as seed(
    category_slug,
    name,
    internal_sku,
    brand,
    manufacturer,
    model,
    product_type,
    status,
    short_description,
    staff_notes,
    stock_unit,
    inventory_tracking_enabled,
    is_taxable,
    cost_cents,
    retail_price_cents,
    msrp_cents,
    sort_order
  )
),
category_lookup as (
  select id, slug
  from product_categories
)
insert into products (
  category_id,
  name,
  internal_sku,
  brand,
  manufacturer,
  model,
  product_type,
  status,
  short_description,
  staff_notes,
  stock_unit,
  inventory_tracking_enabled,
  is_taxable,
  cost_cents,
  retail_price_cents,
  msrp_cents
)
select
  category_lookup.id,
  seed_products.name,
  seed_products.internal_sku,
  seed_products.brand,
  seed_products.manufacturer,
  seed_products.model,
  seed_products.product_type,
  seed_products.status,
  seed_products.short_description,
  seed_products.staff_notes,
  seed_products.stock_unit,
  seed_products.inventory_tracking_enabled,
  seed_products.is_taxable,
  seed_products.cost_cents,
  seed_products.retail_price_cents,
  seed_products.msrp_cents
from seed_products
join category_lookup on category_lookup.slug = seed_products.category_slug
where not exists (
  select 1
  from products p
  where lower(p.internal_sku) = lower(seed_products.internal_sku)
);

with seed_inventory as (
  select *
  from (
    values
      ('DEMO-POOL-TABLE', 'SHOWROOM', 1.00, 0.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-POOL-TABLE', 'WAREHOUSE', 2.50, 1.00, 'unverified', 'Demo seed only - not verified inventory.'),
      ('DEMO-SHUFFLEBOARD', 'WAREHOUSE', 1.25, 1.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-FOOSBALL', 'SHOWROOM', 3.00, 1.00, 'counted', 'Demo seed only - not verified inventory.'),
      ('DEMO-AIR-HOCKEY', 'UNKNOWN_REVIEW', 0.50, 1.00, 'review_needed', 'Demo seed only - not verified inventory.'),
      ('DEMO-POOL-CUE', 'SHOWROOM', 7.75, 2.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-POOL-CUE', 'WAREHOUSE', 11.25, 3.00, 'unverified', 'Demo seed only - not verified inventory.'),
      ('DEMO-CUE-TIP', 'SERVICE_TRUCK', 43.50, 12.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-CUE-CHALK', 'SHOWROOM', 18.00, 6.00, 'counted', 'Demo seed only - not verified inventory.'),
      ('DEMO-CUE-GLOVE', 'WAREHOUSE', 4.25, 2.00, 'unverified', 'Demo seed only - not verified inventory.'),
      ('DEMO-CLOTH', 'WAREHOUSE', 14.75, 5.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-CUSHION-RUBBER', 'SERVICE_TRUCK', 2.00, 1.00, 'review_needed', 'Demo seed only - not verified inventory.'),
      ('DEMO-POCKET-SET', 'WAREHOUSE', 0.00, 0.00, 'counted', 'Demo seed only - not verified inventory.'),
      ('DEMO-DARTBOARD', 'SHOWROOM', 5.50, 2.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-TABLE-COVER', 'WAREHOUSE', 6.00, 2.00, 'unverified', 'Demo seed only - not verified inventory.'),
      ('DEMO-MOVING-BLANKET', 'SERVICE_TRUCK', 23.25, 8.00, 'estimated', 'Demo seed only - not verified inventory.'),
      ('DEMO-LEVELING-SHIMS', 'SERVICE_TRUCK', 31.50, 10.00, 'counted', 'Demo seed only - not verified inventory.'),
      ('DEMO-HARDWARE-KIT', 'UNKNOWN_REVIEW', 1.00, 2.00, 'review_needed', 'Demo seed only - not verified inventory.')
  ) as seed(internal_sku, location_code, quantity_on_hand, low_stock_threshold, inventory_confidence, notes)
),
inserted_inventory as (
  insert into product_inventory (
    product_id,
    location_id,
    quantity_on_hand,
    low_stock_threshold,
    inventory_confidence,
    notes,
    last_counted_at
  )
  select
    products.id,
    inventory_locations.id,
    seed_inventory.quantity_on_hand,
    seed_inventory.low_stock_threshold,
    seed_inventory.inventory_confidence,
    seed_inventory.notes,
    now()
  from seed_inventory
  join products on lower(products.internal_sku) = lower(seed_inventory.internal_sku)
  join inventory_locations on inventory_locations.location_code = seed_inventory.location_code
  where products.inventory_tracking_enabled = true
  on conflict (product_id, location_id) do nothing
  returning product_id, location_id, quantity_on_hand
)
insert into inventory_adjustments (
  product_id,
  location_id,
  adjustment_type,
  quantity_before,
  quantity_delta,
  quantity_after,
  reason,
  notes,
  adjusted_by
)
select
  inserted_inventory.product_id,
  inserted_inventory.location_id,
  'initial_count',
  0,
  inserted_inventory.quantity_on_hand,
  inserted_inventory.quantity_on_hand,
  'Demo seed only - not verified inventory.',
  'Created by Products / Inventory v1 demo seed data.',
  'Demo seed'
from inserted_inventory;
