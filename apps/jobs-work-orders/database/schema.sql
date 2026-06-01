-- Work Orders v1 workflow schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project after Customers / Contacts v1.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create sequence if not exists job_work_order_number_seq;

create or replace function job_work_order_next_number()
returns text as $$
begin
  return 'WO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('job_work_order_number_seq')::text, 4, '0');
end;
$$ language plpgsql;

create or replace function job_work_orders_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists customer_contact_properties (
  id uuid primary key default gen_random_uuid(),
  customer_contact_id uuid not null references customer_contacts(id) on delete cascade,
  label text,
  property_type text not null default 'service',
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  province text not null default 'BC',
  postal_code text,
  country text not null default 'Canada',
  site_access_notes text,
  parking_notes text,
  stairs_elevator_notes text,
  room_location_notes text,
  is_default_service_address boolean not null default false,
  is_billing_address boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contact_properties_address_not_blank check (length(btrim(address_line_1)) > 0),
  constraint customer_contact_properties_city_not_blank check (length(btrim(city)) > 0),
  constraint customer_contact_properties_province_not_blank check (length(btrim(province)) > 0),
  constraint customer_contact_properties_country_not_blank check (length(btrim(country)) > 0)
);

create table if not exists job_work_order_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  abbreviation text,
  commonly_uses_pickup_delivery boolean not null default false,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_order_types_name_not_blank check (length(btrim(name)) > 0),
  constraint job_work_order_types_slug_not_blank check (length(btrim(slug)) > 0),
  constraint job_work_order_types_abbreviation_not_blank check (
    abbreviation is null
    or length(btrim(abbreviation)) > 0
  )
);

create table if not exists job_work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text unique not null default job_work_order_next_number(),
  customer_contact_id uuid not null references customer_contacts(id) on delete restrict,
  customer_display_snapshot text,
  contact_person_name text,
  contact_person_phone text,
  contact_person_email text,
  customer_name text not null,
  customer_company text,
  customer_phone text,
  customer_email text,
  job_type_id uuid references job_work_order_types(id) on delete set null,
  job_type_other text,
  work_type_abbreviation text,
  location_mode text not null default 'service',
  title text not null,
  calendar_title text,
  source_reference text,
  reference_number text,
  old_system_reference text,
  customer_reference_number text,
  source_warranty_service_ticket_id uuid,
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
  cancellation_reason_code text,
  priority text not null default 'normal',
  status text not null default 'to_be_scheduled',
  legacy_status text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_orders_customer_name_not_blank check (length(btrim(customer_name)) > 0),
  constraint job_work_orders_contact_required check (
    length(btrim(coalesce(customer_phone, ''))) > 0
    or length(btrim(coalesce(customer_email, ''))) > 0
    or length(btrim(coalesce(contact_person_phone, ''))) > 0
    or length(btrim(coalesce(contact_person_email, ''))) > 0
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
      'quoted',
      'to_be_scheduled',
      'booked',
      'completed',
      'invoiced',
      'paid',
      'cancelled'
    )
  ),
  constraint job_work_orders_location_mode_valid check (
    location_mode in ('service', 'pickup_delivery')
  )
);

create table if not exists job_work_order_locations (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references job_work_orders(id) on delete cascade,
  role text not null,
  customer_contact_property_id uuid references customer_contact_properties(id) on delete set null,
  label text,
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  postal_code text,
  country text,
  site_access_notes text,
  parking_notes text,
  stairs_elevator_notes text,
  room_location_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_order_locations_role_valid check (role in ('service', 'pickup', 'delivery')),
  constraint job_work_order_locations_work_order_role_unique unique (work_order_id, role)
);

create table if not exists job_work_order_visits (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references job_work_orders(id) on delete cascade,
  visit_number integer not null default 1,
  visit_title text,
  visit_type text not null default 'service',
  schedule_state text not null default 'unscheduled',
  scheduled_date date,
  arrival_window_label text,
  start_time time,
  end_time time,
  anytime boolean not null default false,
  assigned_to text not null default 'hbs_internal',
  location_role text,
  primary_location_id uuid references job_work_order_locations(id) on delete set null,
  secondary_location_id uuid references job_work_order_locations(id) on delete set null,
  visit_status text not null default 'pending',
  visit_instructions text,
  timing_notes text,
  completion_notes text,
  cancellation_reason text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_work_order_visits_type_valid check (
    visit_type in (
      'service',
      'pickup',
      'delivery',
      'pickup_delivery',
      'install',
      'inspection',
      'follow_up',
      'warranty_service',
      'other'
    )
  ),
  constraint job_work_order_visits_schedule_state_valid check (schedule_state in ('unscheduled', 'booked')),
  constraint job_work_order_visits_window_valid check (
    arrival_window_label is null
    or arrival_window_label in (
      '9am-11am',
      '11am-1pm',
      '1pm-3pm',
      '3pm-5pm',
      'morning',
      'afternoon',
      'anytime',
      'custom'
    )
  ),
  constraint job_work_order_visits_assigned_to_valid check (assigned_to in ('hbs_internal', 'hbs_external')),
  constraint job_work_order_visits_location_role_valid check (
    location_role is null
    or location_role in ('service', 'pickup', 'delivery', 'pickup_delivery')
  ),
  constraint job_work_order_visits_status_valid check (visit_status in ('pending', 'completed', 'cancelled')),
  constraint job_work_order_visits_number_positive check (visit_number > 0),
  constraint job_work_order_visits_work_order_number_unique unique (work_order_id, visit_number)
);

