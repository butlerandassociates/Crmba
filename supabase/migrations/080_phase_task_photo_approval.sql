-- Photo approval status for phase task completion photos
-- Admin uploads → auto-approved; PM/Foreman uploads → pending admin review

alter table phase_task_completions
  add column if not exists photo_approval_status text not null default 'pending'
  check (photo_approval_status in ('pending', 'approved'));

-- Grandfather all existing photos as approved (uploaded before approval system existed)
update phase_task_completions
  set photo_approval_status = 'approved'
  where photo_url is not null;
