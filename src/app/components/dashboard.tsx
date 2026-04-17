import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Users, FolderKanban, DollarSign, TrendingUp, Cloud, CloudRain, Sun, Award, Loader2, CalendarIcon, ChevronDown, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { PageLoader, SkeletonCards, SkeletonChart } from "./ui/page-loader";
import { Link } from "react-router";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { clientsAPI, projectsAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";

export function Dashboard() {
  const [weather, setWeather] = useState({ temp: 72, condition: 'Sunny' });
  const [firstName, setFirstName] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [collectionsTab, setCollectionsTab] = useState<'today' | 'upcoming' | 'overdue'>('overdue');
  const [revenueGoal, setRevenueGoal] = useState(300000);
  const [loading, setLoading] = useState(true);
  const [dateRangeType, setDateRangeType] = useState<'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [showCustomPickers, setShowCustomPickers] = useState(false);
  
  useEffect(() => {
    fetchData();
    fetchWeather();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("first_name").eq("id", user.id).single()
        .then(({ data }) => { if (data?.first_name) setFirstName(data.first_name); });
    });
  }, []);

  const fetchWeather = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weathercode&temperature_unit=fahrenheit`
        );
        const json = await res.json();
        const temp = Math.round(json.current?.temperature_2m ?? 72);
        const code = json.current?.weathercode ?? 0;
        let condition = "Sunny";
        if (code === 0) condition = "Sunny";
        else if (code <= 3) condition = "Partly Cloudy";
        else if (code <= 48) condition = "Cloudy";
        else if (code <= 67 || (code >= 80 && code <= 82)) condition = "Rainy";
        else if (code <= 77) condition = "Snowy";
        else condition = "Stormy";
        setWeather({ temp, condition });
      } catch {
        // keep default
      }
    }, () => { /* denied — keep default */ });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsData, projectsData] = await Promise.all([
        clientsAPI.getAll(),
        projectsAPI.getAll(),
      ]);
      setClients(clientsData);
      setProjects(projectsData);

      // Fetch all unpaid payments with due dates
      const { data: paymentsData } = await supabase
        .from("project_payments")
        .select(`*, project:projects(id, name, client:clients(id, first_name, last_name, is_discarded))`)
        .eq("is_paid", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      setCollections((paymentsData || []).filter((p: any) => !p.project?.client?.is_discarded));
      // Fetch revenue goal from company_settings
      const { data: settings } = await supabase.from("company_settings").select("monthly_revenue_goal").limit(1).maybeSingle();
      if (settings?.monthly_revenue_goal) setRevenueGoal(Number(settings.monthly_revenue_goal));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "project_payments", "projects", "company_settings"], "dashboard");

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonCards count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonChart height={240} />
          </div>
          <SkeletonChart height={240} />
        </div>
        <PageLoader title="Loading your dashboard…" description="Fetching clients, revenue & pipeline data" className="min-h-[10vh]" />
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

  const activeClients = clients.filter((c) => c.pipeline_stage?.name?.toLowerCase() !== "completed").length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedProjects = projects.filter((p) => p.status === "completed");
  const totalRevenue = completedProjects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const totalProfit = completedProjects.reduce((sum, p) => sum + (p.grossProfit || 0), 0);
  const avgProfitMargin = completedProjects.length > 0
    ? completedProjects.reduce((sum, p) => sum + (p.profitMargin || 0), 0) / completedProjects.length
    : 0;

  // Lead stats
  const newLeadsThisWeek = clients.filter((c) => {
    if (!c.created_at) return false;
    const createdDate = new Date(c.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate >= weekAgo;
  }).length;

  const appointmentsScheduled = clients.filter((c) => c.appointment_scheduled && !c.appointment_met).length;
  const appointmentsMet = clients.filter((c) => c.appointment_met).length;

  // Lead source breakdown — use joined lead_source.name
  const leadsBySource = clients.reduce((acc, client) => {
    const src = client.lead_source?.name ?? client.leadSource;
    if (src) acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Monthly revenue chart — group projects by start_date month (last 6 months)
  const monthlyRevenueChart = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.toLocaleString("en-US", { month: "short" });
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthProjects = projects.filter((p) => {
        if (p.status !== "completed") return false;
        const date = p.start_date ? new Date(p.start_date) : null;
        return date && date.getFullYear() === y && date.getMonth() === m;
      });
      return {
        id: `${y}-${m}`,
        month,
        revenue: monthProjects.reduce((s, p) => s + (p.totalValue || 0), 0),
        profit:  monthProjects.reduce((s, p) => s + (p.grossProfit || 0), 0),
      };
    });
  })();

  const MONTHLY_REVENUE_GOAL = revenueGoal;

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
  
  // Calculate revenue based on selected date range (using project start_date)
  const periodRevenue = projects
    .filter((p) => {
      if (p.status !== "completed") return false;
      if (!p.start_date) return false;
      const d = new Date(p.start_date);
      return d >= startDate && d <= endDate;
    })
    .reduce((sum, p) => sum + (p.totalValue || 0), 0);
  
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
  
  const currentMonthProjects = projects.filter((p) => {
    if (p.status !== "completed") return false;
    if (!p.start_date) return false;
    const d = new Date(p.start_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const currentMonthRevenue = currentMonthProjects.reduce((sum, p) => sum + (p.totalValue || 0), 0);

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
          <h1 className="text-2xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""}!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your business overview for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.</p>
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

        <Link to="/financials" className="block no-underline">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Tap to view breakdown</p>
            </CardContent>
          </Card>
        </Link>

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
                  {clients.length > 0 ? Object.entries(leadsBySource).map(([source, count]) => {
                    const c = count as number;
                    return (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{source}</span>
                      <div className="flex items-center gap-2 flex-1 mx-3">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(c / clients.length) * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold min-w-[20px]">{c}</span>
                      </div>
                    </div>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Cloud className="h-7 w-7 mb-1.5 opacity-20" />
                      <p className="text-xs font-medium">No lead sources yet</p>
                      <p className="text-xs mt-0.5 text-muted-foreground">Set a lead source when adding clients.</p>
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
                <span className="text-muted-foreground">Projects This Month:</span>
                <span className="ml-2 font-semibold">{currentMonthProjects.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Contract:</span>
                <span className="ml-2 font-semibold">
                  {currentMonthProjects.length > 0
                    ? formatCurrency(currentMonthRevenue / currentMonthProjects.length)
                    : "$0"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections */}
      {(() => {
        const today = new Date().toISOString().split('T')[0];
        const overdue = collections.filter(p => p.due_date < today);
        const dueToday = collections.filter(p => p.due_date === today);
        const upcoming = collections.filter(p => p.due_date > today);
        const activeList = collectionsTab === 'overdue' ? overdue : collectionsTab === 'today' ? dueToday : upcoming;

        const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formatCurrencyLocal = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Collections
                </CardTitle>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCollectionsTab('overdue')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'overdue' ? 'bg-red-100 text-red-700' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    Past Due {overdue.length > 0 && <span className="ml-1 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px]">{overdue.length}</span>}
                  </button>
                  <button
                    onClick={() => setCollectionsTab('today')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'today' ? 'bg-orange-100 text-orange-700' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    Today {dueToday.length > 0 && <span className="ml-1 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{dueToday.length}</span>}
                  </button>
                  <button
                    onClick={() => setCollectionsTab('upcoming')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    Upcoming {upcoming.length > 0 && <span className="ml-1 bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{upcoming.length}</span>}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {activeList.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">No payments {collectionsTab === 'overdue' ? 'past due' : collectionsTab === 'today' ? 'due today' : 'upcoming'}</p>
                  <p className="text-xs text-muted-foreground mt-1">All clear for this period</p>
                </div>
              ) : (
                <div className="divide-y">
                  {activeList.map((payment) => {
                    const clientName = payment.project?.client
                      ? `${payment.project.client.first_name ?? ''} ${payment.project.client.last_name ?? ''}`.trim()
                      : '—';
                    const to = payment.project?.client?.id ? `/clients/${payment.project.client.id}?payments=open` : null;
                    const inner = (
                      <>
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {collectionsTab === 'overdue' ? (
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          ) : collectionsTab === 'today' ? (
                            <Clock className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                          ) : (
                            <DollarSign className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-medium text-sm truncate block">{clientName}</span>
                            <div className="text-xs text-muted-foreground">{payment.project?.name ?? '—'} · {payment.label}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-sm">{formatCurrencyLocal(payment.amount)}</div>
                          <div className={`text-xs ${collectionsTab === 'overdue' ? 'text-red-600' : collectionsTab === 'today' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                            {formatDate(payment.due_date)}
                          </div>
                        </div>
                      </>
                    );
                    return to ? (
                      <Link key={payment.id} to={to} className="py-3 flex items-center justify-between gap-4 hover:bg-accent/40 rounded-md px-2 -mx-2 transition-colors block no-underline">
                        {inner}
                      </Link>
                    ) : (
                      <div key={payment.id} className="py-3 flex items-center justify-between gap-4">{inner}</div>
                    );
                  })}
                </div>
              )}
              {(overdue.length > 0 || dueToday.length > 0 || upcoming.length > 0) && (
                <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total outstanding: <strong>{formatCurrencyLocal(collections.reduce((s, p) => s + p.amount, 0))}</strong></span>
                  <span>{collections.length} payment{collections.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}