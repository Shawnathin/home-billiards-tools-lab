-- Internal Messages v1 schema
-- Run this in the Home Billiards Tools Lab Supabase project.

create extension if not exists pgcrypto;

create table if not exists internal_message_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  related_record_type text,
  related_record_id text,
  related_record_label text,
  created_by_user_id uuid references users(id) on delete set null,
  created_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint internal_message_threads_subject_not_blank check (length(btrim(subject)) > 0),
  constraint internal_message_threads_status_check check (
    status in ('open', 'resolved', 'archived')
  ),
  constraint internal_message_threads_priority_check check (
    priority in ('normal', 'needs_attention', 'urgent')
  ),
  constraint internal_message_threads_related_type_check check (
    related_record_type is null
    or related_record_type in (
      'work_order',
      'customer_contact',
      'warranty_service_ticket',
      'cue_repair',
      'product_inventory',
      'general'
    )
  )
);

create table if not exists internal_message_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references internal_message_threads(id) on delete cascade,
  body text not null,
  created_by_user_id uuid references users(id) on delete set null,
  created_by_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_message_posts_body_not_blank check (length(btrim(body)) > 0)
);

create table if not exists internal_message_read_states (
  thread_id uuid not null references internal_message_threads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists internal_message_threads_status_idx
  on internal_message_threads (status);

create index if not exists internal_message_threads_priority_idx
  on internal_message_threads (priority);

create index if not exists internal_message_threads_related_record_type_idx
  on internal_message_threads (related_record_type);

create index if not exists internal_message_threads_last_message_at_idx
  on internal_message_threads (last_message_at desc);

create index if not exists internal_message_threads_created_by_user_id_idx
  on internal_message_threads (created_by_user_id);

create index if not exists internal_message_posts_thread_id_created_at_idx
  on internal_message_posts (thread_id, created_at asc);

create index if not exists internal_message_posts_created_by_user_id_idx
  on internal_message_posts (created_by_user_id);

create index if not exists internal_message_read_states_user_id_idx
  on internal_message_read_states (user_id);

create or replace function internal_message_threads_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists internal_message_threads_touch_updated_at on internal_message_threads;
create trigger internal_message_threads_touch_updated_at
  before update on internal_message_threads
  for each row
  execute function internal_message_threads_touch_updated_at();

create or replace function internal_message_posts_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists internal_message_posts_touch_updated_at on internal_message_posts;
create trigger internal_message_posts_touch_updated_at
  before update on internal_message_posts
  for each row
  execute function internal_message_posts_touch_updated_at();

create or replace function internal_message_posts_touch_thread()
returns trigger as $$
begin
  update internal_message_threads
  set
    last_message_at = greatest(last_message_at, new.created_at),
    updated_at = now()
  where id = new.thread_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists internal_message_posts_touch_thread on internal_message_posts;
create trigger internal_message_posts_touch_thread
  after insert on internal_message_posts
  for each row
  execute function internal_message_posts_touch_thread();
