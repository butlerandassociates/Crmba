import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { ArrowLeft, TrendingUp, Clock, DollarSign, Loader2, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
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
  const [projects, setProjects] = useState<any[]>([]);

  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, string>>({});
  const [payoutNotesByProject, setPayoutNotesByProject] = useState<Record<string, string>>({});
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [confirmDeletePayoutId, setConfirmDeletePayoutId] = useState<string | null>(null);
  const [expandedPayoutHistory, setExpandedPayoutHistory] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

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
          .select("id, name, gross_profit, sales_rep_commission_rate, total_value, commission_override_total, client_id, client:clients(id, first_name, last_name, is_discarded)")
          .eq("sales_rep_id", id!);
        setProjects((repProjects ?? []).filter((p: any) => !p.client?.is_discarded));
      } else {
        const { data: pmProjects } = await supabase
          .from("projects")
          .select("id, name, gross_profit, total_value, commission_override_total, client_id, client:clients(id, first_name, last_name, is_discarded)")
          .eq("project_manager_id", id!);
        setProjects((pmProjects ?? []).filter((p: any) => !p.client?.is_discarded));
      }
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(loadData, ["commission_payments", "projects", "profiles"], `pm-detail-${id}`);

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
        <PageLoader title="Loading commission details…" description="Fetching projects, GP & processed payments" className="min-h-[6vh]" />
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
  const isSalesRep = pm.role === "sales_rep";
  const manualPayouts = installments.filter(i => i.payout_type === "manual_payout");

  // Build groups — GP × rate per project (same model for PM and Sales Rep)
  const allGroups = projects.map((proj: any) => {
    const rate = isSalesRep
      ? Number(proj.sales_rep_commission_rate) || Number(pm.commission_rate) || 0
      : Number(pm.commission_rate) || 0;
    const gp = Number(proj.gross_profit) || 0;
    const commissionTotal = proj.commission_override_total != null
      ? Number(proj.commission_override_total)
      : gp * (rate / 100);
    const projPayouts = manualPayouts.filter((p: any) => p.project_id === proj.id);
    const paid = projPayouts.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
    const remaining = Math.max(0, commissionTotal - paid);
    const pct = commissionTotal > 0 ? Math.min(100, (paid / commissionTotal) * 100) : 0;
    return { project: proj, gp, commissionTotal, rate, paid, remaining, pct, projPayouts };
  });

  const totalOwed = allGroups.reduce((s, g) => s + g.commissionTotal, 0);
  const totalPaid = allGroups.reduce((s, g) => s + g.paid, 0);
  const totalRemaining = Math.max(0, totalOwed - totalPaid);

  const filteredGroups = searchQuery.trim()
    ? allGroups.filter(g => {
        const q = searchQuery.toLowerCase();
        const projName = (g.project?.name ?? "").toLowerCase();
        const clientName = (g.project?.client
          ? `${g.project.client.first_name ?? ""} ${g.project.client.last_name ?? ""}`.trim()
          : "").toLowerCase();
        return projName.includes(q) || clientName.includes(q);
      })
    : allGroups;

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
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Commission Owed</p>
                <p className="text-xl font-bold text-purple-600">{fmtShort(totalOwed)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pm.commission_rate}% of GP across {allGroups.length} project{allGroups.length !== 1 ? "s" : ""}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-purple-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Paid Out</p>
                <p className="text-xl font-bold text-green-600">{fmtShort(totalPaid)}</p>
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
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className={`text-xl font-bold ${totalRemaining > 0 ? "text-amber-600" : "text-green-600"}`}>{fmtShort(totalRemaining)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalRemaining > 0 ? "Balance due" : "Fully paid out"}</p>
              </div>
              <Clock className="h-7 w-7 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      {allGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No projects assigned</p>
            <p className="text-xs mt-1">Commission will appear here once assigned to a project.</p>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <Search className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No results for "{searchQuery}"</p>
          <p className="text-xs mt-1">Try a different project or client name.</p>
        </div>
      ) : (
        filteredGroups.map((group) => {
          const proj = group.project;
          const clientName = proj?.client
            ? `${proj.client.first_name ?? ""} ${proj.client.last_name ?? ""}`.trim()
            : "—";
          const { gp, commissionTotal, rate, paid, remaining, pct, projPayouts } = group;
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
                    <Link to={`/clients/${proj.client_id}`} className="text-xs text-primary hover:opacity-80 no-underline">
                      View Client →
                    </Link>
                  )}
                </div>

                {/* Commission formula */}
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">{rate}% of GP </span>
                  <span className="font-semibold">{fmt(gp)}</span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-bold text-green-700">{fmt(commissionTotal)}</span>
                </p>

                {/* Progress */}
                {commissionTotal > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-muted-foreground">Total <span className="font-semibold text-foreground">{fmt(commissionTotal)}</span></span>
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

              <CardContent className="pt-0 space-y-3">
                {/* Payout buttons */}
                {commissionTotal > 0 && remaining > 0 && (
                  <div className="border rounded-lg p-3 bg-muted/20 space-y-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Record Payout</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[25, 50, 75, 100].map(p => {
                        const val = ((commissionTotal * p) / 100).toFixed(2);
                        return (
                          <Button
                            key={p}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5"
                            onClick={() => setPayoutAmounts(prev => ({ ...prev, [proj.id]: val }))}
                          >
                            {p}%
                            <span className="text-muted-foreground ml-1">({fmtShort(parseFloat(val))})</span>
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={inputAmt}
                        onChange={e => setPayoutAmounts(prev => ({ ...prev, [proj.id]: e.target.value }))}
                        className="h-7 w-28 text-sm text-right"
                      />
                      <Input
                        placeholder="Notes (optional)"
                        value={inputNote}
                        onChange={e => setPayoutNotesByProject(prev => ({ ...prev, [proj.id]: e.target.value }))}
                        className="h-7 flex-1 min-w-[120px] text-sm"
                      />
                      <Button
                        size="sm"
                        disabled={isSaving || !(parseFloat(inputAmt) > 0)}
                        className="h-7 min-w-[72px] flex items-center justify-center"
                        onClick={() => handleRecordProjectPayout(proj.id)}
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>Record</span>}
                      </Button>
                    </div>
                  </div>
                )}

                {commissionTotal > 0 && remaining <= 0 && (
                  <p className="text-xs text-green-700 font-medium">Fully paid out</p>
                )}

                {gp === 0 && (
                  <p className="text-xs text-muted-foreground italic">GP not set — commission will calculate once gross profit is available.</p>
                )}

                {/* Payout History */}
                {projPayouts.length > 0 && (
                  <>
                    <div className="flex items-center justify-end border-t pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 text-muted-foreground"
                        onClick={() => setExpandedPayoutHistory(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))}
                      >
                        {isHistoryOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Payout History ({projPayouts.length})
                      </Button>
                    </div>

                    {isHistoryOpen && (
                      <div className="border rounded-lg overflow-hidden">
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
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

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

    </div>
  );
}
