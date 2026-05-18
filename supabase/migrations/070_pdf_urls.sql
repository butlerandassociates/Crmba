-- Add pdf_url to store the generated PDF when proposals/COs are sent to the client portal
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS pdf_url text NULL;
ALTER TABLE public.change_orders ADD COLUMN IF NOT EXISTS pdf_url text NULL;
