-- ============================================================
-- Migration 100: Flag material products as sales-tax applicable
-- Butler & Associates CRM
--
-- WHY (Jonathan, Jun 6 2026): "All material items should be taxed. No tax on
--   labor." A few material products were left unflagged (sales_tax_rate NULL):
--   the Weston Stone wizard blocks (added in mig 099), plus Decorative Rock and
--   Low Voltage Wire. Flag them at 9% to match every other material.
--   Labor/service items (Stamped Upcharge, Difficult Access, Stump Grinding)
--   stay EXEMPT per Jonathan — not included here.
-- Safe / idempotent.
-- ============================================================

UPDATE products_services
SET sales_tax_rate = 9
WHERE name IN (
  'Weston Stone Wall Block',
  'Weston Stone Cap Block',
  'Decorative Rock / Pea Gravel',
  'Low Voltage Wire (250'')'
)
AND sales_tax_rate IS NULL;
