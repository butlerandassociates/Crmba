import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency } from "@/app/utils/format";
import { Users, FolderKanban, DollarSign, TrendingUp, Cloud, CloudRain, Sun, Award, Loader2, CalendarIcon, ChevronDown, AlertCircle, Clock, CheckCircle2, Car, X, Pencil, Target, BarChart3, Activity, FileText, Check } from "lucide-react";
import { PageLoader, SkeletonCards, SkeletonChart } from "./ui/page-loader";
import { Link, useNavigate } from "react-router";
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
import { PipelineBoard } from "./pipeline-board";
import { DashPanel, FinancialSummary, PipelineVsClosedChart, GoalTrackers, type SummaryMetric } from "./dashboard-sections";

export function Dashboard() {
  const { can, role } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [dateRangeType, setDateRangeType] = useState<'month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'ytd' | 'last_12' | 'all_time' | 'custom'>('month');
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
  const [acceptedProposals, setAcceptedProposals] = useState<{ client_id: string; accepted_at: string }[]>([]);
  // proposals that were sent (value + date) -> the "Pipeline value" bars; first appointment per client -> closing cycle
  const [proposalsSent, setProposalsSent] = useState<{ total: number; sent_at: string }[]>([]);
  const [appointmentDates, setAppointmentDates] = useState<{ client_id: string; appointment_date: string }[]>([]);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarios, setScenarios] = useState([
    { name: "Scenario A", materials: "", labor: "", markup: "" },
    { name: "Scenario B", materials: "", labor: "", markup: "" },
  ]);

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

      // Fetch sold transitions for Sales Goal tracker — try both 'sold' and 'Sold' casing
      const [{ data: soldLower }, { data: soldTitle }] = await Promise.all([
        supabase.from("stage_history").select("client_id, changed_at").eq("to_stage", "sold"),
        supabase.from("stage_history").select("client_id, changed_at").eq("to_stage", "Sold"),
      ]);
      setSoldTransitions([...(soldLower || []), ...(soldTitle || [])]);

      // Fetch accepted proposals — used as primary source for sales goal (just need client_id + date)
      const { data: proposalsData } = await supabase
        .from("estimates")
        .select("client_id, accepted_at")
        .eq("status", "accepted");
      setAcceptedProposals(proposalsData || []);

      // Dashboard redesign (Nov 2026): proposals sent per month + every appointment date. Optional: a failure here only
      // leaves the pipeline bars / closing cycle empty.
      try {
        const [{ data: sentRows }, { data: apptRows }] = await Promise.all([
          supabase.from("estimates").select("total, sent_at, client:clients!inner(is_discarded)").not("sent_at", "is", null).eq("client.is_discarded", false),
          supabase.from("appointments").select("client_id, appointment_date"),
        ]);
        setProposalsSent(((sentRows ?? []) as any[]).map((r) => ({ total: Number(r.total) || 0, sent_at: r.sent_at })));
        setAppointmentDates((apptRows ?? []) as any[]);
      } catch (e) {
        console.warn("Dashboard extras failed:", e);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "project_payments", "projects", "company_settings", "project_receipts", "fio_crew_payments", "commission_payments", "stage_history", "estimates"], "dashboard");

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

  // Active Clients/Projects = clients in "active" pipeline stage (matches what the nav "Active" button shows)
  const activeStageClients = clients.filter((c: any) => !c.is_discarded && c.status === 'active');
  const activeClients = activeStageClients.length;
  const activeProjects = visibleProjects.filter(
    (p: any) => activeStageClients.some((c: any) => c.id === p.client_id)
  ).length;

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
    const y = now.getFullYear();
    const today = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59);
    const quarter = (q: number) => ({ startDate: new Date(y, q * 3, 1), endDate: new Date(y, q * 3 + 3, 0, 23, 59, 59) });
    switch (dateRangeType) {
      case 'month':
        return { startDate: new Date(y, now.getMonth(), 1), endDate: new Date(y, now.getMonth() + 1, 0, 23, 59, 59) };
      case 'last_month':
        return { startDate: new Date(y, now.getMonth() - 1, 1), endDate: new Date(y, now.getMonth(), 0, 23, 59, 59) };
      case 'q1': return quarter(0);
      case 'q2': return quarter(1);
      case 'q3': return quarter(2);
      case 'q4': return quarter(3);
      case 'ytd':
        return { startDate: new Date(y, 0, 1), endDate: today };
      case 'last_12':
        return { startDate: new Date(y, now.getMonth() - 11, 1), endDate: today };
      case 'all_time':
        return { startDate: new Date(2000, 0, 1), endDate: today };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate),
            endDate: new Date(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate(), 23, 59, 59),
          };
        }
        // Default to current month if custom dates not set
        return { startDate: new Date(y, now.getMonth(), 1), endDate: new Date(y, now.getMonth() + 1, 0, 23, 59, 59) };
    }
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

  // Sales Goal: new contracts signed in selected period only
  // Primary: accepted proposals with accepted_at in the period
  const periodAcceptedSales = acceptedProposals
    .filter((p) => {
      if (!p.accepted_at) return false;
      const d = p.accepted_at.includes("T") ? new Date(p.accepted_at) : new Date(p.accepted_at + "T00:00:00");
      return d >= startDate && d <= endDate;
    })
    .reduce((sum: number, p) => {
      const proj = projects.find((pr: any) => pr.client_id === p.client_id);
      return sum + parseFloat(proj?.totalValue || proj?.total_value || '0');
    }, 0);
  // Fallback: stage_history "sold" transitions within the period
  const periodSoldIds = new Set(
    soldTransitions
      .filter(t => {
        const d = t.changed_at.includes("T") ? new Date(t.changed_at) : new Date(t.changed_at + "T00:00:00");
        return d >= startDate && d <= endDate;
      })
      .map(t => t.client_id)
  );
  const periodStageHistorySales = projects
    .filter((p: any) => p.client_id && periodSoldIds.has(p.client_id))
    .reduce((sum: number, p: any) => sum + (parseFloat(p.totalValue || p.total_value || 0)), 0);
  const periodSalesAmount = periodAcceptedSales > 0 ? periodAcceptedSales : periodStageHistorySales;
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

  // All-time GP: sum ALL paid payments (not just selected period) — Jonathan requested this
  const allTimeProfit = visiblePaidPayments.reduce((sum, p) => {
    const proj = visibleProjects.find((vp: any) => vp.id === p.project?.id);
    if (!proj || !proj.totalValue || proj.totalValue === 0) return sum;
    const costs = projectCostsMap[proj.id] ?? { materials: 0, labor: 0, commissions: 0 };
    const liveGPRate = Math.max(0, (proj.totalValue - (costs.materials + costs.labor + costs.commissions)) / proj.totalValue);
    return sum + (parseFloat(p.amount) || 0) * liveGPRate;
  }, 0);
  const allTimeRevenue = visiblePaidPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const allTimeMargin = allTimeRevenue > 0 ? (allTimeProfit / allTimeRevenue) * 100 : 0;

  // Projected GP: expected GP from all active/sold projects when fully paid
  const projectedGP = [...pipeSold, ...pipeActive].reduce((sum: number, c: any) => {
    const proj = projects.find((p: any) => p.client_id === c.id);
    const totalVal = parseFloat(proj?.totalValue || proj?.total_value || 0);
    if (!proj || !totalVal) return sum;
    const costs = projectCostsMap[proj.id] ?? { materials: 0, labor: 0, commissions: 0 };
    const totalCosts = costs.materials + costs.labor + costs.commissions;
    if (totalCosts > 0) return sum + Math.max(0, totalVal - totalCosts);
    // No tracked costs yet — use stored profit margin %
    const marginRate = Number(proj?.profitMargin || proj?.profit_margin || 0) / 100;
    return sum + totalVal * marginRate;
  }, 0);

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
  
  // Period label + detail for the picker, the cards and the goal tracker (Figma redesign, Nov 2026)
  const getPeriodInfo = (): { label: string; detail: string } => {
    const y = new Date().getFullYear();
    const longMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const shortMonthYear = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    switch (dateRangeType) {
      case 'month': return { label: 'Current month', detail: longMonth(startDate) };
      case 'last_month': return { label: 'Last month', detail: longMonth(startDate) };
      case 'q1': return { label: 'Q1', detail: `Jan – Mar ${y}` };
      case 'q2': return { label: 'Q2', detail: `Apr – Jun ${y}` };
      case 'q3': return { label: 'Q3', detail: `Jul – Sep ${y}` };
      case 'q4': return { label: 'Q4', detail: `Oct – Dec ${y}` };
      case 'ytd': return { label: 'Year to date', detail: `Jan – ${endDate.toLocaleDateString('en-US', { month: 'short' })} ${y}` };
      case 'last_12': return { label: 'Last 12 months', detail: `${shortMonthYear(startDate)} – ${shortMonthYear(endDate)}` };
      case 'all_time': return { label: 'All time', detail: 'Entire business history' };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { label: 'Custom range', detail: `${customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` };
        }
        return { label: 'Custom range', detail: 'Pick start and end dates' };
    }
  };
  const getDateRangeLabel = () => getPeriodInfo().detail;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const isAdminView = role !== "sales_rep" && role !== "project_manager";

  // "Pipeline value" bars: value of the proposals sent in each of the last 6 months, next to the cash collected that month
  const pipelineVsClosed = monthlyRevenueChart.map((m) => {
    const [yy, mm] = m.id.split("-").map(Number);
    const sent = proposalsSent
      .filter((p) => { const d = new Date(p.sent_at); return d.getFullYear() === yy && d.getMonth() === mm; })
      .reduce((sum, p) => sum + p.total, 0);
    return { month: m.month, pipeline: sent, closed: m.revenue };
  });

  // Closing cycle (Jonathan, Nov 2026): average days from a client's FIRST appointment to the contract being signed
  // (earliest of the stage-history "sold" move and the accepted proposal). Clients with no appointment on record, or
  // whose sale predates their first appointment, are left out.
  const closingCycle = (() => {
    const firstAppt: Record<string, number> = {};
    for (const a of appointmentDates) {
      const t = new Date(`${a.appointment_date}T00:00:00`).getTime();
      if (!Number.isNaN(t) && (firstAppt[a.client_id] === undefined || t < firstAppt[a.client_id])) firstAppt[a.client_id] = t;
    }
    const soldAt: Record<string, number> = {};
    const noteSold = (clientId: string, iso: string) => {
      const t = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`).getTime();
      if (!Number.isNaN(t) && (soldAt[clientId] === undefined || t < soldAt[clientId])) soldAt[clientId] = t;
    };
    for (const t of soldTransitions) noteSold(t.client_id, t.changed_at);
    for (const p of acceptedProposals) if (p.accepted_at) noteSold(p.client_id, p.accepted_at);
    const days: number[] = [];
    for (const c of [...pipeSold, ...pipeActive, ...pipeCompleted]) {
      const appt = firstAppt[c.id];
      const sold = soldAt[c.id];
      if (appt === undefined || sold === undefined) continue;
      const d = (sold - appt) / 86400000;
      if (d >= 0) days.push(d);
    }
    if (days.length === 0) return null;
    days.sort((x, y) => x - y);
    const avg = days.reduce((sum, d) => sum + d, 0) / days.length;
    const mid = Math.floor(days.length / 2);
    const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
    return { avg, median, n: days.length };
  })();

  // The goals are monthly: over a quarter / year-to-date / last 12 months the goal covers that many months
  // (Figma redesign shows the goal scaling with the selected period).
  const periodMonths = (() => {
    const now = new Date();
    switch (dateRangeType) {
      case 'month': case 'last_month': return 1;
      case 'q1': case 'q2': case 'q3': case 'q4': return 3;
      case 'ytd': return now.getMonth() + 1;
      case 'last_12': return 12;
      case 'all_time': {
        const firstPaid = visiblePaidPayments.map((p: any) => p.paid_date).filter(Boolean).sort()[0];
        if (!firstPaid) return 1;
        const f = new Date(`${firstPaid}T00:00:00`);
        return Math.max(1, (now.getFullYear() - f.getFullYear()) * 12 + now.getMonth() - f.getMonth() + 1);
      }
      case 'custom': return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (30.44 * 86400000)));
    }
  })();
  const revenueGoalForPeriod = MONTHLY_REVENUE_GOAL * periodMonths;
  const salesGoalForPeriod = salesGoal * periodMonths;
  const revenueProgressForPeriod = revenueGoalForPeriod > 0 ? (periodRevenue / revenueGoalForPeriod) * 100 : 0;
  const salesProgressForPeriod = salesGoalForPeriod > 0 ? (periodSalesAmount / salesGoalForPeriod) * 100 : 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const overduePayments = visibleCollections.filter((p: any) => p.due_date < todayStr).length;
  const upcomingPayments = visibleCollections.length - overduePayments;
  const period = getPeriodInfo();

  const financialMetrics: SummaryMetric[] = [
    {
      id: "revenue", label: "Total Revenue", value: totalRevenue,
      iconTint: "bg-blue-50 text-blue-600", icon: <DollarSign className="h-4 w-4" />,
      detail: `Revenue collected · ${period.detail}`, note: `${periodPayments.length} payment${periodPayments.length === 1 ? "" : "s"}`, noteClass: "text-blue-600",
      action: { label: "View breakdown", onClick: () => setShowRevenueBreakdown(true) },
    },
    {
      id: "profit", label: "Gross Profit", value: allTimeProfit,
      iconTint: "bg-green-50 text-green-600", icon: <TrendingUp className="h-4 w-4" />,
      detail: `${allTimeMargin.toFixed(1)}% avg margin · all-time`, note: projectedGP > 0 ? `Projected: ${formatCurrency(projectedGP)}` : undefined, noteClass: "text-green-600",
      action: { label: "View breakdown", onClick: () => setShowRevenueBreakdown(true) },
    },
    {
      id: "contracted", label: "Contracted Value", value: contractedRevenue,
      iconTint: "bg-amber-50 text-amber-700", icon: <FileText className="h-4 w-4" />,
      detail: "Sold + Active + Completed", note: `${pipeSold.length + pipeActive.length + pipeCompleted.length} signed contracts`, noteClass: "text-amber-700",
      action: { label: "View clients", to: "/clients?stage=sold" },
    },
    {
      id: "closed", label: "Closed Revenue", value: closedRevenueDash,
      iconTint: "bg-violet-50 text-violet-600", icon: <Award className="h-4 w-4" />,
      detail: "Completed projects", note: `${pipeCompleted.length} projects closed`, noteClass: "text-violet-600",
      action: { label: "View clients", to: "/clients?stage=completed" },
    },
  ];

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

      {/* Admin dashboard — Jonathan's Figma redesign (Nov 2026): same numbers, more compact */}
      {isAdminView && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]">Revenue &amp; profit for selected period</p>
              <p className="mt-1 text-xs text-muted-foreground">A focused view of your financial performance.</p>
            </div>
            <Popover open={dateRangeOpen} onOpenChange={(open) => { setDateRangeOpen(open); if (!open) setShowCustomPickers(false); }}>
              <PopoverTrigger asChild>
                <button type="button" className="flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 text-left text-[11px] font-semibold shadow-sm hover:bg-accent">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="flex min-w-[105px] flex-col leading-tight">
                    {period.label}
                    <small className="mt-0.5 text-[9px] font-normal text-muted-foreground">{period.detail}</small>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                {([
                  { group: "Quick select", items: [["month", "Current month"], ["last_month", "Last month"]] },
                  { group: "Quarter", items: [["q1", "Q1"], ["q2", "Q2"], ["q3", "Q3"], ["q4", "Q4"]] },
                  { group: "Extended", items: [["ytd", "Year to date"], ["last_12", "Last 12 months"], ["all_time", "All time"]] },
                ] as const).map(({ group, items }) => (
                  <div key={group} className="[&+&]:mt-1 [&+&]:border-t [&+&]:pt-2">
                    <span className="block px-2 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group}</span>
                    <div className={group === "Quarter" ? "grid grid-cols-4 gap-1" : "space-y-0.5"}>
                      {items.map(([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => { setDateRangeType(type as any); setShowCustomPickers(false); setDateRangeOpen(false); }}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs hover:bg-accent ${dateRangeType === type ? "bg-accent font-medium" : "text-muted-foreground"} ${group === "Quarter" ? "justify-center" : ""}`}
                        >
                          <span>{label}</span>
                          {dateRangeType === type && group !== "Quarter" && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-1 border-t pt-1">
                  <button
                    type="button"
                    onClick={() => { if (dateRangeType === 'custom') { setShowCustomPickers(!showCustomPickers); } else { setDateRangeType('custom'); setShowCustomPickers(true); } }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs hover:bg-accent ${dateRangeType === 'custom' ? "bg-accent font-medium" : "text-muted-foreground"}`}
                  >
                    Custom range
                    {dateRangeType === 'custom' && <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {dateRangeType === 'custom' && showCustomPickers && (
                  <div className="mt-2 space-y-3 border-t px-1 pt-3">
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
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(340px,0.74fr)_minmax(0,1.26fr)]">
            <FinancialSummary metrics={financialMetrics} />
            <PipelineVsClosedChart data={pipelineVsClosed} />
          </div>

          <DashPanel
            title="Pipeline by stage"
            subtitle="Select a stage to see its clients"
            right={
              <div className="flex flex-wrap gap-x-7 gap-y-2 text-[10px] text-muted-foreground">
                <span className="flex flex-col gap-0.5">Weighted forecast <strong className="text-[12px] text-foreground">{formatCurrency(weightedForecastDash)}</strong></span>
                <span className="flex flex-col gap-0.5">Pipeline value <strong className="text-[12px] text-foreground">{formatCurrency(pipelineValue)}</strong></span>
                <span className="flex flex-col gap-0.5" title="Average days from a client's first appointment to a signed contract">
                  Avg closing cycle
                  <strong className="text-[12px] text-foreground">{closingCycle ? `${Math.round(closingCycle.avg)} days` : "—"}</strong>
                  {closingCycle && <span className="text-[9px]">median {Math.round(closingCycle.median)} · {closingCycle.n} deals</span>}
                </span>
              </div>
            }
          >
            <div className="px-5 pb-5 pt-4">
              <PipelineBoard
                clients={nonDiscarded}
                // same amounts the stage tiles always showed: proposal total, else the job total
                clientValue={(_stage: string, c: any) => c.proposal_forecast || clientProjectTotal(c.id) || 0}
              />
            </div>
          </DashPanel>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.3fr_0.7fr]">
            <DashPanel title="Leads & closing metrics" subtitle={`Performance for ${period.label.toLowerCase()}`}>
              <div className="grid grid-cols-2 gap-y-5 px-5 py-5 md:grid-cols-4">
                {[
                  { label: "New leads", value: String(periodLeads), sub: "Selected period" },
                  { label: "Closing rate", value: `${closingRate.toFixed(1)}%`, sub: `${closedCount} of ${totalNonDiscarded} clients` },
                  { label: "Avg deal size", value: formatCurrency(avgDealSize), sub: `${dealProjects.length} contracts` },
                  { label: "Avg GP %", value: `${avgProfitMargin.toFixed(1)}%`, sub: "From collected payments" },
                ].map((m, i) => (
                  <div key={m.label} className={`flex flex-col px-4 ${i === 0 ? "pl-0" : ""} ${i < 3 ? "md:border-r" : ""} ${i % 2 === 0 ? "border-r md:border-r-0" : ""} ${i < 3 ? "md:border-r" : ""}`}>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    <strong className="mt-1.5 text-[15px]">{m.value}</strong>
                    <small className="mt-0.5 text-[10px] text-muted-foreground">{m.sub}</small>
                  </div>
                ))}
              </div>
            </DashPanel>
            <DashPanel title="Lead activity" subtitle="This week at a glance">
              <div className="grid grid-cols-3 gap-2 px-5 py-4">
                <div className="flex min-h-[61px] flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <strong className="text-[17px]">{newLeadsThisWeek}</strong>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">New leads</span>
                </div>
                <div className="flex min-h-[61px] flex-col items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <strong className="text-[17px]">{appointmentsScheduled}</strong>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">Scheduled</span>
                </div>
                <div className="flex min-h-[61px] flex-col items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <strong className="text-[17px]">{appointmentsMet}</strong>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">Completed</span>
                </div>
              </div>
              {Object.keys(leadsBySource).length > 0 && (
                <details className="group border-t px-5 py-3">
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground">Lead sources</summary>
                  <div className="mt-2.5 space-y-2">
                    {Object.entries(leadsBySource).map(([source, count]) => {
                      const c = count as number;
                      return (
                        <div key={source} className="flex items-center justify-between text-xs">
                          <span className="w-24 shrink-0 truncate text-muted-foreground">{source}</span>
                          <div className="mx-3 flex flex-1 items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-blue-500" style={{ width: `${(c / clients.length) * 100}%` }} />
                            </div>
                            <span className="min-w-[20px] text-right font-semibold">{c}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </DashPanel>
          </div>

          <GoalTrackers
            periodLabel={period.detail}
            canUseCalculator={role === "admin"}
            onEditGoals={() => { setEditRevGoal(MONTHLY_REVENUE_GOAL.toString()); setEditSalesGoal(salesGoal.toString()); setGoalEditOpen(true); }}
            onOpenFullCalculator={() => setScenarioOpen(true)}
            revenue={{ collected: periodRevenue, goal: revenueGoalForPeriod, progress: revenueProgressForPeriod, remaining: revenueGoalForPeriod - periodRevenue, subtitle: periodMonths > 1 ? `Collection goal for ${periodMonths} months` : "Monthly collection goal" }}
            sales={{ amount: periodSalesAmount, goal: salesGoalForPeriod, progress: salesProgressForPeriod, subtitle: periodMonths > 1 ? `New contracts signed · ${periodMonths} months` : "New contracts signed" }}
            projectsThisPeriod={periodProjects.length}
            averageContract={periodProjects.length > 0 ? periodRevenue / periodProjects.length : 0}
            upcomingPayments={upcomingPayments}
            overduePayments={overduePayments}
            showCollections={role !== "sales_rep"}
            onOpenCollections={() => setCollectionsOpen(true)}
          />
        </>
      )}

      {/* Stats cards for Sales Reps and PMs (company-wide admin sections above are admin only) */}
      {!isAdminView && (
      <div className={`grid grid-cols-1 gap-4 ${role === "sales_rep" ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
          <Link to="/clients?stage=active" className="no-underline">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
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
          </Link>
  
          <Link to="/clients?stage=active" className="no-underline">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
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
          </Link>
  
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowRevenueBreakdown(true)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{formatCurrency(allTimeProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">{allTimeMargin.toFixed(1)}% avg margin · all-time</p>
              {projectedGP > 0 && (
                <p className="text-xs text-blue-600 mt-0.5">Projected: {formatCurrency(projectedGP)}</p>
              )}
            </CardContent>
          </Card>
          )}
        </div>
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

      {/* Scenario Calculator Modal */}
      {scenarioOpen && (() => {
        const calc = (s: typeof scenarios[0]) => {
          const mat = parseFloat(s.materials) || 0;
          const lab = parseFloat(s.labor) || 0;
          const pct = parseFloat(s.markup) || 0;
          const totalCost = mat + lab;
          const markupAmt = totalCost * (pct / 100);
          const salePrice = totalCost + markupAmt;
          const gpDollars = salePrice - totalCost;
          const gpPct = salePrice > 0 ? (gpDollars / salePrice) * 100 : 0;
          return { totalCost, markupAmt, salePrice, gpDollars, gpPct };
        };
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setScenarioOpen(false)} />
            <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-base">Scenario Calculator</h3>
                </div>
                <button onClick={() => setScenarioOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {scenarios.map((s, i) => {
                    const r = calc(s);
                    const update = (field: string, val: string) =>
                      setScenarios(prev => prev.map((sc, idx) => idx === i ? { ...sc, [field]: val } : sc));
                    return (
                      <div key={i} className="space-y-4">
                        <Input
                          value={s.name}
                          onChange={e => update("name", e.target.value)}
                          className="font-semibold text-sm h-8"
                        />
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Materials ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input value={s.materials} onChange={e => update("materials", e.target.value.replace(/[^0-9.]/g, ""))} className="pl-7" placeholder="0" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Labor ($)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input value={s.labor} onChange={e => update("labor", e.target.value.replace(/[^0-9.]/g, ""))} className="pl-7" placeholder="0" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground font-medium">Markup (%)</label>
                            <div className="relative">
                              <Input value={s.markup} onChange={e => update("markup", e.target.value.replace(/[^0-9.]/g, ""))} className="pr-7" placeholder="0" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Cost</span>
                            <span className="font-medium">{formatCurrency(r.totalCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Markup Amount</span>
                            <span className="font-medium text-blue-600">+{formatCurrency(r.markupAmt)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="font-semibold">Sale Price</span>
                            <span className="font-bold">{formatCurrency(r.salePrice)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gross Profit</span>
                            <span className={`font-medium ${r.gpDollars >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(r.gpDollars)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">GP %</span>
                            <span className={`font-bold ${r.gpPct >= 20 ? "text-green-600" : r.gpPct >= 10 ? "text-amber-600" : "text-red-600"}`}>{r.gpPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-5 pt-4 border-t">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setScenarios([{ name: "Scenario A", materials: "", labor: "", markup: "" }, { name: "Scenario B", materials: "", labor: "", markup: "" }])}
                  >
                    Reset
                  </button>
                  <Button onClick={() => setScenarioOpen(false)}>Done</Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Collections button — hidden for sales reps; admins have it in the Goal trackers panel */}
      {role !== "sales_rep" && !isAdminView && (() => {
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
