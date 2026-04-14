import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link } from "react-router";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import { clientsAPI, projectsAPI, usersAPI } from "../utils/api";
import { PageLoader, SkeletonCards, SkeletonTable } from "./ui/page-loader";

const clientDisplayName = (c: any) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "—";

export function PipelineForecast() {
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<{ label: string; color: string; list: any[] } | null>(null);

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
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchData, ["clients", "projects"], "pipeline-forecast");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Bucket by pipeline_stage.name (source of truth — not clients.status)
  const stageName = (c: any) => c.pipeline_stage?.name?.toLowerCase() ?? "";
  const prospectClients  = clients.filter((c) => ["new", "pursuing"].includes(stageName(c)));
  const soldClients      = clients.filter((c) => stageName(c) === "closing");
  const activeClients    = clients.filter((c) => stageName(c) === "active");
  const completedClients = clients.filter((c) => stageName(c) === "completed");

  // Revenue per bucket — project_total computed by clientsAPI.getAll()
  const prospectValue  = prospectClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);
  const soldValue      = soldClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);
  const activeValue    = activeClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);
  const completedValue = completedClients.reduce((sum, c) => sum + (c.project_total ?? 0), 0);

  // Weighted forecast (65% probability for prospects)
  const weightedForecast = prospectClients.reduce((sum, c) => {
    return sum + ((c.project_total ?? 0) * 0.65);
  }, 0);

  // Company Stats — from projects (camelCased by mapProject)
  const totalRevenue    = projects.reduce((sum, p) => sum + (p.totalValue ?? 0), 0);
  const totalProjects   = projects.length;
  const activeProjects  = projects.filter((p) => p.status === "active").length;
  const totalTeamMembers = users.length;

  // Commission Calculations — from projects
  const salesReps = users.filter((u) => u.role === "sales_rep");

  const pendingCommissions = projects
    .filter((p) => ["sold", "active"].includes(p.status))
    .reduce((sum, p) => sum + (p.commission ?? 0), 0);

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
            <p className="text-xs text-muted-foreground mt-1">Closing + Active</p>
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

      {/* Pipeline Stages in Columns — click to open client list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: "Prospect",  color: "bg-blue-500",   list: prospectClients,  value: prospectValue  },
          { label: "Sold",      color: "bg-orange-500", list: soldClients,      value: soldValue      },
          { label: "Active",    color: "bg-green-500",  list: activeClients,    value: activeValue    },
          { label: "Completed", color: "bg-purple-500", list: completedClients, value: completedValue },
        ].map(({ label, color, list, value }) => (
          <Card
            key={label}
            className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedStage({ label, color, list })}
          >
            <CardHeader className={`${color} text-white pb-3 rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{label}</CardTitle>
                <Badge variant="secondary" className="bg-white text-gray-900">
                  {list.length}
                </Badge>
              </div>
              <div className="text-xl font-bold mt-1">{formatCurrency(value)}</div>
            </CardHeader>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">
                {list.length === 0
                  ? "No clients here yet"
                  : `${list.length} client${list.length !== 1 ? "s" : ""} — click to view`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client list modal */}
      <Dialog open={!!selectedStage} onOpenChange={() => setSelectedStage(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedStage?.label} Clients</span>
              <Badge variant="secondary">{selectedStage?.list.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="divide-y px-0 py-0">
            {selectedStage?.list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Users className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No clients in this stage</p>
                <p className="text-xs mt-1 text-muted-foreground">Move clients here from the pipeline to track them.</p>
              </div>
            ) : (
              selectedStage?.list.map((client) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  onClick={() => setSelectedStage(null)}
                  className="flex items-center justify-between p-3 hover:bg-accent transition-colors group no-underline"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{clientDisplayName(client)}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary flex-shrink-0" />
                    </div>
                    {client.company && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.company}</p>
                    )}
                  </div>
                  {client.project_total > 0 && (
                    <span className="text-sm font-semibold text-green-600 ml-3 flex-shrink-0">
                      {formatCurrency(client.project_total)}
                    </span>
                  )}
                </Link>
              ))
            )}
          </DialogBody>
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
                {salesReps.slice(0, 3).map((rep, idx) => {
                  const repProjects = projects.filter(
                    (p) => p.sales_rep_id === rep.id && ["sold", "active"].includes(p.status)
                  );
                  const commission = repProjects.reduce((s, p) => s + (p.commission ?? 0), 0);
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
                        <span>{`${rep.first_name ?? ""} ${rep.last_name ?? ""}`.trim() || rep.email}</span>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(commission)}</span>
                    </div>
                  );
                })}
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
              <Badge variant="secondary">{prospectClients.length + soldClients.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {prospectClients.slice(0, 3).map((client) => (
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
                      <p className="text-xs text-muted-foreground mt-1">Send proposal and schedule meeting</p>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {soldClients.slice(0, 2).map((client) => (
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
                      <p className="text-xs text-muted-foreground mt-1">Assign PM and schedule kickoff</p>
                    </div>
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Link>
              ))}

              {prospectClients.length === 0 && soldClients.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8">
                  <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No pending tasks</p>
                  <p className="text-xs mt-1 text-muted-foreground">Tasks appear when clients are in prospect or sold stages.</p>
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
            <div className="space-y-4">

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
                  .filter((c) => c.appointment_scheduled && c.appointment_date && new Date(c.appointment_date) >= today)
                  .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
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
                          {new Date(client.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
