/**
 * Crew (Foreman) Detail Page
 * Shows all FIOs assigned to a specific foreman with approve/mark-paid actions.
 * Route: /payroll/crew/:id  (id = foreman's profile id)
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ArrowLeft, Loader2, CheckCircle2, Clock, Wrench, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fioAPI } from "../utils/api";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

type FIOFilter = "all" | "pending" | "approved" | "paid";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

export function PayrollCrewDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [foreman, setForeman] = useState<any>(null);
  const [fios, setFios] = useState<any[]>([]);
  const [filter, setFilter] = useState<FIOFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, email")
        .eq("id", id!)
        .single();
      setForeman(profile);

      const { data, error } = await supabase
        .from("field_installation_orders")
        .select(`
          id, status, work_date, notes, created_at, approved_date, paid_date,
          project:projects(id, name, client:clients(first_name, last_name)),
          items:field_installation_order_items(id, product_name, unit, quantity, labor_cost_per_unit, notes),
          payments:fio_crew_payments(id, amount_paid, week_ending_date, completion_pct, notes)
        `)
        .eq("foreman_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const mapped = (data ?? []).map((fio: any) => {
        const totalLabor = (fio.items || []).reduce(
          (s: number, it: any) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0
        );
        const totalPaid = (fio.payments || []).reduce((s: number, p: any) => s + (parseFloat(p.amount_paid) || 0), 0);
        return { ...fio, totalLabor, totalPaid, remaining: Math.max(0, totalLabor - totalPaid) };
      });
      setFios(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (fioId: string) => {
    setActionLoading(fioId + "_approve");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await fioAPI.update(fioId, {
        status: "approved",
        approved_by: user?.id,
        approved_date: new Date().toISOString().split("T")[0],
      });
      setFios(prev => prev.map(f => f.id === fioId ? { ...f, status: "approved" } : f));
      toast.success("FIO approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (fioId: string) => {
    setActionLoading(fioId + "_paid");
    try {
      await fioAPI.update(fioId, {
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0],
      });
      setFios(prev => prev.map(f => f.id === fioId ? { ...f, status: "paid" } : f));
      toast.success("FIO marked as paid");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!foreman) {
    return (
      <div className="p-6">
        <Link to="/payroll" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <p className="text-center text-muted-foreground py-12">Foreman not found.</p>
      </div>
    );
  }

  const name = `${foreman.first_name ?? ""} ${foreman.last_name ?? ""}`.trim() || "—";
  const totalLabor = fios.reduce((s, f) => s + f.totalLabor, 0);
  const totalPaid = fios.reduce((s, f) => s + f.totalPaid, 0);
  const totalRemaining = fios.reduce((s, f) => s + f.remaining, 0);

  const filteredFIOs = filter === "all" ? fios : fios.filter(f => f.status === filter);

  const filterCounts: Record<FIOFilter, number> = {
    all: fios.length,
    pending: fios.filter(f => f.status === "pending").length,
    approved: fios.filter(f => f.status === "approved").length,
    paid: fios.filter(f => f.status === "paid").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back + Header */}
      <div>
        <Link to="/payroll" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{name}</h1>
          <Badge variant="outline">Foreman</Badge>
        </div>
        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
          {foreman.phone && <span>{foreman.phone}</span>}
          {foreman.email && <span>{foreman.email}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Labor</p>
                <p className="text-xl font-bold">{fmt(totalLabor)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fios.length} FIO{fios.length !== 1 ? "s" : ""}</p>
              </div>
              <Wrench className="h-7 w-7 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-600">{fmt(totalPaid)}</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className={`text-xl font-bold ${totalRemaining > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                  {fmt(totalRemaining)}
                </p>
              </div>
              <Clock className="h-7 w-7 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {(["all", "pending", "approved", "paid"] as FIOFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs text-muted-foreground">({filterCounts[f]})</span>
          </button>
        ))}
      </div>

      {/* FIO List */}
      {filteredFIOs.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center justify-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No {filter !== "all" ? filter : ""} FIOs found</p>
            <p className="text-xs mt-1">Field installation orders will appear here once created.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFIOs.map((fio) => {
            const clientName = fio.project?.client
              ? `${fio.project.client.first_name ?? ""} ${fio.project.client.last_name ?? ""}`.trim()
              : "—";
            const isApproving = actionLoading === fio.id + "_approve";
            const isMarkingPaid = actionLoading === fio.id + "_paid";

            return (
              <Card key={fio.id}>
                <CardContent className="pt-5">
                  {/* FIO Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{fio.project?.name ?? "—"}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[fio.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {fio.status.charAt(0).toUpperCase() + fio.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Client: {clientName}
                        {fio.work_date && ` · Work Date: ${new Date(fio.work_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fio.project?.id && (
                        <Link
                          to={`/projects/${fio.project.id}`}
                          className="text-xs text-primary hover:opacity-80 no-underline"
                        >
                          View Project →
                        </Link>
                      )}
                      {fio.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isApproving}
                          onClick={() => handleApprove(fio.id)}
                        >
                          {isApproving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Approve FIO
                        </Button>
                      )}
                      {fio.status === "approved" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          disabled={isMarkingPaid}
                          onClick={() => handleMarkPaid(fio.id)}
                        >
                          {isMarkingPaid ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Labor breakdown */}
                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Total Labor</p>
                      <p className="font-bold">{fmt(fio.totalLabor)}</p>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
                      <p className="font-bold text-green-600">{fmt(fio.totalPaid)}</p>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Remaining</p>
                      <p className={`font-bold ${fio.remaining > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                        {fmt(fio.remaining)}
                      </p>
                    </div>
                  </div>

                  {/* Line items */}
                  {fio.items && fio.items.length > 0 && (
                    <div className="border rounded-md overflow-hidden mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/40 border-b">
                            <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Item</th>
                            <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Qty</th>
                            <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Rate</th>
                            <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fio.items.map((item: any, i: number) => {
                            const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
                            return (
                              <tr key={item.id} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                                <td className="py-1.5 px-2">{item.product_name} {item.unit && <span className="text-muted-foreground">/ {item.unit}</span>}</td>
                                <td className="py-1.5 px-2 text-right">{item.quantity}</td>
                                <td className="py-1.5 px-2 text-right">${parseFloat(item.labor_cost_per_unit).toFixed(2)}</td>
                                <td className="py-1.5 px-2 text-right font-medium">{fmt(total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Payment history */}
                  {fio.payments && fio.payments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Payment History</p>
                      <div className="space-y-1">
                        {fio.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Week ending {new Date(p.week_ending_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {p.completion_pct != null && <> · {p.completion_pct}% complete</>}
                            </span>
                            <span className="font-semibold text-green-600">${parseFloat(p.amount_paid).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dates footer */}
                  {(fio.approved_date || fio.paid_date) && (
                    <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                      {fio.approved_date && <span>Approved: {fio.approved_date}</span>}
                      {fio.paid_date && <span>Paid: {fio.paid_date}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
