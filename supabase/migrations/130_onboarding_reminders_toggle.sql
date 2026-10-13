-- ─────────────────────────────────────────────────────────────────────────────
-- Onboarding reminders: admin on/off switch.
--
-- Jonathan (Oct 13 2026): "can you turn these automatic onboarding reminders off or give me the
-- ability to do so?" — the 'onboarding-reminders' pg_cron job (migration 112) emails every
-- sales rep / PM below 100% every 3 days and CCs Jonathan and Thomas on each one.
--
-- company_settings.onboarding_reminders_enabled gates ONLY the automatic cron run inside the
-- send-onboarding-reminders edge function. The manual per-person "send reminder" button in the
-- Onboarding Builder (Tracking tab) still works either way. Defaults to FALSE, i.e. the
-- automatic reminders stop as soon as this runs and the edge function is redeployed; an admin
-- can turn them back on from the Tracking tab. The cron job itself is left in place.
-- Additive only: one boolean column, no data touched.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS onboarding_reminders_enabled boolean NOT NULL DEFAULT false;
