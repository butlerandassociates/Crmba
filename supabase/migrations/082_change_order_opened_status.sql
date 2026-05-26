-- Migration 082: Add "opened" status to change_orders
-- Tracks when a client has viewed/opened a sent change order via the portal.

-- 1. Drop existing status check constraint
ALTER TABLE public.change_orders DROP CONSTRAINT IF EXISTS change_orders_status_check;

-- 2. Add updated CHECK constraint including "opened"
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft', 'pending_client', 'opened', 'approved', 'rejected', 'merged'));

-- 3. Add opened_at timestamp column
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS opened_at timestamptz DEFAULT NULL;
