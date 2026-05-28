-- Migration 084: Payment reminders toggle + SMS opt-out on clients
-- Safe to re-run: uses IF NOT EXISTS

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS payment_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_out              boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.payment_reminders_enabled IS 'Admin toggle — auto SMS+email reminders 1 and 3 days before payment due dates';
COMMENT ON COLUMN public.clients.sms_opt_out              IS 'Client opted out of SMS notifications';
