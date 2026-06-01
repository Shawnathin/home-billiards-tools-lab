-- Cue Repairs v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create sequence if not exists cue_repair_number_seq;

create or replace function cue_repair_next_number()
returns text as $$
begin
  return 'CR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('cue_repair_number_seq')::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists cue_repair_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_price_cents integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cue_repair_types_name_not_blank check (length(btrim(name)) > 0),
  constraint cue_repair_types_default_price_cents_nonnegative check (default_price_cents >= 0)
);

create table if not exists cue_repair_jobs (
  id uuid primary key default gen_random_uuid(),
  repair_number text unique not null default cue_repair_next_number(),
  customer_name text not null,
  customer_phone text,
  customer_email text,
  cue_brand text,
  cue_model text,
  cue_description text,
  repair_type_id uuid references cue_repair_types(id) on delete set null,
  repair_type_other text,
  intake_notes text,
  internal_notes text,
  status text not null default 'received',
  estimate_cents integer not null default 0,
  final_price_cents integer,
  estimate_approved boolean not null default false,
  completed_at timestamptz,
  customer_contacted_at timestamptz,
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cue_repair_jobs_customer_name_not_blank check (length(btrim(customer_name)) > 0),
  constraint cue_repair_jobs_contact_required check (
    length(btrim(coalesce(customer_phone, ''))) > 0
    or length(btrim(coalesce(customer_email, ''))) > 0
  ),
  constraint cue_repair_jobs_cue_detail_required check (
    length(btrim(coalesce(cue_brand, ''))) > 0
    or length(btrim(coalesce(cue_model, ''))) > 0
    or length(btrim(coalesce(cue_description, ''))) > 0
  ),
  constraint cue_repair_jobs_repair_type_required check (
    repair_type_id is not null
    or length(btrim(coalesce(repair_type_other, ''))) > 0
  ),
  constraint cue_repair_jobs_status_valid check (
    status in (
      'received',
      'in_progress',
      'needs_attention',
      'ready_for_pickup',
      'picked_up',
      'cancelled'
    )
  ),
  constraint cue_repair_jobs_estimate_cents_nonnegative check (estimate_cents >= 0),
  constraint cue_repair_jobs_final_price_cents_nonnegative check (
    final_price_cents is null or final_price_cents >= 0
  )
);

create unique index if not exists cue_repair_types_name_unique_idx
  on cue_repair_types (lower(name));

create index if not exists cue_repair_types_active_sort_idx
  on cue_repair_types (is_active, sort_order, lower(name));

create index if not exists cue_repair_jobs_repair_number_idx
  on cue_repair_jobs (repair_number);

create index if not exists cue_repair_jobs_status_idx
  on cue_repair_jobs (status);

create index if not exists cue_repair_jobs_repair_type_id_idx
  on cue_repair_jobs (repair_type_id);

create index if not exists cue_repair_jobs_customer_name_idx
  on cue_repair_jobs (lower(customer_name));

create index if not exists cue_repair_jobs_customer_phone_idx
  on cue_repair_jobs (lower(customer_phone));

create index if not exists cue_repair_jobs_customer_email_idx
  on cue_repair_jobs (lower(customer_email));

create index if not exists cue_repair_jobs_created_at_idx
  on cue_repair_jobs (created_at desc);

create index if not exists cue_repair_jobs_updated_at_idx
  on cue_repair_jobs (updated_at desc);

create index if not exists cue_repair_jobs_picked_up_at_idx
  on cue_repair_jobs (picked_up_at);

create index if not exists cue_repair_jobs_cancelled_at_idx
  on cue_repair_jobs (cancelled_at);

create or replace function cue_repairs_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cue_repair_types_touch_updated_at on cue_repair_types;
create trigger cue_repair_types_touch_updated_at
  before update on cue_repair_types
  for each row
  execute function cue_repairs_touch_updated_at();

drop trigger if exists cue_repair_jobs_touch_updated_at on cue_repair_jobs;
create trigger cue_repair_jobs_touch_updated_at
  before update on cue_repair_jobs
  for each row
  execute function cue_repairs_touch_updated_at();

-- Optional demo/test seed data only.
-- These rows are intentionally labeled "Demo -" and use example pricing only.
-- Review or remove this section before running seed data in production.
-- No customer records or repair jobs are inserted here.
insert into cue_repair_types (name, description, default_price_cents, is_active, sort_order)
values
  ('Demo - Tip replacement', 'Demo repair type for replacing a worn or damaged cue tip.', 2500, true, 10),
  ('Demo - Tip shaping / mushroom clean-up', 'Demo repair type for reshaping a tip and cleaning mushrooming.', 1200, true, 20),
  ('Demo - Ferrule replacement', 'Demo repair type for replacing a cracked or damaged ferrule.', 6500, true, 30),
  ('Demo - Shaft cleaning / polish', 'Demo repair type for cleaning and polishing a cue shaft.', 2000, true, 40),
  ('Demo - Shaft ding repair', 'Demo repair type for addressing minor shaft dents or dings.', 3000, true, 50),
  ('Demo - Wrap repair / replacement', 'Demo repair type for cue wrap service or replacement.', 9500, true, 60),
  ('Demo - Bumper replacement', 'Demo repair type for replacing a missing or damaged bumper.', 1500, true, 70),
  ('Demo - Weight bolt adjustment', 'Demo repair type for cue weight bolt adjustment.', 1800, true, 80),
  ('Demo - Joint issue / inspection', 'Demo repair type for inspecting joint fit or related issues.', 3500, true, 90),
  ('Demo - Cue assessment / diagnosis', 'Demo repair type for a cue condition assessment.', 2000, true, 100),
  ('Demo - Other custom repair', 'Demo repair type for custom repair work not listed above.', 0, true, 110)
on conflict do nothing;
