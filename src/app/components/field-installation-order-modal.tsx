import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Plus, Trash2, FileDown, Loader2, Edit, Check, X, DollarSign, ChevronLeft } from "lucide-react";
import { fioAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface FIOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onCrewPayment?: () => void;
}

type View = "view" | "edit" | "pay_crew";

export function FieldInstallationOrderModal({ open, onOpenChange, project, onCrewPayment }: FIOModalProps) {
  const [view, setView] = useState<View>("view");
  const [fio, setFio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [units, setUnits] = useState<string[]>([]);

  // Pay Crew state
  const [completionPct, setCompletionPct] = useState<Record<string, number>>({});
  const [crewPayments, setCrewPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [recording, setRecording] = useState(false);
  const [weekEndingDate, setWeekEndingDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const d = new Date(today);
    d.setDate(today.getDate() + daysUntilSunday);
    return d.toISOString().split("T")[0];
  });
  const [payNotes, setPayNotes] = useState("");

  const fioDocRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("units").select("name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setUnits((data ?? []).map((u: any) => u.name)));
  }, []);

  useEffect(() => {
    if (!open || !project?.id) return;
    loadFIO();
  }, [open, project?.id]);

  const loadCrewPayments = async (fioId: string) => {
    setLoadingPayments(true);
    try {
      const data = await fioAPI.getCrewPayments(fioId);
      setCrewPayments(data);
    } catch {
      toast.error("Failed to load payment history");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!fio) return;
    const entries = (fio.items || [])
      .filter((item: any) => (completionPct[item.id] || 0) > 0)
      .map((item: any) => {
        const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
        const pct = completionPct[item.id] || 0;
        return { fio_item_id: item.id, completion_pct: pct, amount_paid: total * (pct / 100) };
      });
    if (entries.length === 0) { toast.error("Enter a % for at least one item"); return; }
    setRecording(true);
    try {
      await fioAPI.recordCrewPayment(fio.id, weekEndingDate, entries, payNotes);
      toast.success("Payment recorded successfully");
      setCompletionPct({});
      setPayNotes("");
      loadCrewPayments(fio.id);
      onCrewPayment?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setRecording(false);
    }
  };

  const loadFIO = async () => {
    setLoading(true);
    try {
      const existing = await fioAPI.getByProject(project.id);
      if (existing) {
        setFio(existing);
        setEditItems(existing.items || []);
        // Init completion pct to 0
        const init: Record<string, number> = {};
        (existing.items || []).forEach((item: any) => { init[item.id] = 0; });
        setCompletionPct(init);
        setView("view");
      } else {
        setFio(null);
        const items = await fetchLaborFromEstimate();
        setSuggestedItems(items);
        setCheckedIds(new Set());
        setEditItems([]);
        setView("edit");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaborFromEstimate = async () => {
    if (!project?.client?.id) return [];
    const { data: estimates } = await supabase
      .from("estimates").select("id").eq("client_id", project.client.id)
      .order("created_at", { ascending: false }).limit(1);
    if (!estimates || estimates.length === 0) return [];
    const { data: items } = await supabase
      .from("estimate_line_items").select("*").eq("estimate_id", estimates[0].id).gt("labor_cost", 0);
    return (items || []).map((item: any, i: number) => ({
      id: `new-${i}`,
      product_name: item.product_name,
      unit: item.unit,
      quantity: item.quantity,
      labor_cost_per_unit: item.labor_cost,
      total_labor: item.quantity * item.labor_cost,
      notes: "",
    }));
  };

  const handleSave = async () => {
    if (editItems.length === 0) { toast.error("Add at least one labor item"); return; }
    setSaving(true);
    try {
      const items = editItems.map((item) => ({
        product_name: item.product_name,
        unit: item.unit,
        quantity: parseFloat(item.quantity) || 0,
        labor_cost_per_unit: parseFloat(item.labor_cost_per_unit) || 0,
        notes: item.notes || "",
      }));
      if (fio) {
        await fioAPI.updateItems(fio.id, items);
        toast.success("Field Installation Order updated");
      } else {
        await fioAPI.create(
          { project_id: project.id, foreman_id: project.foreman?.id || undefined },
          items
        );
        toast.success("Field Installation Order created");
      }
      setView("view");
      loadFIO();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const exportPDF = async () => {
    if (!fioDocRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(fioDocRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 750,
        windowWidth: 750,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 10;
      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, "PNG", 10, y, imgW, imgH);
      } else {
        // multi-page
        let remaining = imgH;
        let srcY = 0;
        while (remaining > 0) {
          const sliceH = Math.min(remaining, pageH - 20);
          pdf.addImage(imgData, "PNG", 10, y, imgW, imgH, undefined, "FAST", 0);
          remaining -= sliceH;
          srcY += sliceH;
          if (remaining > 0) { pdf.addPage(); y = 10; }
        }
      }
      const projectName = project?.name?.replace(/[^a-z0-9]/gi, "_") ?? "FIO";
      pdf.save(`FIO_${projectName}.pdf`);
    } catch (err) {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const addItem = () => setEditItems([...editItems, { id: `new-${Date.now()}`, product_name: "", unit: "", quantity: 1, labor_cost_per_unit: 0, notes: "" }]);
  const removeItem = (idx: number) => setEditItems(editItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: string, value: any) =>
    setEditItems(editItems.map((item, i) => i === idx ? { ...item, [key]: value } : item));

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const grandTotal = (fio?.items || []).reduce(
    (sum: number, item: any) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0), 0
  );

  const editTotal = editItems.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0), 0
  );

  // Pay crew totals
  const weeklyPayout = (fio?.items || []).reduce((sum: number, item: any) => {
    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
    const pct = completionPct[item.id] || 0;
    return sum + total * (pct / 100);
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0 gap-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-3">
              {view === "pay_crew" && (
                <button onClick={() => setView("view")} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <SheetTitle>
                  {view === "pay_crew" ? "Pay Crew — Weekly Completion" : "Field Installation Order"}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="mt-0.5">
                    <p className="text-sm text-muted-foreground">{project?.name ?? "—"}</p>
                    {project?.foremanName && <p className="text-xs text-muted-foreground">{project.foremanName}</p>}
                  </div>
                </SheetDescription>
              </div>
            </div>

            {/* Action buttons */}
            {view === "view" && fio && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setView("edit"); setEditItems(fio.items || []); }}>
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                  Export PDF
                </Button>
                <Button size="sm" onClick={() => { setView("pay_crew"); loadCrewPayments(fio.id); }}>
                  <DollarSign className="h-4 w-4 mr-1.5" /> Pay Crew
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

          ) : view === "edit" ? (
            /* ── Edit / Create Mode ── */
            <div className="space-y-4">
              {!fio && suggestedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suggested labor items from proposal — select which to include:</p>
                  {suggestedItems.map((item) => {
                    const checked = checkedIds.has(item.id);
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                        onClick={() => {
                          const next = new Set(checkedIds);
                          if (checked) { next.delete(item.id); setEditItems(editItems.filter((e) => e.id !== item.id)); }
                          else { next.add(item.id); setEditItems([...editItems, { ...item }]); }
                          setCheckedIds(next);
                        }}
                      >
                        <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-primary pointer-events-none" />
                        <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                        <span className="text-xs font-semibold">{formatCurrency(item.labor_cost_per_unit)}/unit</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!fio && suggestedItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No labor items found in the proposal. Add items manually below.</p>
              )}
              {editItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/60 border-b">
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[40%]">Service / Product</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[15%]">Unit</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[15%]">Qty</th>
                        <th className="text-left text-xs font-semibold px-3 py-2 w-[20%]">$/Unit</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                          <td className="px-2 py-1.5">
                            <Input value={item.product_name} onChange={(e) => updateItem(idx, "product_name", e.target.value)} className="h-8 text-sm" placeholder="e.g., Labor — Concrete Pour" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                              <option value="">—</option>
                              {units.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input type="number" value={item.labor_cost_per_unit} onChange={(e) => updateItem(idx, "labor_cost_per_unit", e.target.value)} className="h-8 text-sm" />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Item
              </Button>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-semibold text-sm">Total: {formatCurrency(editTotal)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setView("view"); if (!fio) onOpenChange(false); }}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    {fio ? "Save Changes" : "Create FIO"}
                  </Button>
                </div>
              </div>
            </div>

          ) : view === "pay_crew" ? (
            /* ── Pay Crew ── */
            <div className="space-y-5">

              {/* Week ending date */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium shrink-0">Week Ending</label>
                <input
                  type="date"
                  value={weekEndingDate}
                  onChange={(e) => setWeekEndingDate(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {/* Line items table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold">
                  <div className="col-span-4">Scope Item</div>
                  <div className="col-span-2 text-center">Total Pay</div>
                  <div className="col-span-2 text-center">Paid to Date</div>
                  <div className="col-span-2 text-center">This Week %</div>
                  <div className="col-span-2 text-right">This Week $</div>
                </div>
                {(fio?.items || []).map((item: any, idx: number) => {
                  const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0);
                  const paidPct = crewPayments
                    .filter((p) => p.fio_item_id === item.id)
                    .reduce((s, p) => s + (p.completion_pct || 0), 0);
                  const paidAmt = crewPayments
                    .filter((p) => p.fio_item_id === item.id)
                    .reduce((s, p) => s + (p.amount_paid || 0), 0);
                  const remainingPct = Math.max(0, 100 - paidPct);
                  const pct = completionPct[item.id] || 0;
                  const weekAmt = total * (pct / 100);
                  return (
                    <div key={item.id} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                        <div className="col-span-4 font-medium truncate">{item.product_name}</div>
                        <div className="col-span-2 text-center text-xs text-muted-foreground">{formatCurrency(total)}</div>
                        <div className="col-span-2 text-center">
                          <span className={`text-xs font-semibold ${paidPct >= 100 ? "text-green-600" : paidPct > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {paidPct.toFixed(0)}% · {formatCurrency(paidAmt)}
                          </span>
                        </div>
                        <div className="col-span-2 text-center">
                          {paidPct >= 100 ? (
                            <span className="text-xs text-green-600 font-medium">Fully paid</span>
                          ) : (
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={remainingPct}
                                className="h-8 text-sm text-center pr-5"
                                value={pct || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.min(remainingPct, Math.max(0, parseFloat(e.target.value) || 0));
                                  setCompletionPct((prev) => ({ ...prev, [item.id]: val }));
                                }}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                            </div>
                          )}
                        </div>
                        <div className={`col-span-2 text-right font-semibold ${weekAmt > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {formatCurrency(weekAmt)}
                        </div>
                      </div>
                      {/* Cumulative progress bar */}
                      <div className="px-4 pb-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(paidPct + pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {/* Payout total + Record button */}
              <div className="flex items-center justify-between bg-gray-900 text-white rounded-lg px-5 py-4">
                <span className="font-bold tracking-wide text-sm">WEEKLY CREW PAYOUT</span>
                <span className="text-lg font-bold text-[#C9A84C]">{formatCurrency(weeklyPayout)}</span>
              </div>

              <Button
                className="w-full bg-black hover:bg-gray-800 text-white"
                onClick={handleRecordPayment}
                disabled={recording || weeklyPayout === 0}
              >
                {recording ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                Record Payment
              </Button>

              {/* Payment history */}
              {loadingPayments ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : crewPayments.length > 0 && (() => {
                // Group by week_ending_date
                const weeks = [...new Set(crewPayments.map((p) => p.week_ending_date))];
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment History</p>
                    {weeks.map((week) => {
                      const weekEntries = crewPayments.filter((p) => p.week_ending_date === week);
                      const weekTotal = weekEntries.reduce((s, p) => s + (p.amount_paid || 0), 0);
                      const recorder = weekEntries[0]?.paidBy;
                      return (
                        <div key={week} className="border rounded-lg overflow-hidden opacity-75">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 text-xs font-semibold">
                            <span>Week ending {new Date(week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <div className="flex items-center gap-3">
                              {recorder && <span className="text-muted-foreground">by {recorder.first_name} {recorder.last_name}</span>}
                              <span className="text-green-700">{formatCurrency(weekTotal)}</span>
                            </div>
                          </div>
                          {weekEntries.map((p) => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-1.5 text-xs border-t text-muted-foreground">
                              <span>{p.fio_item_id ? (fio?.items || []).find((i: any) => i.id === p.fio_item_id)?.product_name ?? "—" : "—"}</span>
                              <span>{p.completion_pct}% · {formatCurrency(p.amount_paid)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          ) : (
            /* ── View Mode — compact document ── */
            <div ref={fioDocRef} style={{ width: "100%", maxWidth: 750, margin: "0 auto" }} className="bg-white space-y-5 font-sans text-[13px]">

              {/* Black header */}
              <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 rounded-sm">
                <span className="text-[16px] font-bold">Butler &amp; Associates Construction</span>
                <span className="text-[13px] font-bold text-[#C9A84C]">Crew Labor Schedule</span>
              </div>

              {/* Project / Date */}
              <div className="flex items-center justify-between border-b border-gray-300 pb-3">
                <span className="text-[#C9A84C] text-sm">Project: {project?.name ?? "—"}</span>
                <span className="text-sm text-gray-700">
                  Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  {fio?.status && <Badge variant="outline" className="ml-3 capitalize text-xs">{fio.status}</Badge>}
                </span>
              </div>

              {/* Scope heading */}
              <div>
                <h3 className="text-[13px] font-bold mb-3">Scope 1 — {project?.name ?? "Labor Items"}</h3>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#111111] text-white">
                      <th className="py-2 px-3 text-left font-semibold">Scope Item</th>
                      <th className="py-2 px-3 text-center font-semibold w-14">Unit</th>
                      <th className="py-2 px-3 text-center font-semibold w-12">Qty</th>
                      <th className="py-2 px-3 text-right font-semibold w-20">Rate</th>
                      <th className="py-2 px-3 text-right font-semibold w-22">Crew Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fio?.items || []).map((item: any, idx: number) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const rate = parseFloat(item.labor_cost_per_unit) || 0;
                      return (
                        <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                          <td className="py-2 px-3">{item.product_name}</td>
                          <td className="py-2 px-3 text-center">{item.unit}</td>
                          <td className="py-2 px-3 text-center">{qty.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{rate > 0 ? formatCurrency(rate) : "—"}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(qty * rate)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">Subtotal</td>
                      <td className="py-2 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">{formatCurrency(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total bar */}
              <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-3 rounded-sm">
                <span className="text-sm font-bold tracking-wide">TOTAL CREW PAYOUT</span>
                <span className="text-base font-bold text-[#C9A84C]">{formatCurrency(grandTotal)}</span>
              </div>

              {fio?.notes && (
                <div>
                  <div className="font-bold text-sm mb-1">Notes</div>
                  <p className="text-xs text-gray-600 leading-relaxed">{fio.notes}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-10 pt-4 border-t border-gray-300">
                <div>
                  <div className="text-xs mb-8">Butler &amp; Associates Construction</div>
                  <div className="border-b border-gray-800 mb-1" />
                  <div className="text-[11px] text-gray-500">Authorized Signature / Date</div>
                </div>
                <div>
                  <div className="text-xs mb-8">Crew Lead / Subcontractor{project?.foremanName ? ` — ${project.foremanName}` : ""}</div>
                  <div className="border-b border-gray-800 mb-1" />
                  <div className="text-[11px] text-gray-500">Signature / Date</div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
                Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
