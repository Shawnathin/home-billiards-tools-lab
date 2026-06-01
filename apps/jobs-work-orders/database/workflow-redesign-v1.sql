-- Work Orders workflow redesign v1 migration
-- Run this after Customers / Contacts v1, contact-linking v1, Warranty / Service Tickets v1,
-- and the original Jobs / Work Orders v1 schema.
-- Do not run this against the live Cue Tracker database.

begin;

create extension if not exists pgcrypto;

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

create index if not exists customer_contact_properties_contact_idx
  on customer_contact_properties (customer_contact_id);

create index if not exists customer_contact_properties_city_idx
  on customer_contact_properties (lower(city));

create index if not exists customer_contact_properties_archived_at_idx
  on customer_contact_properties (archived_at);

drop trigger if exists customer_contact_properties_touch_updated_at on customer_contact_properties;
create trigger customer_contact_properties_touch_updated_at
  before update on customer_contact_properties
  for each row
  execute function customer_contacts_touch_updated_at();

alter table job_work_order_types
  add column if not exists abbreviation text;

alter table job_work_order_types
  add column if not exists commonly_uses_pickup_delivery boolean not null default false;

update job_work_order_types
set is_active = false
where slug like 'demo-%';

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

alter table job_work_orders
  add column if not exists customer_display_snapshot text;

alter table job_work_orders
  add column if not exists contact_person_name text;

alter table job_work_orders
  add column if not exists contact_person_phone text;

alter table job_work_orders
  add column if not exists contact_person_email text;

alter table job_work_orders
  add column if not exists location_mode text not null default 'service';

alter table job_work_orders
  add column if not exists calendar_title text;

alter table job_work_orders
  add column if not exists work_type_abbreviation text;

alter table job_work_orders
  add column if not exists reference_number text;

alter table job_work_orders
  add column if not exists old_system_reference text;

alter table job_work_orders
  add column if not exists customer_reference_number text;

alter table job_work_orders
  add column if not exists source_warranty_service_ticket_id uuid;

alter table job_work_orders
  add column if not exists legacy_status text;

alter table job_work_orders
  add column if not exists cancellation_reason_code text;

update job_work_orders
set
  legacy_status = coalesce(legacy_status, status),
  customer_display_snapshot = coalesce(
    customer_display_snapshot,
    nullif(btrim(concat_ws(' / ', customer_company, customer_name)), ''),
    customer_name
  ),
  reference_number = coalesce(reference_number, source_reference),
  work_type_abbreviation = coalesce(work_type_abbreviation, jt.abbreviation)
from job_work_order_types jt
where job_work_orders.job_type_id = jt.id;

update job_work_orders
set
  legacy_status = coalesce(legacy_status, status),
  customer_display_snapshot = coalesce(
    customer_display_snapshot,
    nullif(btrim(concat_ws(' / ', customer_company, customer_name)), ''),
    customer_name
  ),
  reference_number = coalesce(reference_number, source_reference)
where job_type_id is null;

alter table job_work_orders
  alter column status set default 'to_be_scheduled';

alter table job_work_orders
  drop constraint if exists job_work_orders_status_valid;

update job_work_orders
set status = case status
  when 'open' then 'to_be_scheduled'
  when 'scheduled' then 'booked'
  when 'in_progress' then 'booked'
  when 'waiting_on_customer' then 'quoted'
  when 'waiting_on_parts' then 'to_be_scheduled'
  else status
end
where status in (
  'open',
  'scheduled',
  'in_progress',
  'waiting_on_customer',
  'waiting_on_parts'
);

update job_work_orders
set status = 'to_be_scheduled'
where status not in (
  'quoted',
  'to_be_scheduled',
  'booked',
  'completed',
  'invoiced',
  'paid',
  'cancelled'
);

alter table job_work_orders
  add constraint job_work_orders_status_valid check (
    status in (
      'quoted',
      'to_be_scheduled',
      'booked',
      'completed',
      'invoiced',
      'paid',
      'cancelled'
    )
  );

alter table job_work_orders
  drop constraint if exists job_work_orders_location_mode_valid;

alter table job_work_orders
  add constraint job_work_orders_location_mode_valid check (
    location_mode in ('service', 'pickup_delivery')
  );

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

create index if not exists job_work_order_locations_work_order_idx
  on job_work_order_locations (work_order_id);

create index if not exists job_work_order_locations_role_idx
  on job_work_order_locations (role);

create index if not exists job_work_order_locations_property_idx
  on job_work_order_locations (customer_contact_property_id);

