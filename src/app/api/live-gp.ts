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
import { calcJobCommissionOwed, computeLiveProjectFinancials, liveProjectCostInputs, pickJobEstimate, type ProjectedFinancials } from "@/app/utils/financials";

const LIVE_GP_SELECT = `
  id, total_value, status, materials_complete, labor_complete, gross_profit,
  receipts:project_receipts(category, amount),
  fios:field_installation_orders(
    items:field_installation_order_items(labor_cost_per_unit, quantity),
    crew_payments:fio_crew_payments(amount_paid)
  ),
  client:clients(
    estimates(id, total, subtotal, total_cost, tax_amount, pm_labor_actual_hours, status, created_at,
      line_items:estimate_line_items(material_cost, labor_cost, quantity),
      pm_labor:estimate_pm_labor_items(hours, hourly_rate))
  )
`;

// `subtotal` is the job's proposal subtotal (pre-BAD/tax) — the basis for Sales Rep commission
// (Jonathan, Oct 27 2026: "sales reps is 7% of subtotal. PM is 3% of active/live GP").
// `budget` = material/labor budget vs actual spend (receipts + crew payments), for the Budget Alert.
export type LiveProjectFinancials = ProjectedFinancials & {
  subtotal: number;
  budget: { materialBudget: number; materialActual: number; laborBudget: number; laborActual: number };
};

export async function fetchLiveProjectFinancials(projectIds: string[]): Promise<Record<string, LiveProjectFinancials>> {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const out: Record<string, LiveProjectFinancials> = {};
  // chunk the id list so the request URL stays short
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    try {
      const { data, error } = await supabase.from("projects").select(LIVE_GP_SELECT).in("id", chunk);
      if (error) { console.warn("[live-gp] query failed:", error.message); continue; }
      for (const p of (data ?? []) as any[]) {
        const ests = p.client?.estimates ?? [];
        // same fallback as Move to Sold: the proposal subtotal, else the contract value
        const subtotal = Number((pickJobEstimate(ests) as any)?.subtotal) || Number(p.total_value) || 0;
        const inputs = liveProjectCostInputs(p, ests);
        out[p.id] = {
          ...computeLiveProjectFinancials(p, ests),
          subtotal,
          budget: {
            materialBudget: inputs.materialBudget,
            materialActual: inputs.materialActual,
            laborBudget: inputs.laborBudget,
            laborActual: inputs.laborActual,
          },
        };
      }
    } catch (e) {
      console.warn("[live-gp] failed:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/**
 * Adds `pmCommissionOwed` / `repCommissionOwed` to projects as returned by projectsAPI.getAll(), worked out by the same
 * shared formula (financials.ts calcJobCommissionOwed) every other screen uses. For forecast-style pages that list
 * many jobs and only had the stored GP: if the live lookup fails they fall back to the stored numbers.
 */
export async function withLiveCommissions<T extends Record<string, any>>(
  projects: T[],
): Promise<(T & { pmCommissionOwed: number; repCommissionOwed: number })[]> {
  const live = await fetchLiveProjectFinancials(projects.filter((p) => p.project_manager_id || p.sales_rep_id).map((p) => p.id));
  return projects.map((p) => ({
    ...p,
    pmCommissionOwed: p.project_manager_id
      ? calcJobCommissionOwed({ role: "pm", ratePct: p.pmCommissionRate, liveGP: live[p.id]?.gp, storedGP: p.grossProfit, override: p.commission_override_total })
      : 0,
    repCommissionOwed: p.sales_rep_id
      ? calcJobCommissionOwed({
          role: "rep", ratePct: p.salesRepCommissionRate, status: p.status, completedAt: p.completed_at, storedGP: p.grossProfit,
          subtotal: live[p.id]?.subtotal, contractValue: p.totalValue, override: p.commission_override_total,
        })
      : 0,
  }));
}
