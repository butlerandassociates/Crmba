-- Add 811 completion tracking to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS call_811_completed_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS call_811_completed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
