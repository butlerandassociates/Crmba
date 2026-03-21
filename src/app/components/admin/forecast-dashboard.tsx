import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { mockClients, mockProjects } from "../../data/mock-data";
import { TrendingUp, DollarSign, Target, Calendar } from "lucide-react";
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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate forecasts
  const prospectClients = mockClients.filter((c) => c.status === "prospect");
  const weightedForecast = prospectClients.reduce(
    (sum, c) => sum + ((c.projectedValue || 0) * (c.closingProbability || 0)) / 100,
    0
  );
  const totalPipelineValue = prospectClients.reduce((sum, c) => sum + (c.projectedValue || 0), 0);
  
  const activeRevenue = mockClients
    .filter((c) => c.status === "active" || c.status === "sold")
    .reduce((sum, c) => sum + c.totalRevenue, 0);

  const completedRevenue = mockClients
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + c.totalRevenue, 0);

  // Monthly forecast projection
  const monthlyForecast = [
    { month: "Apr", actual: 185000, forecast: 210000 },
    { month: "May", actual: 165000, forecast: 195000 },
    { month: "Jun", actual: 145000, forecast: 230000 },
    { month: "Jul", actual: 0, forecast: 285000 },
    { month: "Aug", actual: 0, forecast: 310000 },
    { month: "Sep", actual: 0, forecast: 295000 },
  ];

  // Revenue by client status
  const revenueByStatus = [
    { status: "Prospects", value: weightedForecast },
    { status: "Sold", value: mockClients.filter(c => c.status === "sold").reduce((s, c) => s + c.totalRevenue, 0) },
    { status: "Active", value: mockClients.filter(c => c.status === "active").reduce((s, c) => s + c.totalRevenue, 0) },
    { status: "Completed", value: completedRevenue },
  ];

  // Calculate commission forecast
  const projectedCommissions = mockProjects
    .filter((p) => p.status === "prospect" || p.status === "selling")
    .reduce((sum, p) => sum + p.commission, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Revenue Forecasting</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Predictive analysis based on pipeline data
        </p>
      </div>

      {/* Forecast KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Weighted Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(weightedForecast)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on closing probability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalPipelineValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {prospectClients.length} prospects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Active Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(activeRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In progress + sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Projected Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(projectedCommissions)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Forecast Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line
                  key="actual-line"
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Actual"
                  connectNulls
                />
                <Line
                  key="forecast-line"
                  type="monotone"
                  dataKey="forecast"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Pipeline Stage</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Forecast Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prospect Forecast Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Client
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Projected Value
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Probability
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Weighted Value
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Expected Close
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prospectClients
                  .filter((c) => c.projectedValue && c.closingProbability)
                  .sort((a, b) => (b.closingProbability || 0) - (a.closingProbability || 0))
                  .map((client) => {
                    const weightedValue =
                      ((client.projectedValue || 0) * (client.closingProbability || 0)) / 100;
                    return (
                      <tr key={client.id} className="hover:bg-accent/50">
                        <td className="p-3">
                          <div>
                            <div className="font-semibold text-sm">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.company}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-medium">
                            {formatCurrency(client.projectedValue || 0)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${client.closingProbability}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{client.closingProbability}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-semibold text-blue-600">
                            {formatCurrency(weightedValue)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground">
                            {client.expectedCloseDate
                              ? new Date(client.expectedCloseDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "-"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
