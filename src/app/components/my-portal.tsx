import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../contexts/auth-context";
import { usePermissions } from "../hooks/usePermissions";
import { useViewAs } from "../contexts/view-as-context";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Loader2, Search, Briefcase, CheckCircle2, Clock, Award, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/app/utils/format";

const STAGE_COLORS: Record<string, string> = {
  prospect:  "bg-blue-100 text-blue-700 border-blue-200",
  scheduled: "bg-indigo-100 text-indigo-700 border-indigo-200",
  selling:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  sold:      "bg-orange-100 text-orange-700 border-orange-200",
  active:    "bg-green-100 text-green-700 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
};

const STAGE_LABELS: Record<string, string> = {
  prospect:  "Prospect",
  scheduled: "Scheduled",
  selling:   "Selling",
  sold:      "Sold",
  active:    "Active",
  completed: "Completed",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function MyPortal() {
  const { user } = useAuth();
  const { role } = usePermissions();
  const navigate = useNavigate();
  const { viewAsProfileId, viewAsProfileName, viewAsRole } = useViewAs();
  const profileId = viewAsProfileId || user?.profile?.id || null;
  const firstName = viewAsProfileName || user?.profile?.first_name || "";

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const effectiveRole = viewAsRole ?? role;
  const isPM = effectiveRole === "project_manager";
  const isSalesRep = effectiveRole === "sales_rep";

  useEffect(() => {
    if (!profileId) return;
    fetchJobs();
  }, [profileId, effectiveRole]);

  const PROJ_SELECT = `
    id, status, total_value, gross_profit, profit_margin,
    commission, commission_rate,
    sales_rep_commission, sales_rep_commission_rate,
    start_date, end_date, name
  `;

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let jobs: any[] = [];

      if (isPM) {
        const { data, error } = await supabase
          .from("projects")
          .select(`${PROJ_SELECT}, client:clients(id, first_name, last_name, email, phone, address, is_discarded)`)
          .eq("project_manager_id", profileId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        jobs = (data ?? []).filter((p: any) => p.client && !p.client.is_discarded);
      } else if (isSalesRep) {
        // Sales rep ID can live on clients.sales_rep_id OR projects.sales_rep_id.
        // Query both and merge to avoid showing empty when only the client has the rep set.
        const [{ data: clientRows, error: e1 }, { data: projRows, error: e2 }] = await Promise.all([
          supabase
            .from("clients")
            .select(`id, first_name, last_name, email, phone, address, is_discarded, projects(${PROJ_SELECT})`)
            .eq("sales_rep_id", profileId)
            .eq("is_discarded", false),
          supabase
            .from("projects")
            .select(`${PROJ_SELECT}, client:clients(id, first_name, last_name, email, phone, address, is_discarded)`)
            .eq("sales_rep_id", profileId),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const seen = new Set<string>();

        // Projects from clients where the client has this sales rep assigned
        for (const c of clientRows ?? []) {
          for (const p of (c as any).projects ?? []) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              jobs.push({
                ...p,
                client: { id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, address: c.address, is_discarded: c.is_discarded },
              });
            }
          }
        }

        // Projects directly tagged with this sales rep (dedup)
        for (const p of projRows ?? []) {
          if (!seen.has(p.id) && (p as any).client && !(p as any).client.is_discarded) {
            seen.add(p.id);
            jobs.push(p);
          }
        }
      }

      setJobs(jobs);
    } catch (err: any) {
      console.error("MyPortal fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalJobs      = jobs.length;
  const activeJobs     = jobs.filter((j) => j.status === "active").length;
  const completedJobs  = jobs.filter((j) => j.status === "completed").length;
  const totalCommission = jobs.reduce((sum, j) => {
    return sum + (isPM ? (j.commission ?? 0) : (j.sales_rep_commission ?? 0));
  }, 0);

  // Filter + search
  const visibleJobs = jobs.filter((j) => {
    const clientName = `${j.client?.first_name ?? ""} ${j.client?.last_name ?? ""}`.toLowerCase();
    const projectName = (j.name ?? "").toLowerCase();
    const proposalName = "";
    const email = (j.client?.email ?? "").toLowerCase();
    const phone = (j.client?.phone ?? "").toLowerCase();
    const address = (j.client?.address ?? "").toLowerCase();
    const term = search.toLowerCase();
    const matchSearch = !term || clientName.includes(term) || projectName.includes(term) || proposalName.includes(term) || email.includes(term) || phone.includes(term) || address.includes(term);
    const matchStage = stageFilter === "all" || j.status === stageFilter;
    return matchSearch && matchStage;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 -mt-4">
        <h1 className="text-2xl font-bold">My Portal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome, {firstName} — {isPM ? "Project Manager" : "Sales Rep"}
        </p>
      </div>


      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{totalJobs}</div>
            <p className="text-xs text-muted-foreground mt-0.5">all assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Jobs</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{activeJobs}</div>
            <p className="text-xs text-muted-foreground mt-0.5">in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{completedJobs}</div>
            <p className="text-xs text-muted-foreground mt-0.5">finished jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Commission</CardTitle>
            <Award className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold ${isPM ? "text-blue-600" : "text-purple-600"}`}>
              {formatCurrency(totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, address, project..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {!isPM && <SelectItem value="scheduled">Scheduled</SelectItem>}
            {!isPM && <SelectItem value="selling">Selling</SelectItem>}
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      {visibleJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold text-base">No jobs found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || stageFilter !== "all" ? "Try adjusting your search or filter." : "No jobs assigned to you yet."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Project / Proposal</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Stage</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">Contract Value</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">GP%</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">My Commission</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Start Date</th>
                <th className="p-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleJobs.map((job) => {
                const clientName = `${job.client?.first_name ?? ""} ${job.client?.last_name ?? ""}`.trim();
                const proposalTitle = job.name ?? "—";
                const commission = isPM ? (job.commission ?? 0) : (job.sales_rep_commission ?? 0);
                const gpPct = job.profit_margin != null ? Number(job.profit_margin).toFixed(1) + "%" : "—";

                return (
                  <tr
                    key={job.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${job.client?.id}`)}
                  >
                    <td className="p-3 font-medium">{clientName || "—"}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">{proposalTitle}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${STAGE_COLORS[job.status] ?? ""}`}>
                        {STAGE_LABELS[job.status] ?? job.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {job.total_value ? formatCurrency(job.total_value) : "—"}
                    </td>
                    <td className="p-3 text-right text-green-600 font-medium">{gpPct}</td>
                    <td className={`p-3 text-right font-semibold ${isPM ? "text-blue-600" : "text-purple-600"}`}>
                      {commission > 0 ? formatCurrency(commission) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{fmtDate(job.start_date)}</td>
                    <td className="p-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
