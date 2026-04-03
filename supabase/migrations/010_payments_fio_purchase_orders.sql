-- ============================================================
-- Migration 010: Project Payments · FIO · Purchase Orders
-- Butler & Associates CRM
-- NOTE: These tables were created directly in Supabase before
--       this migration file existed. All statements use
--       IF NOT EXISTS so this is safe to run on any environment.
-- ============================================================


-- ── 1. PROJECT PAYMENTS ──────────────────────────────────────
-- Payment milestones per project (Deposit / Progress / Final).
-- Linked to both project and client for cross-entity queries.

CREATE TABLE IF NOT EXISTS public.project_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  label           text NOT NULL,                        -- e.g. "Deposit", "Final Payment"
  percentage      numeric(5,2) DEFAULT 0,               -- e.g. 30 for 30%
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  is_paid         boolean NOT NULL DEFAULT false,
  paid_date       date,
  due_date        date,
  payment_method  text,                                 -- e.g. "Check", "ACH", "Credit Card"
  notes           text,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_payments_project_id_idx ON public.project_payments(project_id);
CREATE INDEX IF NOT EXISTS project_payments_client_id_idx  ON public.project_payments(client_id);


-- ── 2. FIELD INSTALLATION ORDERS (FIO) ───────────────────────
-- One FIO per project — labor assignments given to the foreman.

CREATE TABLE IF NOT EXISTS public.field_installation_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  foreman_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'sent', 'acknowledged', 'complete')),
  notes       text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fio_project_id_idx ON public.field_installation_orders(project_id);


-- ── 3. FIO LINE ITEMS ─────────────────────────────────────────
-- Individual labor tasks within a FIO.

CREATE TABLE IF NOT EXISTS public.field_installation_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fio_id              uuid NOT NULL REFERENCES public.field_installation_orders(id) ON DELETE CASCADE,
  product_name        text NOT NULL,
  unit                text NOT NULL DEFAULT '',
  quantity            numeric(12,3) NOT NULL DEFAULT 1,
  labor_cost_per_unit numeric(12,2) NOT NULL DEFAULT 0,
  total_labor         numeric(12,2) GENERATED ALWAYS AS (quantity * labor_cost_per_unit) STORED,
  notes               text,
  sort_order          int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fio_items_fio_id_idx ON public.field_installation_order_items(fio_id);


-- ── 4. PURCHASE ORDERS ────────────────────────────────────────
-- Material orders sent to suppliers, multiple per project.

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_name     text NOT NULL,
  delivery_address  text,
  delivery_date     date,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'delivered', 'cancelled')),
  notes             text,
  sent_by_user_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_project_id_idx ON public.purchase_orders(project_id);


-- ── 5. PURCHASE ORDER ITEMS ───────────────────────────────────
-- Individual materials within a PO.

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id         uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES public.products_services(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  quantity      numeric(12,3) NOT NULL DEFAULT 1,
  unit          text NOT NULL DEFAULT '',
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_order_items_po_id_idx ON public.purchase_order_items(po_id);
