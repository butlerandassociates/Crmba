/**
 * PM Commission Detail Page
 * Shows all commission installments for a specific project manager.
 * Route: /payroll/pm/:id
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, TrendingUp, Clock, CheckCircle2, Edit2, Check, X, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageLoader, SkeletonCards, SkeletonList } from "./ui/page-loader";
import { commissionPaymentsAPI } from "../utils/api";
import { toast } from "sonner";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const fmtShort = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v || 0);

export function PayrollPMDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [pm, setPm] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  // Manual payout form
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load PM profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, commission_rate, role, phone, email")
        .eq("id", id!)
        .single();
      setPm(profile);

      // Load all commission payments for this PM
      const data = await commissionPaymentsAPI.getAll({ profile_id: id! });
      setInstallments(data);

      // Silently fix any stale projects.commission values for this PM
      commissionPaymentsAPI.reconcileForPM(id!).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleMarkProcessed = async (cpId: string) => {
    setProcessing(cpId);
    try {
      await commissionPaymentsAPI.update(cpId, { status: "processed" });
      setInstallments(prev =>
        prev.map(i => i.id === cpId ? { ...i, status: "processed", processed_date: new Date().toISOString().split("T")[0] } : i)
      );
      toast.success("Commission marked as processed");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteInstallment = async (cpId: string) => {
    setProcessing(cpId);
    try {
      await commissionPaymentsAPI.deleteById(cpId);
      setInstallments(prev => prev.filter(i => i.id !== cpId));
      toast.success("Commission installment removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setProcessing(null);
    }
  };

  const handleSaveAmount = async (cpId: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) { toast.error("Please enter a valid amount greater than 0."); return; }
    setProcessing(cpId);
    try {
      await commissionPaymentsAPI.update(cpId, { amount });
      setInstallments(prev => prev.map(i => i.id === cpId ? { ...i, amount } : i));
      setEditingId(null);
      toast.success("Amount updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setProcessing(null);
    }
  };

  const handleRecordPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount greater than $0."); return; }
    setPayoutSaving(true);
    try {
      await commissionPaymentsAPI.createManualPayout(id!, amount, payoutNotes.trim() || undefined);
      toast.success(`${fmt(amount)} payout recorded`);
      setPayoutAmount("");
      setPayoutNotes("");
      setPayoutOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payout");
    } finally {
      setPayoutSaving(false);
    }
  };

  const handleDeletePayout = async (cpId: string) => {
    setDeletingPayoutId(cpId);
    try {
      await commissionPaymentsAPI.deleteManualPayout(cpId);
      setInstallments(prev => prev.filter(i => i.id !== cpId));
      toast.success("Payout removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove payout");
    } finally {
      setDeletingPayoutId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-accent animate-pulse rounded-lg" />
          <div className="space-y-1">
            <div className="h-5 w-40 bg-accent animate-pulse rounded-md" />
            <div className="h-3 w-28 bg-accent animate-pulse rounded-md" />
          </div>
        </div>
        <SkeletonCards count={3} />
        <SkeletonList rows={4} />
        <PageLoader title="Loading commission details…" description="Fetching installments, project GP & processed payments" className="min-h-[6vh]" />
      </div>
    );
  }

  if (!pm) {
    return (
      <div className="p-6">
        <Link to="/payroll" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <p className="text-center text-muted-foreground py-12">Profile not found.</p>
      </div>
    );
  }

  const name = `${pm.first_name ?? ""} ${pm.last_name ?? ""}`.trim() || "—";

  // Project commission records (auto-created from move-to-sold or milestone payments)
  const milestoneInstallments = installments.filter(i => i.payout_type !== "manual_payout");
  // Manual cash payouts recorded by admin
  const manualPayouts = installments.filter(i => i.payout_type === "manual_payout");

  const pendingInstallments = milestoneInstallments.filter(i => i.status === "pending");
  const processedInstallments = milestoneInstallments.filter(i => i.status === "processed");
  const totalPending = pendingInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalProcessed = processedInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // Payout tracker: how much of the total owed has been paid in cash
  const totalOwed = totalPending; // pending milestone commissions = what's owed
  const totalPaidOut = manualPayouts.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const remaining = Math.max(0, totalOwed - totalPaidOut);
  const paidPct = totalOwed > 0 ? Math.min(100, (totalPaidOut / totalOwed) * 100) : 0;

  // Group by project (milestone installments only)
  const byProject: Record<string, any> = {};
  milestoneInstallments.forEach((i: any) => {
    const pid = i.project?.id ?? "unknown";
    if (!byProject[pid]) {
      byProject[pid] = { project: i.project, items: [] };
    }
    byProject[pid].items.push(i);
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back + Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-6 px-6 pt-6 pb-4 -mt-6">
        <Link to="/payroll" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{name}</h1>
          {pm.commission_rate && (
            <Badge variant="outline">{pm.commission_rate}% commission rate</Badge>
          )}
        </div>
        {pm.email && <p className="text-sm text-muted-foreground mt-1">{pm.email}</p>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{fmtShort(totalPending)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pendingInstallments.length} installment{pendingInstallments.length !== 1 ? "s" : ""}</p>
              </div>
              <Clock className="h-7 w-7 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Processed</p>
                <p className="text-xl font-bold text-green-600">{fmtShort(totalProcessed)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{processedInstallments.length} installment{processedInstallments.length !== 1 ? "s" : ""}</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-xl font-bold">{fmtShort(totalPending + totalProcessed)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{milestoneInstallments.length} total installment{milestoneInstallments.length !== 1 ? "s" : ""}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Payout Tracker */}
      {totalOwed > 0 && (
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">Commission Payout Tracker</p>
                <p className="text-xs text-muted-foreground mt-0.5">Record cash installments paid to {pm.first_name} — use these amounts for your QuickBooks entries.</p>
              </div>
              <Button size="sm" onClick={() => setPayoutOpen((o) => !o)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Record Payment
              </Button>
            </div>

            {/* Progress bar */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{paidPct.toFixed(0)}% paid out</span>
                <span>{fmtShort(remaining)} remaining</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${paidPct >= 100 ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total owed: <span className="font-semibold text-foreground">{fmtShort(totalOwed)}</span></span>
                <span className="text-green-700 font-semibold">Paid: {fmtShort(totalPaidOut)}</span>
              </div>
            </div>

            {/* Record payout form */}
            {payoutOpen && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Payment Entry</p>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => {
                    const val = ((totalOwed * pct) / 100).toFixed(2);
                    return (
                      <Button
                        key={pct}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => setPayoutAmount(val)}
                      >
                        {pct}% ({fmtShort(parseFloat(val))})
                      </Button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                      placeholder="e.g. QuickBooks batch 04/22"
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setPayoutOpen(false); setPayoutAmount(""); setPayoutNotes(""); }}>Cancel</Button>
                  <Button size="sm" disabled={payoutSaving} onClick={handleRecordPayout}>
                    {payoutSaving ? "Saving..." : "Record Payment"}
                  </Button>
                </div>
              </div>
            )}

            {/* Payout history */}
            {manualPayouts.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Amount</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Notes</th>
                      <th className="py-2 px-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualPayouts.map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {p.processed_date
                            ? new Date(p.processed_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-green-700">{fmt(parseFloat(p.amount) || 0)}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                        <td className="py-2 px-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                            disabled={deletingPayoutId === p.id}
                            onClick={() => handleDeletePayout(p.id)}
                            title="Remove payout entry"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t">
                      <td className="py-2 px-3 text-xs font-semibold">Total Paid Out</td>
                      <td className="py-2 px-3 text-right font-bold text-green-700">{fmt(totalPaidOut)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {manualPayouts.length === 0 && !payoutOpen && (
              <p className="text-xs text-muted-foreground text-center py-2">No payouts recorded yet. Click "Record Payment" to log your first installment.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Commission Installments by Project */}
      {milestoneInstallments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No commission installments yet</p>
            <p className="text-xs mt-1">Installments are created automatically when a progress payment is marked paid.</p>
          </CardContent>
        </Card>
      ) : (
        Object.values(byProject).map((group: any) => {
          const proj = group.project;
          const clientName = proj?.client
            ? `${proj.client.first_name ?? ""} ${proj.client.last_name ?? ""}`.trim()
            : "—";
          const gpTotal = parseFloat(proj?.gross_profit) || 0;
          const commissionTotal = parseFloat(proj?.commission) || 0;

          return (
            <Card key={proj?.id ?? "unknown"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{proj?.name ?? "Unknown Project"}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Client: {clientName}
                      {gpTotal > 0 && <> &nbsp;·&nbsp; GP: {fmtShort(gpTotal)} &nbsp;·&nbsp; Total Commission: {fmtShort(commissionTotal)}</>}
                    </p>
                  </div>
                  {proj?.id && (
                    <Link
                      to={`/projects/${proj.id}`}
                      className="text-xs text-primary hover:opacity-80 no-underline"
                    >
                      View Project →
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Milestone</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Progress Amt</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Commission</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item: any, idx: number) => {
                        const pp = item.progress_payment;
                        const isEditing = editingId === item.id;
                        const isProcessing = processing === item.id;
                        return (
                          <tr key={item.id} className={`border-b last:border-0 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                            <td className="py-2.5 px-3 font-medium">
                              {pp?.label ?? `Installment ${idx + 1}`}
                              {pp?.percentage && <span className="text-xs text-muted-foreground ml-1">({pp.percentage}%)</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              {pp?.amount ? fmtShort(parseFloat(pp.amount)) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold">
                              {isEditing ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="h-7 w-24 text-right text-sm"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <span className="text-green-700">{fmt(parseFloat(item.amount) || 0)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                item.status === "processed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {item.status === "processed" ? "Processed" : "Pending"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                              {item.status === "processed" && item.processed_date
                                ? new Date(item.processed_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : item.created_at
                                ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1 justify-end">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      disabled={isProcessing}
                                      onClick={() => handleSaveAmount(item.id)}
                                    >
                                      {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingId(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    {item.status === "pending" && (
                                      <>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          title="Edit amount"
                                          onClick={() => { setEditingId(item.id); setEditAmount(String(parseFloat(item.amount) || 0)); }}
                                        >
                                          <Edit2 className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs px-2"
                                          disabled={isProcessing}
                                          onClick={() => handleMarkProcessed(item.id)}
                                        >
                                          {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Processed"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          disabled={isProcessing}
                                          onClick={() => handleDeleteInstallment(item.id)}
                                          title="Remove incorrect installment"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
