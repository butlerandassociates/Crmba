import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency } from "@/app/utils/format";
import { DollarSign, TrendingUp, TrendingDown, Percent, BarChart2, Award, AlertCircle, Clock, Calendar, CreditCard } from "lucide-react";
import { PageLoader, SkeletonCards, SkeletonChart } from "./ui/page-loader";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Badge } from "./ui/badge";
import { Link } from "react-router";
import { projectsAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-500",
  selling:   "bg-blue-500",
  sold:      "bg-purple-500",
  completed: "bg-emerald-600",
  on_hold:   "bg-yellow-500",
  cancelled: "bg-red-500",
  planning:  "bg-sky-500",
};

export function Financials() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [paidPayments, setPaidPayments] = useState<any[]>([]);
  const [collectionView, setCollectionView] = useState<"outstanding" | "collected">("outstanding");

  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const todayDate = new Date();
  const [fromDate, setFromDate] = useState(toDateStr(new Date(todayDate.getTime() - 30 * 86400000)));
  const [toDate,   setToDate]   = useState(toDateStr(new Date(todayDate.getTime() + 30 * 86400000)));

  const PAYMENT_SELECT = `id, label, amount, due_date, paid_date, payment_method, project_id, client_id, projects(id, name), clients(id, first_name, last_name)`;

  const fetchData = async () => {
    const [projectsResult, unpaidResult, paidResult] = await Promise.all([
      projectsAPI.getAll(),
      supabase
        .from("project_payments")
        .select(PAYMENT_SELECT)
        .eq("is_paid", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true }),
      supabase
        .from("project_payments")
        .select(PAYMENT_SELECT)
        .eq("is_paid", true)
        .not("paid_date", "is", null)
        .order("paid_date", { ascending: false }),
    ]);
    setProjects(projectsResult);
    setPayments(unpaidResult.data ?? []);
    setPaidPayments(paidResult.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefetch(fetchData, ["projects", "receipts", "project_payments"], "financials");

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonCards count={4} />
        <SkeletonChart height={260} />
        <PageLoader title="Building your financial overview…" description="Calculating revenue, costs, gross profit & margins across all projects" className="min-h-[8vh]" />
      </div>
    );
  }

  const revenueProjects = projects.filter((p) => ["sold", "active", "completed"].includes(p.status));
  const totalRevenue = revenueProjects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const totalCosts   = revenueProjects.reduce((sum, p) => sum + (p.totalCosts  || 0), 0);
  const totalProfit  = revenueProjects.reduce((sum, p) => sum + (p.grossProfit || 0), 0);
  const totalCommissions = revenueProjects.reduce((sum, p) => sum + (p.commission || 0) + (p.salesRepCommission || 0), 0);
  const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Monthly financial trends — sold + active + completed projects by created_at (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthProjects = revenueProjects.filter((p) => {
      const date = p.created_at ? new Date(p.created_at) : null;
      return date && date.getFullYear() === y && date.getMonth() === m;
    });
    return {
      month:   d.toLocaleString("en-US", { month: "short" }),
      revenue: monthProjects.reduce((s, p) => s + (p.totalValue  || 0), 0),
      costs:   monthProjects.reduce((s, p) => s + (p.totalCosts  || 0), 0),
      profit:  monthProjects.reduce((s, p) => s + (p.grossProfit || 0), 0),
    };
  });

  const projectProfitability = revenueProjects.map((p) => ({
    name:   p.name && p.name.length > 20 ? p.name.substring(0, 20) + "…" : (p.name || "Unnamed"),
    profit: p.grossProfit || 0,
    margin: p.profitMargin || 0,
  }));


  return (
    <div className="p-6 space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-6 px-6 pt-6 pb-4 -mt-6">
        <h1 className="text-2xl font-bold">Financial Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track revenue, costs, and profitability</p>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Sold + Active + Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
            <p className="text-xs text-muted-foreground mt-1">Materials + Labor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue - Costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Profit Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProfitMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Financial Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="costs"   stroke="#ef4444" strokeWidth={2} name="Costs"   dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="profit"  stroke="#10b981" strokeWidth={2} name="Profit"  dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Profitability</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <BarChart2 className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No profitability data yet</p>
                <p className="text-xs mt-1">Data will appear once clients are moved to sold.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectProfitability}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="profit" fill="#10b981" name="Gross Profit" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commissions Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Total Commissions: {formatCurrency(totalCommissions)}</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Award className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No commissions yet</p>
              <p className="text-xs mt-1">Commission data is generated when clients are moved to sold.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/clients/${project.client?.id}`} className="font-semibold hover:text-primary no-underline">
                        {project.clientName || project.name || "Unnamed"}
                      </Link>
                      <Badge className={STATUS_COLORS[project.status] ?? "bg-gray-500"}>
                        {(project.status ?? "").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{project.clientName}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(project.commission || 0)}</div>
                    <div className="text-sm text-muted-foreground">
                      {project.totalValue > 0
                        ? `${(((project.commission || 0) / project.totalValue) * 100).toFixed(1)}% of ${formatCurrency(project.totalValue)}`
                        : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Collections */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const from  = fromDate ? new Date(fromDate + "T00:00:00") : null;
        const to    = toDate   ? new Date(toDate   + "T00:00:00") : null;

        // Outstanding (unpaid) — filter by due_date within range
        const outstanding = payments.filter((p) => {
          const due = new Date(p.due_date); due.setHours(0,0,0,0);
          if (from && due < from) return false;
          if (to   && due > to)   return false;
          return true;
        });
        const overdue  = outstanding.filter((p) => { const d = new Date(p.due_date); d.setHours(0,0,0,0); return d < today; });
        const dueToday = outstanding.filter((p) => { const d = new Date(p.due_date); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); });
        const upcoming = outstanding.filter((p) => { const d = new Date(p.due_date); d.setHours(0,0,0,0); return d > today; });

        // Collected (paid) — filter by paid_date within range
        const collected = paidPayments.filter((p) => {
          const paid = new Date(p.paid_date); paid.setHours(0,0,0,0);
          if (from && paid < from) return false;
          if (to   && paid > to)   return false;
          return true;
        });

        const clientName = (p: any) => p.clients ? `${p.clients.first_name ?? ""} ${p.clients.last_name ?? ""}`.trim() : "—";
        const clientId   = (p: any) => p.client_id;
        const fmtDate    = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Payment Collections</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {collectionView === "outstanding" ? "Unpaid milestones with a due date" : "Paid milestones received in this period"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={collectionView} onValueChange={(v) => setCollectionView(v as "outstanding" | "collected")}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outstanding">Outstanding</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="border-0 p-0 h-auto text-sm w-32 focus-visible:ring-0 shadow-none"
                    />
                    <span className="text-muted-foreground text-sm">—</span>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="border-0 p-0 h-auto text-sm w-32 focus-visible:ring-0 shadow-none"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>

              {collectionView === "outstanding" ? (
                <>
                  <div className="flex gap-3 mb-4">
                    {overdue.length  > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full"><AlertCircle className="h-3.5 w-3.5" />{overdue.length} Overdue</span>}
                    {dueToday.length > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><Clock className="h-3.5 w-3.5" />{dueToday.length} Due Today</span>}
                    {upcoming.length > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full"><Calendar className="h-3.5 w-3.5" />{upcoming.length} Upcoming</span>}
                  </div>
                  {outstanding.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <CreditCard className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No outstanding payments</p>
                      <p className="text-xs mt-1">All milestones in this range are paid.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background z-10">
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium w-[30%]">Client</th>
                            <th className="text-left p-3 font-medium w-[25%]">Payment</th>
                            <th className="text-right p-3 font-medium w-[15%]">Due Date</th>
                            <th className="text-right p-3 font-medium w-[15%]">Status</th>
                            <th className="text-right p-3 font-medium w-[15%]">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outstanding.map((p) => {
                            const due = new Date(p.due_date); due.setHours(0,0,0,0);
                            const isOverdue  = due < today;
                            const isDueToday = due.getTime() === today.getTime();
                            const diffDays   = Math.round((due.getTime() - today.getTime()) / 86400000);
                            return (
                              <tr key={p.id} className="border-b hover:bg-accent">
                                <td className="p-3"><Link to={`/clients/${clientId(p)}`} className="font-medium hover:text-primary no-underline">{clientName(p)}</Link></td>
                                <td className="p-3 text-sm text-muted-foreground">{p.label}</td>
                                <td className="p-3 text-right text-sm">{fmtDate(p.due_date)}</td>
                                <td className="p-3 text-right">
                                  {isOverdue  && <Badge className="bg-red-100 text-red-700 border-red-200">Overdue {Math.abs(diffDays)}d</Badge>}
                                  {isDueToday && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Due Today</Badge>}
                                  {!isOverdue && !isDueToday && <Badge className="bg-blue-100 text-blue-700 border-blue-200">In {diffDays}d</Badge>}
                                </td>
                                <td className="p-3 text-right font-medium">{formatCurrency(p.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2">
                          <tr className="font-bold">
                            <td className="p-3" colSpan={3}>Total Outstanding</td>
                            <td />
                            <td className="p-3 text-right">{formatCurrency(outstanding.reduce((s, p) => s + (p.amount || 0), 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex gap-3 mb-4">
                    {collected.length > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><TrendingUp className="h-3.5 w-3.5" />{collected.length} Received</span>}
                  </div>
                  {collected.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <DollarSign className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No collected payments in this range</p>
                      <p className="text-xs mt-1">Paid milestones will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background z-10">
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium w-[30%]">Client</th>
                            <th className="text-left p-3 font-medium w-[25%]">Payment</th>
                            <th className="text-right p-3 font-medium w-[15%]">Paid Date</th>
                            <th className="text-right p-3 font-medium w-[15%]">Method</th>
                            <th className="text-right p-3 font-medium w-[15%]">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {collected.map((p) => (
                            <tr key={p.id} className="border-b hover:bg-accent">
                              <td className="p-3"><Link to={`/clients/${clientId(p)}`} className="font-medium hover:text-primary no-underline">{clientName(p)}</Link></td>
                              <td className="p-3 text-sm text-muted-foreground">{p.label}</td>
                              <td className="p-3 text-right text-sm">{fmtDate(p.paid_date)}</td>
                              <td className="p-3 text-right text-sm text-muted-foreground">{p.payment_method || "—"}</td>
                              <td className="p-3 text-right font-medium text-emerald-600">{formatCurrency(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2">
                          <tr className="font-bold">
                            <td className="p-3" colSpan={3}>Total Collected</td>
                            <td />
                            <td className="p-3 text-right text-emerald-600">{formatCurrency(collected.reduce((s, p) => s + (p.amount || 0), 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}

            </CardContent>
          </Card>
        );
      })()}

      {/* Client Financial Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Financial Details</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <DollarSign className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No client financial data yet</p>
              <p className="text-xs mt-1">Financial details will appear here once clients are moved to sold.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Client</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Revenue</th>
                    <th className="text-right p-3 font-medium">Costs</th>
                    <th className="text-right p-3 font-medium">Profit</th>
                    <th className="text-right p-3 font-medium">Margin</th>
                    <th className="text-right p-3 font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueProjects.map((project) => (
                    <tr key={project.id} className="border-b hover:bg-accent">
                      <td className="p-3">
                        <Link to={`/clients/${project.client?.id}`} className="hover:text-primary no-underline">
                          <div className="font-medium">{project.clientName || project.name || "Unnamed"}</div>
                          <div className="text-sm text-muted-foreground">{project.name}</div>
                        </Link>
                      </td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[project.status] ?? "bg-gray-500"}>
                          {(project.status ?? "").replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="text-right p-3 font-medium">{formatCurrency(project.totalValue  || 0)}</td>
                      <td className="text-right p-3">               {formatCurrency(project.totalCosts  || 0)}</td>
                      <td className="text-right p-3 font-medium text-green-600">{formatCurrency(project.grossProfit || 0)}</td>
                      <td className="text-right p-3">{(project.profitMargin || 0).toFixed(1)}%</td>
                      <td className="text-right p-3">{formatCurrency(project.commission  || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="font-bold">
                    <td className="p-3" colSpan={2}>Totals</td>
                    <td className="text-right p-3">{formatCurrency(totalRevenue)}</td>
                    <td className="text-right p-3">{formatCurrency(totalCosts)}</td>
                    <td className="text-right p-3 text-green-600">{formatCurrency(totalProfit)}</td>
                    <td className="text-right p-3">{avgProfitMargin.toFixed(1)}%</td>
                    <td className="text-right p-3">{formatCurrency(totalCommissions)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
