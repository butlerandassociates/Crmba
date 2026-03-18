import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Users, FolderKanban, DollarSign, TrendingUp, Workflow, Cloud, CloudRain, Sun, Eye, Award, Loader2, CalendarIcon, ChevronDown } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "react-router";
import { Badge } from "./ui/badge";
import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { clientsAPI, projectsAPI, usersAPI } from "../utils/api";
import { format } from "date-fns";

export function Dashboard() {
  const [weather, setWeather] = useState({ temp: 72, condition: 'Sunny' });
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRangeType, setDateRangeType] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [showCustomPickers, setShowCustomPickers] = useState(false);
  
  useEffect(() => {
    fetchData();
    
    // Simulated weather - in production this would call a weather API
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy'];
    const temps = [68, 72, 75, 80];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    const randomTemp = temps[Math.floor(Math.random() * temps.length)];
    setWeather({ temp: randomTemp, condition: randomCondition });
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsData, projectsData, usersData] = await Promise.all([
        clientsAPI.getAll(),
        projectsAPI.getAll(),
        usersAPI.getAll(),
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const getWeatherIcon = () => {
    switch (weather.condition) {
      case 'Sunny':
        return <Sun className="h-5 w-5 text-yellow-500" />;
      case 'Rainy':
        return <CloudRain className="h-5 w-5 text-blue-500" />;
      default:
        return <Cloud className="h-5 w-5 text-gray-500" />;
    }
  };

  const activeClients = clients.filter((c) => c.status === "active").length;
  const activeProjects = projects.filter((p) => p.status === "in_progress" || p.status === "planning").length;
  const totalRevenue = projects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const totalProfit = projects.reduce((sum, p) => sum + (p.grossProfit || 0), 0);
  const avgProfitMargin = projects.length > 0
    ? projects.reduce((sum, p) => sum + (p.profitMargin || 0), 0) / projects.length
    : 0;

  // Lead stats
  const newLeadsThisWeek = clients.filter((c) => {
    if (!c.createdAt) return false;
    const createdDate = new Date(c.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate >= weekAgo;
  }).length;

  const appointmentsScheduled = clients.filter((c) => c.appointmentScheduled && !c.appointmentMet).length;
  const appointmentsMet = clients.filter((c) => c.appointmentMet).length;

  // Lead source breakdown
  const leadsBySource = clients.reduce((acc, client) => {
    if (client.leadSource) {
      acc[client.leadSource] = (acc[client.leadSource] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const projectsByStatus = [
    {
      name: "Planning",
      value: projects.filter((p) => p.status === "planning").length,
      color: "#3b82f6",
    },
    {
      name: "In Progress",
      value: projects.filter((p) => p.status === "in_progress").length,
      color: "#10b981",
    },
    {
      name: "Completed",
      value: projects.filter((p) => p.status === "completed").length,
      color: "#8b5cf6",
    },
    {
      name: "On Hold",
      value: projects.filter((p) => p.status === "on_hold").length,
      color: "#f59e0b",
    },
  ];

  const monthlyRevenueChart = [
    { id: "jan", month: "Jan", revenue: 120000, profit: 32000 },
    { id: "feb", month: "Feb", revenue: 185000, profit: 51000 },
    { id: "mar", month: "Mar", revenue: 95000, profit: 26000 },
    { id: "apr", month: "Apr", revenue: 210000, profit: 58000 },
    { id: "may", month: "May", revenue: 165000, profit: 45000 },
    { id: "jun", month: "Jun", revenue: 145000, profit: 39000 },
  ];

  const recentProjects = projects.slice(0, 5);
  
  // Monthly Revenue Goal Tracking
  const MONTHLY_REVENUE_GOAL = 300000; // $300,000.00 - TODO: Make editable in admin portal
  
  // Calculate date range based on selected type
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    switch (dateRangeType) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59);
        } else {
          // Default to current month if custom dates not set
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }
        break;
    }
    
    return { startDate, endDate };
  };
  
  const { startDate, endDate } = getDateRange();
  
  // Calculate revenue based on selected date range
  const periodRevenue = clients
    .filter((c) => {
      if (c.status !== "sold") return false;
      
      if (c.contractSignedDate) {
        const signedDate = new Date(c.contractSignedDate);
        return signedDate >= startDate && signedDate <= endDate;
      }
      return false;
    })
    .reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  
  const revenueProgress = (periodRevenue / MONTHLY_REVENUE_GOAL) * 100;
  const remainingRevenue = MONTHLY_REVENUE_GOAL - periodRevenue;
  
  // Get date range label
  const getDateRangeLabel = () => {
    switch (dateRangeType) {
      case 'month':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor(startDate.getMonth() / 3) + 1;
        return `Q${quarter} ${startDate.getFullYear()}`;
      case 'year':
        return startDate.getFullYear().toString();
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'Custom Range';
    }
  };
  
  // Calculate current month's revenue from sold contracts
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const currentMonthRevenue = clients
    .filter((c) => {
      // Only count clients with "sold" status
      if (c.status !== "sold") return false;
      
      // Check if contract was signed this month
      if (c.contractSignedDate) {
        const signedDate = new Date(c.contractSignedDate);
        return (
          signedDate.getMonth() === currentMonth &&
          signedDate.getFullYear() === currentYear
        );
      }
      return false;
    })
    .reduce((sum, c) => sum + (c.totalRevenue || 0), 0);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your business overview for today.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg">
          {getWeatherIcon()}
          <span className="text-sm font-medium">{weather.temp}°F</span>
          <span className="text-sm text-muted-foreground">{weather.condition}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {clients.length} total clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{activeProjects}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {projects.length} total projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgProfitMargin.toFixed(1)}% avg margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue & Profit Trends</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={250} key="revenue-chart-container">
              <LineChart data={monthlyRevenueChart} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Profit"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{newLeadsThisWeek}</div>
                  <div className="text-xs text-muted-foreground">New Leads</div>
                  <div className="text-xs text-muted-foreground">This Week</div>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{appointmentsScheduled}</div>
                  <div className="text-xs text-muted-foreground">Scheduled</div>
                  <div className="text-xs text-muted-foreground">Appointments</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{appointmentsMet}</div>
                  <div className="text-xs text-muted-foreground">Appointments</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Lead Sources</div>
                <div className="space-y-2">
                  {clients.length > 0 ? Object.entries(leadsBySource).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{source}</span>
                      <div className="flex items-center gap-2 flex-1 mx-3">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(count / clients.length) * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold min-w-[20px]">{count}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      No lead sources yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Goal Tracker */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Revenue Goal Tracker</CardTitle>
            <Popover open={dateRangeOpen} onOpenChange={(open) => {
              setDateRangeOpen(open);
              if (!open) {
                setShowCustomPickers(false);
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-7 text-xs gap-1 hover:bg-accent"
                >
                  <CalendarIcon className="h-3 w-3" />
                  {getDateRangeLabel()}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Select Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={dateRangeType === 'month' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDateRangeType('month');
                          setShowCustomPickers(false);
                          setDateRangeOpen(false);
                        }}
                      >
                        This Month
                      </Button>
                      <Button
                        variant={dateRangeType === 'quarter' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDateRangeType('quarter');
                          setShowCustomPickers(false);
                          setDateRangeOpen(false);
                        }}
                      >
                        This Quarter
                      </Button>
                      <Button
                        variant={dateRangeType === 'year' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDateRangeType('year');
                          setShowCustomPickers(false);
                          setDateRangeOpen(false);
                        }}
                      >
                        This Year
                      </Button>
                      <Button
                        variant={dateRangeType === 'custom' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (dateRangeType === 'custom') {
                            // Toggle the custom pickers if already in custom mode
                            setShowCustomPickers(!showCustomPickers);
                          } else {
                            // Switch to custom mode and show pickers
                            setDateRangeType('custom');
                            setShowCustomPickers(true);
                          }
                        }}
                      >
                        Custom
                      </Button>
                    </div>
                  </div>
                  
                  {dateRangeType === 'custom' && showCustomPickers && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs">Start Date</Label>
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                          className="rounded-md border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">End Date</Label>
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                          className="rounded-md border"
                          disabled={(date) => 
                            customStartDate ? date < customStartDate : false
                          }
                        />
                      </div>
                      {customStartDate && customEndDate && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setDateRangeOpen(false)}
                        >
                          Apply Custom Range
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Progress Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Goal</div>
                <div className="text-lg font-bold">{formatCurrency(MONTHLY_REVENUE_GOAL)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-lg font-bold text-green-600">{formatCurrency(periodRevenue)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Remaining</div>
                <div className="text-lg font-bold text-orange-600">
                  {remainingRevenue > 0 ? formatCurrency(remainingRevenue) : formatCurrency(0)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">
                  {revenueProgress.toFixed(1)}%
                  {revenueProgress >= 100 && (
                    <Award className="h-4 w-4 inline ml-1 text-yellow-500" />
                  )}
                </span>
              </div>
              <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    revenueProgress >= 100
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : revenueProgress >= 75
                      ? 'bg-gradient-to-r from-green-400 to-green-500'
                      : revenueProgress >= 50
                      ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                      : revenueProgress >= 25
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                      : 'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${Math.min(revenueProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Status Message */}
            {revenueProgress >= 100 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700">
                  <Award className="h-5 w-5" />
                  <div>
                    <div className="font-semibold text-sm">Goal Exceeded! 🎉</div>
                    <div className="text-xs">
                      You've exceeded your monthly goal by {formatCurrency(periodRevenue - MONTHLY_REVENUE_GOAL)}
                    </div>
                  </div>
                </div>
              </div>
            ) : revenueProgress >= 75 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-blue-700 text-sm">
                  <div className="font-semibold">Almost there!</div>
                  <div className="text-xs">
                    Just {formatCurrency(remainingRevenue)} away from your monthly goal
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-orange-700 text-sm">
                  <div className="font-semibold">Keep pushing!</div>
                  <div className="text-xs">
                    {formatCurrency(remainingRevenue)} more to reach your goal
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="border-t pt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Contracts Signed:</span>
                <span className="ml-2 font-semibold">
                  {clients.filter((c) => {
                    if (c.status !== "sold") return false;
                    if (c.contractSignedDate) {
                      const signedDate = new Date(c.contractSignedDate);
                      return (
                        signedDate.getMonth() === currentMonth &&
                        signedDate.getFullYear() === currentYear
                      );
                    }
                    return false;
                  }).length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Contract:</span>
                <span className="ml-2 font-semibold">
                  {clients.filter((c) => {
                    if (c.status !== "sold") return false;
                    if (c.contractSignedDate) {
                      const signedDate = new Date(c.contractSignedDate);
                      return (
                        signedDate.getMonth() === currentMonth &&
                        signedDate.getFullYear() === currentYear
                      );
                    }
                    return false;
                  }).length > 0
                    ? formatCurrency(
                        currentMonthRevenue /
                          clients.filter((c) => {
                            if (c.status !== "sold") return false;
                            if (c.contractSignedDate) {
                              const signedDate = new Date(c.contractSignedDate);
                              return (
                                signedDate.getMonth() === currentMonth &&
                                signedDate.getFullYear() === currentYear
                              );
                            }
                            return false;
                          }).length
                      )
                    : "$0"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}