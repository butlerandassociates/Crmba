import { useState, useEffect, useRef, useMemo } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Plus, Trash2, Upload, FileText, Loader2, Receipt, Car, Pencil, Users, Layers, TrendingUp, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { receiptsAPI } from "../api/receipts";
import { mileageTripsAPI } from "../api/mileage";
import { fioAPI } from "../api/field-installation-orders";
import { activityLogAPI } from "../api/activity-log";
import { usePermissions } from "../hooks/usePermissions";
import { computeProjectedGP, expectedMaterialByCategory, rollupMaterialByCategory, OTHER_MATERIAL_CATEGORY } from "../utils/financials";
import { toast } from "sonner";

interface CostAttributionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  /** Accepted (or latest non-declined) proposal — its line items are what was sold */
  proposal?: any;
  /** Same gpHealthData[project.id] the Financial Health panel uses (budgets, actuals, FIO) */
  gpData?: any;
  onReceiptChange?: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const EMPTY = { name: "", amount: "", note: "", materialCategory: "" };

export function CostAttributionsSheet({ open, onOpenChange, client, project, proposal, gpData, onReceiptChange }: CostAttributionsSheetProps) {
  const { can } = usePermissions();
  const canEdit = can("can_edit_financials");
  const [receipts, setReceipts] = useState<any[]>([]);
  const [mileageTrips, setMileageTrips] = useState<any[]>([]);
  const [crewPayments, setCrewPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", amount: "", note: "", materialCategory: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [data, trips, fios] = await Promise.all([
        receiptsAPI.getByProject(project.id),
        mileageTripsAPI.getProjectCostTrips(project.id).catch(() => []),
        fioAPI.getByProject(project.id).catch(() => [] as any[]),
      ]);
      setReceipts(data || []);
      setMileageTrips(trips || []);
      // Crew pay increments (already tracked in the FIO) shown here read-only so ALL spend on
      // the job is visible in one place (Jonathan, Oct 13 2026).
      const itemName: Record<string, string> = {};
      for (const f of fios as any[]) for (const it of f.items ?? []) itemName[it.id] = it.product_name;
      const payments = await Promise.all(
        (fios as any[]).filter((f) => f.id).map((f) =>
          fioAPI.getCrewPayments(f.id).then((rows: any[]) =>
            rows.map((r) => ({ ...r, _item: itemName[r.fio_item_id] ?? "Crew payment", _foreman: f.foreman })),
          ).catch(() => [] as any[]),
        ),
      );
      setCrewPayments(payments.flat());
    } catch {
      toast.error("Failed to load receipts — please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadReceipts();
  }, [open, project?.id]);

  useRealtimeRefetch(() => { if (open && project?.id) loadReceipts(); }, ["project_receipts", "mileage_trips", "mileage_submissions", "fio_crew_payments"], `cost-attr-${project?.id}`);

  // ── Sold material categories (what was sold → what we expected to spend) ───────────────
  const expectedByCategory = useMemo(
    () => expectedMaterialByCategory(proposal?.line_items ?? []),
    [proposal?.line_items],
  );
  const categoryOptions = useMemo(() => {
    const names = Object.keys(expectedByCategory).filter((n) => n !== OTHER_MATERIAL_CATEGORY).sort((a, b) => a.localeCompare(b));
    return [...names, OTHER_MATERIAL_CATEGORY];
  }, [expectedByCategory]);
  const rollup = useMemo(() => rollupMaterialByCategory(expectedByCategory, receipts), [expectedByCategory, receipts]);
  const laborReceipts = receipts.filter((r) => r.category === "labor");

  const totalMaterialReceipts = receipts.filter((r) => r.category !== "labor").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCrewPaid = crewPayments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const totalMileage  = mileageTrips.reduce((s, t) => s + Number(t.payout || 0), 0);

  // ── Header numbers — same projected-GP source as the Financial Health panel / Active tab ──
  const contractValue = Number(project?.totalValue ?? project?.total_value ?? 0);
  const projectedGP = gpData ? computeProjectedGP(gpData, project) : null;
  const totalProjectCost = projectedGP !== null ? contractValue - projectedGP : null;
  const gpPct = projectedGP !== null && contractValue > 0 ? (projectedGP / contractValue) * 100 : null;
  const expectedMaterialTotal = gpData?.materialBudget ?? Object.values(expectedByCategory).reduce((s, v) => s + v, 0);

  const canAdd = !!form.name.trim() && !!form.amount && !!form.materialCategory;

  const handleAdd = async () => {
    if (!form.name.trim() || !form.amount) { toast.error("Supplier and amount are required."); return; }
    if (!form.materialCategory) { toast.error("Choose which sold material this receipt belongs to (or Other / General)."); return; }
    if (!project?.id) { toast.error("No project linked — a project must exist before adding receipts."); return; }
    setSaving(true);
    try {
      const saved = await receiptsAPI.create(
        { project_id: project.id, name: form.name.trim(), amount: parseFloat(form.amount), category: "material", note: form.note || undefined, material_category: form.materialCategory },
        droppedFile || undefined
      );
      setReceipts((prev) => [saved, ...prev]);
      setForm({ ...EMPTY });
      setDroppedFile(null);
      activityLogAPI.create({ client_id: client?.id, action_type: "receipt_added", description: `Receipt added: "${form.name}" — ${fmt(parseFloat(form.amount))} (material · ${form.materialCategory})` }).catch(() => {});
      toast.success("Receipt added");
      onReceiptChange?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to add receipt");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm({ name: r.name ?? "", amount: String(r.amount ?? ""), note: r.note ?? "", materialCategory: r.material_category ?? "" });
  };

  const handleSaveEdit = async (r: any) => {
    const amount = parseFloat(editForm.amount);
    if (!editForm.name.trim() || !(amount >= 0)) { toast.error("Supplier and a valid amount are required."); return; }
    const isMaterial = r.category !== "labor";
    if (isMaterial && !editForm.materialCategory) { toast.error("Choose which sold material this receipt belongs to (or Other / General)."); return; }
    setSavingEdit(true);
    try {
      const saved = await receiptsAPI.update(r.id, {
        name: editForm.name.trim(),
        amount,
        note: editForm.note.trim() || null,
        ...(isMaterial ? { material_category: editForm.materialCategory } : {}),
      });
      setReceipts((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...saved } : x)));
      setEditingId(null);
      activityLogAPI.create({ client_id: client?.id, action_type: "receipt_updated", description: `Receipt updated: "${editForm.name.trim()}" — ${fmt(amount)}${isMaterial ? ` (${editForm.materialCategory})` : ""}` }).catch(() => {});
      toast.success("Receipt updated");
      onReceiptChange?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update receipt");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (r: any) => {
    setDeletingId(r.id);
    try {
      await receiptsAPI.delete(r.id, r.file_url);
      setReceipts((prev) => prev.filter((x) => x.id !== r.id));
      activityLogAPI.create({ client_id: client?.id, action_type: "receipt_deleted", description: `Receipt deleted: "${r.name}" — ${fmt(r.amount)} (${r.category})` }).catch(() => {});
      toast.success("Receipt deleted");
      onReceiptChange?.();
    } catch {
      toast.error("Failed to delete receipt — please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const renderReceipt = (r: any) => {
    if (editingId === r.id) {
      const isMaterial = r.category !== "labor";
      return (
        <div key={r.id} className="border rounded-lg p-3 bg-accent/20 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Supplier or payee</Label>
              <Input className="h-8 text-sm" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Actual cost ($)</Label>
              <Input type="number" className="h-8 text-sm" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            {isMaterial && (
              <div className="space-y-1">
                <Label className="text-xs">Sold material item</Label>
                <Select value={editForm.materialCategory || undefined} onValueChange={(v) => setEditForm((f) => ({ ...f, materialCategory: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Input className="h-8 text-sm" placeholder="Optional detail" value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
            <Button size="sm" onClick={() => handleSaveEdit(r)} disabled={savingEdit}>
              {savingEdit && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Save
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div key={r.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-accent/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{r.name}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${r.category === "labor" ? "border-blue-300 text-blue-700" : "border-amber-300 text-amber-700"}`}>
              {r.category === "labor" ? "labor" : "material"}
            </Badge>
          </div>
          {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
          {r.file_url && (
            <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:opacity-75">
              <FileText className="h-3 w-3" />{r.file_name || "Receipt"}
            </a>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {r.uploader ? `${r.uploader.first_name ?? ""} ${r.uploader.last_name ?? ""}`.trim() : "Unknown"}{" · "}
            {fmtDate(r.created_at)}{" "}
            {new Date(r.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </p>
        </div>
        <span className="font-semibold text-sm shrink-0 tabular-nums">{fmt(r.amount)}</span>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => startEdit(r)} className="text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteTarget(r)}
              disabled={deletingId === r.id}
              className="text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    );
  };

  const stat = (icon: React.ReactNode, label: string, value: string, tone = "") => (
    <div className="px-4 py-3 border-r last:border-r-0 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
      <p className={`text-xl font-bold mt-1 tabular-nums ${tone}`}>{value}</p>
    </div>
  );

  const selectedExpected = form.materialCategory ? (expectedByCategory[form.materialCategory] ?? 0) : null;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm({ ...EMPTY }); setDroppedFile(null); setEditingId(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0">
        <DialogHeader className="px-6 py-4 pr-12">
          <DialogTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Cost Attributions
          </DialogTitle>
          <DialogDescription className="text-xs">
            {client?.first_name} {client?.last_name}
            {proposal?.estimate_number ? ` · Proposal #${proposal.estimate_number}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 border-b">
            {stat(<DollarSign className="h-3.5 w-3.5" />, "Actual Material Spend", fmt(totalMaterialReceipts))}
            {stat(<TrendingUp className="h-3.5 w-3.5" />, "Expected Material Spend", fmt(expectedMaterialTotal))}
            {stat(<Layers className="h-3.5 w-3.5" />, "Total Project Cost", totalProjectCost !== null ? fmt(totalProjectCost) : "—")}
            {stat(null, "Active GP %", gpPct !== null ? `${gpPct.toFixed(1)}%` : "—")}
            {stat(null, "Projected GP $", projectedGP !== null ? fmt(projectedGP) : "—")}
          </div>

          {/* Add receipt */}
          {canEdit && (
            <div className="p-6 border-b space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Add receipt</p>
                <span className="text-xs text-muted-foreground">* Required</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Supplier or payee *</Label>
                  <Input className="h-9 text-sm" placeholder="e.g. Home Depot" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category *</Label>
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">Material</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Actual cost *</Label>
                  <Input type="number" className="h-9 text-sm" placeholder="$ 0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Input className="h-9 text-sm" placeholder="Optional detail" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>

              {/* Material attribution */}
              <div className="rounded-lg border bg-emerald-50/50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <p className="text-sm font-semibold">Material attribution</p>
                  <p className="text-xs text-muted-foreground">Expected costs are pulled from the material items sold on this job.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sold material item *</Label>
                    <Select value={form.materialCategory || undefined} onValueChange={(v) => setForm((f) => ({ ...f, materialCategory: v }))}>
                      <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expected category total</Label>
                    <div className="flex h-9 items-center justify-between rounded-md border bg-background px-3 text-sm tabular-nums">
                      <span>{selectedExpected === null ? "—" : selectedExpected > 0 ? fmt(selectedExpected) : "—"}</span>
                      <span className="text-[10px] font-semibold text-emerald-700">CRM</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 items-stretch">
                <div
                  className={`flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer text-xs transition-colors flex items-center justify-center ${isDragging ? "border-primary bg-primary/5" : "hover:border-primary text-muted-foreground"}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setDroppedFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) setDroppedFile(f); }} />
                  {droppedFile ? (
                    <span className="text-primary font-medium">{droppedFile.name}</span>
                  ) : (
                    <span><Upload className="h-3.5 w-3.5 inline mr-1" />Attach receipt image or PDF</span>
                  )}
                </div>
                <Button className="h-auto px-6" disabled={saving || !canAdd} onClick={handleAdd}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                  Add Receipt
                </Button>
              </div>
            </div>
          )}

          {/* Attributed costs */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Attributed costs</p>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                {receipts.length + crewPayments.length + mileageTrips.length} records
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : receipts.length === 0 && mileageTrips.length === 0 && crewPayments.length === 0 && rollup.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No costs yet</p>
                <p className="text-xs mt-1">Upload receipts or approve mileage to track this job's costs.</p>
              </div>
            ) : (<>
              {/* Material — grouped by sold category, actual vs expected */}
              {rollup.map((row) => {
                const label = row.category || "Unattributed";
                const hasBudget = row.expected > 0;
                return (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        {label}
                        {!row.category && <Badge variant="outline" className="text-[10px] normal-case border-amber-300 text-amber-700">needs a sold item</Badge>}
                      </p>
                      <div className="text-right text-xs tabular-nums">
                        <span className="font-semibold text-sm">{fmt(row.actual)}</span>
                        {hasBudget && <span className="text-muted-foreground"> of {fmt(row.expected)} expected</span>}
                        {hasBudget && (row.over > 0
                          ? <span className="ml-2 font-semibold text-red-600">{fmt(row.over)} over</span>
                          : <span className="ml-2 text-emerald-700">{fmt(row.remaining)} left</span>)}
                      </div>
                    </div>
                    {row.receipts.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No receipts attributed yet.</p>
                    ) : row.receipts.map(renderReceipt)}
                  </div>
                );
              })}

              {laborReceipts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Labor receipts</p>
                  {laborReceipts.map(renderReceipt)}
                </div>
              )}

              {/* Crew pay — read-only, from the FIO's crew payments */}
              {crewPayments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />Crew pay <span className="font-normal normal-case">(from the FIO)</span>
                    </p>
                    <span className="text-sm font-semibold tabular-nums">{fmt(totalCrewPaid)}</span>
                  </div>
                  {crewPayments.map((p) => {
                    const foreman = p._foreman ? `${p._foreman.first_name ?? ""} ${p._foreman.last_name ?? ""}`.trim() : "";
                    return (
                      <div key={p.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-accent/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{p._item}</span>
                            <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700">crew pay</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Week ending {fmtDate(p.week_ending_date + "T00:00:00")}
                            {p.completion_pct != null ? ` · ${Number(p.completion_pct)}% complete` : ""}
                            {foreman ? ` · ${foreman}` : ""}
                          </p>
                        </div>
                        <span className="font-semibold text-sm shrink-0 tabular-nums">{fmt(Number(p.amount_paid))}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mileage — read-only; auto-attributed from approved/paid trips, counts toward GP$ */}
              {mileageTrips.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" />Mileage <span className="font-normal normal-case">(from approved trips)</span>
                    </p>
                    <span className="text-sm font-semibold tabular-nums">{fmt(totalMileage)}</span>
                  </div>
                  {mileageTrips.map((t) => {
                    const emp = t._sub?.user ? `${t._sub.user.first_name ?? ""} ${t._sub.user.last_name ?? ""}`.trim() : "Employee";
                    return (
                      <div key={t.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-accent/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{emp}</span>
                            <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700">mileage</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {fmtDate(t.trip_date + "T00:00:00")}
                            {" · "}{Number(t.miles).toFixed(1)} mi
                          </p>
                        </div>
                        <span className="font-semibold text-sm shrink-0 tabular-nums">{fmt(Number(t.payout))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <span className="font-medium text-foreground">"{deleteTarget?.name}"</span> ({deleteTarget ? fmt(deleteTarget.amount) : ""})? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { if (deleteTarget) { handleDelete(deleteTarget); setDeleteTarget(null); } }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
