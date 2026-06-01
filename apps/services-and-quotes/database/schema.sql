-- Services & Quotes v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_categories_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  description text,
  base_price_cents integer not null default 0,
  unit_label text not null default 'service',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_name_not_blank check (length(btrim(name)) > 0),
  constraint services_unit_label_not_blank check (length(btrim(unit_label)) > 0),
  constraint services_base_price_cents_nonnegative check (base_price_cents >= 0)
);

create index if not exists service_categories_active_sort_idx
  on service_categories (is_active, sort_order, lower(name));

create unique index if not exists service_categories_name_unique_idx
  on service_categories (lower(name));

create index if not exists services_active_category_sort_idx
  on services (is_active, category_id, sort_order, lower(name));

create index if not exists services_category_id_idx
  on services (category_id);

create unique index if not exists services_category_name_unique_idx
  on services (category_id, lower(name))
  where category_id is not null;

create unique index if not exists services_uncategorized_name_unique_idx
  on services (lower(name))
  where category_id is null;

create or replace function services_and_quotes_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists service_categories_touch_updated_at on service_categories;
create trigger service_categories_touch_updated_at
  before update on service_categories
  for each row
  execute function services_and_quotes_touch_updated_at();

drop trigger if exists services_touch_updated_at on services;
create trigger services_touch_updated_at
  before update on services
  for each row
  execute function services_and_quotes_touch_updated_at();

-- Demo seed data only. These are example services, not customer records.
insert into service_categories (name, description, sort_order)
values
  ('Table Service', 'Common pool table setup and maintenance work.', 10),
  ('Moves', 'Pool table disassembly, transport prep, and reassembly work.', 20),
  ('Cloth & Cushions', 'Cloth replacement and cushion-related service work.', 30),
  ('Accessories Setup', 'Assembly and setup for common game room accessories.', 40)
on conflict do nothing;

with category_lookup as (
  select id, name
  from service_categories
  where name in ('Table Service', 'Moves', 'Cloth & Cushions', 'Accessories Setup')
)
insert into services (
  category_id,
  name,
  description,
  base_price_cents,
  unit_label,
  is_active,
  sort_order
)
select
  category_lookup.id,
  seed.name,
  seed.description,
  seed.base_price_cents,
  seed.unit_label,
  seed.is_active,
  seed.sort_order
from (
  values
    ('Table Service', 'Standard table leveling', 'Level a pool table after installation or seasonal movement.', 14900, 'service', true, 10),
    ('Table Service', 'Standard table setup', 'Basic setup service for a residential pool table.', 39900, 'service', true, 20),
    ('Moves', 'Disassemble table', 'Take down a pool table for moving or storage.', 29900, 'service', true, 10),
    ('Moves', 'Reassemble table', 'Reassemble a previously moved pool table.', 39900, 'service', true, 20),
    ('Cloth & Cushions', 'Cloth replacement labor', 'Labor estimate for replacing table cloth; cloth material priced separately.', 49900, 'service', true, 10),
    ('Cloth & Cushions', 'Cushion inspection', 'Inspect cushion condition and provide service recommendation.', 7900, 'service', true, 20),
    ('Accessories Setup', 'Ping pong top setup', 'Set up a conversion top or table tennis accessory.', 9900, 'service', true, 10),
    ('Accessories Setup', 'Retired demo accessory service', 'Inactive demo row used to verify inactive services stay out of the quote builder.', 1000, 'service', false, 90)
) as seed(category_name, name, description, base_price_cents, unit_label, is_active, sort_order)
join category_lookup on category_lookup.name = seed.category_name
on conflict do nothing;
