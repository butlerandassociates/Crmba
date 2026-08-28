import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserManagement } from "./user-management";
import { ForecastDashboard } from "./forecast-dashboard";
import { ProductManager } from "./product-manager";
import { PLReport } from "./pl-report";
import { PhaseTemplateEditor } from "./phase-template-editor";
import { DiscardReasonsSettings } from "./discard-reasons-settings";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Link } from "react-router";
import { FileText, List, Archive, Loader2, RotateCcw, FileBarChart2, Search, ChevronLeft, ChevronRight, ShieldCheck, Building2, GraduationCap, Activity } from "lucide-react";
import { Input } from "../ui/input";
import { supabase } from "@/lib/supabase";
import { activityLogAPI } from "../../utils/api";
import { toast } from "sonner";
import { SkeletonList } from "../ui/page-loader";

function DiscardedClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviving, setReviving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [discardedPage, setDiscardedPage] = useState(0);
  const DISCARDED_PAGE_SIZE = 10;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, address, city, state, zip, status, discarded_at, discarded_reason")
      .eq("is_discarded", true)
      .order("discarded_at", { ascending: false });
    if (error) toast.error("Failed to load discarded clients");
    else setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeRefetch(load, ["clients"], "admin-portal");

  const handleRevive = async (client: any) => {
    setReviving(client.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("clients")
        .update({ is_discarded: false, reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
        .eq("id", client.id);
      if (error) throw error;
      const revivedOnLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      activityLogAPI.create({ client_id: client.id, action_type: "status_changed", description: `Client revived on ${revivedOnLabel} — back in pipeline` }).catch(() => {});
      toast.success(`${client.first_name} ${client.last_name} revived and back in pipeline.`);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to revive client");
    } finally {
      setReviving(null);
    }
  };

  if (loading) return <SkeletonList rows={5} />;

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.address ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q) ||
      (c.state ?? "").toLowerCase().includes(q) ||
      (c.zip ?? "").toLowerCase().includes(q) ||
      (c.discarded_reason ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-0">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">Discarded Clients</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Clients removed from the pipeline. Revive them to bring them back to active status.</p>
          </div>
          {clients.length > 0 && (
            <div className="relative w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or address..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDiscardedPage(0); }}
                className="pl-9"
              />
            </div>
          )}
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Archive className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No discarded clients</p>
          <p className="text-xs mt-1">Clients you discard from the pipeline will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3 pt-4">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Archive className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No clients match your search</p>
            </div>
          )}
          <div className="space-y-2">
            {(() => {
              const totalPages = Math.ceil(filtered.length / DISCARDED_PAGE_SIZE);
              const pagedFiltered = filtered.slice(discardedPage * DISCARDED_PAGE_SIZE, (discardedPage + 1) * DISCARDED_PAGE_SIZE);
              return (<>
                {pagedFiltered.map((client) => (
                  <div key={client.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-card">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/clients/${client.id}`}
                          className="font-semibold text-sm hover:opacity-75 no-underline"
                        >
                          {client.first_name} {client.last_name}
                        </Link>
                        {client.status && (
                          <Badge variant="outline" className="text-xs capitalize">{client.status}</Badge>
                        )}
                      </div>
                      {client.email && <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>}
                      {client.discarded_reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{client.discarded_reason}"</p>
                      )}
                      {client.discarded_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Discarded {new Date(client.discarded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevive(client)}
                      disabled={reviving === client.id}
                      className="ml-4 shrink-0"
                    >
                      {reviving === client.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                      Revive
                    </Button>
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
                    <span>{discardedPage * DISCARDED_PAGE_SIZE + 1}–{Math.min((discardedPage + 1) * DISCARDED_PAGE_SIZE, filtered.length)} of {filtered.length} clients</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={discardedPage === 0} onClick={() => setDiscardedPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2">{discardedPage + 1} / {totalPages}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={discardedPage >= totalPages - 1} onClick={() => setDiscardedPage((p) => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>);
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  sales_rep: "Sales Rep",
  foreman: "Foreman",
  team_member: "Team Member",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  project_manager: "bg-amber-100 text-amber-700",
  sales_rep: "bg-green-100 text-green-700",
  foreman: "bg-orange-100 text-orange-700",
  team_member: "bg-gray-100 text-gray-700",
};

function parseDevice(ua: string | null): string {
  if (!ua) return "Unknown";
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
  const browser = ua.includes("Edg/") ? "Edge"
    : ua.includes("Chrome/") ? "Chrome"
    : ua.includes("Firefox/") ? "Firefox"
    : ua.includes("Safari/") ? "Safari"
    : "Browser";
  return `${mobile ? "Mobile" : "Desktop"} · ${browser}`;
}

function LoginLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("login_logs")
      .select("id, email, first_name, last_name, role, user_agent, ip_address, city, country, event_type, logged_in_at")
      .order("logged_in_at", { ascending: false });
    if (error) toast.error("Failed to load login logs");
    else setLogs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <SkeletonList rows={5} />;

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.event_type !== filter) return false;
    const q = search.toLowerCase();
    return (
      `${l.first_name ?? ""} ${l.last_name ?? ""}`.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.role ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-0">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">Login Logs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track when each user last signed in and from what device.</p>
          </div>
          {logs.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center rounded-md border overflow-hidden text-xs">
                {(["all", "success", "failed"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setPage(0); }}
                    className={`px-3 py-1.5 font-medium transition-colors capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                  >
                    {f === "all" ? "All" : f === "success" ? "✓ Success" : "✗ Failed"}
                  </button>
                ))}
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, role..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Activity className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No login activity yet</p>
          <p className="text-xs mt-1">Login events will appear here after users sign in.</p>
        </div>
      ) : (
        <div className="pt-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No results match your search</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">Status</th>
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">User</th>
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">Role</th>
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">Date & Time</th>
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">Device</th>
                    <th className="h-10 px-3 text-left font-medium text-foreground whitespace-nowrap">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50 border-b transition-colors last:border-0">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${log.event_type === "failed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {log.event_type === "failed" ? "Failed" : "Success"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-medium">{log.first_name || log.last_name ? `${log.first_name ?? ""} ${log.last_name ?? ""}`.trim() : "—"}</div>
                        <div className="text-xs text-muted-foreground">{log.email}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[log.role] ?? "bg-gray-100 text-gray-700"}`}>
                          {ROLE_LABELS[log.role] ?? log.role ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground">
                        {log.logged_in_at
                          ? new Date(log.logged_in_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {parseDevice(log.user_agent)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {log.city || log.country ? (
                          <div>
                            <div className="text-xs text-foreground">{[log.city, log.country].filter(Boolean).join(", ")}</div>
                            {log.ip_address && <div className="text-[11px] text-muted-foreground font-mono">{log.ip_address}</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{log.ip_address ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground mt-3">
              <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} logs</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">{page + 1} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminPortal() {
  return (
    <div className="p-4 space-y-0">
      <Tabs defaultValue="products" className="w-full">
        {/* Sticky block: title + quick links + tabs */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 -mt-4 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
            <div>
              <h1 className="text-2xl font-bold">Admin Portal</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage users, products, and forecasts</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/estimate-templates" className="flex items-center gap-1.5 no-underline">
                  <FileText className="h-4 w-4" />
                  Estimate Templates
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/list-management" className="flex items-center gap-1.5 no-underline">
                  <List className="h-4 w-4" />
                  List Management
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/warranty" className="flex items-center gap-1.5 no-underline">
                  <ShieldCheck className="h-4 w-4" />
                  Warranty
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/suppliers" className="flex items-center gap-1.5 no-underline">
                  <Building2 className="h-4 w-4" />
                  Suppliers
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/onboarding" className="flex items-center gap-1.5 no-underline">
                  <GraduationCap className="h-4 w-4" />
                  Onboarding
                </Link>
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="grid w-full grid-cols-8 max-w-5xl min-w-[900px]">
            <TabsTrigger value="products">Products & Pricing</TabsTrigger>
            <TabsTrigger value="forecast">Forecasting</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="phases">Phase Templates</TabsTrigger>
            <TabsTrigger value="reports">
              <FileBarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="discard-reasons">
              <List className="h-3.5 w-3.5 mr-1.5" />
              Discard Reasons
            </TabsTrigger>
            <TabsTrigger value="discarded">
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Discarded
            </TabsTrigger>
            <TabsTrigger value="login-logs">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Login Logs
            </TabsTrigger>
          </TabsList>
          </div>
        </div>

        <TabsContent value="products" className="mt-0">
          <ProductManager />
        </TabsContent>

        <TabsContent value="forecast" className="mt-0">
          <ForecastDashboard />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UserManagement />
        </TabsContent>

        <TabsContent value="phases" className="mt-0">
          <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b mb-4">
            <h2 className="font-semibold text-base">Phase Templates</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage phases and tasks for each job type. Used when loading a template into a project timeline.</p>
          </div>
          <PhaseTemplateEditor />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b mb-4">
            <h2 className="font-semibold text-base">Reports</h2>
            <p className="text-sm text-muted-foreground mt-0.5">View profit & loss breakdowns and project-level financial summaries.</p>
          </div>
          <PLReport />
        </TabsContent>

        <TabsContent value="discard-reasons" className="mt-0">
          <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b mb-4">
            <h2 className="font-semibold text-base">Discard Reasons</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage the reasons available when discarding a client. Changes take effect immediately.</p>
          </div>
          <DiscardReasonsSettings />
        </TabsContent>

        <TabsContent value="discarded" className="mt-0">
          <DiscardedClients />
        </TabsContent>

        <TabsContent value="login-logs" className="mt-0">
          <LoginLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}