-- Migration 063: Discount type/label + Stripe fee on estimates and project_payments

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS discount_type    text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_label   text,
  ADD COLUMN IF NOT EXISTS stripe_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_fee_amount  decimal(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS stripe_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_amount        decimal(12,2) NOT NULL DEFAULT 0;
