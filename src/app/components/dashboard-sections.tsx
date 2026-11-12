import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock, DollarSign, Pencil, SlidersHorizontal, TrendingUp, Award } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

// Presentational pieces of the redesigned admin Dashboard (Jonathan's Figma "Redesign CRM Revenue Dashboard",
// Nov 2026): same numbers as before, laid out more compactly. All data comes in through props from dashboard.tsx.

const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const moneyShort = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}m` : `$${Math.round(v / 1000)}k`;

/** A rounded white panel with the Figma title row (title + subtitle on the left, anything on the right). */
export function DashPanel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}>
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ── Financial summary ────────────────────────────────────────────────────────────────────────

export type SummaryMetric = {
  id: string;
  label: string;
  value: number;
  /** tailwind classes for the small tinted icon square, e.g. "bg-blue-50 text-blue-600" */
  iconTint: string;
  icon: ReactNode;
  detail: string;
  note?: string;
  noteClass?: string;
  /** a link shown inside the expanded row */
  action?: { label: string; to?: string; onClick?: () => void };
};

export function FinancialSummary({ metrics }: { metrics: SummaryMetric[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <DashPanel
      title="Financial summary"
      subtitle="Click a metric to view details"
      right={
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" /> Updated today
        </span>
      }
    >
      <div className="px-4 pb-2.5">
        {metrics.map((m) => {
          const expanded = open === m.id;
          return (
            <div key={m.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : m.id)}
                aria-expanded={expanded}
                className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto_22px] items-center gap-3 px-1 py-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2.5 text-[12px] font-medium transition-colors group-hover:text-blue-600">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.iconTint}`}>{m.icon}</span>
                  <span className="truncate">{m.label}</span>
                </span>
                <span className="text-[15px] font-bold tabular-nums tracking-tight">{money(m.value)}</span>
                <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
              {expanded && (
                <div className="mx-1 mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>{m.detail}</span>
                  {m.note && <strong className={`font-semibold ${m.noteClass ?? ""}`}>{m.note}</strong>}
                  {m.action &&
                    (m.action.to ? (
                      <Link to={m.action.to} className="font-medium text-primary hover:underline">{m.action.label}</Link>
                    ) : (
                      <button type="button" onClick={m.action.onClick} className="font-medium text-primary hover:underline">{m.action.label}</button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashPanel>
  );
}

// ── Pipeline vs. closed revenue ──────────────────────────────────────────────────────────────

export function PipelineVsClosedChart({ data }: { data: { month: string; pipeline: number; closed: number }[] }) {
  return (
    <DashPanel
      title="Pipeline vs. closed revenue"
      subtitle="Monthly performance comparison"
      right={
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#2c69e8]" />Pipeline value</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#20a268]" />Closed revenue</span>
        </div>
      }
    >
      <div className="h-[244px] px-3 pb-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e4e8" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6f737d" }} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={moneyShort} tick={{ fontSize: 10, fill: "#9598a1" }} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              formatter={(value: number, name: string) => [money(Number(value)), name]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e4e8" }}
            />
            <Bar dataKey="pipeline" name="Pipeline value" fill="#2c69e8" radius={[3, 3, 1, 1]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="closed" name="Closed revenue" fill="#20a268" radius={[3, 3, 1, 1]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashPanel>
  );
}

// ── Goal trackers ────────────────────────────────────────────────────────────────────────────

type GoalCardProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconTint: string;
  barColor: string;
  collectedLabel: string;
  collected: number;
  goal: number;
  progress: number;
  footer: ReactNode;
};

function GoalCard({ title, subtitle, icon, iconTint, barColor, collectedLabel, collected, goal, progress, footer }: GoalCardProps) {
  return (
    <article className="rounded-lg border bg-muted/20 px-4 pb-3.5 pt-4">
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconTint}`}>{icon}</span>
        <div className="min-w-0">
          <strong className="block truncate text-[12px] font-semibold">{title}</strong>
          <span className="block truncate text-[10px] text-muted-foreground">{subtitle}</span>
        </div>
        <strong className="flex items-center gap-1 text-[13px]">
          {progress.toFixed(1)}%
          {progress >= 100 && <Award className="h-3.5 w-3.5 text-yellow-500" />}
        </strong>
      </div>
      <div className="mt-3.5 flex justify-between gap-5">
        <div>
          <span className="block text-[10px] text-muted-foreground">{collectedLabel}</span>
          <strong className="text-[13px]">{money(collected)}</strong>
        </div>
        <div className="text-right">
          <span className="block text-[10px] text-muted-foreground">Goal</span>
          <strong className="text-[13px]">{money(goal)}</strong>
        </div>
      </div>
      <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, background: barColor }} />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{footer}</p>
    </article>
  );
}

export type GoalTrackersProps = {
  periodLabel: string;
  canUseCalculator: boolean;
  onEditGoals: () => void;
  onOpenFullCalculator: () => void;
  revenue: { collected: number; goal: number; progress: number; remaining: number; subtitle: string };
  sales: { amount: number; goal: number; progress: number; subtitle: string };
  projectsThisPeriod: number;
  averageContract: number;
  upcomingPayments: number;
  overduePayments: number;
  showCollections: boolean;
  onOpenCollections: () => void;
};

export function GoalTrackers(p: GoalTrackersProps) {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [lift, setLift] = useState(10);
  const projected = p.averageContract * (1 + lift / 100);

  return (
    <DashPanel
      title="Goal trackers"
      subtitle="Progress toward your revenue and sales targets"
      right={
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{p.periodLabel}</span>
          {p.canUseCalculator && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => setScenarioOpen((v) => !v)} aria-expanded={scenarioOpen}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scenario calculator</span>
            </Button>
          )}
          <button type="button" onClick={p.onEditGoals} title="Edit goals" aria-label="Edit goals" className="grid h-8 w-8 place-items-center rounded-lg border text-muted-foreground hover:bg-accent">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      {scenarioOpen && (
        <div className="mx-5 mt-4 grid grid-cols-1 items-center gap-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 md:grid-cols-[1fr_minmax(220px,0.75fr)_auto] md:gap-6">
          <div>
            <strong className="block text-[12px]">Forecast scenario</strong>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">Model the impact of increasing average contract value.</span>
            <button type="button" onClick={p.onOpenFullCalculator} className="mt-1 text-[10px] font-medium text-primary hover:underline">Open the full calculator</button>
          </div>
          <label className="flex flex-col gap-1.5 text-[10px] text-muted-foreground">
            Contract value lift
            <input type="range" min={0} max={50} step={5} value={lift} onChange={(e) => setLift(Number(e.target.value))} className="w-full accent-blue-600" />
          </label>
          <div className="flex min-w-[110px] flex-col md:items-end">
            <span className="text-[10px] font-bold text-blue-600">+{lift}%</span>
            <strong className="text-[14px]">{money(projected)}</strong>
            <small className="text-[10px] text-muted-foreground">projected average</small>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-2">
        <GoalCard
          title="Revenue collected"
          subtitle={p.revenue.subtitle}
          icon={<DollarSign className="h-4 w-4" />}
          iconTint="bg-orange-50 text-orange-600"
          barColor="#f06b19"
          collectedLabel="Collected"
          collected={p.revenue.collected}
          goal={p.revenue.goal}
          progress={p.revenue.progress}
          footer={p.revenue.remaining > 0 ? <><strong className="font-semibold text-foreground/70">{money(p.revenue.remaining)}</strong> remaining to reach revenue goal</> : "Revenue goal reached"}
        />
        <GoalCard
          title="Sales goal"
          subtitle={p.sales.subtitle}
          icon={<TrendingUp className="h-4 w-4" />}
          iconTint="bg-violet-50 text-violet-600"
          barColor="#8358ea"
          collectedLabel="Contracted"
          collected={p.sales.amount}
          goal={p.sales.goal}
          progress={p.sales.progress}
          footer={p.sales.goal - p.sales.amount > 0 ? <><strong className="font-semibold text-foreground/70">{money(p.sales.goal - p.sales.amount)}</strong> remaining to reach sales goal</> : "Sales goal reached"}
        />
      </div>

      <div className="grid grid-cols-2 items-center gap-x-5 gap-y-3 border-t px-5 py-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted-foreground">Projects this period</span>
          <strong className="text-[12px]">{p.projectsThisPeriod}</strong>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-muted-foreground">Average contract</span>
          <strong className="text-[12px]">{money(scenarioOpen ? projected : p.averageContract)}</strong>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[10px] text-muted-foreground">Upcoming payments</span>
          <strong className="text-[12px]">{p.upcomingPayments}</strong>
          {p.overduePayments > 0 ? (
            <small className="text-[10px] font-medium text-red-600">{p.overduePayments} past due</small>
          ) : (
            <small className="text-[10px] text-green-600">No overdue payments</small>
          )}
        </div>
        {p.showCollections && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={p.onOpenCollections}>
            <DollarSign className="h-3.5 w-3.5" />
            Collections
            {p.overduePayments > 0 && <Badge variant="destructive" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">{p.overduePayments}</Badge>}
          </Button>
        )}
      </div>
    </DashPanel>
  );
}
