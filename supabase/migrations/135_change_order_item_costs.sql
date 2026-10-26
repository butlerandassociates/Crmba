-- Change order items keep their real costs (Jonathan, Oct 27 2026):
--   "I added these items via change order but why isn't it showing any of the crew cost, material or markup
--    figures? ... If the crew/material costs show $0 then there's no way to monitor GP and actual/expected
--    spend ... It showing 0% markup ... is not showing our GP accurately ... It's also prohibiting me from
--    editing the FIO to reflect the changes for what they are to be paid."
--
-- Why: a change order line only stored material_cost (and not even that for labor lines). When the CO was merged
-- into the proposal the new estimate_line_items row therefore had labor_cost = 0 and markup_percent = 0, so
--   * the proposal showed Crew Cost $0 / Markup 0%,
--   * GP could not be compared to anything, and
--   * the FIO screen (which suggests proposal lines with labor_cost > 0) never offered the new work.
--
-- This adds the two missing per-unit fields on the CO line. material_cost already exists on this table.
-- Additive only, safe to re-run. Run BEFORE deploying the code that writes them.

ALTER TABLE public.change_order_items ADD COLUMN IF NOT EXISTS labor_cost     numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.change_order_items ADD COLUMN IF NOT EXISTS markup_percent numeric(8,2)  NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.change_order_items.labor_cost     IS 'Crew / labor cost per unit (what the foreman is paid). Copied to estimate_line_items.labor_cost when the CO is merged.';
COMMENT ON COLUMN public.change_order_items.markup_percent IS 'Markup % on (material + labor) per unit. Copied to estimate_line_items.markup_percent when the CO is merged.';
