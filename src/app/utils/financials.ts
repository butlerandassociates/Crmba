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

// What the client actually pays, in one place. Oct 12 2026: Jonathan found the "View Proposal"
// page and the proposal email showed $110,685.99 while the PDF showed $113,879.74 for the same
// proposal — those screens each re-added subtotal + BAD + tax - discount themselves and left
// out the marked-up PM Labor Hours (billed inside the client-facing BAD line) and the CC
// processing fee. Anything that shows a client-facing total from saved proposal fields must
// go through this so it can't drift from the PDF (proposal-export.tsx) again.
export function calcClientProposalTotal(p: {
  subtotal?: number | null;
  badAmount?: number | null;
  pmLaborMarkedUp?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  stripeFeeEnabled?: boolean | null;
}): { preStripeTotal: number; stripeFee: number; total: number } {
  const preStripeTotal =
    Number(p.subtotal ?? 0) + Number(p.badAmount ?? 0) + Number(p.pmLaborMarkedUp ?? 0) +
    Number(p.taxAmount ?? 0) - Number(p.discountAmount ?? 0);
  const stripeFee = p.stripeFeeEnabled ? Math.round((preStripeTotal * 0.029 + 0.30) * 100) / 100 : 0;
  return { preStripeTotal, stripeFee, total: preStripeTotal + stripeFee };
}

// Change orders (Jonathan, Oct 25-26 2026: "why does a new change order immediately show a negative
// impact?"). A proposal's SAVED total also contains things the change-order screen / mergeApproved do
// not rebuild from line items — chiefly marked-up PM labor (see calcClientProposalTotal) — so
// "rebuilt total - saved total" was already negative (-$3,193.75 on Kelly Easler) before any change,
// and approving a CO would have dropped that amount from the contract. This returns the pre-stripe-fee
// amount that is in the saved total but NOT in the rebuilt one, so both places can carry it forward
// unchanged: zero changes => impact exactly $0, and a CO only ever moves the total by its own changes.
// Differences under $1 are rounding noise (stripe fee is back-solved) and are ignored. Callers must pass
// BAD / tax rounded exactly the way their own live total rounds them.
export function calcCoBaselineCarry(p: {
  total?: number | null;
  stripeFeeEnabled?: boolean | null;
  lineSubtotal: number;
  discountAmount?: number | null;
  badAmount?: number | null;
  taxAmount?: number | null;
}): number {
  const total = Number(p.total ?? 0);
  if (!(total > 0)) return 0;
  const preStripe = p.stripeFeeEnabled ? (total - 0.30) / 1.029 : total;
  const rebuilt = Number(p.lineSubtotal || 0) - Number(p.discountAmount ?? 0) + Number(p.badAmount ?? 0) + Number(p.taxAmount ?? 0);
  const carry = preStripe - rebuilt;
  // intentionally NOT rounded: the live total must equal the saved total to the last decimal at zero changes
  return Math.abs(carry) >= 1 ? carry : 0;
}

// ─── Cost Attributions: expected vs actual material per SOLD category ─────────────────────
// Jonathan, Oct 12-13 2026: each material receipt is attributed to a category sold on the job
// (Concrete, Pavers, ...) so we can see what we actually spent vs what the sold line items
// budgeted for that category. "Expected" is OUR material cost (qty x material_cost of the sold
// line items, change orders included once merged into the proposal) — never the client price.
export const OTHER_MATERIAL_CATEGORY = "Other / General";

// Round to cents the way a person would (0.75 x $930.42 = 697.815 -> $697.82). Plain Math.round on
// the raw float gives 697.81 for some values (697.8149999...), which made the proposal's line
// total and the Cost Attributions "expected" differ by a cent for the same item.
export const roundCents = (n: number): number => Math.round(Number((n * 100).toPrecision(12))) / 100;

export type MaterialCategoryRow = {
  category: string;            // sold category name, OTHER_MATERIAL_CATEGORY, or "" for unattributed
  expected: number;
  actual: number;
  remaining: number;           // expected - actual (negative = over budget)
  over: number;                // dollars over expected (0 when within budget or no budget)
  receipts: any[];
};

