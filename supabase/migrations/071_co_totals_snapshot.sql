-- Add snapshot columns to change_orders so the portal always shows the
-- correct original/revised totals regardless of subsequent CO merges.
-- original_total = proposal.total at the moment the CO was sent to the client
-- new_total      = computed new proposal total at send time (includes mods + new items)

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS original_total numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS new_total      numeric(12,2) NULL;

-- ── Immediate fix for Rhonda Marshall's pending CO ─────────────────────────
-- Run this in Supabase SQL editor to fix the CO that is currently showing
-- wrong totals in the client portal. Jonathan confirmed:
--   original contract = $31,320.00   new total = $33,663.60
--
-- UPDATE change_orders
-- SET original_total = 31320.00,
--     new_total      = 33663.60
-- WHERE status = 'pending_client'
--   AND client_id = (
--     SELECT id FROM clients
--     WHERE first_name = 'Rhonda' AND last_name = 'Marshall'
--     LIMIT 1
--   );
