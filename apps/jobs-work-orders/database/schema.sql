-- Jobs / Work Orders v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create sequence if not exists job_work_order_number_seq;

create or replace function job_work_order_next_number()
returns text as $$
begin
  return 'WO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('job_work_order_number_seq')::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists job_work_order_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_order_types_name_not_blank check (length(btrim(name)) > 0),
  constraint job_work_order_types_slug_not_blank check (length(btrim(slug)) > 0)
);

create table if not exists job_work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text unique not null default job_work_order_next_number(),
  customer_contact_id uuid null references customer_contacts(id) on delete set null,
  customer_name text not null,
  customer_company text,
  customer_phone text,
  customer_email text,
  job_type_id uuid references job_work_order_types(id) on delete set null,
  job_type_other text,
  title text not null,
  source_reference text,
  product_or_table_involved text,
  service_address_line_1 text,
  service_address_line_2 text,
  service_city text,
  service_province text,
  service_postal_code text,
  service_location_name text,
  access_notes text,
  service_details text not null,
  scheduled_date date,
  assigned_to_text text,
  job_notes text,
  internal_notes text,
  completion_notes text,
  cancellation_reason text,
  priority text not null default 'normal',
  status text not null default 'open',
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_orders_customer_name_not_blank check (length(btrim(customer_name)) > 0),
  constraint job_work_orders_contact_required check (
    length(btrim(coalesce(customer_phone, ''))) > 0
    or length(btrim(coalesce(customer_email, ''))) > 0
  ),
  constraint job_work_orders_job_type_required check (
    job_type_id is not null
    or length(btrim(coalesce(job_type_other, ''))) > 0
  ),
  constraint job_work_orders_title_not_blank check (length(btrim(title)) > 0),
  constraint job_work_orders_service_details_not_blank check (length(btrim(service_details)) > 0),
  constraint job_work_orders_priority_valid check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint job_work_orders_status_valid check (
    status in (
      'open',
      'scheduled',
      'in_progress',
      'waiting_on_customer',
      'waiting_on_parts',
      'completed',
      'cancelled'
    )
  )
);

create index if not exists job_work_order_types_slug_idx
  on job_work_order_types (slug);

create index if not exists job_work_order_types_active_sort_idx
  on job_work_order_types (is_active, sort_order, lower(name));

create index if not exists job_work_orders_work_order_number_idx
  on job_work_orders (work_order_number);

create index if not exists job_work_orders_customer_contact_id_idx
  on job_work_orders (customer_contact_id);

create index if not exists job_work_orders_customer_name_idx
  on job_work_orders (lower(customer_name));

create index if not exists job_work_orders_customer_phone_idx
  on job_work_orders (lower(customer_phone));

create index if not exists job_work_orders_customer_email_idx
  on job_work_orders (lower(customer_email));

create index if not exists job_work_orders_job_type_id_idx
  on job_work_orders (job_type_id);

create index if not exists job_work_orders_status_idx
  on job_work_orders (status);

create index if not exists job_work_orders_priority_idx
  on job_work_orders (priority);

create index if not exists job_work_orders_scheduled_date_idx
  on job_work_orders (scheduled_date);

create index if not exists job_work_orders_completed_at_idx
  on job_work_orders (completed_at);

create index if not exists job_work_orders_cancelled_at_idx
  on job_work_orders (cancelled_at);

create index if not exists job_work_orders_archived_at_idx
  on job_work_orders (archived_at);

create index if not exists job_work_orders_created_at_idx
  on job_work_orders (created_at desc);

create index if not exists job_work_orders_updated_at_idx
  on job_work_orders (updated_at desc);

create or replace function job_work_orders_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists job_work_order_types_touch_updated_at on job_work_order_types;
create trigger job_work_order_types_touch_updated_at
  before update on job_work_order_types
  for each row
  execute function job_work_orders_touch_updated_at();

drop trigger if exists job_work_orders_touch_updated_at on job_work_orders;
create trigger job_work_orders_touch_updated_at
  before update on job_work_orders
  for each row
  execute function job_work_orders_touch_updated_at();

-- Optional demo/reference seed data only.
-- These job types are intentionally labeled "Demo -".
-- Demo/reference data must be reviewed, replaced, or removed before real staff use.
-- No work orders, customer records, fake customer names, phone numbers, or emails are inserted here.
insert into job_work_order_types (name, slug, description, is_active, sort_order)
values
  ('Demo - Pool Table Move', 'demo-pool-table-move', 'Demo job type for moving a pool table.', true, 10),
  ('Demo - Pool Table Installation', 'demo-pool-table-installation', 'Demo job type for installing a pool table.', true, 20),
  ('Demo - Pool Table Recovering', 'demo-pool-table-recovering', 'Demo job type for pool table recovering work.', true, 30),
  ('Demo - Pool Table Leveling', 'demo-pool-table-leveling', 'Demo job type for leveling service.', true, 40),
  ('Demo - Shuffleboard Service', 'demo-shuffleboard-service', 'Demo job type for shuffleboard service work.', true, 50),
  ('Demo - Delivery / Pickup', 'demo-delivery-pickup', 'Demo job type for delivery or pickup work.', true, 60),
  ('Demo - Custom Service Work', 'demo-custom-service-work', 'Demo job type for custom service work.', true, 70),
  ('Demo - Commercial Service Work', 'demo-commercial-service-work', 'Demo job type for commercial service work.', true, 80),
  ('Demo - Other / Review Needed', 'demo-other-review-needed', 'Demo job type for work that needs review.', true, 90)
on conflict (slug) do nothing;
