-- Migration 062: Add modifications column to change_orders
-- Stores edits/deletions to existing proposal line items as part of a CO
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS modifications jsonb NOT NULL DEFAULT '[]'::jsonb;