export function expectedMaterialByCategory(
  lineItems: { category?: string | null; quantity?: number | string | null; material_cost?: number | string | null }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const li of lineItems ?? []) {
    const cost = (parseFloat(String(li.quantity)) || 1) * (parseFloat(String(li.material_cost)) || 0);
    if (cost <= 0) continue;
    const key = (li.category ?? "").trim() || OTHER_MATERIAL_CATEGORY;
    out[key] = (out[key] || 0) + cost;
  }
  for (const k of Object.keys(out)) out[k] = roundCents(out[k]);
  return out;
}

// ─── Receipt types (project_receipts.category) ───────────────────────────────────────────────
// Jonathan, Oct 14 2026: besides Material, a receipt can be a one-off Subcontractor payment (no
// FIO) or a Delivery fee, so ALL spend on what was sold is tracked. For GP these fold into the
// two buckets the formulas already know: delivery -> material (proposals store delivery cost in
// material_cost) and subcontractor -> labor. Change the two functions below to change that rule
// everywhere (GP, Cost Attributions, receipts overview) — don't re-test category strings inline.
export type ReceiptType = "material" | "labor" | "subcontractor" | "delivery";
export const DELIVERY_SOLD_CATEGORY = "Delivery";

export const isMaterialReceipt = (r: { category?: string | null }) => (r.category ?? "material") === "material";
export const countsAsMaterialCost = (r: { category?: string | null }) => {
  const c = r.category ?? "material";
  return c === "material" || c === "delivery";
};
export const countsAsLaborCost = (r: { category?: string | null }) => {
  const c = r.category ?? "";
  return c === "labor" || c === "subcontractor";
};

// Sold "Delivery" category (case-insensitive) is tracked in its own Delivery section, not as a
// sold-material row, so split it out of the expected-by-category map.
export function splitDeliveryExpected(expected: Record<string, number>): { material: Record<string, number>; delivery: number } {
  const material: Record<string, number> = {};
  let delivery = 0;
  for (const [k, v] of Object.entries(expected)) {
    if (k.trim().toLowerCase() === DELIVERY_SOLD_CATEGORY.toLowerCase()) delivery += v;
    else material[k] = v;
  }
  return { material, delivery: Math.round(delivery * 100) / 100 };
}

