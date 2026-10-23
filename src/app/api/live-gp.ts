/**
 * Live job GP for Payroll.
 *
 * projects.gross_profit is a snapshot that drifts as receipts, change orders and PM hours change, so
 * Payroll disagreed with the job page's Project Financials card (Teresa Hammond, Oct 21 2026).
 * Jonathan, Oct 22 2026: "Moving forward, sync it to live GP." This loads the same joined rows the
 * clients list loads and runs them through the same shared function, so every screen lands on the
 * same GP.
 *
 * Never throws: on any failure it returns what it could and callers fall back to the stored GP.
 */

import { supabase } from "@/lib/supabase";
import { computeLiveProjectFinancials, type ProjectedFinancials } from "@/app/utils/financials";

const LIVE_GP_SELECT = `
  id, total_value, status, materials_complete, labor_complete, gross_profit,
  receipts:project_receipts(category, amount),
  fios:field_installation_orders(
    items:field_installation_order_items(labor_cost_per_unit, quantity),
    crew_payments:fio_crew_payments(amount_paid)
  ),
  client:clients(
    estimates(id, total, total_cost, tax_amount, pm_labor_actual_hours, status, created_at,
      line_items:estimate_line_items(material_cost, labor_cost, quantity),
      pm_labor:estimate_pm_labor_items(hours, hourly_rate))
  )
`;

export async function fetchLiveProjectFinancials(projectIds: string[]): Promise<Record<string, ProjectedFinancials>> {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const out: Record<string, ProjectedFinancials> = {};
  // chunk the id list so the request URL stays short
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    try {
      const { data, error } = await supabase.from("projects").select(LIVE_GP_SELECT).in("id", chunk);
      if (error) { console.warn("[live-gp] query failed:", error.message); continue; }
      for (const p of (data ?? []) as any[]) {
        out[p.id] = computeLiveProjectFinancials(p, p.client?.estimates ?? []);
      }
    } catch (e) {
      console.warn("[live-gp] failed:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}
