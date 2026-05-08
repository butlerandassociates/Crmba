-- Migration 061: Add "voided" status to estimates
-- Voided = superseded internally when another proposal is accepted (auto-set by app)
-- Declined = client explicitly said no (set by client on public proposal page)
-- These are distinct and should never be confused.

-- 1. Drop existing CHECK constraint on status
alter table public.estimates drop constraint if exists estimates_status_check;

-- 2. Add new CHECK constraint including "voided"
alter table public.estimates
  add constraint estimates_status_check
  check (status in ('draft', 'saved', 'sent', 'accepted', 'declined', 'voided'));

-- 3. Add voided_at timestamp column
alter table public.estimates
  add column if not exists voided_at timestamptz default null;