// One row per category that has a budget or any attributed receipt, plus an "Unattributed" row
// ("" category) for material receipts nobody has tagged yet. Labor receipts are not material
// and are ignored here.
export function rollupMaterialByCategory(
  expected: Record<string, number>,
  receipts: { category?: string | null; amount?: number | string | null; material_category?: string | null }[],
): MaterialCategoryRow[] {
  const material = (receipts ?? []).filter((r) => isMaterialReceipt(r));
  const names = new Set<string>(Object.keys(expected));
  for (const r of material) if (r.material_category) names.add(r.material_category);
  const rows: MaterialCategoryRow[] = [];
  const build = (category: string, exp: number, rs: any[]): MaterialCategoryRow => {
    const actual = Math.round(rs.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
    const remaining = Math.round((exp - actual) * 100) / 100;
    return { category, expected: exp, actual, remaining, over: exp > 0 && actual > exp ? Math.round((actual - exp) * 100) / 100 : 0, receipts: rs };
  };
  const named = Array.from(names).sort((a, b) => {
    if (a === OTHER_MATERIAL_CATEGORY) return 1;
    if (b === OTHER_MATERIAL_CATEGORY) return -1;
    return a.localeCompare(b);
  });
  for (const n of named) rows.push(build(n, expected[n] || 0, material.filter((r) => r.material_category === n)));
  const unattributed = material.filter((r) => !r.material_category);
  if (unattributed.length > 0) rows.push(build("", 0, unattributed));
  return rows;
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
  // Jonathan, Oct 14 2026 (job-level GP): sales tax is part of the contract total but is NOT
  // revenue/profit, so it comes off the top; PM Labor Hours are a real cost, planned on the
  // proposal (hours x rate) and optionally replaced by the actual hours someone enters.
  // BAD stays in revenue at job level, exactly as before. All optional so older callers and
  // saved snapshots keep working (missing = 0 / not entered).
  taxAmount?: number;
  pmLaborPlannedCost?: number;
  pmLaborActualCost?: number | null; // null = no actual hours entered yet
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
  /** accepted proposal's sales tax (estimates.tax_amount) */
  estimateTaxAmount?: number | string | null;
  /** accepted proposal's planned PM hours (estimate_pm_labor_items) */
  pmLaborItems?: { hours?: number | string | null; hourly_rate?: number | string | null }[];
  /** estimates.pm_labor_actual_hours — null/undefined until someone enters it */
  pmLaborActualHours?: number | string | null;
  /** used to price actual hours only when the proposal has no planned PM entries to take a rate from */
  pmFallbackRate?: number;
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

  const materialActual = params.receipts.filter((r) => r.category === "material" || r.category === "delivery")
    .reduce((s, r) => s + (r.amount || 0), 0);
  const laborFromReceipts = params.receipts.filter((r) => r.category === "labor" || r.category === "subcontractor")
    .reduce((s, r) => s + (r.amount || 0), 0);

  const fioAssigned = params.fioItems.reduce((s, item) =>
    s + (parseFloat(String(item.labor_cost_per_unit)) || 0) * (parseFloat(String(item.quantity)) || 0), 0);
  const laborFromCrewPayments = params.crewPayments.reduce((s, cp) =>
    s + (parseFloat(String(cp.amount_paid)) || 0), 0);

  const pmItems = params.pmLaborItems ?? [];
  const pmPlannedHours = pmItems.reduce((s, it) => s + (parseFloat(String(it.hours)) || 0), 0);
  const pmLaborPlannedCost = Math.round(pmItems.reduce((s, it) =>
    s + (parseFloat(String(it.hours)) || 0) * (parseFloat(String(it.hourly_rate)) || 0), 0) * 100) / 100;
  const actualHoursRaw = params.pmLaborActualHours;
  const actualHours = actualHoursRaw === null || actualHoursRaw === undefined || String(actualHoursRaw) === ""
    ? null : (parseFloat(String(actualHoursRaw)) || 0);
  const pmRate = pmPlannedHours > 0 ? pmLaborPlannedCost / pmPlannedHours : (params.pmFallbackRate ?? 0);
  const pmLaborActualCost = actualHours === null ? null : Math.round(actualHours * pmRate * 100) / 100;

  return {
    materialBudget: effectiveMaterialBudget,
    laborBudget: effectiveLaborBudget,
    materialActual,
    laborActual: laborFromReceipts + laborFromCrewPayments,
    laborProjected: laborFromReceipts + Math.max(fioAssigned, laborFromCrewPayments),
    isFallbackBudget: lineItemCostTotal === 0 && estimateTotalCost > 0,
    taxAmount: parseFloat(String(params.estimateTaxAmount)) || 0,
    pmLaborPlannedCost,
    pmLaborActualCost,
  };
}

// Jonathan's exact spec (Sep 25/29 2026): Projected Cost per category = the greater of
// Actual and (Committed-if-one-exists, otherwise Budget) — except once a category is
// marked complete (or the job reaches "Completed" status, which auto-completes both),
// where Projected Cost collapses to the literal Actual.
export type ProjectedFinancials = {
  revenue: number;          // contract value minus sales tax (BAD stays in)
  materialProjected: number;
  laborProjected: number;
  pmLaborProjected: number;
  cost: number;             // material + labor + PM labor, projected
  gp: number;
  gpPct: number;            // gp / revenue
};

type ProjectForGP = { totalValue?: number | null; status?: string | null; materials_complete?: boolean | null; labor_complete?: boolean | null; grossProfit?: number | null };

// PM Labor Hours cost, same philosophy as materials/labor: until the job is closed out the
// projected cost is the greater of what was planned (sold) and what has actually been entered;
// once completed it is the literal actual — falling back to the plan when no actual was ever entered.
export function pmLaborProjectedCost(inputs: ProjectedGPInputs, jobComplete: boolean): number {
  const planned = inputs.pmLaborPlannedCost ?? 0;
  const actual = inputs.pmLaborActualCost;
  if (jobComplete) return actual ?? planned;
  return Math.max(actual ?? 0, planned);
}

// The single job-level GP formula (Active tab, Financial Health, Cost Attributions, overhead
// tool, clients list). Jonathan, Oct 14 2026: revenue = contract value minus sales tax (BAD and
// PM labor revenue stay in), cost = projected material + labor + PM Labor Hours.
// COMPLETED jobs are deliberately left on the original formula (contract value incl. tax, no PM
// Labor Hours cost) — Jonathan, Oct 14 2026: "leave all completed jobs untouched and apply this
// revision to sold and active only." Do not "fix" that without asking him.
export function computeProjectedFinancials(
  inputs: ProjectedGPInputs | null | undefined,
  project: ProjectForGP | null | undefined,
): ProjectedFinancials {
  const contractValue = project?.totalValue ?? 0;
  if (!inputs) {
    const gp = project?.grossProfit ?? 0;
    return { revenue: contractValue, materialProjected: 0, laborProjected: 0, pmLaborProjected: 0, cost: contractValue - gp, gp, gpPct: contractValue > 0 ? (gp / contractValue) * 100 : 0 };
  }
  const jobComplete = project?.status === "completed";
  const revenue = jobComplete
    ? contractValue
    : contractValue - Math.min(Math.max(inputs.taxAmount ?? 0, 0), Math.max(contractValue, 0));
  const materialsComplete = jobComplete || !!project?.materials_complete;
  const laborComplete = jobComplete || !!project?.labor_complete;
  const materialProjected = materialsComplete ? inputs.materialActual : Math.max(inputs.materialActual, inputs.materialBudget);
  // Preserves the exact existing behavior (client-detail.tsx's prior inline version):
  // laborProjected already folds in max(FIO committed, crew paid), so it's used as-is
  // rather than also maxing against laborBudget here — NOT touching this in this fix,
  // since it's a pre-existing, separate question (what should Projected Labor show
  // before any FIO exists?) outside the scope of the list-vs-detail consistency bug.
  const laborProjectedFinal = laborComplete ? inputs.laborActual : (inputs.laborProjected ?? Math.max(inputs.laborActual, inputs.laborBudget));
  const pmProjected = jobComplete ? 0 : pmLaborProjectedCost(inputs, jobComplete);
  const cost = materialProjected + laborProjectedFinal + pmProjected;
  const gp = revenue - cost;
  return { revenue, materialProjected, laborProjected: laborProjectedFinal, pmLaborProjected: pmProjected, cost, gp, gpPct: revenue > 0 ? (gp / revenue) * 100 : 0 };
}

export function computeProjectedGP(
  inputs: ProjectedGPInputs | null | undefined,
  project: ProjectForGP | null | undefined,
): number {
  return computeProjectedFinancials(inputs, project).gp;
}

// ── Live job financials from raw joined rows ──────────────────────────────────────────────────
// ONE place that turns a project row (+ its receipts / FIOs and its client's proposals) into the
// projected GP the job's own page shows. Used by the clients list (api/clients.ts) and by
// api/live-gp.ts, which Payroll uses so PM commission follows the same GP as the job page.
// Jonathan, Oct 22 2026: "Moving forward, sync it to live GP." (Payroll had read the stored
// projects.gross_profit snapshot, which drifts from the live number.)

export type LiveGPProjectRow = {
  total_value?: number | null;
  status?: string | null;
  materials_complete?: boolean | null;
  labor_complete?: boolean | null;
  gross_profit?: number | null;
  receipts?: { category?: string | null; amount?: number | null }[] | null;
  fios?: {
    items?: { labor_cost_per_unit?: number | string | null; quantity?: number | string | null }[] | null;
    crew_payments?: { amount_paid?: number | string | null }[] | null;
  }[] | null;
};

/** The proposal a job's numbers are based on: the accepted one, else the newest that isn't declined/voided. */
export function pickJobEstimate<T extends { status?: string | null; created_at?: string | null }>(estimates: T[] | null | undefined): T | undefined {
  const list = estimates ?? [];
  return list.find((e) => e.status === "accepted")
    ?? list
      .filter((e) => e.status !== "declined" && e.status !== "voided")
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];
}

export function computeLiveProjectFinancials(
  project: LiveGPProjectRow,
  estimates: any[] | null | undefined,
): ProjectedFinancials {
  const est: any = pickJobEstimate(estimates);
  const fios = project.fios ?? [];
  const costs = aggregateProjectCosts({
    lineItems: est?.line_items ?? [],
    estimateTotalCost: est?.total_cost ?? 0,
    receipts: project.receipts ?? [],
    fioItems: fios.flatMap((f) => f.items ?? []),
    crewPayments: fios.flatMap((f) => f.crew_payments ?? []),
    estimateTaxAmount: est?.tax_amount ?? 0,
    pmLaborItems: est?.pm_labor ?? [],
    pmLaborActualHours: est?.pm_labor_actual_hours ?? null,
  });
  return computeProjectedFinancials(costs, {
    totalValue: project.total_value,
    status: project.status,
    materials_complete: project.materials_complete,
    labor_complete: project.labor_complete,
    grossProfit: project.gross_profit,
  });
}
