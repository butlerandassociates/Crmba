-- Migration 117: add monthly_sales_goal to company_settings

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS monthly_sales_goal numeric(12, 2) DEFAULT 300000;
