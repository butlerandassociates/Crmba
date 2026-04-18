-- Migration 041: Fix field_installation_orders status constraint
-- Adds 'paid' and 'work_date' related statuses that are used in the app
-- but were missing from the original constraint.

ALTER TABLE public.field_installation_orders
  DROP CONSTRAINT IF EXISTS field_installation_orders_status_check;

ALTER TABLE public.field_installation_orders
  ADD CONSTRAINT field_installation_orders_status_check
  CHECK (status IN ('draft', 'sent', 'acknowledged', 'complete', 'paid'));
