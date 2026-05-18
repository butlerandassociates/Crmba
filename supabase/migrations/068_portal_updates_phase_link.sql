-- Migration 068: Link portal_updates to project phases
-- Adds phase_id so a field update can be tagged to a specific project phase.
-- On save, admin can also update that phase's progress % from the same form.

ALTER TABLE public.portal_updates
  ADD COLUMN IF NOT EXISTS phase_id uuid NULL
    REFERENCES public.project_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portal_updates_phase_id
  ON public.portal_updates(phase_id);
