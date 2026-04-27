-- Add sales rep commission tracking to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sales_rep_commission      decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_rep_commission_rate decimal(5,2)  DEFAULT 0;
