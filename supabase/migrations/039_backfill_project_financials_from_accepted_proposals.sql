-- Migration 039: Backfill project financials from accepted proposals
-- For any project where total_value = 0 or NULL, pull values from the
-- client's accepted estimate so all financial pages show real numbers.

UPDATE projects p
SET
  total_value   = e.total,
  gross_profit  = e.total - COALESCE(p.total_costs, 0),
  profit_margin = CASE
                    WHEN e.total > 0
                    THEN ROUND(((e.total - COALESCE(p.total_costs, 0)) / e.total) * 100, 2)
                    ELSE 0
                  END,
  commission    = CASE
                    WHEN COALESCE(p.commission_rate, 0) > 0
                    THEN e.total * (p.commission_rate / 100)
                    ELSE p.commission
                  END
FROM estimates e
WHERE e.client_id = p.client_id
  AND e.status    = 'accepted'
  AND (p.total_value IS NULL OR p.total_value = 0)
  AND e.total     > 0;
