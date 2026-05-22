-- ============================================================
-- Migration 074: Commission override for Mark Midenberg
-- Jonathan confirmed May 22 2026
--
-- Mark's commission basis = 3% of contract ($206,725.35) = $6,201.76
-- All other projects stay on 3% of GP.
--
-- Adds commission_override_total to projects (nullable).
-- When set, payroll uses this instead of GP × rate.
-- ============================================================


-- ── 1. Add override column ───────────────────────────────────

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS commission_override_total NUMERIC;


-- ── 2. Set override for Mark Midenberg's project ─────────────

UPDATE projects
SET commission_override_total = 6201.76
WHERE id = '5f0f0c19-42a6-482a-8b89-377d99207dea';