create index if not exists customer_contact_properties_contact_idx
  on customer_contact_properties (customer_contact_id);

create index if not exists customer_contact_properties_city_idx
  on customer_contact_properties (lower(city));

create index if not exists customer_contact_properties_archived_at_idx
  on customer_contact_properties (archived_at);

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

create index if not exists job_work_orders_location_mode_idx
  on job_work_orders (location_mode);

create index if not exists job_work_orders_reference_number_idx
  on job_work_orders (lower(reference_number));

create index if not exists job_work_orders_old_system_reference_idx
  on job_work_orders (lower(old_system_reference));

create index if not exists job_work_orders_customer_reference_number_idx
  on job_work_orders (lower(customer_reference_number));

create index if not exists job_work_orders_source_warranty_service_ticket_id_idx
  on job_work_orders (source_warranty_service_ticket_id);

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

do $$
begin
  if to_regclass('warranty_service_tickets') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'job_work_orders_source_warranty_service_ticket_id_fkey'
        and conrelid = 'job_work_orders'::regclass
    )
  then
    alter table job_work_orders
      add constraint job_work_orders_source_warranty_service_ticket_id_fkey
      foreign key (source_warranty_service_ticket_id)
      references warranty_service_tickets(id)
      on delete set null;
  end if;
end $$;

create index if not exists job_work_order_locations_work_order_idx
  on job_work_order_locations (work_order_id);

create index if not exists job_work_order_locations_role_idx
  on job_work_order_locations (role);

create index if not exists job_work_order_locations_property_idx
  on job_work_order_locations (customer_contact_property_id);

create index if not exists job_work_order_locations_city_idx
  on job_work_order_locations (lower(city));

create index if not exists job_work_order_visits_work_order_idx
  on job_work_order_visits (work_order_id);

create index if not exists job_work_order_visits_schedule_state_idx
  on job_work_order_visits (schedule_state);

create index if not exists job_work_order_visits_visit_type_idx
  on job_work_order_visits (visit_type);

create index if not exists job_work_order_visits_scheduled_date_idx
  on job_work_order_visits (scheduled_date);

create index if not exists job_work_order_visits_assigned_to_idx
  on job_work_order_visits (assigned_to);

create index if not exists job_work_order_visits_visit_status_idx
  on job_work_order_visits (visit_status);

create index if not exists job_work_order_visits_primary_location_idx
  on job_work_order_visits (primary_location_id);

create index if not exists job_work_order_visits_secondary_location_idx
  on job_work_order_visits (secondary_location_id);

drop trigger if exists customer_contact_properties_touch_updated_at on customer_contact_properties;
create trigger customer_contact_properties_touch_updated_at
  before update on customer_contact_properties
  for each row
  execute function job_work_orders_touch_updated_at();

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

drop trigger if exists job_work_order_locations_touch_updated_at on job_work_order_locations;
create trigger job_work_order_locations_touch_updated_at
  before update on job_work_order_locations
  for each row
  execute function job_work_orders_touch_updated_at();

drop trigger if exists job_work_order_visits_touch_updated_at on job_work_order_visits;
create trigger job_work_order_visits_touch_updated_at
  before update on job_work_order_visits
  for each row
  execute function job_work_orders_touch_updated_at();

insert into job_work_order_types (
  name,
  slug,
  abbreviation,
  commonly_uses_pickup_delivery,
  description,
  is_active,
  sort_order
)
values
  ('Quote', 'quote', 'QUO', false, 'Quoted work or estimate that may become a scheduled job.', true, 10),
  ('Delivery', 'delivery', 'DEL', true, 'Delivery work that may include a destination address.', true, 20),
  ('Pickup', 'pickup', 'PU', true, 'Pickup work that may include an origin address.', true, 30),
  ('Move', 'move', 'MOV', true, 'Pool table or product move with pickup and delivery addresses.', true, 40),
  ('Dismantle', 'dismantle', 'DIS', false, 'Dismantle or teardown work.', true, 50),
  ('Assemble', 'assemble', 'ASM', false, 'Assembly or reassembly work.', true, 60),
  ('Installation', 'installation', 'INS', false, 'Installation work at a service address.', true, 70),
  ('Recover', 'recover', 'REC', false, 'Pool table recovering work.', true, 80),
  ('Level', 'level', 'LVL', false, 'Pool table leveling work.', true, 90),
  ('Warranty / Service', 'warranty-service', 'W/S', false, 'Warranty or service follow-up work.', true, 100),
  ('Inspection', 'inspection', 'INSP', false, 'Inspection or assessment visit.', true, 110),
  ('Commercial / Special Project', 'commercial-special-project', 'CSP', false, 'Commercial or special-project work.', true, 120),
  ('Other', 'other', 'OTH', false, 'Work that does not fit another active type.', true, 130)
on conflict (slug) do update
set
  name = excluded.name,
  abbreviation = excluded.abbreviation,
  commonly_uses_pickup_delivery = excluded.commonly_uses_pickup_delivery,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
