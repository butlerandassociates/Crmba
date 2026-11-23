import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { allTimeTotals, inProgressDuring, monthOverview, totalsFor, yearOverview, type JobRow } from "../utils/period-metrics";

// Detail popups for the dashboard's Financial summary (Jonathan, Nov 20 2026):
//  - Contracted Value / Closed Revenue: "current period AND all time"
//  - Gross Profit: live GP for the selected period + an overview of the year and the years before it
export type MetricKind = "contracted" | "closed" | "profit";

const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const pct = (v: number) => `${v.toFixed(1)}%`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (t: number | null) => (t === null ? "—" : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));

function StatCard({ title, value, sub, accent }: { title: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-muted/40" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function DashboardMetricDialog({
  kind, onClose, rows, start, end, periodName, periodDetail, isAllTimePeriod,
}: {
  kind: MetricKind | null;
  onClose: () => void;
  rows: JobRow[];
  start: number;
  end: number;
  periodName: string; // "Current month"
  periodDetail: string; // "November 2026"
  isAllTimePeriod: boolean;
}) {
  const period = useMemo(() => totalsFor(rows, start, end), [rows, start, end]);
  const all = useMemo(() => allTimeTotals(rows), [rows]);
  const years = useMemo(() => yearOverview(rows), [rows]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  useEffect(() => {
    if (years.length > 0 && !years.some((y) => y.year === year)) setYear(years[0].year);
  }, [years, year]);
  const months = useMemo(() => monthOverview(rows, year), [rows, year]);
  const yearTotals = years.find((y) => y.year === year);

  const periodJobs = useMemo(() => {
    if (kind === "contracted") return rows.filter((r) => r.signedAt !== null && r.signedAt >= start && r.signedAt <= end).sort((a, b) => (b.signedAt ?? 0) - (a.signedAt ?? 0));
    if (kind === "closed") return rows.filter((r) => r.status === "completed" && r.completedAt !== null && r.completedAt >= start && r.completedAt <= end).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return [];
  }, [rows, kind, start, end]);

  // the jobs the Gross Profit number is made of (so every figure can be traced to a client)
  const gpJobs = useMemo(
    () => (kind === "profit" ? rows.filter((r) => inProgressDuring(r, start, end)).sort((a, b) => b.gp - a.gp) : []),
    [rows, kind, start, end],
  );

  if (!kind) return null;

  const title = kind === "contracted" ? "Contracted Value" : kind === "closed" ? "Closed Revenue" : "Gross Profit";
  const description =
    kind === "contracted" ? "Jobs signed (Sold + Active + Completed), by the date the contract was signed."
      : kind === "closed" ? "Completed projects, by the date they were completed."
        : "Live gross profit of every job in progress during the period: signed by then and not yet finished (the same GP as on each client page).";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody className="min-w-0 space-y-5">
        {/* this period vs all time */}
        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "contracted" && (
            <>
              <StatCard accent title={`${periodName} · ${periodDetail}`} value={money(period.contractedValue)} sub={`${period.contractedCount} contract${period.contractedCount === 1 ? "" : "s"} signed`} />
              <StatCard title="All time" value={money(all.contractedValue)} sub={`${all.contractedCount} contracts signed`} />
            </>
          )}
          {kind === "closed" && (
            <>
              <StatCard accent title={`${periodName} · ${periodDetail}`} value={money(period.closedValue)} sub={`${period.closedCount} project${period.closedCount === 1 ? "" : "s"} completed`} />
              <StatCard title="All time" value={money(all.closedValue)} sub={`${all.closedCount} projects completed`} />
            </>
          )}
          {kind === "profit" && (
            <>
              <StatCard accent title={`${periodName} · ${periodDetail}`} value={money(period.gp)} sub={`${pct(period.gpPct)} avg live GP · ${period.flightCount} job${period.flightCount === 1 ? "" : "s"} in progress`} />
              <StatCard title="All time" value={money(all.gp)} sub={`${pct(all.gpPct)} avg live GP · ${all.flightCount} jobs`} />
            </>
          )}
        </div>
        {isAllTimePeriod && kind !== "profit" && (
          <p className="-mt-2 text-xs text-muted-foreground">The selected period is All time, so both boxes match.</p>
        )}

        {/* the jobs behind the period number */}
        {kind !== "profit" && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{kind === "contracted" ? "Signed" : "Completed"} in {periodDetail}</p>
              <Link to={kind === "contracted" ? "/clients?stage=sold" : "/clients?stage=completed"} onClick={onClose} className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                View clients
              </Link>
            </div>
            {periodJobs.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {kind === "contracted" ? "No contracts were signed" : "No projects were completed"} in this period.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left font-semibold">Client</th><th className="px-3 py-2 text-left font-semibold">{kind === "contracted" ? "Signed" : "Completed"}</th><th className="px-3 py-2 text-right font-semibold">Value</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {periodJobs.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium">{r.client}</td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(kind === "contracted" ? r.signedAt : r.completedAt)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GP: which jobs are counted in the selected period */}
        {kind === "profit" && (
          <div>
            <p className="mb-2 text-sm font-semibold">Jobs counted in {periodDetail}</p>
            {gpJobs.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No jobs were in progress in this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Client</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Contract value</th>
                      <th className="px-3 py-2 text-right font-semibold">Live GP</th>
                      <th className="px-3 py-2 text-right font-semibold">GP %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gpJobs.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium">{r.client}</td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">{r.status}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(r.value)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.gp)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.value > 0 ? pct((r.gp / r.value) * 100) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>{gpJobs.length} job{gpJobs.length === 1 ? "" : "s"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(gpJobs.reduce((s, r) => s + r.value, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(gpJobs.reduce((s, r) => s + r.gp, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(period.gpPct)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              A job is counted from the day it is signed until it is completed: active and sold jobs signed earlier, plus jobs completed in this period. Each job's GP is its live GP, the same as on its client page.
            </p>
          </div>
        )}

        {/* GP: the year and the years before */}
        {kind === "profit" && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">Years</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Year</th>
                      <th className="px-3 py-2 text-right font-semibold">Jobs</th>
                      <th className="px-3 py-2 text-right font-semibold">Contract value</th>
                      <th className="px-3 py-2 text-right font-semibold">Live GP</th>
                      <th className="px-3 py-2 text-right font-semibold">GP %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {years.map((y) => (
                      <tr key={y.year} onClick={() => setYear(y.year)} className={`cursor-pointer hover:bg-muted/40 ${y.year === year ? "bg-muted/40" : ""}`}>
                        <td className="px-3 py-2 font-semibold">{y.year}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{y.flightCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(y.flightValue)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(y.gp)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(y.gpPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Click a year to see its months. Earlier years appear here as soon as they have jobs.</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{year} by month</p>
                {years.length > 1 && (
                  <select className="h-8 rounded-md border bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
                  </select>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Month</th>
                      <th className="px-3 py-2 text-right font-semibold">Jobs</th>
                      <th className="px-3 py-2 text-right font-semibold">Contract value</th>
                      <th className="px-3 py-2 text-right font-semibold">Live GP</th>
                      <th className="px-3 py-2 text-right font-semibold">GP %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {months.map((m) => (
                      <tr key={m.month} className={m.flightCount === 0 ? "text-muted-foreground" : ""}>
                        <td className="px-3 py-2 font-medium">{MONTHS[m.month]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.flightCount || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.flightCount ? money(m.flightValue) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.flightCount ? money(m.gp) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.flightCount ? pct(m.gpPct) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  {yearTotals && (
                    <tfoot className="bg-muted/50 font-semibold">
                      <tr>
                        <td className="px-3 py-2">{year} total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{yearTotals.flightCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(yearTotals.flightValue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(yearTotals.gp)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(yearTotals.gpPct)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">A job counts in every month it is in progress, so months overlap and do not add up to the year.</p>
            </div>
          </>
        )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
