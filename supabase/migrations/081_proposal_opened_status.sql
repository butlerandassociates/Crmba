-- Migration 081: Add "opened" status to estimates (proposals)
-- Tracks when a client has viewed/opened a sent proposal via the public link.

-- 1. Drop existing status check constraint
alter table public.estimates drop constraint if exists estimates_status_check;

-- 2. Add updated CHECK constraint including "opened"
alter table public.estimates
  add constraint estimates_status_check
  check (status in ('draft', 'saved', 'sent', 'opened', 'accepted', 'declined', 'voided'));

-- 3. Add opened_at timestamp column
alter table public.estimates
  add column if not exists opened_at timestamptz default null;
