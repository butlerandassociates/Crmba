// Shared proposal-financials calculations — the single source of truth for commission
// and BAD math, so proposal-detail.tsx and client-detail.tsx can't drift out of sync
// the way Sales Rep commission did (GP-based in one place, subtotal-based in the other).

export function calcPmCommission(grossProfit: number, pmRatePct: number): number {
  return grossProfit > 0 && pmRatePct > 0
    ? Math.round(grossProfit * (pmRatePct / 100) * 100) / 100
    : 0;
}

// Sales Rep commission is a % of subtotal (pre-BAD/tax), not gross profit — confirmed by
// Jonathan three times (Aug 12, and again Sep 6 after the Projected Financials modal was
// found still using GP). Never change this basis without his explicit direction.
export function calcSalesRepCommission(subtotal: number, salesRepRatePct: number): number {
  return subtotal > 0 && salesRepRatePct > 0
    ? Math.round(subtotal * (salesRepRatePct / 100) * 100) / 100
    : 0;
}

export type EffectiveCommissionRates = {
  pmRate: number;
  salesRepRate: number;
};

/**
 * Resolves the live PM/Sales Rep commission rates the same way for any screen that needs
 * them, mirroring client-detail.tsx's "Project Financials" card logic exactly. A project's
 * own rates always win once a project exists; the client's assigned sales rep rate is only
 * used as a fallback before any project row exists.
 */
export function resolveEffectiveCommissionRates(params: {
  project?: { pmCommissionRate?: number | null; salesRepCommissionRate?: number | null } | null;
  clientSalesRepId?: string | null;
  clientSalesRepCommissionRate?: number | null;
}): EffectiveCommissionRates {
  const hasProject = !!params.project;
  const pmRate = params.project?.pmCommissionRate ?? 0;
  const projectSalesRepRate = params.project?.salesRepCommissionRate ?? 0;
  const salesRepRate = projectSalesRepRate > 0
    ? projectSalesRepRate
    : (!hasProject && params.clientSalesRepId ? (params.clientSalesRepCommissionRate ?? 0) : 0);
  return { pmRate, salesRepRate };
}

// BAD (Base, Aggregate & Disposal) — NEW-proposal model only. Old proposals
// (estimate.bad_rate === null) never call these; they keep their original
// subtotal/price-based formula untouched, forever, per Jonathan's Sep 7 2026
// instruction not to affect any already-existing proposal regardless of status.
const BAD_CATEGORIES = ["Concrete", "Pavers", "Retaining Walls", "Sod"];

export type BadQualifyingItem = {
  category?: string | null;
  quantity: number;
  material_cost?: number | null;
  labor_cost?: number | null;
};

// Direct cost (material + labor) of items that qualify for BAD — same category/labor-cost
// filter the old formula always used, just summing cost instead of price.
export function calcBadQualifyingDirectCost(items: BadQualifyingItem[]): number {
  return items
    .filter((item) => BAD_CATEGORIES.includes(item.category ?? "") || Number(item.labor_cost ?? 0) > 0)
    .reduce((sum, item) => sum + Number(item.quantity) * (Number(item.material_cost ?? 0) + Number(item.labor_cost ?? 0)), 0);
}

// contingency_reserve = qualifying direct cost x bad_rate. For new proposals this is also
// the client-facing BAD dollar amount — the two are the same figure, just tracked under
// two field names for internal (contingency) vs client-facing (bad_amount) reporting.
export function calcContingencyReserve(qualifyingDirectCost: number, badRatePct: number): number {
  return Math.round(qualifyingDirectCost * (badRatePct / 100) * 100) / 100
}

// contingency_released — computed once at job close, never recomputed after.
export function calcContingencyReleased(reserve: number, consumed: number): number {
  return Math.round((reserve - consumed) * 100) / 100
}

// ─── Projected GP — the single source of truth for "what is this job's real GP right
// now" ───────────────────────────────────────────────────────────────────────────────
// Extracted Oct 1 2026 after the SAME formula drifted out of sync across 5+ places over
// a week (client-detail.tsx's donut, header, GP% toggle, Net Profit calc, and the
// Financial Health panel itself each had their own inline copy at various points —
// see [[project_work_page_feature_and_deploy_fix]] for the full history). Jonathan
// (Oct 1 2026): the clients-list "Active" tab's quick-view GP% read the raw
// `projects.profit_margin` DB column (continuously recalculated from live actuals by a
// trigger, migrations 049+050) while the job's own detail page showed this function's
// result — two genuinely different numbers for the same job. Both client-detail.tsx and
// clients.ts's getAll() must call these two functions instead of computing their own
// version, or this exact inconsistency will keep resurfacing in new places.

