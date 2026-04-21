import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { DollarSign, TrendingUp, Users, Search, ChevronRight, Clock, History } from "lucide-react";
import { PageLoader, SkeletonCards, SkeletonPayrollRow } from "./ui/page-loader";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

export function Payroll() {
  const [activeTab, setActiveTab] = useState<"commissions" | "crews" | "history">("commissions");
  const [search, setSearch] = useState("");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // PM commissions: grouped by profile
  const [pmData, setPmData] = useState<any[]>([]);

  // FIO crew: grouped by foreman
  const [foremanData, setForemanData] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPMCommissions(), fetchCrewByForeman(), fetchHistory()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    // Processed commissions
    const { data: commissions } = await supabase
      .from("commission_payments")
      .select(`
        id, amount, status, processed_date, created_at,
        project:projects(id, name, client:clients(first_name, last_name, is_discarded)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name)
      `)
      .eq("status", "processed")
      .order("processed_date", { ascending: false })
      .limit(100);

    // Paid crew FIOs
    const { data: crewPayments } = await supabase
      .from("fio_crew_payments")
      .select(`
        id, amount_paid, paid_at, notes,
        fio:field_installation_orders(
          id,
          project:projects(id, name, client:clients(first_name, last_name, is_discarded)),
          foreman:profiles!field_installation_orders_foreman_id_fkey(id, first_name, last_name)
        )
      `)
      .order("paid_at", { ascending: false })
      .limit(100);

    const commissionEntries = (commissions ?? [])
      .filter((c: any) => !c.project?.client?.is_discarded)
      .map((c: any) => ({
        id: `cp-${c.id}`,
        type: "commission" as const,
        date: c.processed_date ?? c.created_at,
        amount: parseFloat(c.amount) || 0,
        projectName: c.project?.name ?? "—",
        clientName: c.project?.client
          ? `${c.project.client.first_name ?? ""} ${c.project.client.last_name ?? ""}`.trim()
          : "—",
        personName: c.profile
          ? `${c.profile.first_name ?? ""} ${c.profile.last_name ?? ""}`.trim()
          : "—",
        link: `/payroll/pm/${c.profile?.id}`,
      }));

    const crewEntries = (crewPayments ?? [])
      .filter((p: any) => !p.fio?.project?.client?.is_discarded)
      .map((p: any) => ({
        id: `crew-${p.id}`,
        type: "crew" as const,
        date: p.paid_at,
        amount: parseFloat(p.amount_paid) || 0,
        projectName: p.fio?.project?.name ?? "—",
        clientName: p.fio?.project?.client
          ? `${p.fio.project.client.first_name ?? ""} ${p.fio.project.client.last_name ?? ""}`.trim()
          : "—",
        personName: p.fio?.foreman
          ? `${p.fio.foreman.first_name ?? ""} ${p.fio.foreman.last_name ?? ""}`.trim()
          : "—",
        link: p.fio?.foreman?.id ? `/payroll/crew/${p.fio.foreman.id}` : null,
        notes: p.notes,
      }));

    const combined = [...commissionEntries, ...crewEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setHistoryData(combined);
  };

  const fetchPMCommissions = async () => {
    // Pull all commission_payments with profile + project info
    const { data, error } = await supabase
      .from("commission_payments")
      .select(`
        id, amount, status, created_at,
        project:projects(id, name, gross_profit, commission, client:clients(first_name, last_name, is_discarded)),
        profile:profiles!commission_payments_profile_id_fkey(id, first_name, last_name, commission_rate),
        progress_payment:project_payments!commission_payments_progress_payment_id_fkey(id, label, amount, percentage)
      `)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Group by profile
    const byPM: Record<string, any> = {};
    (data ?? []).filter((cp: any) => !cp.project?.client?.is_discarded).forEach((cp: any) => {
      const pmId = cp.profile?.id;
      if (!pmId) return;
      if (!byPM[pmId]) {
        byPM[pmId] = {
          ...cp.profile,
          installments: [],
          totalPending: 0,
          totalProcessed: 0,
        };
      }
      byPM[pmId].installments.push(cp);
      if (cp.status === "pending") byPM[pmId].totalPending += parseFloat(cp.amount) || 0;
      if (cp.status === "processed") byPM[pmId].totalProcessed += parseFloat(cp.amount) || 0;
    });

    // Also include PMs with no commission_payments yet (role=project_manager)
    const { data: pms } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, commission_rate")
      .eq("role", "project_manager")
      .eq("is_active", true);
    (pms ?? []).forEach((pm: any) => {
      if (!byPM[pm.id]) {
        byPM[pm.id] = { ...pm, installments: [], totalPending: 0, totalProcessed: 0 };
      }
    });

    setPmData(Object.values(byPM).sort((a: any, b: any) =>
      `${a.first_name}${a.last_name}`.localeCompare(`${b.first_name}${b.last_name}`)
    ));
  };

  const fetchCrewByForeman = async () => {
    const { data, error } = await supabase
      .from("field_installation_orders")
      .select(`
        id, status, work_date, created_at,
        project:projects(id, name, client:clients(first_name, last_name, is_discarded)),
        foreman:profiles!field_installation_orders_foreman_id_fkey(id, first_name, last_name, phone),
        items:field_installation_order_items(id, quantity, labor_cost_per_unit),
        payments:fio_crew_payments(amount_paid)
      `)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Group by foreman
    const byForeman: Record<string, any> = {};
    (data ?? []).filter((fio: any) => !fio.project?.client?.is_discarded).forEach((fio: any) => {
      const fId = fio.foreman?.id ?? "unassigned";
      if (!byForeman[fId]) {
        byForeman[fId] = {
          id: fId,
          foreman: fio.foreman,
          fios: [],
          totalLabor: 0,
          totalPaid: 0,
        };
      }
      const labor = (fio.items || []).reduce(
        (s: number, it: any) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0
      );
      const paid = (fio.payments || []).reduce((s: number, p: any) => s + (parseFloat(p.amount_paid) || 0), 0);
      byForeman[fId].fios.push({ ...fio, labor, paid });
      byForeman[fId].totalLabor += labor;
      byForeman[fId].totalPaid += paid;
    });

    setForemanData(Object.values(byForeman).sort((a: any, b: any) => {
      const na = a.foreman ? `${a.foreman.first_name}${a.foreman.last_name}` : "zzz";
      const nb = b.foreman ? `${b.foreman.first_name}${b.foreman.last_name}` : "zzz";
      return na.localeCompare(nb);
    }));
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefetch(fetchData, ["commission_payments", "field_installation_orders", "fio_crew_payments"], "payroll");

  // Summary totals from actual commission_payments data
  const totalPendingCommissions = pmData.reduce((s, pm) => s + pm.totalPending, 0);
  const totalProcessedCommissions = pmData.reduce((s, pm) => s + pm.totalProcessed, 0);
  const totalCrewPending = foremanData.reduce((s, f) => s + Math.max(0, f.totalLabor - f.totalPaid), 0);
  const totalCrewPaid = foremanData.reduce((s, f) => s + f.totalPaid, 0);

  const filteredPMs = pmData.filter((pm) =>
    `${pm.first_name} ${pm.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredForemen = foremanData.filter((f) => {
    if (!f.foreman) return "unassigned".includes(search.toLowerCase());
    return `${f.foreman.first_name} ${f.foreman.last_name}`.toLowerCase().includes(search.toLowerCase());
  });

  const filteredHistory = historyData.filter((e) => {
    const q = search.toLowerCase();
    return (
      (e.personName  || "").toLowerCase().includes(q) ||
      (e.clientName  || "").toLowerCase().includes(q) ||
      (e.projectName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Sticky: header + tabs together */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-6 px-6 pt-6 -mt-6">
        <div className="pb-3">
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">PM commissions and crew labor payments</p>
        </div>
        <div className="flex gap-6 border-b">
          {[
            { key: "commissions", label: "PM Commissions" },
            { key: "crews", label: "Crew Payments" },
            { key: "history", label: "Payroll History" },
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
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

      {loading && (
        <div className="space-y-6 pt-4">
          <SkeletonCards count={4} />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonPayrollRow key={i} />)}
          </div>
          <PageLoader title="Loading payroll data…" description="Fetching commissions, crew payments & payroll history" className="min-h-[6vh]" />
        </div>
      )}

      {!loading && (<>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pending Commissions</p>
                <p className="text-xl font-bold text-yellow-600">{fmt(totalPendingCommissions)}</p>
              </div>
              <Clock className="h-7 w-7 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Processed Commissions</p>
                <p className="text-xl font-bold text-green-600">{fmt(totalProcessedCommissions)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pending Crew Pay</p>
                <p className="text-xl font-bold text-yellow-600">{fmt(totalCrewPending)}</p>
              </div>
              <Users className="h-7 w-7 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Crew Paid</p>
                <p className="text-xl font-bold text-blue-600">{fmt(totalCrewPaid)}</p>
              </div>
              <DollarSign className="h-7 w-7 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search — sticks below the sticky header+tabs block */}
      <div className="sticky top-[132px] z-10 bg-background/95 backdrop-blur py-2 -mx-6 px-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "commissions" ? "Search PMs…"
              : activeTab === "crews" ? "Search foreman…"
              : "Search name, client, or project…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── PM COMMISSIONS TAB ── */}
      {activeTab === "commissions" && (
        <div className="space-y-3">
          {filteredPMs.length === 0 && (
            <Card>
              <CardContent className="py-14 flex flex-col items-center justify-center text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {pmData.length === 0 ? "No project managers found" : "No results match your search"}
                </p>
                <p className="text-xs mt-1">
                  {pmData.length === 0 ? "Assign the Project Manager role in Team settings." : "Try a different search term."}
                </p>
              </CardContent>
            </Card>
          )}

          {filteredPMs.map((pm) => {
            const name = `${pm.first_name ?? ""} ${pm.last_name ?? ""}`.trim() || "—";
            const pendingCount = pm.installments.filter((i: any) => i.status === "pending").length;
            return (
              <Card key={pm.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="font-semibold text-base">{name}</p>
                        {pm.commission_rate && (
                          <Badge variant="outline" className="text-xs">{pm.commission_rate}% rate</Badge>
                        )}
                        {pendingCount > 0 && (
                          <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
                            {pendingCount} pending
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Pending</p>
                          <p className="font-bold text-yellow-600">{fmt(pm.totalPending)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Processed</p>
                          <p className="font-bold text-green-600">{fmt(pm.totalProcessed)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Total Earned</p>
                          <p className="font-bold">{fmt(pm.totalPending + pm.totalProcessed)}</p>
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/payroll/pm/${pm.id}`}
                      className="flex items-center gap-1 text-sm text-primary hover:opacity-80 shrink-0 font-medium no-underline"
                    >
                      View Details <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── PAYROLL HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {historyData.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No payroll history yet</p>
                <p className="text-xs text-muted-foreground mt-1">Processed commissions and paid crew payments will appear here.</p>
              </CardContent>
            </Card>
          ) : filteredHistory.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No results match your search</p>
                <p className="text-xs text-muted-foreground mt-1">Try searching by name, client, or project.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 px-0">
                <div className="divide-y">
                  {filteredHistory.map((entry) => {
                    const inner = (
                      <div className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-accent/40 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            entry.type === "commission"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {entry.type === "commission" ? "PM" : "CR"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{entry.personName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.type === "commission" ? "Commission" : "Crew Pay"} · {entry.clientName} · {entry.projectName}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-green-600">{fmt(entry.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.date
                              ? new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </p>
                        </div>
                      </div>
                    );
                    return entry.link ? (
                      <Link key={entry.id} to={entry.link} className="block no-underline">{inner}</Link>
                    ) : (
                      <div key={entry.id}>{inner}</div>
                    );
                  })}
                </div>
                <div className="px-5 pt-3 border-t mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filteredHistory.length} payment{filteredHistory.length !== 1 ? "s" : ""}{search ? ` of ${historyData.length}` : ""}</span>
                  <span>Total paid: <strong>{fmt(filteredHistory.reduce((s, e) => s + e.amount, 0))}</strong></span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── CREW PAYMENTS TAB ── */}
      {activeTab === "crews" && (
        <div className="space-y-3">
          {filteredForemen.length === 0 && (
            <Card>
              <CardContent className="py-14 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">
                  {foremanData.length === 0 ? "No Field Installation Orders found" : "No results match your search"}
                </p>
                <p className="text-xs mt-1">
                  {foremanData.length === 0 ? "Create an FIO from a project detail page." : "Try a different search term."}
                </p>
              </CardContent>
            </Card>
          )}

          {filteredForemen.map((f) => {
            const name = f.foreman
              ? `${f.foreman.first_name ?? ""} ${f.foreman.last_name ?? ""}`.trim()
              : "No Foreman Assigned";
            const pending = Math.max(0, f.totalLabor - f.totalPaid);
            const fioCount = f.fios.length;
            const pendingFIOs = f.fios.filter((fio: any) => fio.status === "pending").length;
            const approvedFIOs = f.fios.filter((fio: any) => fio.status === "approved").length;

            return (
              <Card key={f.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="font-semibold text-base">{name}</p>
                        {f.foreman?.phone && (
                          <span className="text-xs text-muted-foreground">{f.foreman.phone}</span>
                        )}
                        <Badge variant="outline" className="text-xs">{fioCount} FIO{fioCount !== 1 ? "s" : ""}</Badge>
                        {pendingFIOs > 0 && (
                          <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">
                            {pendingFIOs} pending
                          </Badge>
                        )}
                        {approvedFIOs > 0 && (
                          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                            {approvedFIOs} approved
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Total Labor</p>
                          <p className="font-bold">{fmt(f.totalLabor)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Paid</p>
                          <p className="font-bold text-green-600">{fmt(f.totalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Remaining</p>
                          <p className={`font-bold ${pending > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                            {fmt(pending)}
                          </p>
                        </div>
                      </div>
                    </div>
                    {f.foreman && (
                      <Link
                        to={`/payroll/crew/${f.foreman.id}`}
                        className="flex items-center gap-1 text-sm text-primary hover:opacity-80 shrink-0 font-medium no-underline"
                      >
                        View Details <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      </>)}

    </div>
  );
}
