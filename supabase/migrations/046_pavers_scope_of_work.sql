-- Migration 046: Add "Pavers" to scope_of_work
-- Exists on website Formspree form as a checkbox option but was missing from DB.
INSERT INTO public.scope_of_work (name, is_active, sort_order)
VALUES ('Pavers', true, 13)
ON CONFLICT (name) DO NOTHING;
