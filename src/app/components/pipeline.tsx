import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link } from "react-router";
import { 
  TrendingUp, 
  Target, 
  DollarSign, 
  CheckCircle2, 
  Activity, 
  Calendar, 
  ExternalLink,
  Users,
  Briefcase,
  AlertCircle,
  Loader2,
  Building2,
  Award,
  Bell
} from "lucide-react";
import { clientsAPI, projectsAPI, usersAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";

export function Pipeline() {
  useEffect(() => {
    if (loading) return;
    const target = sessionStorage.getItem("pipeline_scroll");
    if (target === "tasks") {
      sessionStorage.removeItem("pipeline_scroll");
      const el = document.getElementById(target) as HTMLElement;
      const scroller = document.querySelector("main");
      if (el && scroller) {
        const scrollerRect = scroller.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        scroller.scrollTo({ top: scroller.scrollTop + elRect.top - scrollerRect.top - 16, behavior: "smooth" });
      }
    }
  }, [loading]);

  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart alerts data
  const [clientsWithProposals, setClientsWithProposals] = useState<Set<string>>(new Set());
  const [overduePayments, setOverduePayments] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsData, projectsData, usersData] = await Promise.all([
        clientsAPI.getAll(),
        projectsAPI.getAll(),
        usersAPI.getAll()
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setUsers(usersData);

      // Fetch alert data in parallel
      const today = new Date().toISOString().split("T")[0];
      const [estimatesRes, paymentsRes] = await Promise.all([
        supabase.from("estimates").select("client_id"),
        supabase.from("project_payments")
          .select("*, project:projects(id, client_id, name, client:clients(first_name, last_name))")
          .eq("is_paid", false)
          .not("due_date", "is", null)
          .lt("due_date", today),
      ]);

      setClientsWithProposals(new Set((estimatesRes.data ?? []).map((e: any) => e.client_id)));
      setOverduePayments(paymentsRes.data ?? []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "project_payments", "estimates"], "pipeline");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate metrics
  const prospectClients = clients.filter((c) => c.status === "prospect");
  const soldClients = clients.filter((c) => c.status === "sold");
  const activeClients = clients.filter((c) => c.status === "active");
  const completedClients = clients.filter((c) => c.status === "completed");

  const prospectValue = prospectClients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const soldValue = soldClients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const activeValue = activeClients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);
  const completedValue = completedClients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0);

  // Calculate weighted forecast (probability-adjusted)
  const weightedForecast = prospectClients.reduce((sum, c) => {
    const probability = c.probability || 65;
    return sum + ((c.totalRevenue || 0) * (probability / 100));
  }, 0);

  // Company Stats
  const totalRevenue = soldValue + activeValue + completedValue;
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'planning').length;
  const totalTeamMembers = users.length;

  // Commission Calculations
  const salesReps = users.filter(u => u.role === 'sales');
  
  const pendingCommissions = soldClients.reduce((sum, c) => {
    const salesCommission = (c.totalRevenue || 0) * 0.05; // 5% for sales
    const pmCommission = (c.totalRevenue || 0) * 0.03; // 3% for PM
    return sum + salesCommission + pmCommission;
  }, 0);

  // ── Smart Alerts ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Selling clients with no proposal sent
  const sellingNoProposal = clients.filter(
    (c) => c.status === "selling" && !clientsWithProposals.has(c.id)
  );

  // 2. Prospect/Selling clients with Est. Close Date passed and not updated
  const staleForecasts = clients.filter((c) => {
    if (!["prospect", "selling"].includes(c.status)) return false;
    if (!c.expected_close_date) return false;
    const closeDate = new Date(c.expected_close_date);
    closeDate.setHours(0, 0, 0, 0);
    return closeDate < today;
  });

  // Build unified alerts array
  type Alert = { id: string; clientId: string; clientName: string; label: string; description: string; severity: "red" | "amber" | "blue" };
  const alerts: Alert[] = [
    ...sellingNoProposal.map((c) => ({
      id: `no-proposal-${c.id}`,
      clientId: c.id,
      clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      label: "No Proposal Sent",
      description: "Client is in Selling stage but has no proposal",
      severity: "amber" as const,
    })),
    ...staleForecasts.map((c) => ({
      id: `stale-forecast-${c.id}`,
      clientId: c.id,
      clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      label: "Est. Close Date Passed",
      description: `Expected to close by ${new Date(c.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — update date & CP%`,
      severity: "amber" as const,
    })),
    ...overduePayments.map((pmt) => ({
      id: `overdue-${pmt.id}`,
      clientId: pmt.project?.client_id ?? "",
      clientName: pmt.project?.client
        ? `${pmt.project.client.first_name ?? ""} ${pmt.project.client.last_name ?? ""}`.trim()
        : "—",
      label: "Payment Overdue",
      description: `${pmt.label ?? "Payment"} — ${new Date(pmt.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      severity: "red" as const,
    })),
  ];

  // Activity data
  const upcomingCollections = clients.filter(c => {
    if (!c.nextPaymentDate) return false;
    const paymentDate = new Date(c.nextPaymentDate);
    const now = new Date();
    const daysUntil = Math.ceil((paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sales Pipeline & Forecast</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track deals and company performance</p>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Weighted Forecast</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(weightedForecast)}</div>
            <p className="text-xs text-muted-foreground mt-1">Probability-adjusted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(prospectValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total in prospects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Active Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(soldValue + activeValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Sold + Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Closed Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(completedValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stages in Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Prospect Stage */}
        <Card className="flex flex-col">
          <CardHeader className="bg-blue-500 text-white pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Prospect</CardTitle>
              <Badge variant="secondary" className="bg-white text-gray-900">
                {prospectClients.length}
              </Badge>
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(prospectValue)}</div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {prospectClients.length > 0 ? (
                prospectClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{client.name}</h4>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{client.company || 'No company'}</p>
                        </div>
                      </div>
                      {client.totalRevenue > 0 && (
                        <>
                          <div className="text-sm font-semibold text-green-600">
                            {formatCurrency(client.totalRevenue)}
                          </div>
                          {client.probability && (
                            <>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${client.probability}%` }}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground">{client.probability}%</div>
                            </>
                          )}
                        </>
                      )}
                      {client.estimatedCloseDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Est: {new Date(client.estimatedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No clients in this stage
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sold Stage */}
        <Card className="flex flex-col">
          <CardHeader className="bg-orange-500 text-white pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sold</CardTitle>
              <Badge variant="secondary" className="bg-white text-gray-900">
                {soldClients.length}
              </Badge>
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(soldValue)}</div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {soldClients.length > 0 ? (
                soldClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{client.name}</h4>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{client.company || 'No company'}</p>
                        </div>
                      </div>
                      {client.totalRevenue > 0 && (
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(client.totalRevenue)}
                        </div>
                      )}
                      {client.contractSignedDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Signed: {new Date(client.contractSignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No clients in this stage
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Stage */}
        <Card className="flex flex-col">
          <CardHeader className="bg-green-500 text-white pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active</CardTitle>
              <Badge variant="secondary" className="bg-white text-gray-900">
                {activeClients.length}
              </Badge>
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(activeValue)}</div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {activeClients.length > 0 ? (
                activeClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{client.name}</h4>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{client.company || 'No company'}</p>
                        </div>
                      </div>
                      {client.totalRevenue > 0 && (
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(client.totalRevenue)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No clients in this stage
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Stage */}
        <Card className="flex flex-col">
          <CardHeader className="bg-purple-500 text-white pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Completed</CardTitle>
              <Badge variant="secondary" className="bg-white text-gray-900">
                {completedClients.length}
              </Badge>
            </div>
            <div className="text-xl font-bold mt-1">{formatCurrency(completedValue)}</div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {completedClients.length > 0 ? (
                completedClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 hover:bg-accent transition-colors group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{client.name}</h4>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{client.company || 'No company'}</p>
                        </div>
                      </div>
                      {client.totalRevenue > 0 && (
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(client.totalRevenue)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No clients in this stage
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Stats, Commissions, Tasks, Activity - 2x2 Grid */}
      <div id="tasks" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Company Stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Company Stats</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Revenue</span>
                </div>
                <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Projects</span>
                </div>
                <span className="font-semibold">{totalProjects}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Active Projects</span>
                </div>
                <span className="font-semibold">{activeProjects}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Team Members</span>
                </div>
                <span className="font-semibold">{totalTeamMembers}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generating Commissions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Generating Commissions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Pending Commissions</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(pendingCommissions)}</div>
                <div className="text-xs text-muted-foreground mt-1">From sold contracts</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium mb-2">Top Earners</div>
                {salesReps.slice(0, 3).map((rep, idx) => {
                  const repClients = soldClients.filter(c => c.salesRepId === rep.id);
                  const commission = repClients.reduce((sum, c) => sum + ((c.totalRevenue || 0) * 0.05), 0);
                  return (
                    <div key={rep.id} className="flex items-center justify-between p-2 bg-accent/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-white' : 
                          idx === 1 ? 'bg-gray-400 text-white' : 
                          'bg-orange-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <span>{rep.name}</span>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(commission)}</span>
                    </div>
                  );
                })}
                {salesReps.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No sales reps yet
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Smart Alerts</CardTitle>
              </div>
              {alerts.length > 0 && (
                <Badge className="bg-red-500 text-white">{alerts.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-6 space-y-1">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm font-medium text-green-700">All clear!</p>
                  <p className="text-xs text-muted-foreground">No issues detected across your pipeline</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.clientId ? `/clients/${alert.clientId}` : "#"}
                    className="block p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "red" ? "text-red-500" : "text-amber-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            alert.severity === "red"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {alert.label}
                          </span>
                          <span className="text-sm font-medium truncate">{alert.clientName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Overdue Payments */}
              {overduePayments.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-600">
                      {overduePayments.length} Overdue Payment{overduePayments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {overduePayments.slice(0, 2).map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}`}
                        className="block text-xs text-red-700 hover:underline"
                      >
                        • {client.name} - {formatCurrency(client.balanceDue || 0)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Collections */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-600">
                    Upcoming Collections (Next 7 Days)
                  </span>
                </div>
                {upcomingCollections.length > 0 ? (
                  <div className="space-y-1">
                    {upcomingCollections.slice(0, 3).map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}`}
                        className="block text-xs text-blue-700 hover:underline"
                      >
                        • {client.name} - {formatCurrency(client.balanceDue || 0)} 
                        {client.nextPaymentDate && ` - ${new Date(client.nextPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No upcoming collections</p>
                )}
              </div>

              {/* Recent Activity */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</div>
                {soldClients.slice(0, 3).map((client) => (
                  <div key={client.id} className="flex items-center gap-2 text-xs p-2 bg-accent/50 rounded">
                    <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{client.name}</span> contract signed
                      {client.contractSignedDate && ` - ${new Date(client.contractSignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </span>
                  </div>
                ))}
                {soldClients.length === 0 && (
                  <p className="text-xs text-muted-foreground">No recent activity</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
