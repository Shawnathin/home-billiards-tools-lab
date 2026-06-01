-- Customers / Contacts v1 schema
-- Run this in the NEW Home Billiards Tools Lab Supabase project.
-- Do not run this against any production database.

create extension if not exists pgcrypto;

create sequence if not exists customer_contact_number_seq;

create or replace function customer_contacts_next_number()
returns text as $$
begin
  return 'CT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('customer_contact_number_seq')::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists customer_contact_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contact_types_name_not_blank check (length(btrim(name)) > 0),
  constraint customer_contact_types_slug_not_blank check (length(btrim(slug)) > 0)
);

create table if not exists customer_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_number text unique not null default customer_contacts_next_number(),
  contact_type_id uuid references customer_contact_types(id) on delete set null,
  contact_type_other text,
  display_name text not null,
  company_name text,
  phone text,
  email text,
  preferred_contact_method text not null default 'unknown',
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  postal_code text,
  country text not null default 'Canada',
  notes text,
  tags text,
  status text not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contacts_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint customer_contacts_contact_method_required check (
    length(btrim(coalesce(phone, ''))) > 0
    or length(btrim(coalesce(email, ''))) > 0
  ),
  constraint customer_contacts_contact_type_required check (
    contact_type_id is not null
    or length(btrim(coalesce(contact_type_other, ''))) > 0
  ),
  constraint customer_contacts_preferred_contact_method_valid check (
    preferred_contact_method in ('phone', 'email', 'text', 'unknown')
  ),
  constraint customer_contacts_status_valid check (
    status in ('active', 'inactive', 'review_needed', 'archived')
  ),
  constraint customer_contacts_archived_at_required check (
    status <> 'archived'
    or archived_at is not null
  )
);

create index if not exists customer_contact_types_slug_idx
  on customer_contact_types (slug);

create index if not exists customer_contact_types_active_sort_idx
  on customer_contact_types (is_active, sort_order, lower(name));

create index if not exists customer_contacts_contact_number_idx
  on customer_contacts (contact_number);

create index if not exists customer_contacts_display_name_idx
  on customer_contacts (lower(display_name));

create index if not exists customer_contacts_company_name_idx
  on customer_contacts (lower(company_name));

create index if not exists customer_contacts_phone_idx
  on customer_contacts (lower(phone));

create index if not exists customer_contacts_email_idx
  on customer_contacts (lower(email));

create index if not exists customer_contacts_contact_type_id_idx
  on customer_contacts (contact_type_id);

create index if not exists customer_contacts_preferred_contact_method_idx
  on customer_contacts (preferred_contact_method);

create index if not exists customer_contacts_status_idx
  on customer_contacts (status);

create index if not exists customer_contacts_archived_at_idx
  on customer_contacts (archived_at);

create index if not exists customer_contacts_city_idx
  on customer_contacts (lower(city));

create index if not exists customer_contacts_province_idx
  on customer_contacts (lower(province));

create index if not exists customer_contacts_created_at_idx
  on customer_contacts (created_at desc);

create index if not exists customer_contacts_updated_at_idx
  on customer_contacts (updated_at desc);

create or replace function customer_contacts_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customer_contact_types_touch_updated_at on customer_contact_types;
create trigger customer_contact_types_touch_updated_at
  before update on customer_contact_types
  for each row
  execute function customer_contacts_touch_updated_at();

drop trigger if exists customer_contacts_touch_updated_at on customer_contacts;
create trigger customer_contacts_touch_updated_at
  before update on customer_contacts
  for each row
  execute function customer_contacts_touch_updated_at();

-- Optional demo/test seed data only.
-- These contact types are intentionally labeled "Demo -".
-- Demo data must be reviewed, replaced, or removed before real staff use.
-- No customer contact records, fake contacts, or real customer data are inserted here.
insert into customer_contact_types (name, slug, description, is_active, sort_order)
values
  ('Demo - Customer', 'demo-customer', 'Demo contact type for a customer contact.', true, 10),
  ('Demo - Designer', 'demo-designer', 'Demo contact type for an interior designer contact.', true, 20),
  ('Demo - Builder / Contractor', 'demo-builder-contractor', 'Demo contact type for a builder or contractor contact.', true, 30),
  ('Demo - Vendor / Supplier', 'demo-vendor-supplier', 'Demo contact type for a vendor or supplier contact.', true, 40),
  ('Demo - Service Contact', 'demo-service-contact', 'Demo contact type for a service contact.', true, 50),
  ('Demo - Commercial Client', 'demo-commercial-client', 'Demo contact type for a commercial client contact.', true, 60),
  ('Demo - Other Contact', 'demo-other-contact', 'Demo contact type for another kind of business contact.', true, 70)
on conflict (slug) do nothing;
