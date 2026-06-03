-- Migration 097: Employee home address (for mileage business/personal auto-classification)
-- Phase 2: store each PM/Sales Rep's home address so the system can suggest whether a
-- trip is Business (home/office → job site) or Personal (everything else, $0). The admin
-- still reviews/confirms every trip before saving — this only pre-fills the suggestion.
-- Safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_address text;

COMMENT ON COLUMN public.profiles.home_address IS 'Employee home address — anchor for mileage business/personal auto-classification (home → job site = business)';
