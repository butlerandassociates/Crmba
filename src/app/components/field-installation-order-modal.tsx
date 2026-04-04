import { useState, useEffect } from "react";
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
import { Plus, Trash2, FileDown, Loader2, Edit, Check, X } from "lucide-react";
import { fioAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface FIOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
}

export function FieldInstallationOrderModal({ open, onOpenChange, project }: FIOModalProps) {
  const [fio, setFio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [units, setUnits] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("units").select("name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setUnits((data ?? []).map((u: any) => u.name)));
  }, []);

  useEffect(() => {
    if (!open || !project?.id) return;
    loadFIO();
  }, [open, project?.id]);

  const loadFIO = async () => {
    setLoading(true);
    try {
      const existing = await fioAPI.getByProject(project.id);
      if (existing) {
        setFio(existing);
        setEditItems(existing.items || []);
      } else {
        // No FIO yet — fetch labor items as suggestions, let admin select manually
        setFio(null);
        const items = await fetchLaborFromEstimate();
        setSuggestedItems(items);
        setCheckedIds(new Set());
        setEditItems([]);
        setEditMode(true);
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
      .from("estimates")
      .select("id")
      .eq("client_id", project.client.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!estimates || estimates.length === 0) return [];
    const { data: items } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimates[0].id)
      .gt("labor_cost", 0);
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
    if (editItems.length === 0) {
      toast.error("Add at least one labor item");
      return;
    }
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
      setEditMode(false);
      loadFIO();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setEditItems([...editItems, { id: `new-${Date.now()}`, product_name: "", unit: "", quantity: 1, labor_cost_per_unit: 0, notes: "" }]);
  };

  const removeItem = (idx: number) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, key: string, value: any) => {
    setEditItems(editItems.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const exportPDF = () => {
    const items: any[] = fio?.items || [];
    const total = items.reduce((s: number, it: any) =>
      s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0);
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const GOLD = "#C9A84C";
    const BLACK = "#111111";
    const fmt = (v: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

    const rows = items.map((item: any, idx: number) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.labor_cost_per_unit) || 0;
      return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:12px;">${item.product_name}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${item.unit}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${qty.toLocaleString()}</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;">${rate > 0 ? fmt(rate) : "—"}</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;">${fmt(qty * rate)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Crew Labor Schedule — ${project.name ?? "Project"}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;background:#fff;padding:40px 48px;}@page{margin:0;}table{border-collapse:collapse;width:100%;}</style>
</head><body style="display:flex;flex-direction:column;min-height:100vh;">
<div style="background:${BLACK};color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
  <div style="font-size:22px;font-weight:bold;">Butler &amp; Associates Construction</div>
  <div style="font-size:17px;font-weight:bold;color:${GOLD};">Crew Labor Schedule</div>
</div>
<div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #d1d5db;">
  <div style="color:${GOLD};font-size:13px;">Project: ${project.name ?? "—"}</div>
  <div style="font-size:13px;">Date: ${today}</div>
</div>
<div style="margin-bottom:24px;">
  <h3 style="font-size:15px;font-weight:bold;margin-bottom:12px;">Scope 1 — ${project.name ?? "Labor Items"}</h3>
  <table>
    <thead>
      <tr style="background:${BLACK};color:#fff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:bold;">Scope Item</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:80px;">Unit</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:70px;">Qty</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:bold;width:90px;">Rate</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:bold;width:110px;">Crew Pay</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <td colspan="4" style="padding:10px 14px;text-align:right;font-size:12px;color:${GOLD};font-weight:bold;border-top:1px solid #e5e7eb;">Subtotal</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;color:${GOLD};font-weight:bold;border-top:1px solid #e5e7eb;">${fmt(total)}</td>
      </tr>
    </tbody>
  </table>
</div>
<div style="background:${BLACK};color:#fff;display:flex;justify-content:space-between;align-items:center;padding:16px 24px;margin-bottom:36px;">
  <div style="font-size:14px;font-weight:bold;letter-spacing:0.5px;">TOTAL CREW PAYOUT</div>
  <div style="font-size:18px;font-weight:bold;color:${GOLD};">${fmt(total)}</div>
</div>
${fio?.notes ? `<div style="margin-bottom:32px;"><div style="font-weight:bold;font-size:13px;margin-bottom:8px;">Notes</div><p style="font-size:12px;line-height:1.65;color:#374151;">${fio.notes}</p></div>` : ""}
<div style="flex:1;"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;">
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Butler &amp; Associates Construction</div>
    <div style="border-bottom:1px solid #111;margin-bottom:6px;"></div>
    <div style="font-size:11px;color:#6b7280;">Authorized Signature / Date</div>
  </div>
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Crew Lead / Subcontractor${project.foremanName ? ` — ${project.foremanName}` : ""}</div>
    <div style="border-bottom:1px solid #111;margin-bottom:6px;"></div>
    <div style="font-size:11px;color:#6b7280;">Signature / Date</div>
  </div>
</div>
<div style="margin-top:48px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
  Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup blocked — allow popups and try again."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const grandTotal = (editMode ? editItems : fio?.items || []).reduce(
    (sum: number, item: any) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.labor_cost_per_unit) || 0),
    0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div>
              <SheetTitle>Field Installation Order</SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-0.5 mt-1">
                  {project?.name && project?.clientName && (
                    <p className="text-sm text-muted-foreground">{project.name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{project?.foremanName || "No foreman assigned"}</p>
                </div>
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              {!editMode && fio && (
                <Button variant="outline" size="sm" onClick={() => { setEditMode(true); setEditItems(fio.items || []); }}>
                  <Edit className="h-4 w-4 mr-1.5" /> Edit
                </Button>
              )}
              {!editMode && (
                <Button variant="outline" size="sm" onClick={exportPDF}>
                  <FileDown className="h-4 w-4 mr-1.5" /> Export PDF
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : editMode ? (
            /* ── Edit / Create Mode ── */
            <div className="space-y-4">
              {/* Suggestions checklist — only shown when creating new FIO */}
              {!fio && suggestedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suggested labor items from proposal — select which to include:</p>
                  {suggestedItems.map((item) => {
                    const checked = checkedIds.has(item.id);
                    return (
                      <div key={item.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                        onClick={() => {
                          const next = new Set(checkedIds);
                          if (checked) {
                            next.delete(item.id);
                            setEditItems(editItems.filter((e) => e.id !== item.id));
                          } else {
                            next.add(item.id);
                            setEditItems([...editItems, { ...item }]);
                          }
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
              {/* Selected / manual items — editable table */}
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
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(idx, "unit", e.target.value)}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
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
                <span className="font-semibold text-sm">Grand Total: {formatCurrency(grandTotal)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); if (!fio) onOpenChange(false); }}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    {fio ? "Save Changes" : "Create FIO"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ── View Mode — matches Butler Crew Labor Schedule PDF design ── */
            <div className="bg-white space-y-5 font-sans text-[13px]">

              {/* Black header bar */}
              <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 -mx-0 rounded-sm">
                <span className="text-[18px] font-bold">Butler &amp; Associates Construction</span>
                <span className="text-[15px] font-bold text-[#C9A84C]">Crew Labor Schedule</span>
              </div>

              {/* Project / Date row */}
              <div className="flex items-center justify-between border-b border-gray-300 pb-3">
                <span className="text-[#C9A84C] text-sm">Project: {project?.name ?? "—"}</span>
                <span className="text-sm text-gray-700">
                  Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  {fio?.status && <Badge variant="outline" className="ml-3 capitalize text-xs">{fio.status}</Badge>}
                </span>
              </div>

              {/* Scope heading */}
              <div>
                <h3 className="text-[14px] font-bold mb-3">Scope 1 — {project?.name ?? "Labor Items"}</h3>

                {/* Table */}
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#111111] text-white">
                      <th className="py-2.5 px-3 text-left font-semibold">Scope Item</th>
                      <th className="py-2.5 px-3 text-center font-semibold w-16">Unit</th>
                      <th className="py-2.5 px-3 text-center font-semibold w-14">Qty</th>
                      <th className="py-2.5 px-3 text-right font-semibold w-20">Rate</th>
                      <th className="py-2.5 px-3 text-right font-semibold w-24">Crew Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fio?.items || []).map((item: any, idx: number) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const rate = parseFloat(item.labor_cost_per_unit) || 0;
                      return (
                        <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                          <td className="py-2.5 px-3">{item.product_name}</td>
                          <td className="py-2.5 px-3 text-center">{item.unit}</td>
                          <td className="py-2.5 px-3 text-center">{qty.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right">{rate > 0 ? formatCurrency(rate) : "—"}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(qty * rate)}</td>
                        </tr>
                      );
                    })}
                    {/* Subtotal row */}
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">Subtotal</td>
                      <td className="py-2.5 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">{formatCurrency(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total payout bar */}
              <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 rounded-sm">
                <span className="text-sm font-bold tracking-wide">TOTAL CREW PAYOUT</span>
                <span className="text-lg font-bold text-[#C9A84C]">{formatCurrency(grandTotal)}</span>
              </div>

              {/* Notes */}
              {fio?.notes && (
                <div>
                  <div className="font-bold text-sm mb-1">Notes</div>
                  <p className="text-xs text-gray-600 leading-relaxed">{fio.notes}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-10 pt-4 border-t border-gray-300 mt-4">
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
