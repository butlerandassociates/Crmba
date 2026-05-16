import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { ArrowLeft, TrendingUp, Clock, DollarSign, Edit2, Check, X, Loader2, Trash2, ChevronDown, ChevronUp, Plus, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageLoader, SkeletonCards, SkeletonList } from "./ui/page-loader";
import { commissionPaymentsAPI } from "../utils/api";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const fmtShort = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v || 0);

export function PayrollPMDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [pm, setPm] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, string>>({});
  const [payoutNotesByProject, setPayoutNotesByProject] = useState<Record<string, string>>({});
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [confirmDeletePayoutId, setConfirmDeletePayoutId] = useState<string | null>(null);
  const [expandedAddPayment, setExpandedAddPayment] = useState<Record<string, boolean>>({});
  const [expandedPayoutHistory, setExpandedPayoutHistory] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteInstallmentTarget, setDeleteInstallmentTarget] = useState<any>(null);
  const [projectedCommission, setProjectedCommission] = useState(0);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, commission_rate, role, phone, email, is_active")
        .eq("id", id!)
        .single();
      setPm(profile);

      const data = await commissionPaymentsAPI.getAll({ profile_id: id! });
      setInstallments(data);

      if (profile?.role === "sales_rep") {
        const { data: repProjects } = await supabase
          .from("projects")
          .select("gross_profit, sales_rep_commission_rate")
          .eq("sales_rep_id", id!);
        const projected = (repProjects ?? []).reduce((s: number, p: any) => {
          const rate = Number(p.sales_rep_commission_rate) || Number(profile?.commission_rate) || 0;
          return s + (Number(p.gross_profit) || 0) * (rate / 100);
        }, 0);
        setProjectedCommission(projected);
      } else {
        const { data: pmProjects } = await supabase
          .from("projects")
          .select("commission")
          .eq("project_manager_id", id!);
        const projected = (pmProjects ?? []).reduce((s: number, p: any) =>
          s + (Number(p.commission) || 0), 0);
        setProjectedCommission(projected);
      }

      if (profile?.role === "sales_rep") {
        commissionPaymentsAPI.reconcileForSalesRep(id!).catch(() => {});
      } else {
        commissionPaymentsAPI.reconcileForPM(id!).catch(() => {});
      }
    } finally {
      setLoading(false);
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

  const handleRecordProjectPayout = async (projectId: string) => {
    const amount = parseFloat(payoutAmounts[projectId] ?? "");
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount greater than $0."); return; }
    setSavingProjectId(projectId);
    try {
      const notes = payoutNotesByProject[projectId]?.trim() || undefined;
      await commissionPaymentsAPI.createManualPayout(id!, amount, notes, projectId);
      toast.success(`${fmt(amount)} payout recorded`);
      setPayoutAmounts(prev => { const next = { ...prev }; delete next[projectId]; return next; });
      setPayoutNotesByProject(prev => { const next = { ...prev }; delete next[projectId]; return next; });
      setExpandedAddPayment(prev => ({ ...prev, [projectId]: false }));
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payout");
    } finally {
      setSavingProjectId(null);
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

  const milestoneInstallments = installments.filter(i => i.payout_type !== "manual_payout");
  const manualPayouts = installments.filter(i => i.payout_type === "manual_payout");

  const pendingInstallments = milestoneInstallments.filter(i => i.status === "pending");
  const totalPending = pendingInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalPaidOut = manualPayouts.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalEarned = milestoneInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // Group all milestone installments by project, augmented with per-project payout data
  const byProject: Record<string, any> = {};
  milestoneInstallments.forEach((i: any) => {
    const pid = i.project?.id ?? "unknown";
    if (!byProject[pid]) {
      byProject[pid] = { project: i.project, items: [] };
    }
    byProject[pid].items.push(i);
  });

  const allGroups = Object.values(byProject).map((group: any) => {
    const proj = group.project;
    const owed = group.items
      .filter((i: any) => i.status === "pending")
      .reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
    const projPayouts = manualPayouts.filter((p: any) => p.project_id === proj?.id);
    const paid = projPayouts.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, owed - paid);
    const pct = owed > 0 ? Math.min(100, (paid / owed) * 100) : 0;
    return { ...group, owed, paid, remaining, pct, projPayouts };
  });

  const filterCounts = {
    all: allGroups.length,
    pending: allGroups.filter(g => g.items.some((i: any) => i.status === "pending")).length,
    paid: allGroups.filter(g => g.items.some((i: any) => i.status === "processed")).length,
  };
  const filterPassedGroups = filter === "all" ? allGroups
    : filter === "pending" ? allGroups.filter(g => g.items.some((i: any) => i.status === "pending"))
    : allGroups.filter(g => g.items.some((i: any) => i.status === "processed"));

  const filteredGroups = searchQuery.trim()
    ? filterPassedGroups.filter(g => {
        const q = searchQuery.toLowerCase();
        const projName = (g.project?.name ?? "").toLowerCase();
        const clientName = (g.project?.client
          ? `${g.project.client.first_name ?? ""} ${g.project.client.last_name ?? ""}`.trim()
          : ""
        ).toLowerCase();
        return projName.includes(q) || clientName.includes(q);
      })
    : filterPassedGroups;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Back + Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-6 px-6 pt-6 pb-4 -mt-6">
        <Link to="/payroll" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 no-underline">
          <ArrowLeft className="h-4 w-4" /> Back to Payroll
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{name}</h1>
          {pm.is_active === false && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactive</span>}
          {pm.commission_rate != null && (
            <Badge
              variant="outline"
              className={pm.commission_rate === 0
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-green-300 bg-green-50 text-green-700"}
            >
              {pm.commission_rate}% Commission
            </Badge>
          )}
        </div>
        {pm.email && <p className="text-sm text-muted-foreground mt-1">{pm.email}</p>}
        <div className="relative mt-7">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by project or client name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-4 ${projectedCommission > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
        {projectedCommission > 0 && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Projected Total</p>
                  <p className="text-xl font-bold text-purple-600">{fmtShort(projectedCommission)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pm.commission_rate}% of GP</p>
                </div>
                <TrendingUp className="h-7 w-7 text-purple-500 opacity-60" />
              </div>
            </CardContent>
          </Card>
        )}
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
                <p className="text-xs text-muted-foreground mb-1">Paid</p>
                <p className="text-xl font-bold text-green-600">{fmtShort(totalPaidOut)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{manualPayouts.length} payout{manualPayouts.length !== 1 ? "s" : ""} recorded</p>
              </div>
              <DollarSign className="h-7 w-7 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-xl font-bold">{fmtShort(totalEarned)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{milestoneInstallments.length} total installment{milestoneInstallments.length !== 1 ? "s" : ""}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Installments by Project */}
      {milestoneInstallments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No commission installments yet</p>
            <p className="text-xs mt-1">Installments are created automatically when a progress payment is marked paid.</p>
          </CardContent>
        </Card>
      ) : (<>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {(["all", "pending", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors capitalize ${
                filter === f
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "paid" ? "Paid" : f === "pending" ? "Pending" : "All"}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({filterCounts[f]})</span>
            </button>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            {searchQuery.trim() ? (
              <>
                <Search className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No results for "{searchQuery}"</p>
                <p className="text-xs mt-1">Try a different project or client name.</p>
              </>
            ) : filter === "pending" ? (
              <>
                <Clock className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No pending commissions</p>
                <p className="text-xs mt-1">All installments have been paid out.</p>
              </>
            ) : filter === "paid" ? (
              <>
                <DollarSign className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No paid commissions yet</p>
                <p className="text-xs mt-1">Payouts will appear here once recorded.</p>
              </>
            ) : (
              <>
                <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No commission installments</p>
                <p className="text-xs mt-1">Installments are created automatically when a progress payment is marked paid.</p>
              </>
            )}
          </div>
        )}

        {filteredGroups.map((group: any) => {
          const proj = group.project;
          const clientName = proj?.client
            ? `${proj.client.first_name ?? ""} ${proj.client.last_name ?? ""}`.trim()
            : "—";
          const gpTotal = parseFloat(proj?.gross_profit) || 0;
          const commissionTotal = group.items.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
          const { owed, paid, remaining, pct, projPayouts } = group;
          const isAddPaymentOpen = !!expandedAddPayment[proj?.id];
          const isHistoryOpen = !!expandedPayoutHistory[proj?.id];
          const inputAmt = payoutAmounts[proj?.id] ?? "";
          const inputNote = payoutNotesByProject[proj?.id] ?? "";
          const isSaving = savingProjectId === proj?.id;

          return (
            <Card key={proj?.id ?? "unknown"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{proj?.name ?? "Unknown Project"}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
                  </div>
                  {proj?.client_id && (
                    <Link
                      to={`/clients/${proj.client_id}`}
                      className="text-xs text-primary hover:opacity-80 no-underline"
                    >
                      View Client →
                    </Link>
                  )}
                </div>

                {/* GP + Commission */}
                {gpTotal > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    GP: <span className="font-semibold text-foreground">{fmtShort(gpTotal)}</span>
                    &nbsp;·&nbsp;
                    Commission: <span className="font-semibold text-foreground">{fmtShort(commissionTotal)}</span>
                  </p>
                )}

                {/* Per-project payout summary */}
                {owed > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-muted-foreground">Owed <span className="font-semibold text-foreground">{fmt(owed)}</span></span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-green-700">Paid <span className="font-semibold">{fmt(paid)}</span></span>
                      <span className="text-muted-foreground">·</span>
                      <span className={remaining > 0 ? "text-amber-600" : "text-green-700"}>
                        Remaining <span className="font-semibold">{fmt(remaining)}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% paid out</p>
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Installment rows */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Installment</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Source</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Total Projected Commission</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="py-2 px-3" />
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
                            <td className="py-2.5 px-3 text-xs">
                              <span className="text-blue-600">
                                {pm.commission_rate}% of GP {fmtShort(gpTotal)}
                              </span>
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
                                {item.status === "processed" ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                              {item.status === "processed" && item.processed_date
                                ? new Date(item.processed_date.includes("T") ? item.processed_date : `${item.processed_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          disabled={isProcessing}
                                          onClick={() => setDeleteInstallmentTarget(item)}
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

                {/* GP Correction flag */}
                {gpTotal > 0 && (pm.commission_rate ?? 0) > 0 && (() => {
                  const expectedCommission = gpTotal * ((pm.commission_rate ?? 0) / 100);
                  const delta = expectedCommission - commissionTotal;
                  if (Math.abs(delta) < 0.01) return null;
                  const overpaid = delta < 0;
                  return (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-amber-800">Commission Correction Needed</p>
                        <p className="text-amber-700 mt-0.5">
                          Based on current GP of {fmtShort(gpTotal)}, expected total commission is {fmtShort(expectedCommission)}.{" "}
                          {overpaid
                            ? `Overpaid by ${fmtShort(Math.abs(delta))} — adjust installments down.`
                            : `Underpaid by ${fmtShort(delta)} — adjust installments up.`
                          }
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Footer: + Add Payment | ▼ Payout History */}
                {owed > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div>
                      {remaining > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => setExpandedAddPayment(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))}
                        >
                          {isAddPaymentOpen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {isAddPaymentOpen ? "Cancel" : "Add Payment"}
                        </Button>
                      ) : (
                        <span className="text-xs text-green-700 font-medium">Fully paid out</span>
                      )}
                    </div>
                    {projPayouts.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 text-muted-foreground"
                        onClick={() => setExpandedPayoutHistory(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))}
                      >
                        {isHistoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Payout History ({projPayouts.length})
                      </Button>
                    )}
                  </div>
                )}

                {/* Add Payment form (collapsible) */}
                {isAddPaymentOpen && remaining > 0 && (
                  <div className="mt-3 border rounded-lg p-3 bg-muted/20 space-y-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[25, 50, 75, 100].map(pct => {
                        const val = ((owed * pct) / 100).toFixed(2);
                        return (
                          <Button
                            key={pct}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5"
                            onClick={() => setPayoutAmounts(prev => ({ ...prev, [proj.id]: val }))}
                          >
                            {pct}%
                            <span className="text-muted-foreground ml-1">({fmtShort(parseFloat(val))})</span>
                          </Button>
                        );
                      })}
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={inputAmt}
                          onChange={e => setPayoutAmounts(prev => ({ ...prev, [proj.id]: e.target.value }))}
                          className="h-7 w-24 text-sm text-right"
                          autoFocus
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={inputNote}
                          onChange={e => setPayoutNotesByProject(prev => ({ ...prev, [proj.id]: e.target.value }))}
                          className="h-7 w-36 text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={isSaving || !(parseFloat(inputAmt) > 0)}
                          className="h-7 min-w-[72px] flex items-center justify-center"
                          onClick={() => handleRecordProjectPayout(proj.id)}
                        >
                          {isSaving
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <span>Record</span>
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payout History (collapsible) */}
                {isHistoryOpen && projPayouts.length > 0 && (
                  <div className="mt-3 border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Amount</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Notes</th>
                          <th className="py-2 px-3 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {projPayouts.map((p: any) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {p.processed_date
                                ? new Date(p.processed_date.includes("T") ? p.processed_date : `${p.processed_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
                                onClick={() => setConfirmDeletePayoutId(p.id)}
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
                          <td className="py-2 px-3 text-xs font-semibold">Total Paid</td>
                          <td className="py-2 px-3 text-right font-bold text-green-700">{fmt(paid)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })}
      </>)}

      <AlertDialog open={!!confirmDeletePayoutId} onOpenChange={(o) => { if (!o) setConfirmDeletePayoutId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payout Entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this manual payout record. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeletePayoutId) { handleDeletePayout(confirmDeletePayoutId); setConfirmDeletePayoutId(null); } }}
            >Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteInstallmentTarget} onOpenChange={(o) => { if (!o) setDeleteInstallmentTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Commission Installment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the <strong>{fmt(parseFloat(deleteInstallmentTarget?.amount) || 0)}</strong> installment
              {deleteInstallmentTarget?.progress_payment?.label
                ? <> for <strong>{deleteInstallmentTarget.progress_payment.label}</strong></>
                : " (Contract Signed)"
              }. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!processing}
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                await handleDeleteInstallment(deleteInstallmentTarget.id);
                setDeleteInstallmentTarget(null);
              }}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
