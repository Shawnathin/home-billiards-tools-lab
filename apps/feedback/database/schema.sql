-- Staff Feedback v1 schema
-- Run this in the Home Billiards Tools Lab Supabase project.

create extension if not exists pgcrypto;

create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  category text not null default 'other',
  severity text not null default 'medium',
  status text not null default 'new',
  source_app_slug text,
  source_app_label text,
  source_path text,
  source_url text,
  source_page_title text,
  related_record_type text,
  related_record_id text,
  related_record_label text,
  submitted_by_user_id uuid references users(id) on delete set null,
  submitted_by_display_name text,
  submitted_by_username text,
  user_agent text,
  admin_note text,
  reviewed_by_user_id uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_submissions_message_not_blank check (length(btrim(message)) > 0),
  constraint feedback_submissions_category_check check (
    category in ('bug', 'confusing', 'missing_field', 'workflow_issue', 'feature_idea', 'data_issue', 'other')
  ),
  constraint feedback_submissions_severity_check check (
    severity in ('low', 'medium', 'high', 'blocking')
  ),
  constraint feedback_submissions_status_check check (
    status in ('new', 'reviewing', 'accepted', 'deferred', 'resolved', 'dismissed')
  )
);

create index if not exists feedback_submissions_status_idx
  on feedback_submissions (status);

create index if not exists feedback_submissions_category_idx
  on feedback_submissions (category);

create index if not exists feedback_submissions_severity_idx
  on feedback_submissions (severity);

create index if not exists feedback_submissions_source_app_slug_idx
  on feedback_submissions (source_app_slug);

create index if not exists feedback_submissions_submitted_by_user_id_idx
  on feedback_submissions (submitted_by_user_id);

create index if not exists feedback_submissions_created_at_idx
  on feedback_submissions (created_at desc);

create index if not exists feedback_submissions_updated_at_idx
  on feedback_submissions (updated_at desc);

create or replace function feedback_submissions_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists feedback_submissions_touch_updated_at on feedback_submissions;
create trigger feedback_submissions_touch_updated_at
  before update on feedback_submissions
  for each row
  execute function feedback_submissions_touch_updated_at();
