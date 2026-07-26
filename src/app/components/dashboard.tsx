import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency } from "@/app/utils/format";
import { Users, FolderKanban, DollarSign, TrendingUp, Cloud, CloudRain, Sun, Award, Loader2, CalendarIcon, ChevronDown, AlertCircle, Clock, CheckCircle2, Car, X, Pencil, Target, BarChart3, Activity } from "lucide-react";
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
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../contexts/auth-context";
import { useViewAs } from "../contexts/view-as-context";

export function Dashboard() {
  const { can, role } = usePermissions();
  const { user } = useAuth();
  const { viewAsRole, viewAsProfileId, viewAsProfileName } = useViewAs();
  const currentProfileId = user?.profile?.id ?? null;
  // When viewing as a team member, use their profile ID; if no person selected yet use null (shows empty)
  const effectiveProfileId = viewAsProfileId || (viewAsRole ? null : currentProfileId);
  const [weather, setWeather] = useState({ temp: 72, condition: 'Sunny' });
  const [firstName, setFirstName] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [paidPayments, setPaidPayments] = useState<any[]>([]);
  const [projectCostsMap, setProjectCostsMap] = useState<Record<string, { materials: number; labor: number; commissions: number }>>({});
  const [collectionsTab, setCollectionsTab] = useState<'today' | 'upcoming' | 'overdue'>('overdue');
  const [revenueGoal, setRevenueGoal] = useState(300000);
  const [loading, setLoading] = useState(true);
  const [dateRangeType, setDateRangeType] = useState<'month' | 'last_month' | 'last_3_months' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [showCustomPickers, setShowCustomPickers] = useState(false);
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
  const [activeMileagePeriod, setActiveMileagePeriod] = useState<boolean>(false);
  const [salesGoal, setSalesGoal] = useState(300000);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [editRevGoal, setEditRevGoal] = useState("");
  const [editSalesGoal, setEditSalesGoal] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  const [soldTransitions, setSoldTransitions] = useState<{ client_id: string; changed_at: string }[]>([]);

  useEffect(() => {
    fetchData();
    fetchWeather();
    // Check for active mileage period for PM/Sales Rep dashboard card
    if (role === "project_manager" || role === "sales_rep") {
      supabase.from("mileage_periods")
        .select("id")
        .eq("status", "open")
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => setActiveMileagePeriod(!!data));
    }
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

      // Fetch all paid payments for cash-basis revenue calculation
      const { data: paidData } = await supabase
        .from("project_payments")
        .select(`amount, paid_date, project:projects(id, gross_profit, profit_margin, client:clients(is_discarded))`)
        .eq("is_paid", true)
        .not("paid_date", "is", null);
      setPaidPayments((paidData || []).filter((p: any) => !p.project?.client?.is_discarded));

      // Fetch actual costs per project for live GP calculation
      const [{ data: receiptsData }, { data: crewData }, { data: commissionsData }] = await Promise.all([
        supabase.from("project_receipts").select("project_id, amount"),
        supabase
          .from("fio_crew_payments")
          .select("amount_paid, fio:field_installation_orders!inner(project_id)"),
        supabase
          .from("commission_payments")
          .select("project_id, amount")
          .eq("status", "processed"),
      ]);

      const costsMap: Record<string, { materials: number; labor: number; commissions: number }> = {};
      const ensure = (id: string) => {
        if (!costsMap[id]) costsMap[id] = { materials: 0, labor: 0, commissions: 0 };
      };
      for (const r of receiptsData || []) {
        ensure(r.project_id);
        costsMap[r.project_id].materials += parseFloat(r.amount) || 0;
      }
      for (const c of crewData || []) {
        const pid = (c.fio as any)?.project_id;
        if (!pid) continue;
        ensure(pid);
        costsMap[pid].labor += parseFloat(c.amount_paid) || 0;
      }
      for (const cp of commissionsData || []) {
        ensure(cp.project_id);
        costsMap[cp.project_id].commissions += parseFloat(cp.amount) || 0;
      }
      setProjectCostsMap(costsMap);

      // Fetch revenue + sales goals from company_settings
      const { data: settings } = await supabase.from("company_settings").select("monthly_revenue_goal, monthly_sales_goal").limit(1).maybeSingle();
      if (settings?.monthly_revenue_goal) setRevenueGoal(Number(settings.monthly_revenue_goal));
      if (settings?.monthly_sales_goal) setSalesGoal(Number(settings.monthly_sales_goal));

      // Fetch sold transitions for Sales Goal tracker
      const { data: soldData } = await supabase.from("stage_history").select("client_id, changed_at").eq("to_stage", "sold");
      setSoldTransitions(soldData || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "project_payments", "projects", "company_settings", "project_receipts", "fio_crew_payments", "commission_payments", "stage_history"], "dashboard");

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

  const visibleProjects =
    role === "sales_rep" && effectiveProfileId
      ? projects.filter((p) => p.sales_rep_id === effectiveProfileId)
      : role === "project_manager" && effectiveProfileId
        ? projects.filter((p) => p.project_manager_id === effectiveProfileId)
        : (role === "admin" && !viewAsRole)
          ? projects
          : (role === "sales_rep" || role === "project_manager") && !effectiveProfileId
            ? []  // View As active but no person selected yet
            : projects;

  const visibleProjectIds = new Set(visibleProjects.map((p: any) => p.id));
  const totalScopedClients = (role === "admin" && !viewAsRole)
    ? clients.length
    : role === "sales_rep" && effectiveProfileId
      ? clients.filter((c: any) => c.salesRepId === effectiveProfileId).length
      : new Set(visibleProjects.map((p: any) => p.client_id).filter(Boolean)).size;
  const visibleCollections =
    (role === "project_manager" || role === "sales_rep") && effectiveProfileId
      ? collections.filter((p: any) => visibleProjectIds.has(p.project?.id))
      : (role === "admin" && !viewAsRole)
        ? collections
        : [];

  const visiblePaidPayments = (role === "project_manager" || role === "sales_rep") && effectiveProfileId
    ? paidPayments.filter((p: any) => visibleProjectIds.has(p.project?.id))
    : (role === "admin" && !viewAsRole)
      ? paidPayments
      : [];

  // Active Clients = clients with at least one active project
  const activeClientIds = new Set(visibleProjects.filter((p) => p.status === "active").map((p) => p.client_id).filter(Boolean));
  const activeClients = activeClientIds.size;
  const activeProjects = visibleProjects.filter((p) => p.status === "active").length;

  // totalRevenue/totalProfit/avgProfitMargin derived from periodProjects below (after date range is computed)

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

  // Monthly revenue chart — cash basis: sum payments collected per month (last 6 months)
  const monthlyRevenueChart = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.toLocaleString("en-US", { month: "short" });
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthPayments = visiblePaidPayments.filter((p) => {
        const date = p.paid_date ? new Date(p.paid_date + "T00:00:00") : null;
        return date && date.getFullYear() === y && date.getMonth() === m;
      });
      return {
        id: `${y}-${m}`,
        month,
        revenue: monthPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
        profit: monthPayments.reduce((s, p) => {
          const proj = visibleProjects.find((vp: any) => vp.id === p.project?.id);
          if (!proj || !proj.totalValue || proj.totalValue === 0) return s;
          const costs = projectCostsMap[proj.id] ?? { materials: 0, labor: 0, commissions: 0 };
          const actualCosts = costs.materials + costs.labor + costs.commissions;
          const liveGPRate = Math.max(0, (proj.totalValue - actualCosts) / proj.totalValue);
          return s + (parseFloat(p.amount) || 0) * liveGPRate;
        }, 0),
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
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
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
  
  // Pipeline buckets (admin only)
  const nonDiscarded = clients.filter((c: any) => !c.is_discarded);
  const pipelineProspect = nonDiscarded.filter((c: any) => c.status === 'prospect');
  const pipelineScheduled = nonDiscarded.filter((c: any) => c.status === 'scheduled');
  const pipeSelling = nonDiscarded.filter((c: any) => c.status === 'selling');
  const pipeSold = nonDiscarded.filter((c: any) => c.status === 'sold');
  const pipeActive = nonDiscarded.filter((c: any) => c.status === 'active');
  const pipeCompleted = nonDiscarded.filter((c: any) => c.status === 'completed');
  const clientProjectTotal = (clientId: string) => {
    const proj = projects.find((p: any) => p.client_id === clientId);
    return parseFloat(proj?.totalValue || proj?.total_value || 0);
  };
  const weightedForecastDash =
    pipeSelling.reduce((sum: number, c: any) => {
      const prob = (c.closing_probability > 0 ? c.closing_probability : 40) / 100;
      return sum + (c.proposal_forecast || clientProjectTotal(c.id) || 0) * prob;
    }, 0) +
    pipeSold.reduce((sum: number, c: any) => sum + clientProjectTotal(c.id), 0) +
    pipeActive.reduce((sum: number, c: any) => sum + clientProjectTotal(c.id), 0);
  const pipelineValue = [...pipelineProspect, ...pipelineScheduled, ...pipeSelling]
    .reduce((sum: number, c: any) => sum + (c.proposal_forecast || clientProjectTotal(c.id) || 0), 0);
  const contractedRevenue = [...pipeSold, ...pipeActive, ...pipeCompleted]
    .reduce((sum: number, c: any) => sum + clientProjectTotal(c.id), 0);
  const closedRevenueDash = pipeCompleted.reduce((sum: number, c: any) => sum + clientProjectTotal(c.id), 0);

  // Sales Goal: new contracts signed (sold transitions) in selected period
  const periodSoldIds = new Set(
    soldTransitions
      .filter(t => { const d = new Date(t.changed_at); return d >= startDate && d <= endDate; })
      .map(t => t.client_id)
  );
  const periodSalesAmount = projects
    .filter((p: any) => p.client_id && periodSoldIds.has(p.client_id))
    .reduce((sum: number, p: any) => sum + (parseFloat(p.totalValue || p.total_value || 0)), 0);
  const salesGoalProgress = salesGoal > 0 ? (periodSalesAmount / salesGoal) * 100 : 0;

  // Leads metrics
  const periodLeads = clients.filter((c: any) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d >= startDate && d <= endDate;
  }).length;
  const totalNonDiscarded = nonDiscarded.length;
  const closedCount = [...pipeSold, ...pipeActive, ...pipeCompleted].length;
  const closingRate = totalNonDiscarded > 0 ? (closedCount / totalNonDiscarded) * 100 : 0;
  const dealProjects = projects.filter((p: any) => ['sold','active','completed'].includes(p.status));
  const avgDealSize = dealProjects.length > 0
    ? dealProjects.reduce((s: number, p: any) => s + parseFloat(p.totalValue || p.total_value || 0), 0) / dealProjects.length
    : 0;

  // Cash-basis revenue: sum payments actually collected within the selected date range
  const periodPayments = visiblePaidPayments.filter((p) => {
    const d = p.paid_date ? new Date(p.paid_date + "T00:00:00") : null;
    if (!d) return false;
    return d >= startDate && d <= endDate;
  });
  const periodRevenue = periodPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalRevenue = periodRevenue;
  // GP: proportional to payments collected, using actual costs (materials + labor paid + paid commissions)
  const totalProfit = periodPayments.reduce((sum, p) => {
    const proj = visibleProjects.find((vp: any) => vp.id === p.project?.id);
    if (!proj || !proj.totalValue || proj.totalValue === 0) return sum;
    const costs = projectCostsMap[proj.id] ?? { materials: 0, labor: 0, commissions: 0 };
    const actualCosts = costs.materials + costs.labor + costs.commissions;
    const liveGPRate = Math.max(0, (proj.totalValue - actualCosts) / proj.totalValue);
    return sum + (parseFloat(p.amount) || 0) * liveGPRate;
  }, 0);
  const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const periodProjectIds = new Set(periodPayments.map((p: any) => p.project?.id).filter(Boolean));
  const periodProjects = visibleProjects.filter((p: any) => periodProjectIds.has(p.id));

  const _curDate = new Date();
  const _curMonth = _curDate.getMonth();
  const _curYear = _curDate.getFullYear();
  const currentMonthRevenue = visiblePaidPayments
    .filter((p) => {
      const d = p.paid_date ? new Date(p.paid_date + "T00:00:00") : null;
      if (!d) return false;
      return d.getMonth() === _curMonth && d.getFullYear() === _curYear;
    })
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const revenueProgress = (periodRevenue / MONTHLY_REVENUE_GOAL) * 100;
  const remainingRevenue = MONTHLY_REVENUE_GOAL - periodRevenue;
  
  // Get date range label
  const getDateRangeLabel = () => {
    switch (dateRangeType) {
      case 'month':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'last_month':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'last_3_months':
        return 'Last 3 Months';
      case 'year':
        return startDate.getFullYear().toString();
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'Custom Range';
    }
  };
  

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="p-4 space-y-4 overflow-x-hidden">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 -mt-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          {viewAsRole && viewAsProfileName ? (
            <>
              <h1 className="text-2xl font-bold">{viewAsProfileName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Viewing dashboard as {viewAsRole === "sales_rep" ? "Sales Rep" : viewAsRole === "project_manager" ? "Project Manager" : "Foreman"}
              </p>
            </>
          ) : viewAsRole && !viewAsProfileName ? (
            <>
              <h1 className="text-2xl font-bold">Select a team member</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Pick a person from the bar above to view their dashboard</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""}!</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Here's your business overview for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg">
          {getWeatherIcon()}
          <span className="text-sm font-medium">{weather.temp}°F</span>
          <span className="text-sm text-muted-foreground">{weather.condition}</span>
        </div>
      </div>

      {/* Stats Cards */}
      {/* Date range row — only shown to admin (Sales Rep / PM see scoped data, no period picker) */}
      {role !== "sales_rep" && role !== "project_manager" && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Revenue &amp; profit for selected period</p>
          <Popover open={dateRangeOpen} onOpenChange={(open) => { setDateRangeOpen(open); if (!open) setShowCustomPickers(false); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 text-xs gap-1 hover:bg-accent">
                <CalendarIcon className="h-3 w-3" />
                {getDateRangeLabel()}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Select Period</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={dateRangeType === 'month' ? 'default' : 'outline'} size="sm" onClick={() => { setDateRangeType('month'); setShowCustomPickers(false); setDateRangeOpen(false); }}>This Month</Button>
                    <Button variant={dateRangeType === 'last_month' ? 'default' : 'outline'} size="sm" onClick={() => { setDateRangeType('last_month'); setShowCustomPickers(false); setDateRangeOpen(false); }}>Last Month</Button>
                    <Button variant={dateRangeType === 'last_3_months' ? 'default' : 'outline'} size="sm" onClick={() => { setDateRangeType('last_3_months'); setShowCustomPickers(false); setDateRangeOpen(false); }}>Last 3 Months</Button>
                    <Button variant={dateRangeType === 'year' ? 'default' : 'outline'} size="sm" onClick={() => { setDateRangeType('year'); setShowCustomPickers(false); setDateRangeOpen(false); }}>This Year</Button>
                    <Button variant={dateRangeType === 'custom' ? 'default' : 'outline'} size="sm" className="col-span-2" onClick={() => { if (dateRangeType === 'custom') { setShowCustomPickers(!showCustomPickers); } else { setDateRangeType('custom'); setShowCustomPickers(true); } }}>Custom Range</Button>
                  </div>
                </div>
                {dateRangeType === 'custom' && showCustomPickers && (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="space-y-2">
                      <Label className="text-xs">Start Date</Label>
                      <Calendar mode="single" selected={customStartDate} onSelect={setCustomStartDate} className="rounded-md border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">End Date</Label>
                      <Calendar mode="single" selected={customEndDate} onSelect={setCustomEndDate} className="rounded-md border" disabled={(date) => customStartDate ? date < customStartDate : false} />
                    </div>
                    {customStartDate && customEndDate && (
                      <Button size="sm" className="w-full" onClick={() => setDateRangeOpen(false)}>Apply</Button>
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-4 ${role === "sales_rep" ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{activeClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalScopedClients} total clients
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
              {visibleProjects.length} total projects
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowRevenueBreakdown(true)}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{role !== "sales_rep" && role !== "project_manager" ? getDateRangeLabel() : "Tap to view breakdown"}</p>
          </CardContent>
        </Card>

        {role !== "sales_rep" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">{avgProfitMargin.toFixed(1)}% avg margin</p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Pipeline Overview — admin only */}
      {role !== "sales_rep" && role !== "project_manager" && (
      <div className="space-y-3">
        {/* 4 pipeline tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Weighted Forecast</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{formatCurrency(weightedForecastDash)}</div>
              <p className="text-xs text-muted-foreground mt-1">Prospect 0% · Selling ind.% · Sold/Active 100%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{formatCurrency(pipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Prospect + Scheduled + Selling</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contracted Revenue</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{formatCurrency(contractedRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Sold + Active + Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Closed Revenue</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{formatCurrency(closedRevenueDash)}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline stage columns */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: 'Prospect', clients: pipelineProspect, color: 'bg-gray-100 text-gray-700', href: '/clients?stage=prospect' },
                { label: 'Scheduled', clients: pipelineScheduled, color: 'bg-blue-100 text-blue-700', href: '/clients?stage=scheduled' },
                { label: 'Selling', clients: pipeSelling, color: 'bg-orange-100 text-orange-700', href: '/clients?stage=selling' },
                { label: 'Sold', clients: pipeSold, color: 'bg-green-100 text-green-700', href: '/clients?stage=sold' },
                { label: 'Active', clients: pipeActive, color: 'bg-emerald-100 text-emerald-700', href: '/clients?stage=active' },
                { label: 'Completed', clients: pipeCompleted, color: 'bg-purple-100 text-purple-700', href: '/clients?stage=completed' },
              ].map((stage) => (
                <Link
                  key={stage.label}
                  to={stage.href}
                  className="no-underline block"
                >
                  <div className={`rounded-lg p-3 text-center transition-opacity hover:opacity-80 cursor-pointer ${stage.color}`}>
                    <div className="text-2xl font-bold">{stage.clients.length}</div>
                    <div className="text-xs font-medium mt-0.5">{stage.label}</div>
                    {stage.clients.length > 0 && (
                      <div className="text-[10px] mt-1 opacity-75">
                        {formatCurrency(stage.clients.reduce((s: number, c: any) => s + (c.proposal_forecast || clientProjectTotal(c.id) || 0), 0))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Leads metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads & Closing Metrics</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">New Leads (Period)</div>
                <div className="text-xl font-bold">{periodLeads}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Closing Rate</div>
                <div className="text-xl font-bold">{closingRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">{closedCount} of {totalNonDiscarded} clients</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Avg Deal Size</div>
                <div className="text-xl font-bold">{formatCurrency(avgDealSize)}</div>
                <div className="text-xs text-muted-foreground">{dealProjects.length} contracts</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Avg GP %</div>
                <div className="text-xl font-bold">{avgProfitMargin.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">From collected payments</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Charts Row — hidden for sales reps and PMs (company-wide data) */}
      {role !== "sales_rep" && role !== "project_manager" && (
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
      )}

      {/* Goal Trackers — hidden for sales reps and PMs */}
      {role !== "sales_rep" && role !== "project_manager" && (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Goal Trackers</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{getDateRangeLabel()}</span>
              <button
                onClick={() => { setEditRevGoal(MONTHLY_REVENUE_GOAL.toString()); setEditSalesGoal(salesGoal.toString()); setGoalEditOpen(true); }}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground"
                title="Edit goals"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-5">
            {/* Revenue Goal Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Revenue Collected</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Goal: <strong>{formatCurrency(MONTHLY_REVENUE_GOAL)}</strong></span>
                  <span className="text-green-600 font-semibold">{formatCurrency(periodRevenue)}</span>
                  <span className="font-semibold">
                    {revenueProgress.toFixed(1)}%
                    {revenueProgress >= 100 && <Award className="h-3.5 w-3.5 inline ml-1 text-yellow-500" />}
                  </span>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    revenueProgress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                    : revenueProgress >= 75 ? 'bg-gradient-to-r from-green-400 to-green-500'
                    : revenueProgress >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                    : revenueProgress >= 25 ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                    : 'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${Math.min(revenueProgress, 100)}%` }}
                />
              </div>
              {remainingRevenue > 0 && (
                <p className="text-xs text-muted-foreground">{formatCurrency(remainingRevenue)} remaining to reach revenue goal</p>
              )}
            </div>

            {/* Sales Goal Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Sales Goal</span>
                  <span className="text-xs text-muted-foreground">(new contracts signed)</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Goal: <strong>{formatCurrency(salesGoal)}</strong></span>
                  <span className="text-blue-600 font-semibold">{formatCurrency(periodSalesAmount)}</span>
                  <span className="font-semibold">
                    {salesGoalProgress.toFixed(1)}%
                    {salesGoalProgress >= 100 && <Award className="h-3.5 w-3.5 inline ml-1 text-yellow-500" />}
                  </span>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    salesGoalProgress >= 100 ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    : salesGoalProgress >= 75 ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                    : salesGoalProgress >= 50 ? 'bg-gradient-to-r from-indigo-400 to-indigo-500'
                    : salesGoalProgress >= 25 ? 'bg-gradient-to-r from-violet-400 to-violet-500'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
                  }`}
                  style={{ width: `${Math.min(salesGoalProgress, 100)}%` }}
                />
              </div>
              {salesGoalProgress === 0 && (
                <p className="text-xs text-muted-foreground">Sales goal tracks new contracts signed in the period (via pipeline stage changes)</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="border-t pt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Projects This Period:</span>
                <span className="ml-2 font-semibold">{periodProjects.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Contract:</span>
                <span className="ml-2 font-semibold">
                  {periodProjects.length > 0 ? formatCurrency(periodRevenue / periodProjects.length) : "$0"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Goal Edit Dialog */}
      {goalEditOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setGoalEditOpen(false)} />
          <div className="relative bg-background rounded-lg border shadow-lg p-6 w-[340px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base">Edit Goal Amounts</h3>
              <button onClick={() => setGoalEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue Goal (collected)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    value={editRevGoal}
                    onChange={(e) => setEditRevGoal(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="pl-7"
                    placeholder="300000"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sales Goal (new contracts)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    value={editSalesGoal}
                    onChange={(e) => setEditSalesGoal(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="pl-7"
                    placeholder="300000"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setGoalEditOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={savingGoals}
                  onClick={async () => {
                    const rv = parseFloat(editRevGoal);
                    const sv = parseFloat(editSalesGoal);
                    if (isNaN(rv) || isNaN(sv)) return;
                    setSavingGoals(true);
                    const { data: existing } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
                    if (existing?.id) {
                      await supabase.from("company_settings").update({ monthly_revenue_goal: rv, monthly_sales_goal: sv }).eq("id", existing.id);
                    } else {
                      await supabase.from("company_settings").insert({ monthly_revenue_goal: rv, monthly_sales_goal: sv });
                    }
                    setRevenueGoal(rv);
                    setSalesGoal(sv);
                    setSavingGoals(false);
                    setGoalEditOpen(false);
                  }}
                >
                  {savingGoals ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collections button — hidden for sales reps */}
      {role !== "sales_rep" && (() => {
        const today = new Date().toISOString().split('T')[0];
        const overdue = visibleCollections.filter(p => p.due_date < today);
        return (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {overdue.length > 0 ? (
                <span className="text-red-600 font-medium">{overdue.length} payment{overdue.length !== 1 ? 's' : ''} past due</span>
              ) : (
                "No overdue payments"
              )}
              {visibleCollections.length > overdue.length && ` · ${visibleCollections.length - overdue.length} upcoming`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollectionsOpen(true)}
              className="gap-1.5"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Collections
              {overdue.length > 0 && (
                <Badge variant="destructive" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">{overdue.length}</Badge>
              )}
            </Button>
          </div>
        );
      })()}

      {/* Collections Popup */}
      {collectionsOpen && role !== "sales_rep" && (() => {
        const today = new Date().toISOString().split('T')[0];
        const overdue = visibleCollections.filter(p => p.due_date < today);
        const dueToday = visibleCollections.filter(p => p.due_date === today);
        const upcoming = visibleCollections.filter(p => p.due_date > today);
        const activeList = collectionsTab === 'overdue' ? overdue : collectionsTab === 'today' ? dueToday : upcoming;
        const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={() => setCollectionsOpen(false)} />
            <div className="relative bg-background rounded-lg border shadow-lg overflow-hidden flex flex-col" style={{ width: 560, maxWidth: "95vw", maxHeight: "80vh" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
                <div>
                  <p className="font-semibold text-sm">Collections</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total outstanding: {formatCurrency(visibleCollections.reduce((s, p) => s + p.amount, 0))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <button onClick={() => setCollectionsTab('overdue')} className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'overdue' ? 'bg-red-100 text-red-700' : 'text-muted-foreground hover:bg-muted'}`}>
                      Past Due {overdue.length > 0 && <span className="ml-1 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px]">{overdue.length}</span>}
                    </button>
                    <button onClick={() => setCollectionsTab('today')} className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'today' ? 'bg-orange-100 text-orange-700' : 'text-muted-foreground hover:bg-muted'}`}>
                      Today {dueToday.length > 0 && <span className="ml-1 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{dueToday.length}</span>}
                    </button>
                    <button onClick={() => setCollectionsTab('upcoming')} className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${collectionsTab === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'text-muted-foreground hover:bg-muted'}`}>
                      Upcoming {upcoming.length > 0 && <span className="ml-1 bg-blue-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{upcoming.length}</span>}
                    </button>
                  </div>
                  <button onClick={() => setCollectionsOpen(false)} className="ml-2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto flex-1 px-5 py-3">
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
                            {collectionsTab === 'overdue' ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              : collectionsTab === 'today' ? <Clock className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                              : <DollarSign className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                            <div className="min-w-0">
                              <span className="font-medium text-sm truncate block">{clientName}</span>
                              <div className="text-xs text-muted-foreground">{payment.project?.name ?? '—'} · {payment.label}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-sm">{formatCurrency(payment.amount)}</div>
                            <div className={`text-xs ${collectionsTab === 'overdue' ? 'text-red-600' : collectionsTab === 'today' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {formatDate(payment.due_date)}
                            </div>
                          </div>
                        </>
                      );
                      return to ? (
                        <Link key={payment.id} to={to} onClick={() => setCollectionsOpen(false)} className="py-3 flex items-center justify-between gap-4 hover:bg-accent/40 rounded-md px-2 -mx-2 transition-colors block no-underline">
                          {inner}
                        </Link>
                      ) : (
                        <div key={payment.id} className="py-3 flex items-center justify-between gap-4">{inner}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Revenue & Profit Breakdown Popup */}
      {showRevenueBreakdown && (() => {
        // Total collected per project across ALL time (for Collected % progress)
        const totalCollectedByProject = paidPayments.reduce((acc: Record<string, number>, p: any) => {
          const pid = p.project?.id;
          if (!pid) return acc;
          acc[pid] = (acc[pid] || 0) + (parseFloat(p.amount) || 0);
          return acc;
        }, {});
        // Cash collected in the SELECTED period per project — drives GP to match the dashboard card
        const periodCollectedByProject = periodPayments.reduce((acc: Record<string, number>, p: any) => {
          const pid = p.project?.id;
          if (!pid) return acc;
          acc[pid] = (acc[pid] || 0) + (parseFloat(p.amount) || 0);
          return acc;
        }, {});
        // Live GP rate per project (same formula as the dashboard GP card)
        const gpRateFor = (proj: any) => {
          if (!proj.totalValue || proj.totalValue === 0) return 0;
          const c = projectCostsMap[proj.id] ?? { materials: 0, labor: 0, commissions: 0 };
          return Math.max(0, (proj.totalValue - (c.materials + c.labor + c.commissions)) / proj.totalValue);
        };
        return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRevenueBreakdown(false)} />
          <div className="relative bg-background rounded-lg border shadow-lg overflow-hidden flex flex-col" style={{ width: 900, maxWidth: "95vw", maxHeight: "80vh" }}>
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <p className="font-semibold text-sm">Period Summary</p>
                <p className="text-xs text-muted-foreground mt-0.5">{getDateRangeLabel()} · {periodProjects.length} client{periodProjects.length !== 1 ? "s" : ""} with collected payments</p>
              </div>
              <button onClick={() => setShowRevenueBreakdown(false)} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="overflow-auto flex-1">
              {periodProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No payments collected in this period.</p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Client</th>
                      <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Contract $</th>
                      <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Collected %</th>
                      <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">GP $ <span className="normal-case text-[9px]">(period)</span></th>
                      <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">GP %</th>
                      <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...periodProjects]
                      .sort((a: any, b: any) => (b.totalValue || 0) - (a.totalValue || 0))
                      .map((proj: any) => {
                        const gpRate = gpRateFor(proj);
                        const periodCollected = periodCollectedByProject[proj.id] || 0;
                        const periodGP = periodCollected * gpRate;
                        const commissions = projectCostsMap[proj.id]?.commissions ?? 0;
                        // Proportional paid commission against the period's collected share
                        const periodCommission = proj.totalValue > 0 ? commissions * (periodCollected / proj.totalValue) : 0;
                        const netProfit = periodGP - periodCommission;
                        const totalCollected = totalCollectedByProject[proj.id] || 0;
                        const collectedPct = proj.totalValue > 0 ? (totalCollected / proj.totalValue) * 100 : 0;
                        return (
                          <tr key={proj.id} className="hover:bg-accent/50">
                            <td className="px-4 py-2.5 font-medium">{proj.clientName || "—"}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(proj.totalValue || 0)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${collectedPct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, collectedPct)}%` }} />
                                </div>
                                <div className="text-right">
                                  <div className={`${collectedPct >= 100 ? "text-green-600" : collectedPct >= 50 ? "text-blue-600" : "text-amber-600"}`}>{collectedPct.toFixed(0)}%</div>
                                  {collectedPct < 100 && (
                                    <div className="text-[10px] text-muted-foreground">{formatCurrency(Math.max(0, (proj.totalValue || 0) - totalCollected))} left</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{formatCurrency(periodGP)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{(gpRate * 100).toFixed(1)}%</td>
                            <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${netProfit >= 0 ? "text-orange-600" : "text-red-600"}`}>{formatCurrency(Math.max(0, netProfit))}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/30">
                    <tr className="font-bold">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{periodProjects.length} client{periodProjects.length !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(periodProjects.reduce((s: number, p: any) => s + (p.totalValue || 0), 0))}</td>
                      <td />
                      <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(totalProfit)}</td>
                      <td className="px-4 py-2.5 text-right">{avgProfitMargin.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">{formatCurrency(Math.max(0, periodProjects.reduce((s: number, p: any) => {
                        const gpRate = gpRateFor(p);
                        const periodCollected = periodCollectedByProject[p.id] || 0;
                        const periodGP = periodCollected * gpRate;
                        const commissions = projectCostsMap[p.id]?.commissions ?? 0;
                        const periodCommission = p.totalValue > 0 ? commissions * (periodCollected / p.totalValue) : 0;
                        return s + Math.max(0, periodGP - periodCommission);
                      }, 0)))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
        );
      })()}


      {/* Mileage quick-action card — PM and Sales Rep only, when period is open */}
      {(role === "project_manager" || role === "sales_rep") && activeMileagePeriod && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-100">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Mileage Reimbursement</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upload your Everlance CSV to submit this week's mileage</p>
              </div>
            </div>
            <Link
              to="/mileage"
              className="no-underline"
            >
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0">
                Submit Mileage →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
