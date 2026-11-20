// Period-aware numbers for the dashboard's Financial summary (Jonathan, Nov 20 2026): "make sure all of these numbers
// reflect for their selected period ... GP, closed revenue and contracted value show all-time despite whatever the
// selected period is" + "GP should reflect our average and live depending on which period is selected, with a way to
// see an overview of the year and years prior".
//
// One row per signed job (sold / active / completed):
//   signedAt     = when the contract was signed (earliest of the stage-history "sold" move and the accepted proposal)
//   completedAt  = when the job was completed (projects.completed_at), null while still open
//   value        = contract value
//   gp           = the job's LIVE projected gross profit (the same number as the client page)
// Contracted value belongs to the period the job was SIGNED in; closed revenue to the period it was COMPLETED in.
// GROSS PROFIT (Jonathan, Nov 20 2026: "if you factor all active jobs live GP, that number should be much higher") is
// the live GP of every job IN PROGRESS during the period: signed on or before the period's end and not finished
// before it started (so active jobs signed earlier count, and so do jobs completed inside the period). Because a job
// stays in progress for several months, months overlap and do not add up to the year.
// GP % is always total GP / total contract value (a weighted average, not an average of percentages).

export interface JobRow {
  id: string;
  client: string;
  status: string;
  signedAt: number | null;
  completedAt: number | null;
  value: number;
  gp: number;
}

export interface Totals {
  contractedValue: number;
  contractedCount: number;
  closedValue: number;
  closedCount: number;
  // jobs in progress during the period (see above) - what the Gross Profit card shows
  flightCount: number;
  flightValue: number;
  gp: number;
  gpPct: number;
}

const inRange = (t: number | null, start: number, end: number) => t !== null && t >= start && t <= end;

/** Signed on or before the period's end, and not completed before the period started. */
export const inProgressDuring = (r: JobRow, start: number, end: number): boolean =>
  r.signedAt !== null && r.signedAt <= end && (r.status !== "completed" || (r.completedAt !== null && r.completedAt >= start));

export function totalsFor(rows: readonly JobRow[], start: number, end: number): Totals {
  let contractedValue = 0, contractedCount = 0, closedValue = 0, closedCount = 0, flightCount = 0, flightValue = 0, gp = 0;
  for (const r of rows) {
    if (inRange(r.signedAt, start, end)) {
      contractedValue += r.value;
      contractedCount += 1;
    }
    if (r.status === "completed" && inRange(r.completedAt, start, end)) {
      closedValue += r.value;
      closedCount += 1;
    }
    if (inProgressDuring(r, start, end)) {
      flightCount += 1;
      flightValue += r.value;
      gp += r.gp;
    }
  }
  return { contractedValue, contractedCount, closedValue, closedCount, flightCount, flightValue, gp, gpPct: flightValue > 0 ? (gp / flightValue) * 100 : 0 };
}

export const allTimeTotals = (rows: readonly JobRow[]): Totals => totalsFor(rows, -Infinity, Infinity);

/** Calendar year of a timestamp in local time. */
const yearOf = (t: number) => new Date(t).getFullYear();

/** One line per year that has any signed or completed job, newest year first. */
export function yearOverview(rows: readonly JobRow[]): (Totals & { year: number })[] {
  const years = new Set<number>();
  for (const r of rows) {
    if (r.signedAt !== null) years.add(yearOf(r.signedAt));
    if (r.status === "completed" && r.completedAt !== null) years.add(yearOf(r.completedAt));
  }
  return [...years].sort((a, b) => b - a).map((year) => ({
    year,
    ...totalsFor(rows, new Date(year, 0, 1).getTime(), new Date(year, 11, 31, 23, 59, 59, 999).getTime()),
  }));
}

/** Twelve month lines for one year. */
export function monthOverview(rows: readonly JobRow[], year: number): (Totals & { month: number })[] {
  return Array.from({ length: 12 }, (_, month) => ({
    month,
    ...totalsFor(rows, new Date(year, month, 1).getTime(), new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()),
  }));
}
