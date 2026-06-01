-- Cue Repairs status simplification migration.
-- Run this once in the Home Billiards Tools Lab Supabase database.
-- Do not run this against the live Cue Tracker database.

begin;

update cue_repair_jobs
set status = case status
  when 'assessing' then 'needs_attention'
  when 'waiting_approval' then 'needs_attention'
  when 'waiting_for_parts' then 'needs_attention'
  when 'approved' then 'in_progress'
  else status
end
where status in (
  'assessing',
  'waiting_approval',
  'waiting_for_parts',
  'approved'
);

alter table cue_repair_jobs
  drop constraint if exists cue_repair_jobs_status_valid;

alter table cue_repair_jobs
  add constraint cue_repair_jobs_status_valid check (
    status in (
      'received',
      'in_progress',
      'needs_attention',
      'ready_for_pickup',
      'picked_up',
      'cancelled'
    )
  );

commit;
