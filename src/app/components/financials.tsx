import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { DollarSign, TrendingUp, TrendingDown, Percent, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    projectsAPI.getAll()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRevenue = projects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const totalCosts   = projects.reduce((sum, p) => sum + (p.totalCosts  || 0), 0);
  const totalProfit  = projects.reduce((sum, p) => sum + (p.grossProfit || 0), 0);
  const totalCommissions = projects.reduce((sum, p) => sum + (p.commission || 0), 0);
  const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Monthly financial trends — group projects by start_date (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthProjects = projects.filter((p) => {
      const date = p.start_date ? new Date(p.start_date) : null;
      return date && date.getFullYear() === y && date.getMonth() === m;
    });
    return {
      month:   d.toLocaleString("en-US", { month: "short" }),
      revenue: monthProjects.reduce((s, p) => s + (p.totalValue  || 0), 0),
      costs:   monthProjects.reduce((s, p) => s + (p.totalCosts  || 0), 0),
      profit:  monthProjects.reduce((s, p) => s + (p.grossProfit || 0), 0),
    };
  });

  const projectProfitability = projects.map((p) => ({
    name:   p.name && p.name.length > 20 ? p.name.substring(0, 20) + "…" : (p.name || "Unnamed"),
    profit: p.grossProfit || 0,
    margin: p.profitMargin || 0,
  }));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financial Overview</h1>
        <p className="text-muted-foreground mt-1">Track revenue, costs, and profitability</p>
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
            <p className="text-xs text-muted-foreground mt-1">All projects</p>
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
            <p className="text-xs text-muted-foreground mt-1">Across all projects</p>
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
            <CardTitle>Project Profitability</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">No projects yet</div>
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
            <p className="text-sm text-muted-foreground text-center py-4">No projects found</p>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                        {project.name || "Unnamed Project"}
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

      {/* Project Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Financial Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Project</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Revenue</th>
                  <th className="text-right p-3 font-medium">Costs</th>
                  <th className="text-right p-3 font-medium">Profit</th>
                  <th className="text-right p-3 font-medium">Margin</th>
                  <th className="text-right p-3 font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <Link to={`/projects/${project.id}`} className="hover:text-primary">
                        <div className="font-medium">{project.name || "Unnamed Project"}</div>
                        <div className="text-sm text-muted-foreground">{project.clientName}</div>
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
              {projects.length > 0 && (
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
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
