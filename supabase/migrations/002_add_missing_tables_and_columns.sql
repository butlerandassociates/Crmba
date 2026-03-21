-- ============================================================
-- Migration 002 — Add missing tables and columns
-- Butler & Associates CRM
-- Run this in Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 1. PROFILES — expand role types
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'project_manager', 'foreman', 'sales_rep', 'team_member'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS team_role    text,  -- display label
  ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commission_rate decimal(5,2) DEFAULT 0;


-- ============================================================
-- 2. LEAD SOURCES — seed defaults
-- ============================================================

INSERT INTO public.lead_sources (name, is_active) VALUES
  ('Google',          true),
  ('Google LSA',      true),
  ('Referral',        true),
  ('Yelp',            true),
  ('Angi',            true),
  ('HomeAdvisor',     true),
  ('Website',         true),
  ('Call Tracking',   true),
  ('Direct',          true),
  ('Facebook',        true),
  ('Instagram',       true),
  ('Other',           true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. CLIENTS — add missing columns
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company               text,
  ADD COLUMN IF NOT EXISTS status                text DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS assigned_to           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope_of_work         text[],
  ADD COLUMN IF NOT EXISTS call_811_required     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_met       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_scheduled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS appointment_date      date,
  ADD COLUMN IF NOT EXISTS projected_value       decimal(12,2),
  ADD COLUMN IF NOT EXISTS last_contact_date     date,
  ADD COLUMN IF NOT EXISTS next_follow_up_date   date,
  ADD COLUMN IF NOT EXISTS expected_close_date   date,
  ADD COLUMN IF NOT EXISTS closing_probability   integer CHECK (closing_probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS docusign_status       text DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS docusign_envelope_id  text,
  ADD COLUMN IF NOT EXISTS docusign_sent_date    date,
  ADD COLUMN IF NOT EXISTS discarded_reason      text;

-- Add status check
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IN ('prospect','pursuing','selling','closing','sold','active','completed'));


-- ============================================================
-- 4. PROJECTS table (separate entity, linked to client)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'prospect'
                          CHECK (status IN ('prospect','selling','sold','active','completed')),

  -- Financials
  total_value           decimal(12,2) DEFAULT 0,
  total_costs           decimal(12,2) DEFAULT 0,
  gross_profit          decimal(12,2) DEFAULT 0,
  profit_margin         decimal(5,2)  DEFAULT 0,
  commission            decimal(12,2) DEFAULT 0,
  commission_rate       decimal(5,2)  DEFAULT 10,

  -- Team
  project_manager_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  foreman_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sales_rep_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Dates
  start_date            date,
  end_date              date,

  -- Details
  description           text,
  docusign_status       text DEFAULT 'not_sent',
  docusign_envelope_id  text,
  quickbooks_invoice_id text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Project line items (crew-level labor assignments)
CREATE TABLE IF NOT EXISTS public.project_line_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id            text,               -- reference to products_services
  product_name          text NOT NULL,
  quantity              decimal(10,2) NOT NULL DEFAULT 1,
  unit                  text,
  price_per_unit        decimal(12,2) DEFAULT 0,
  labor_cost_per_unit   decimal(12,2) DEFAULT 0,
  total_price           decimal(12,2) DEFAULT 0,
  total_labor           decimal(12,2) DEFAULT 0,
  is_labor_assigned     boolean DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. INVOICES table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number        text NOT NULL,
  invoice_date          date NOT NULL DEFAULT CURRENT_DATE,
  due_date              date,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  subtotal              decimal(12,2) DEFAULT 0,
  tax_rate              decimal(5,2)  DEFAULT 0,
  tax_amount            decimal(12,2) DEFAULT 0,
  total                 decimal(12,2) DEFAULT 0,
  amount_paid           decimal(12,2) DEFAULT 0,
  amount_due            decimal(12,2) DEFAULT 0,
  notes                 text,
  quickbooks_invoice_id text,
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description           text NOT NULL,
  quantity              decimal(10,2) NOT NULL DEFAULT 1,
  unit_price            decimal(12,2) DEFAULT 0,
  total                 decimal(12,2) DEFAULT 0,
  sort_order            integer DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. PAYMENTS table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_date          date NOT NULL DEFAULT CURRENT_DATE,
  amount                decimal(12,2) NOT NULL,
  method                text NOT NULL DEFAULT 'check'
                          CHECK (method IN ('credit_card','ach','check','wire_transfer','cash','other')),
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','completed','failed','refunded')),
  transaction_id        text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 7. CHANGE ORDERS table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.change_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_number          text NOT NULL,
  title                 text NOT NULL,
  description           text,
  request_date          date NOT NULL DEFAULT CURRENT_DATE,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','declined')),
  original_amount       decimal(12,2) DEFAULT 0,
  change_amount         decimal(12,2) DEFAULT 0,
  new_amount            decimal(12,2) DEFAULT 0,
  approved_by           text,
  approved_date         date,
  client_approval_token text,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 8. CREW PROFILES table (foremen / field crew)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crew_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  email                 text,
  phone                 text,
  specialty             text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 9. PRODUCTS & SERVICES — add price_per_unit column
-- (material_cost is internal cost; price_per_unit is what we charge)
-- ============================================================

ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS price_per_unit decimal(12,2) DEFAULT 0;


-- ============================================================
-- 10. UPDATED_AT triggers for new tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 11. Row Level Security for new tables
-- ============================================================

ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_profiles     ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all (admins manage permissions in app layer)
CREATE POLICY "auth_all_projects"           ON public.projects           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_project_line_items" ON public.project_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_invoices"           ON public.invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_invoice_line_items" ON public.invoice_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_payments"           ON public.payments           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_change_orders"      ON public.change_orders      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_crew_profiles"      ON public.crew_profiles      FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 12. Seed company settings (Butler & Associates)
-- ============================================================

INSERT INTO public.company_settings (
  company_name, address, phone, email, website, default_tax_rate, monthly_revenue_goal
) VALUES (
  'Butler & Associates Construction, Inc',
  '6275 University Drive Northwest, Suite 37-314, Huntsville, Alabama 35806',
  '(256) 617-4691',
  'jonathan@butlerconstruction.co',
  'www.butlerconstruction.co',
  9.0,
  300000
) ON CONFLICT DO NOTHING;


-- ============================================================
-- Done!
-- ============================================================
