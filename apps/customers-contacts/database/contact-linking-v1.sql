-- Customers / Contacts contact-linking v1 migration
-- Run this after the Cue Repairs, Warranty / Service Tickets, and Customers / Contacts v1 schemas.
-- Do not run this against any live production database.

alter table cue_repair_jobs
  add column if not exists customer_contact_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cue_repair_jobs_customer_contact_id_fkey'
      and conrelid = 'cue_repair_jobs'::regclass
  ) then
    alter table cue_repair_jobs
      add constraint cue_repair_jobs_customer_contact_id_fkey
      foreign key (customer_contact_id)
      references customer_contacts(id)
      on delete set null;
  end if;
end $$;

create index if not exists cue_repair_jobs_customer_contact_id_idx
  on cue_repair_jobs (customer_contact_id);

alter table warranty_service_tickets
  add column if not exists customer_contact_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warranty_service_tickets_customer_contact_id_fkey'
      and conrelid = 'warranty_service_tickets'::regclass
  ) then
    alter table warranty_service_tickets
      add constraint warranty_service_tickets_customer_contact_id_fkey
      foreign key (customer_contact_id)
      references customer_contacts(id)
      on delete set null;
  end if;
end $$;

create index if not exists warranty_service_tickets_customer_contact_id_idx
  on warranty_service_tickets (customer_contact_id);