export type ProjectedGPInputs = {
  materialBudget: number;
  laborBudget: number;
  materialActual: number;
  laborActual: number; // true Paid to Crew + material receipts — never "committed"
  laborProjected: number; // material receipts + max(FIO committed, crew paid)
  isFallbackBudget: boolean; // true when line items had no cost breakdown, so the
  // budget split was estimated (70/30) from the estimate total rather than itemized
};

// Aggregates the raw rows (accepted proposal's line items, cost-attribution receipts,
// FIO labor items, FIO crew payments) into the five numbers computeProjectedGP needs.
// Mirrors client-detail.tsx's loadGpHealth() exactly, so both call this instead of each
// maintaining their own copy of the aggregation math.
export function aggregateProjectCosts(params: {
  lineItems: { material_cost?: number | string | null; labor_cost?: number | string | null; quantity?: number | string | null }[];
  estimateTotalCost?: number | null;
  receipts: { category?: string | null; amount?: number | null }[];
  fioItems: { labor_cost_per_unit?: number | string | null; quantity?: number | string | null }[];
  crewPayments: { amount_paid?: number | string | null }[];
}): ProjectedGPInputs {
  const materialBudget = params.lineItems.reduce((s, li) =>
    s + (parseFloat(String(li.material_cost)) || 0) * (parseFloat(String(li.quantity)) || 1), 0);
  const laborBudget = params.lineItems.reduce((s, li) =>
    s + (parseFloat(String(li.labor_cost)) || 0) * (parseFloat(String(li.quantity)) || 1), 0);
  // If line items have no cost breakdown, distribute estimate.total_cost proportionally
  const lineItemCostTotal = materialBudget + laborBudget;
  const estimateTotalCost = params.estimateTotalCost ?? 0;
  const effectiveMaterialBudget = lineItemCostTotal > 0 ? materialBudget : estimateTotalCost * 0.7;
  const effectiveLaborBudget = lineItemCostTotal > 0 ? laborBudget : estimateTotalCost * 0.3;

  const materialActual = params.receipts.filter((r) => r.category === "material")
    .reduce((s, r) => s + (r.amount || 0), 0);
  const laborFromReceipts = params.receipts.filter((r) => r.category === "labor")
    .reduce((s, r) => s + (r.amount || 0), 0);

  const fioAssigned = params.fioItems.reduce((s, item) =>
    s + (parseFloat(String(item.labor_cost_per_unit)) || 0) * (parseFloat(String(item.quantity)) || 0), 0);
  const laborFromCrewPayments = params.crewPayments.reduce((s, cp) =>
    s + (parseFloat(String(cp.amount_paid)) || 0), 0);

  return {
    materialBudget: effectiveMaterialBudget,
    laborBudget: effectiveLaborBudget,
    materialActual,
    laborActual: laborFromReceipts + laborFromCrewPayments,
    laborProjected: laborFromReceipts + Math.max(fioAssigned, laborFromCrewPayments),
    isFallbackBudget: lineItemCostTotal === 0 && estimateTotalCost > 0,
  };
}

// Jonathan's exact spec (Sep 25/29 2026): Projected Cost per category = the greater of
// Actual and (Committed-if-one-exists, otherwise Budget) — except once a category is
// marked complete (or the job reaches "Completed" status, which auto-completes both),
// where Projected Cost collapses to the literal Actual.
export function computeProjectedGP(
  inputs: ProjectedGPInputs | null | undefined,
  project: { totalValue?: number | null; status?: string | null; materials_complete?: boolean | null; labor_complete?: boolean | null; grossProfit?: number | null } | null | undefined,
): number {
  const contractValue = project?.totalValue ?? 0;
  if (!inputs) return project?.grossProfit ?? 0;
  const jobComplete = project?.status === "completed";
  const materialsComplete = jobComplete || !!project?.materials_complete;
  const laborComplete = jobComplete || !!project?.labor_complete;
  const materialProjected = materialsComplete ? inputs.materialActual : Math.max(inputs.materialActual, inputs.materialBudget);
  // Preserves the exact existing behavior (client-detail.tsx's prior inline version):
  // laborProjected already folds in max(FIO committed, crew paid), so it's used as-is
  // rather than also maxing against laborBudget here — NOT touching this in this fix,
  // since it's a pre-existing, separate question (what should Projected Labor show
  // before any FIO exists?) outside the scope of the list-vs-detail consistency bug.
  const laborProjectedFinal = laborComplete ? inputs.laborActual : (inputs.laborProjected ?? Math.max(inputs.laborActual, inputs.laborBudget));
  return contractValue - materialProjected - laborProjectedFinal;
}
