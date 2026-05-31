-- Home Billiards Tools Lab v0.1 schema
-- Run this in the NEW Supabase project for this lab app.
-- Do not run this against the live Cue Tracker database.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_username_idx on users (username);

create table if not exists login_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  username_attempted text,
  success boolean not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_at_idx on login_events (created_at desc);

-- connect-pg-simple uses this table for server-side sessions.
create table if not exists "session" (
  "sid" varchar not null collate "default",
  "sess" json not null,
  "expire" timestamp(6) not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_pkey'
  ) then
    alter table "session" add constraint "session_pkey" primary key ("sid");
  end if;
end $$;

create index if not exists "IDX_session_expire" on "session" ("expire");
