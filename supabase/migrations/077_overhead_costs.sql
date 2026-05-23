-- Migration 077: Overhead Costs
-- New table to track operating expenses (marketing, insurance, office, etc.)
-- Supports parent/child hierarchy for subcategories and recurring vs one-time costs

CREATE TABLE IF NOT EXISTS public.overhead_costs (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text          NOT NULL,
  amount               numeric(12,2) NOT NULL DEFAULT 0,
  is_recurring         boolean       NOT NULL DEFAULT false,
  recurring_frequency  text          CHECK (recurring_frequency IN ('monthly', 'quarterly', 'yearly')),
  date                 date          NOT NULL DEFAULT CURRENT_DATE,
  parent_id            uuid          REFERENCES public.overhead_costs(id) ON DELETE CASCADE,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  created_by           uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  updated_by           uuid          REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.overhead_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overhead_read" ON public.overhead_costs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "overhead_insert" ON public.overhead_costs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "overhead_update" ON public.overhead_costs
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "overhead_delete" ON public.overhead_costs
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_overhead_costs_updated_at
  BEFORE UPDATE ON public.overhead_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
