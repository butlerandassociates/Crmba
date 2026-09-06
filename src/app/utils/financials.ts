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
