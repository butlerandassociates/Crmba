import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { supabase } from "@/lib/supabase";
import { fioAPI } from "../../api/field-installation-orders";
import { Loader2, ArrowLeft, MapPin, HardHat, Wrench, DollarSign, Calendar } from "lucide-react";
import { Badge } from "../ui/badge";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function ForemanJobDetail() {
  const { fioId } = useParams<{ fioId: string }>();
  const [fio, setFio] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fioId) return;
    loadData();
  }, [fioId]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("field_installation_orders")
        .select(`
          id,
          status,
          work_date,
          notes,
          created_at,
          items:field_installation_order_items(*),
          project:projects(
            id,
            name,
            status,
            client:clients(id, first_name, last_name, address, city, state)
          )
        `)
        .eq("id", fioId!)
        .single();

      if (error) throw error;
      setFio(data);

      const pays = await fioAPI.getCrewPayments(fioId!);
      setPayments(pays);
    } catch {
      setFio(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!fio) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted-foreground">
        Job not found.
      </div>
    );
  }

  const client = fio.project?.client;
  const clientName = client
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : "—";
  const address = client?.address
    ? `${client.address}${client.city ? `, ${client.city}` : ""}${client.state ? ` ${client.state}` : ""}`
    : null;

  const items: any[] = fio.items ?? [];
  const totalLabor = items.reduce(
    (s: number, it: any) =>
      s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0),
    0
  );

  // Group payments by week
  const paymentsByWeek = payments.reduce((acc: Record<string, any[]>, p) => {
    const week = p.week_ending_date ?? "Unknown";
    if (!acc[week]) acc[week] = [];
    acc[week].push(p);
    return acc;
  }, {});

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        to="/foreman"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Jobs
      </Link>

      {/* Header */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{fio.project?.name ?? clientName}</h1>
            <p className="text-muted-foreground text-sm">{clientName}</p>
          </div>
          <Badge className="shrink-0 text-xs">
            {(fio.project?.status ?? "active").charAt(0).toUpperCase() +
              (fio.project?.status ?? "active").slice(1)}
          </Badge>
        </div>
        {address && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{address}</span>
          </div>
        )}
        {fio.work_date && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Work date: {fmtDate(fio.work_date)}</span>
          </div>
        )}
        {fio.notes && (
          <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">{fio.notes}</p>
        )}
      </div>

      {/* Scope of Work */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Scope of Work</h2>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No items assigned</p>
            <p className="text-xs text-muted-foreground">Your PM will add work items here.</p>
          </div>
        ) : (
          <>
            <div className="divide-y">
              {items.map((item: any) => {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.labor_cost_per_unit) || 0;
                const total = qty * rate;
                return (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {qty.toLocaleString()} {item.unit} × {rate > 0 ? fmt(rate) : "—"}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0">{total > 0 ? fmt(total) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t bg-muted/20 flex justify-between items-center">
              <span className="text-sm font-semibold">Total Labor</span>
              <span className="text-sm font-bold">{fmt(totalLabor)}</span>
            </div>
          </>
        )}
      </div>

      {/* Payment History */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Payments Received</h2>
          </div>
          {totalPaid > 0 && (
            <span className="text-sm font-semibold text-green-700">{fmt(totalPaid)} total</span>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No payments recorded yet</p>
            <p className="text-xs text-muted-foreground">Payments will appear here once recorded by your PM.</p>
          </div>
        ) : (
          <div className="divide-y">
            {(Object.entries(paymentsByWeek) as [string, any[]][])
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([week, entries]) => {
                const weekTotal = entries.reduce(
                  (s, p) => s + (parseFloat(p.amount_paid) || 0),
                  0
                );
                return (
                  <div key={week} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Week ending {week !== "Unknown" ? fmtDate(week) : "—"}
                      </p>
                      <span className="text-xs font-semibold text-green-700">{fmt(weekTotal)}</span>
                    </div>
                    <div className="space-y-1">
                      {entries.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {p.completion_pct != null ? `${p.completion_pct}% complete` : "Payment"}
                          </span>
                          <span className="font-medium">{fmt(parseFloat(p.amount_paid) || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
