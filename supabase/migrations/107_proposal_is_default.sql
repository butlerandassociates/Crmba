-- Migration 107: Mark one proposal as default per client.
-- Jonathan Jun 13 2026: auto-set on accept, manually overridable by admin.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

COMMENT ON COLUMN public.estimates.is_default IS 'True on the proposal the team is actively working from. Auto-set when a proposal is accepted; admin can manually change it.';
