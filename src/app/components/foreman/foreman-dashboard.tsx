import { useState, useEffect } from "react";
import { Link } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../../contexts/auth-context";
import {
  Loader2, Search, ChevronRight, HardHat,
  Briefcase, DollarSign, Clock, CheckCircle2, MapPin, Calendar,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v || 0);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700 border-green-200",
  sold:      "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
};

export function ForemanDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"jobs" | "payments">("jobs");
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.profile?.id) return;
    loadAll();
  }, [user?.profile?.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadJobs(), loadPayments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    const { data } = await supabase
      .from("field_installation_orders")
      .select(`
        id, status, work_date, notes, created_at,
        items:field_installation_order_items(id, quantity, labor_cost_per_unit),
        payments:fio_crew_payments(amount_paid),
        project:projects(id, name, status, client:clients(id, first_name, last_name, address, city, state))
      `)
      .eq("foreman_id", user!.profile!.id)
      .order("created_at", { ascending: false });

    const enriched = (data ?? []).map((fio: any) => {
      const totalLabor = (fio.items ?? []).reduce(
        (s: number, it: any) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0
      );
      const totalPaid = (fio.payments ?? []).reduce(
        (s: number, p: any) => s + (parseFloat(p.amount_paid) || 0), 0
      );
      return { ...fio, totalLabor, totalPaid };
    });
    setJobs(enriched);
  };

  const loadPayments = async () => {
    const { data: fios } = await supabase
      .from("field_installation_orders")
      .select("id, project:projects(id, name, client:clients(first_name, last_name))")
      .eq("foreman_id", user!.profile!.id);

    if (!fios || fios.length === 0) { setPayments([]); return; }

    const fioIds = fios.map((f: any) => f.id);
    const fioMap: Record<string, any> = {};
    fios.forEach((f: any) => { fioMap[f.id] = f; });

    const { data: pays } = await supabase
      .from("fio_crew_payments")
      .select("*")
      .in("fio_id", fioIds)
      .order("week_ending_date", { ascending: false })
      .order("created_at", { ascending: false });

    setPayments((pays ?? []).map((p: any) => ({ ...p, fio: fioMap[p.fio_id] })));
  };

  // Summary stats
  const totalJobs    = jobs.length;
  const activeJobs   = jobs.filter((j) => j.project?.status === "active").length;
  const totalEarned  = payments.reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0);
  const totalLabor   = jobs.reduce((s, j) => s + j.totalLabor, 0);
  const totalPending = Math.max(0, totalLabor - totalEarned);

  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    const client = j.project?.client;
    const name = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
    return (
      (j.project?.name ?? "").toLowerCase().includes(q) ||
      name.toLowerCase().includes(q)
    );
  });

  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    const fio = p.fio;
    const client = fio?.project?.client;
    const name = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
    return (
      (fio?.project?.name ?? "").toLowerCase().includes(q) ||
      name.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 h-20 animate-pulse bg-muted/30 rounded" /></Card>
          ))}
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Portal</h1>
        <p className="text-muted-foreground text-sm mt-1">Your assigned jobs and payment history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Jobs</p>
                <p className="text-xl font-bold">{totalJobs}</p>
              </div>
              <Briefcase className="h-7 w-7 text-muted-foreground opacity-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Jobs</p>
                <p className="text-xl font-bold text-green-600">{activeJobs}</p>
              </div>
              <HardHat className="h-7 w-7 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pending Pay</p>
                <p className="text-xl font-bold text-yellow-600">{fmt(totalPending)}</p>
              </div>
              <Clock className="h-7 w-7 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-xl font-bold text-blue-600">{fmt(totalEarned)}</p>
              </div>
              <DollarSign className="h-7 w-7 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {[
            { key: "jobs", label: "My Jobs" },
            { key: "payments", label: "My Payments" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as any); setSearch(""); }}
              className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={activeTab === "jobs" ? "Search jobs…" : "Search payments…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── MY JOBS TAB ── */}
      {activeTab === "jobs" && (
        <div className="space-y-3">
          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="py-14 flex flex-col items-center justify-center text-muted-foreground">
                <HardHat className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {jobs.length === 0 ? "No jobs assigned yet" : "No results match your search"}
                </p>
                <p className="text-xs mt-1">
                  {jobs.length === 0 ? "Your assigned jobs will appear here." : "Try a different search term."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredJobs.map((job) => {
              const client = job.project?.client;
              const clientName = client
                ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                : "—";
              const address = client?.address
                ? `${client.address}${client.city ? `, ${client.city}` : ""}${client.state ? ` ${client.state}` : ""}`
                : null;
              const projectStatus = job.project?.status ?? "active";
              const pending = Math.max(0, job.totalLabor - job.totalPaid);

              return (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <p className="font-semibold text-base truncate">
                            {job.project?.name ?? clientName}
                          </p>
                          <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[projectStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {projectStatus.charAt(0).toUpperCase() + projectStatus.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{clientName}</p>
                        {address && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{address}</span>
                          </div>
                        )}
                        {job.work_date && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>Work date: {fmtDate(job.work_date)}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Total Labor</p>
                            <p className="font-bold">{fmt(job.totalLabor)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Paid</p>
                            <p className="font-bold text-green-600">{fmt(job.totalPaid)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Pending</p>
                            <p className={`font-bold ${pending > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                              {fmt(pending)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/foreman/jobs/${job.id}`}
                        className="flex items-center gap-1 text-sm text-primary hover:opacity-80 shrink-0 font-medium no-underline"
                      >
                        View Details <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── MY PAYMENTS TAB ── */}
      {activeTab === "payments" && (
        <div className="space-y-3">
          {filteredPayments.length === 0 ? (
            <Card>
              <CardContent className="py-14 flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {payments.length === 0 ? "No payments recorded yet" : "No results match your search"}
                </p>
                <p className="text-xs mt-1">
                  {payments.length === 0 ? "Payments will appear here once your PM records them." : "Try a different search term."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 px-0">
                <div className="divide-y">
                  {filteredPayments.map((p) => {
                    const fio = p.fio;
                    const client = fio?.project?.client;
                    const clientName = client
                      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                      : "—";
                    const jobName = fio?.project?.name ?? clientName;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-accent/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{jobName}</p>
                            <p className="text-xs text-muted-foreground">
                              Week ending {p.week_ending_date ? fmtDate(p.week_ending_date) : "—"}
                              {p.completion_pct != null ? ` · ${p.completion_pct}% complete` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-green-600">
                            {fmt(parseFloat(p.amount_paid) || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 pt-3 border-t mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}{search ? ` of ${payments.length}` : ""}</span>
                  <span>Total: <strong>{fmt(filteredPayments.reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0))}</strong></span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
