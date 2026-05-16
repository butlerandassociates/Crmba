-- Add unit field to change_order_items
ALTER TABLE public.change_order_items
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
