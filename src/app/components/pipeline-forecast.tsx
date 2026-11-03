import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { formatCurrency } from "@/app/utils/format";
import { Badge } from "./ui/badge";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link } from "react-router";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
  ListTodo,
  Clock,
  Building2,
  Award,
  Bell,
} from "lucide-react";
import { clientsAPI, projectsAPI, usersAPI, estimatesAPI } from "../utils/api";
import { PageLoader, SkeletonCards, SkeletonTable } from "./ui/page-loader";
import { supabase } from "@/lib/supabase";
import { pickJobEstimate } from "@/app/utils/financials";
import { clientRecipientEmails } from "@/app/utils/client-emails";

const clientDisplayName = (c: any) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "—";

export function PipelineForecast() {
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [proposalClientIds, setProposalClientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<any[]>([]);
  // clients.status_changed_at (migration 137) -> "days in stage"; stays empty (card falls back to created_at) if not run yet
  const [stageSince, setStageSince] = useState<Record<string, string>>({});
  const [quickView, setQuickView] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientsData, projectsData, usersData, estimatesData] = await Promise.all([
        clientsAPI.getAll(),
        projectsAPI.getAll(),
        usersAPI.getAll(),
        estimatesAPI.getAll(),
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setUsers(usersData);
      setProposalClientIds(new Set(estimatesData.map((e: any) => e.client_id)));
      setEstimates(estimatesData);
      // When did each client enter its current stage? Best source first: clients.status_changed_at (migration 137, set by a
      // trigger on every status change); older rows fall back to their latest 'status_changed' activity entry, then created_at.
      try {
        const since: Record<string, string> = {};
        const { data: logged } = await supabase.from("activity_log").select("client_id, created_at").eq("action_type", "status_changed").order("created_at", { ascending: false }).limit(5000);
        for (const r of logged ?? []) if (r.client_id && !since[r.client_id]) since[r.client_id] = r.created_at;
        const { data: exact, error: exactErr } = await supabase.from("clients").select("id, status_changed_at").not("status_changed_at", "is", null);
        if (!exactErr) for (const r of exact ?? []) since[r.id] = r.status_changed_at;
        setStageSince(since);
      } catch { /* optional: cards fall back to created_at */ }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "projects", "estimates"], "pipeline-forecast");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Bucket by client.status (source of truth — matches what is written on every stage move)
  const statusName = (c: any) => (c.status ?? "").toLowerCase();
  const prospectClients   = clients.filter((c) => statusName(c) === "prospect");
  const scheduledClients  = clients.filter((c) => statusName(c) === "scheduled");
  const sellingClients    = clients.filter((c) => statusName(c) === "selling");
  const soldClients       = clients.filter((c) => statusName(c) === "sold");
  const activeClients     = clients.filter((c) => statusName(c) === "active");
  const completedClients  = clients.filter((c) => statusName(c) === "completed");

  // Revenue per bucket — pre-contract stages use proposal_forecast; sold/active/completed use project_total
  const prospectValue   = prospectClients.reduce((sum, c) => sum + (c.proposal_forecast ?? 0), 0);
  const scheduledValue  = scheduledClients.reduce((sum, c) => sum + (c.proposal_forecast ?? 0), 0);
  const sellingValue    = sellingClients.reduce((sum, c) => sum + (c.proposal_forecast ?? 0), 0);
  const soldValue       = soldClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);
  const activeValue     = activeClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);
  const completedValue  = completedClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);

  // Weighted forecast — spec: Prospect=0%, Scheduled=0%, Selling=individual close% (default 40), Sold=100%, Active=100%
  const weightedForecast =
    sellingClients.reduce((sum, c) => {
      const prob = c.closing_probability > 0 ? c.closing_probability : 40;
      return sum + (c.proposal_forecast ?? 0) * (prob / 100);
    }, 0) +
    soldClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0) +
    activeClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);

  // Company Stats — active + completed projects
  const completedProjects = projects.filter((p) => p.status === "completed");
  const revenueProjects = projects.filter((p) => p.status === "active" || p.status === "completed");
  const totalRevenue    = revenueProjects.reduce((sum, p) => sum + (p.totalValue ?? 0), 0);
  const totalProjects   = projects.length;
  const activeProjects  = projects.filter((p) => p.status === "active").length;
  const totalTeamMembers = users.length;

  // Commission Calculations — from projects
  const salesReps = users.filter((u) => u.role === "sales_rep");

  const pendingCommissions = projects
    .filter((p) => ["sold", "active"].includes(p.status))
    .reduce((sum, p) => {
      const pmComm  = p.project_manager_id ? (p.grossProfit || 0) * ((p.pmCommissionRate || 0) / 100) : 0;
      const repComm = p.sales_rep_id       ? (p.status === "completed" ? (p.grossProfit || 0) * ((p.salesRepCommissionRate || 0) / 100) : (p.salesRepCommission || 0)) : 0; // open jobs: % of subtotal set at Move to Sold; closed jobs keep the old GP basis (Jonathan, Oct 28 2026)
      return sum + pmComm + repComm;
    }, 0);

  // ── Pipeline board helpers ────────────────────────────────────────────────────
  const money0 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  const dateOnly = (d: string) => new Date(d.includes("T") ? d : `${d}T00:00:00`);
  const daysInStage = (c: any): number | null => {
    const iso = stageSince[c.id] ?? c.created_at;
    if (!iso) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  };
  const daysLabel = (d: number | null) => (d === null ? "" : d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`);
  const clientEstimates = (clientId: string) => estimates.filter((e) => e.client_id === clientId && e.status !== "voided");
  const TAG_GRAY  = "bg-gray-100 text-gray-700 border-gray-200";
  const TAG_BLUE  = "bg-blue-100 text-blue-700 border-blue-200";
  const TAG_AMBER = "bg-amber-100 text-amber-800 border-amber-200";
  const TAG_GREEN = "bg-green-100 text-green-700 border-green-200";
  const TAG_RED   = "bg-red-100 text-red-700 border-red-200";
  // The one-line status on a card: what is happening with this lead right now
  const statusTag = (stage: string, c: any): { label: string; cls: string } => {
    if (stage === "Prospect") return { label: "Not scheduled", cls: TAG_GRAY };
    if (stage === "Scheduled") {
      if (!c.appointment_date) return { label: "Appointment set", cls: TAG_BLUE };
      // appointments are timestamptz; show them in the business's time zone so the tag reads the same on any laptop
      const d = dateOnly(c.appointment_date);
      const tz = "America/Chicago";
      const hasTime = c.appointment_date.includes("T");
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(hasTime ? { timeZone: tz } : {}) });
      const time = hasTime ? ` · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}` : "";
      return { label: `${label}${time}`, cls: TAG_BLUE };
    }
    if (stage === "Selling") {
      const est: any = pickJobEstimate(clientEstimates(c.id));
      if (!est) return { label: "No proposal yet", cls: TAG_GRAY };
      if (est.status === "accepted") return { label: "Proposal accepted", cls: TAG_GREEN };
      if (est.status === "opened") return { label: "Proposal viewed", cls: TAG_AMBER };
      if (est.status === "sent") return { label: "Proposal sent", cls: TAG_AMBER };
      return { label: "Proposal draft", cls: TAG_GRAY };
    }
    if (stage === "Sold") {
      if (c.docusign_status === "completed") return { label: "DocuSigned", cls: TAG_GREEN };
      if (c.docusign_status === "sent_to_client") return { label: "Contract sent", cls: TAG_AMBER };
      if (c.docusign_status === "preparing") return { label: "Contract preparing", cls: TAG_AMBER };
      return { label: "Contract pending", cls: TAG_GRAY };
    }
    if (stage === "Active") {
      return c.project_start_date
        ? { label: `Started ${dateOnly(c.project_start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, cls: TAG_GREEN }
        : { label: "In progress", cls: TAG_GREEN };
    }
    return { label: "Completed", cls: TAG_GRAY };
  };
  // Pre-contract stages show the proposal total, sold / active / completed show the job total
  const cardAmount = (stage: string, c: any) => (["Sold", "Active", "Completed"].includes(stage) ? (c.project_total ?? 0) : (c.proposal_forecast ?? 0));
  const cardSubtitle = (c: any) => {
    const est: any = pickJobEstimate(clientEstimates(c.id));
    return est?.title || c.company || [c.city, c.state].filter(Boolean).join(", ") || "";
  };
  const quickStage = quickView ? (quickView.status ?? "").charAt(0).toUpperCase() + (quickView.status ?? "").slice(1) : "";

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <div className="h-7 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-80 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <SkeletonCards count={4} />
        <SkeletonTable rows={6} cols={5} />
        <PageLoader title="Loading pipeline & forecast…" description="Calculating deal stages, weighted revenue & commission forecasts" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 -mt-4">
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
            <p className="text-xs text-muted-foreground mt-1">
              Prospect 0% · Scheduled 0% · Selling ind.% · Sold 100% · Active 100%
            </p>
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
            <div className="text-2xl font-bold">{formatCurrency(prospectValue + scheduledValue + sellingValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Best-case pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Contracted Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{formatCurrency(soldValue + activeValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Locked-in contracts</p>
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

      {/* Pipeline board — every stage lists its clients; click a card for the quick view */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[
          { label: "Prospect",  color: "bg-blue-500",    list: prospectClients,  value: prospectValue  },
          { label: "Scheduled", color: "bg-indigo-500",  list: scheduledClients, value: scheduledValue },
          { label: "Selling",   color: "bg-sky-500",     list: sellingClients,   value: sellingValue   },
          { label: "Sold",      color: "bg-orange-500",  list: soldClients,      value: soldValue      },
          { label: "Active",    color: "bg-green-500",   list: activeClients,    value: activeValue    },
          { label: "Completed", color: "bg-purple-500",  list: completedClients, value: completedValue },
        ].map(({ label, color, list, value }) => (
          <Card key={label} className="flex flex-col min-w-0 overflow-hidden">
            <CardHeader className={`${color} text-white px-4 py-3 rounded-t-lg`}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                <Badge variant="secondary" className="bg-white text-gray-900 text-xs h-5 px-1.5">
                  {list.length}
                </Badge>
              </div>
              <div className="text-lg font-bold mt-0.5">{formatCurrency(value)}</div>
            </CardHeader>
            <CardContent className="p-3">
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-2">No clients here yet</p>
              ) : (
                <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                  {list.map((c) => {
                    const tag = statusTag(label, c);
                    const amount = cardAmount(label, c);
                    const days = daysLabel(daysInStage(c));
                    const subtitle = cardSubtitle(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setQuickView(c)}
                        className="w-full min-w-0 text-left rounded-lg border bg-card p-3 hover:border-primary/40 hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 break-words text-sm font-medium leading-snug">{clientDisplayName(c)}</span>
                          {amount > 0 && <span className="shrink-0 text-sm font-semibold">{money0(amount)}</span>}
                        </div>
                        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap gap-1">
                            {c.lead_source?.name && (
                              <Badge variant="outline" className="max-w-full truncate bg-muted/50 text-muted-foreground">{c.lead_source.name}</Badge>
                            )}
                            <Badge variant="outline" className={`max-w-full truncate ${tag.cls}`}>{tag.label}</Badge>
                          </div>
                          {days && <span className="shrink-0 text-xs text-muted-foreground">{days}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick view — open the full client page, or jump straight to a proposal */}
      <Dialog open={!!quickView} onOpenChange={(open) => { if (!open) setQuickView(null); }}>
        <DialogContent className="sm:max-w-xl">
          {quickView && (() => {
            const recipients = clientRecipientEmails(quickView);
            const proposals = clientEstimates(quickView.id);
            const days = daysLabel(daysInStage(quickView));
            const address = [quickView.address, [quickView.city, quickView.state].filter(Boolean).join(", "), quickView.zip].filter(Boolean).join(" · ");
            return (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <div className="min-w-0">
                      <DialogTitle className="break-words">{clientDisplayName(quickView)}</DialogTitle>
                      <DialogDescription className="mt-1">
                        {[quickStage, days && `${days} in stage`, quickView.lead_source?.name && `Lead source: ${quickView.lead_source.name}`].filter(Boolean).join(" · ")}
                      </DialogDescription>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link to={`/clients/${quickView.id}`} onClick={() => setQuickView(null)}>
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Open client page
                      </Link>
                    </Button>
                  </div>
                </DialogHeader>
                <DialogBody className="space-y-5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Phone</dt>
                      <dd className="break-words">{quickView.phone || "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="break-all">{recipients.length ? recipients.join(", ") : "—"}</dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Address</dt>
                      <dd className="break-words">{address || "—"}</dd>
                    </div>
                  </dl>

                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Proposals</p>
                    {proposals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No proposals yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {proposals.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">{p.title || "Proposal"}</p>
                              <p className="text-xs text-muted-foreground">
                                {money0(p.total ?? 0)} · {String(p.status ?? "").charAt(0).toUpperCase() + String(p.status ?? "").slice(1)}
                                {p.sent_at ? ` · ${new Date(p.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {["sent", "opened", "accepted", "declined"].includes(p.status) && (
                                <Button asChild variant="outline" size="sm">
                                  <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">View</a>
                                </Button>
                              )}
                              <Button asChild variant="outline" size="sm">
                                <Link to={`/proposals/${p.id}`} onClick={() => setQuickView(null)}>Edit proposal</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button asChild variant="outline" size="sm" className="mt-3">
                      <Link to={`/clients/${quickView.id}/create-proposal`} onClick={() => setQuickView(null)}>New proposal</Link>
                    </Button>
                  </div>
                </DialogBody>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Company Stats, Commissions, Tasks, Activity - 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              <Link to="/financials" className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors no-underline">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Revenue</span>
                </div>
                <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
              </Link>

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

              <Link to="/team" className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors no-underline">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Team Members</span>
                </div>
                <span className="font-semibold">{totalTeamMembers}</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Generating Commissions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Generating Commissions</CardTitle>
              </div>
              <Link to="/payroll" className="text-xs text-primary hover:opacity-80 font-medium no-underline">
                View All →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Pending Commissions</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(pendingCommissions)}</div>
                <div className="text-xs text-muted-foreground mt-1">From sold &amp; active projects</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium mb-2">Top Earners</div>
                {salesReps
                  .map((rep) => {
                    const repProjects = projects.filter(
                      (p) => p.sales_rep_id === rep.id && ["sold", "active"].includes(p.status)
                    );
                    const commission = repProjects.reduce((s, p) => s + (p.sales_rep_id === rep.id ? (p.status === "completed" ? (p.grossProfit || 0) * ((p.salesRepCommissionRate || 0) / 100) : (p.salesRepCommission || 0)) : 0), 0);
                    return { ...rep, commission };
                  })
                  .sort((a, b) => b.commission - a.commission)
                  .slice(0, 3)
                  .map((rep, idx) => (
                    <div key={rep.id} className="flex items-center justify-between p-2 bg-accent/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          'bg-orange-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <span>{`${rep.first_name ?? ""} ${rep.last_name ?? ""}`.trim() || rep.email}</span>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(rep.commission)}</span>
                    </div>
                  ))}
                {salesReps.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Award className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">No sales reps yet</p>
                    <p className="text-xs mt-1 text-muted-foreground">Assign sales reps to clients to track commissions.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Tasks</CardTitle>
              </div>
              <Badge variant="secondary">{prospectClients.length + scheduledClients.length + sellingClients.length + soldClients.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {prospectClients.map((client) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="block p-3 border rounded-lg hover:bg-accent transition-colors no-underline"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Follow Up</Badge>
                        <span className="text-sm font-medium">{clientDisplayName(client)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        No appointment booked — schedule a visit to advance
                      </p>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {scheduledClients
                .filter((c) => c.appointment_date && new Date(c.appointment_date + "T00:00:00") < new Date())
                .map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 border rounded-lg hover:bg-accent transition-colors no-underline"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Follow Up</Badge>
                          <span className="text-sm font-medium">{clientDisplayName(client)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Appointment passed — move to Selling or discard
                        </p>
                      </div>
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </div>
                  </Link>
                ))}

              {sellingClients.map((client) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="block p-3 border rounded-lg hover:bg-accent transition-colors no-underline"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Selling</Badge>
                        <span className="text-sm font-medium">{clientDisplayName(client)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {!proposalClientIds.has(client.id)
                          ? "No proposal yet — create and send proposal"
                          : client.closing_probability > 0
                            ? `${client.closing_probability}% probability — follow up to close`
                            : "Proposal sent — set closing probability"}
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {soldClients.map((client) => {
                const clientProject = projects.find((p) => p.clientId === client.id || p.client_id === client.id);
                const pmAssigned = !!clientProject?.projectManagerId || !!clientProject?.project_manager_id;
                const pm = pmAssigned ? users.find((u) => u.id === (clientProject?.projectManagerId ?? clientProject?.project_manager_id)) : null;
                return (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block p-3 border rounded-lg hover:bg-accent transition-colors no-underline"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-orange-50">Closing</Badge>
                          <span className="text-sm font-medium">{clientDisplayName(client)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pmAssigned
                            ? `PM: ${pm ? `${pm.first_name ?? ""} ${pm.last_name ?? ""}`.trim() : "Assigned"} — schedule kickoff`
                            : "Assign PM and schedule kickoff"}
                        </p>
                      </div>
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </div>
                  </Link>
                );
              })}

              {prospectClients.length === 0 && scheduledClients.filter((c) => c.appointment_date && new Date(c.appointment_date + "T00:00:00") < new Date()).length === 0 && sellingClients.length === 0 && soldClients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8">
                  <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No pending tasks</p>
                  <p className="text-xs mt-1 text-muted-foreground">Tasks appear when clients need follow-up action.</p>
                </div>
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
            <div className="space-y-4 max-h-[300px] overflow-y-auto">

              {/* New clients this week */}
              {(() => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const newThisWeek = clients
                  .filter((c) => c.created_at && new Date(c.created_at) >= weekAgo)
                  .slice(0, 3);
                return newThisWeek.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">New This Week</div>
                    {newThisWeek.map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}`}
                        className="flex items-center gap-2 text-xs p-2 bg-accent/50 rounded hover:bg-accent transition-colors no-underline"
                      >
                        <Users className="h-3 w-3 text-blue-600 flex-shrink-0" />
                        <span className="font-medium">{clientDisplayName(client)}</span>
                        <span className="text-muted-foreground ml-auto">
                          {new Date(client.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Upcoming appointments */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const upcoming = clients
                  .filter((c) => c.appointment_scheduled && c.appointment_date && new Date(c.appointment_date + "T00:00:00") >= today)
                  .sort((a, b) => new Date(a.appointment_date + "T00:00:00").getTime() - new Date(b.appointment_date + "T00:00:00").getTime())
                  .slice(0, 3);
                return upcoming.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">Upcoming Appointments</div>
                    {upcoming.map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.id}`}
                        className="flex items-center gap-2 text-xs p-2 bg-orange-50 border border-orange-100 rounded hover:bg-orange-100 transition-colors no-underline"
                      >
                        <Calendar className="h-3 w-3 text-orange-600 flex-shrink-0" />
                        <span className="font-medium">{clientDisplayName(client)}</span>
                        <span className="text-muted-foreground ml-auto">
                          {new Date(client.appointment_date.includes("T") ? client.appointment_date : `${client.appointment_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Recently gone active */}
              {activeClients.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Active Clients</div>
                  {activeClients.slice(0, 3).map((client) => (
                    <Link
                      key={client.id}
                      to={`/clients/${client.id}`}
                      className="flex items-center gap-2 text-xs p-2 bg-green-50 border border-green-100 rounded hover:bg-green-100 transition-colors no-underline"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span className="font-medium">{clientDisplayName(client)}</span>
                      {client.project_total > 0 && (
                        <span className="text-green-600 font-semibold ml-auto">
                          {formatCurrency(client.project_total)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {clients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Activity className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No recent activity</p>
                  <p className="text-xs mt-1 text-muted-foreground">Client updates will appear here as they progress.</p>
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
