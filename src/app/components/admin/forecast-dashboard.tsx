import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { clientsAPI, projectsAPI } from "../../utils/api";
import { TrendingUp, DollarSign, Target, Calendar } from "lucide-react";
import { SkeletonCards, SkeletonChart } from "../ui/page-loader";
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

export function ForecastDashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    Promise.all([clientsAPI.getAll(), projectsAPI.getAll()])
      .then(([c, p]) => { setClients(c); setProjects(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefetch(fetchData, ["clients", "projects"], "forecast-dashboard");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCards count={4} />
        <SkeletonChart />
        <SkeletonChart height={180} />
      </div>
    );
  }

  // Pipeline stats from real data
  const activeProjects  = projects.filter((p) => ["active", "selling"].includes(p.status));
  const soldProjects    = projects.filter((p) => p.status === "sold");
  const completedProjects = projects.filter((p) => p.status === "completed");

  const activeRevenue    = activeProjects.reduce((s, p) => s + (p.totalValue || 0), 0);
  const soldRevenue      = soldProjects.reduce((s, p) => s + (p.totalValue || 0), 0);
  const completedRevenue = completedProjects.reduce((s, p) => s + (p.totalValue || 0), 0);
  const totalCommissions = projects.reduce((s, p) => s + (p.commission || 0), 0);

  // Monthly revenue — last 6 months from project start_date
  const now = new Date();
  const monthlyForecast = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthRevenue = projects
      .filter((p) => {
        const date = p.start_date ? new Date(p.start_date) : null;
        return date && date.getFullYear() === y && date.getMonth() === m;
      })
      .reduce((s, p) => s + (p.totalValue || 0), 0);
    return {
      month: d.toLocaleString("en-US", { month: "short" }),
      actual: monthRevenue,
    };
  });

  // Revenue by status breakdown
  const revenueByStatus = [
    { status: "Selling", value: activeRevenue },
    { status: "Sold",    value: soldRevenue },
    { status: "Completed", value: completedRevenue },
  ];

  // Pipeline stage breakdown from clients
  const stageBreakdown = clients.reduce((acc, c) => {
    const stage = c.pipeline_stage?.name ?? "No Stage";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stageData = Object.entries(stageBreakdown).map(([stage, count]) => ({ stage, count }));

  return (
    <div className="space-y-4">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3">
        <h2 className="text-xl font-bold">Revenue Forecasting</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Predictive analysis based on pipeline data</p>
      </div>

      {/* Forecast KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Active Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(activeRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeProjects.length} active projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sold Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(soldRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{soldProjects.length} sold projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Completed Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(completedRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{completedProjects.length} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalCommissions)}</div>
            <p className="text-xs text-muted-foreground mt-1">All projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} name="Revenue" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Project Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="value" fill="#3b82f6" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stage Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Client Pipeline Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stageData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No clients in pipeline yet</p>
              <p className="text-xs mt-1">Add clients to start tracking pipeline stages.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Stage</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Clients</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stageData.map(({ stage, count }) => {
                    const n = Number(count);
                    return (
                    <tr key={stage} className="hover:bg-accent/50">
                      <td className="p-3 font-medium text-sm">{stage}</td>
                      <td className="p-3 text-sm">{n}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${(n / clients.length) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{((n / clients.length) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
