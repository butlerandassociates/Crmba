-- Migration 057: Add 'partial_paid' to field_installation_orders status constraint
-- Keeps all existing values (draft, sent, acknowledged, complete, paid).
-- 'partial_paid' is auto-set when the first crew payment is recorded.

ALTER TABLE public.field_installation_orders
  DROP CONSTRAINT IF EXISTS field_installation_orders_status_check;

ALTER TABLE public.field_installation_orders
  ADD CONSTRAINT field_installation_orders_status_check
  CHECK (status IN ('draft', 'sent', 'acknowledged', 'partial_paid', 'complete', 'paid'));
