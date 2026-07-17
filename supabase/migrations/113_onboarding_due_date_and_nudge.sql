-- Migration 113: Add due_date to onboarding_programs
-- Allows admin to set a completion deadline shown on the employee's Overview tab.
-- Safe to re-run.

ALTER TABLE public.onboarding_programs
  ADD COLUMN IF NOT EXISTS due_date DATE NULL;

COMMENT ON COLUMN public.onboarding_programs.due_date IS
  'Optional completion deadline shown on the employee Overview tab ("Complete by …").';
