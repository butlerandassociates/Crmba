-- ============================================================
-- Migration 040 — Add "Scheduled" pipeline stage
-- Sits between Prospect and Selling.
-- Auto-set when appointment is booked for a prospect.
-- ============================================================

-- 1. Insert the new pipeline stage (order 2, shifting Selling/Sold/Active/Completed up)
INSERT INTO public.pipeline_stages (name, order_index, color)
VALUES ('Scheduled', 2, '#6366F1')
ON CONFLICT DO NOTHING;

-- Shift existing stages up to make room
UPDATE public.pipeline_stages SET order_index = order_index + 1
WHERE name IN ('Selling', 'Sold', 'Active', 'Completed');

-- 2. Extend the clients.status CHECK constraint to include 'scheduled'
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('prospect','scheduled','selling','sold','active','completed','discarded'));