create index if not exists job_work_order_locations_city_idx
  on job_work_order_locations (lower(city));

drop trigger if exists job_work_order_locations_touch_updated_at on job_work_order_locations;
create trigger job_work_order_locations_touch_updated_at
  before update on job_work_order_locations
  for each row
  execute function job_work_orders_touch_updated_at();

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

alter table job_work_order_visits
  add column if not exists visit_type text not null default 'service';

alter table job_work_order_visits
  add column if not exists location_role text;

alter table job_work_order_visits
  add column if not exists primary_location_id uuid;

alter table job_work_order_visits
  add column if not exists secondary_location_id uuid;

alter table job_work_order_visits
  add column if not exists timing_notes text;

alter table job_work_order_visits
  drop constraint if exists job_work_order_visits_type_valid;

alter table job_work_order_visits
  add constraint job_work_order_visits_type_valid check (
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
  );

alter table job_work_order_visits
  drop constraint if exists job_work_order_visits_location_role_valid;

alter table job_work_order_visits
  add constraint job_work_order_visits_location_role_valid check (
    location_role is null
    or location_role in ('service', 'pickup', 'delivery', 'pickup_delivery')
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_work_order_visits_primary_location_id_fkey'
      and conrelid = 'job_work_order_visits'::regclass
  ) then
    alter table job_work_order_visits
      add constraint job_work_order_visits_primary_location_id_fkey
      foreign key (primary_location_id)
      references job_work_order_locations(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_work_order_visits_secondary_location_id_fkey'
      and conrelid = 'job_work_order_visits'::regclass
  ) then
    alter table job_work_order_visits
      add constraint job_work_order_visits_secondary_location_id_fkey
      foreign key (secondary_location_id)
      references job_work_order_locations(id)
      on delete set null;
  end if;
end $$;

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

drop trigger if exists job_work_order_visits_touch_updated_at on job_work_order_visits;
create trigger job_work_order_visits_touch_updated_at
  before update on job_work_order_visits
  for each row
  execute function job_work_orders_touch_updated_at();

insert into job_work_order_locations (
  work_order_id,
  role,
  label,
  address_line_1,
  address_line_2,
  city,
  province,
  postal_code,
  country,
  site_access_notes
)
select
  w.id,
  'service',
  w.service_location_name,
  w.service_address_line_1,
  w.service_address_line_2,
  w.service_city,
  w.service_province,
  w.service_postal_code,
  'Canada',
  w.access_notes
from job_work_orders w
where not exists (
    select 1
    from job_work_order_locations l
    where l.work_order_id = w.id
  )
  and (
    length(btrim(coalesce(w.service_address_line_1, ''))) > 0
    or length(btrim(coalesce(w.service_city, ''))) > 0
    or length(btrim(coalesce(w.service_location_name, ''))) > 0
    or length(btrim(coalesce(w.access_notes, ''))) > 0
  );

insert into job_work_order_visits (
  work_order_id,
  visit_number,
  visit_title,
  visit_type,
  schedule_state,
  scheduled_date,
  location_role,
  primary_location_id,
  secondary_location_id,
  assigned_to,
  visit_status,
  visit_instructions,
  completion_notes,
  cancellation_reason,
  completed_at,
  cancelled_at
)
select
  w.id,
  1,
  w.title,
  case
    when w.location_mode = 'pickup_delivery' then 'pickup_delivery'
    else 'service'
  end,
  case when w.scheduled_date is null then 'unscheduled' else 'booked' end,
  w.scheduled_date,
  case
    when w.location_mode = 'pickup_delivery' then 'pickup_delivery'
    else 'service'
  end,
  (
    select l.id
    from job_work_order_locations l
    where l.work_order_id = w.id
      and l.role = case when w.location_mode = 'pickup_delivery' then 'pickup' else 'service' end
    limit 1
  ),
  (
    select l.id
    from job_work_order_locations l
    where l.work_order_id = w.id
      and w.location_mode = 'pickup_delivery'
      and l.role = 'delivery'
    limit 1
  ),
  case
    when w.assigned_to_text ilike '%external%' then 'hbs_external'
    else 'hbs_internal'
  end,
  case
    when w.status = 'completed' then 'completed'
    when w.status = 'cancelled' then 'cancelled'
    else 'pending'
  end,
  w.job_notes,
  w.completion_notes,
  w.cancellation_reason,
  w.completed_at,
  w.cancelled_at
from job_work_orders w
where not exists (
  select 1
  from job_work_order_visits v
  where v.work_order_id = w.id
);

commit;
