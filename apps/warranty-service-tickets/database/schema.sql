-- Warranty / Service Tickets v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create sequence if not exists warranty_service_ticket_number_seq;

create or replace function warranty_service_ticket_next_number()
returns text as $$
begin
  return 'WST-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('warranty_service_ticket_number_seq')::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists warranty_ticket_issue_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warranty_ticket_issue_types_name_not_blank check (length(btrim(name)) > 0),
  constraint warranty_ticket_issue_types_slug_not_blank check (length(btrim(slug)) > 0)
);

create table if not exists warranty_service_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null default warranty_service_ticket_next_number(),
  customer_name text not null,
  customer_phone text,
  customer_email text,
  issue_type_id uuid references warranty_ticket_issue_types(id) on delete set null,
  issue_type_other text,
  product_involved text,
  order_or_job_reference text,
  is_warranty boolean not null default false,
  issue_description text not null,
  internal_notes text,
  resolution_notes text,
  priority text not null default 'normal',
  status text not null default 'open',
  follow_up_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warranty_service_tickets_customer_name_not_blank check (length(btrim(customer_name)) > 0),
  constraint warranty_service_tickets_contact_required check (
    length(btrim(coalesce(customer_phone, ''))) > 0
    or length(btrim(coalesce(customer_email, ''))) > 0
  ),
  constraint warranty_service_tickets_issue_description_not_blank check (
    length(btrim(issue_description)) > 0
  ),
  constraint warranty_service_tickets_issue_type_required check (
    issue_type_id is not null
    or length(btrim(coalesce(issue_type_other, ''))) > 0
  ),
  constraint warranty_service_tickets_priority_valid check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint warranty_service_tickets_status_valid check (
    status in (
      'open',
      'in_progress',
      'needs_attention',
      'waiting_on_customer',
      'resolved',
      'cancelled'
    )
  )
);

create index if not exists warranty_ticket_issue_types_slug_idx
  on warranty_ticket_issue_types (slug);

create index if not exists warranty_ticket_issue_types_active_sort_idx
  on warranty_ticket_issue_types (is_active, sort_order, lower(name));

create index if not exists warranty_service_tickets_ticket_number_idx
  on warranty_service_tickets (ticket_number);

create index if not exists warranty_service_tickets_status_idx
  on warranty_service_tickets (status);

create index if not exists warranty_service_tickets_priority_idx
  on warranty_service_tickets (priority);

create index if not exists warranty_service_tickets_issue_type_id_idx
  on warranty_service_tickets (issue_type_id);

create index if not exists warranty_service_tickets_is_warranty_idx
  on warranty_service_tickets (is_warranty);

create index if not exists warranty_service_tickets_follow_up_at_idx
  on warranty_service_tickets (follow_up_at);

create index if not exists warranty_service_tickets_resolved_at_idx
  on warranty_service_tickets (resolved_at);

create index if not exists warranty_service_tickets_cancelled_at_idx
  on warranty_service_tickets (cancelled_at);

create index if not exists warranty_service_tickets_created_at_idx
  on warranty_service_tickets (created_at desc);

create index if not exists warranty_service_tickets_updated_at_idx
  on warranty_service_tickets (updated_at desc);

create index if not exists warranty_service_tickets_customer_name_idx
  on warranty_service_tickets (lower(customer_name));

create index if not exists warranty_service_tickets_customer_phone_idx
  on warranty_service_tickets (lower(customer_phone));

create index if not exists warranty_service_tickets_customer_email_idx
  on warranty_service_tickets (lower(customer_email));

create or replace function warranty_service_tickets_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists warranty_ticket_issue_types_touch_updated_at on warranty_ticket_issue_types;
create trigger warranty_ticket_issue_types_touch_updated_at
  before update on warranty_ticket_issue_types
  for each row
  execute function warranty_service_tickets_touch_updated_at();

drop trigger if exists warranty_service_tickets_touch_updated_at on warranty_service_tickets;
create trigger warranty_service_tickets_touch_updated_at
  before update on warranty_service_tickets
  for each row
  execute function warranty_service_tickets_touch_updated_at();

-- Optional demo/test seed data only.
-- These issue types are intentionally labeled "Demo -".
-- Demo data must be reviewed, replaced, or removed before real staff use.
-- No tickets, customer records, or real customer data are inserted here.
insert into warranty_ticket_issue_types (name, slug, description, is_active, sort_order)
values
  ('Demo - Warranty claim', 'demo-warranty-claim', 'Demo issue type for a warranty claim review.', true, 10),
  ('Demo - Product issue', 'demo-product-issue', 'Demo issue type for a product problem.', true, 20),
  ('Demo - Service issue', 'demo-service-issue', 'Demo issue type for a service-related issue.', true, 30),
  ('Demo - Delivery damage', 'demo-delivery-damage', 'Demo issue type for delivery damage follow-up.', true, 40),
  ('Demo - Missing parts', 'demo-missing-parts', 'Demo issue type for missing parts or components.', true, 50),
  ('Demo - Installation concern', 'demo-installation-concern', 'Demo issue type for installation concerns.', true, 60),
  ('Demo - Customer follow-up', 'demo-customer-follow-up', 'Demo issue type for customer follow-up.', true, 70),
  ('Demo - Other issue', 'demo-other-issue', 'Demo issue type for issues not listed above.', true, 80)
on conflict (slug) do nothing;
