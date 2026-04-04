-- Migration 015: Change Orders + Purchase Order enhancements
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS
-- ─────────────────────────────────────────────────────────────

-- ── 1. Enhance purchase_orders (columns that don't exist yet) ─
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_time text;

-- Fix status check: existing constraint allows 'draft','sent','received'
-- Expand to also include 'confirmed','delivered','cancelled'
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'sent', 'received', 'confirmed', 'delivered', 'cancelled'));

-- ── 2. Add color to purchase_order_items (if not exists) ──────
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS color text;

-- ── 3. Drop and recreate change_orders cleanly ───────────────
-- (handles case where a previous partial run left a broken table)
DROP TABLE IF EXISTS public.change_order_items CASCADE;
DROP TABLE IF EXISTS public.change_orders      CASCADE;

CREATE TABLE public.change_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.clients(id)  ON DELETE CASCADE,
  title           text NOT NULL,
  reason          text,
  timeline_impact text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'pending_client', 'approved', 'rejected')),
  cost_impact     numeric(12,2) NOT NULL DEFAULT 0,
  submitted_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.change_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  co_id       uuid NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  category    text NOT NULL DEFAULT 'Materials',
  description text NOT NULL,
  quantity    numeric(12,3) NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0,
  total       numeric(12,2) NOT NULL DEFAULT 0,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS purchase_orders_client_id_idx    ON public.purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS change_orders_client_id_idx      ON public.change_orders(client_id);
CREATE INDEX IF NOT EXISTS change_orders_project_id_idx     ON public.change_orders(project_id);
CREATE INDEX IF NOT EXISTS change_order_items_co_id_idx     ON public.change_order_items(co_id);

-- ── 5. RLS ───────────────────────────────────────────────────
ALTER TABLE public.change_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_order_items  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage change_orders"
    ON public.change_orders FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage change_order_items"
    ON public.change_order_items FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
