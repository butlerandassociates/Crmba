-- Add global markup percentage to company settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS global_markup_percent decimal(5,2) DEFAULT 50.00;
