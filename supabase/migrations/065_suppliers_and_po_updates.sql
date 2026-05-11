-- ============================================================
-- Migration 065: Suppliers table + Purchase Order column updates
-- Butler & Associates CRM — May 11 2026
-- ============================================================

-- ── 1. SUPPLIERS ─────────────────────────────────────────────
-- Reusable supplier records: name, point-of-contact, email.
-- Selected when creating a PO; info denormalised onto the PO for history.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  poc_name      text,
  email         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(supplier_name);

-- ── 2. PURCHASE ORDERS — missing columns ─────────────────────

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS client_id       uuid REFERENCES public.clients(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id     uuid REFERENCES public.suppliers(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_poc_name text,
  ADD COLUMN IF NOT EXISTS supplier_email  text,
  ADD COLUMN IF NOT EXISTS delivery_time   text DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS approved_by     uuid REFERENCES public.profiles(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz;

-- Add 'confirmed' to status (drop old constraint, add new one)
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'sent', 'confirmed', 'delivered', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_client_id   ON public.purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);

-- ── 3. PURCHASE ORDER ITEMS — add color ──────────────────────

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS color text;
