import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { mockProjects } from "../data/mock-data";
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

export function Financials() {
  const totalRevenue = mockProjects.reduce((sum, p) => sum + p.totalValue, 0);
  const totalCosts = mockProjects.reduce((sum, p) => sum + p.totalCosts, 0);
  const totalProfit = mockProjects.reduce((sum, p) => sum + p.grossProfit, 0);
  const totalCommissions = mockProjects.reduce((sum, p) => sum + p.commission, 0);
  const avgProfitMargin = (totalProfit / totalRevenue) * 100;

  const monthlyData = [
    { month: "Jan", revenue: 120000, costs: 88000, profit: 32000 },
    { month: "Feb", revenue: 185000, costs: 134000, profit: 51000 },
    { month: "Mar", revenue: 95000, costs: 69000, profit: 26000 },
    { month: "Apr", revenue: 210000, costs: 152000, profit: 58000 },
    { month: "May", revenue: 165000, costs: 120000, profit: 45000 },
    { month: "Jun", revenue: 145000, costs: 106000, profit: 39000 },
  ];

  const projectProfitability = mockProjects.map((p) => ({
    name: p.name.length > 20 ? p.name.substring(0, 20) + "..." : p.name,
    profit: p.grossProfit,
    margin: p.profitMargin,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-green-500";
      case "planning":
        return "bg-blue-500";
      case "completed":
        return "bg-purple-500";
      case "on_hold":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

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
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="costs"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Costs"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Profitability</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectProfitability}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="profit" fill="#10b981" name="Gross Profit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Commissions Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Total Commissions: {formatCurrency(totalCommissions)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                      {project.name}
                    </Link>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{project.clientName}</p>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(project.commission)}</div>
                  <div className="text-sm text-muted-foreground">
                    {((project.commission / project.totalValue) * 100).toFixed(1)}% of{" "}
                    {formatCurrency(project.totalValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                {mockProjects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-accent">
                    <td className="p-3">
                      <Link to={`/projects/${project.id}`} className="hover:text-primary">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-muted-foreground">{project.clientName}</div>
                      </Link>
                    </td>
                    <td className="p-3">
                      <Badge className={getStatusColor(project.status)} size="sm">
                        {project.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="text-right p-3 font-medium">{formatCurrency(project.totalValue)}</td>
                    <td className="text-right p-3">{formatCurrency(project.totalCosts)}</td>
                    <td className="text-right p-3 font-medium text-green-600">
                      {formatCurrency(project.grossProfit)}
                    </td>
                    <td className="text-right p-3">{project.profitMargin.toFixed(1)}%</td>
                    <td className="text-right p-3">{formatCurrency(project.commission)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr className="font-bold">
                  <td className="p-3" colSpan={2}>
                    Totals
                  </td>
                  <td className="text-right p-3">{formatCurrency(totalRevenue)}</td>
                  <td className="text-right p-3">{formatCurrency(totalCosts)}</td>
                  <td className="text-right p-3 text-green-600">{formatCurrency(totalProfit)}</td>
                  <td className="text-right p-3">{avgProfitMargin.toFixed(1)}%</td>
                  <td className="text-right p-3">{formatCurrency(totalCommissions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
