-- Migration 075: Add stripe_fee_amount to project_payments
-- Migration 063 added stripe_fee_amount to estimates only.
-- project_payments needs it so the stripe-webhook can record
-- the actual CC fee charged and the portal/admin can display it.

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS stripe_fee_amount numeric(12,2) NULL;
