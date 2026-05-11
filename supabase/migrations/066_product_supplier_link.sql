-- ============================================================
-- Migration 066: Link products_services to suppliers
-- Butler & Associates CRM — May 11 2026
-- ============================================================

ALTER TABLE public.products_services
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products_services(supplier_id);
