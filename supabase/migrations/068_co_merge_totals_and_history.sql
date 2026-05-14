-- Migration 068: CO pre/post merge totals + history support
-- Adds pre_merge_total and post_merge_total to change_orders
-- so admins can see contract value before vs after each CO was applied

ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS pre_merge_total  numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_merge_total numeric(12,2) DEFAULT NULL;

COMMENT ON COLUMN change_orders.pre_merge_total  IS 'Proposal total before this CO was merged';
COMMENT ON COLUMN change_orders.post_merge_total IS 'Proposal total after this CO was merged';
