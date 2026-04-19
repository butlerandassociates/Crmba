-- Migration 047: Change Order approval gate columns + merged status
-- Safe to re-run

-- Add approval gate columns
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS approval_verified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_file_url   text,
  ADD COLUMN IF NOT EXISTS approval_file_name  text;

-- Extend status CHECK to include 'merged' (was missing, caused runtime errors on merge)
ALTER TABLE public.change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft', 'pending_client', 'approved', 'rejected', 'merged'));
