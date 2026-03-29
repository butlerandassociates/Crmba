import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
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
  const printRef = useRef<HTMLDivElement>(null);

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
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup blocked — allow popups and try again."); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FIO – ${project.name ?? "Order"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px; }
    h2 { font-size: 16px; font-weight: 700; }
    .space-y-6 > * + * { margin-top: 24px; }
    .space-y-0\\.5 > * + * { margin-top: 2px; }
    .flex { display: flex; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-end { justify-content: flex-end; }
    .items-center { align-items: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-sm { font-size: 13px; }
    .text-xs { font-size: 11px; }
    .text-gray-600 { color: #4b5563; }
    .text-white { color: #fff; }
    .bg-white { background: #fff; }
    .bg-gray-50 { background: #f9fafb; }
    .bg-gray-100 { background: #f3f4f6; }
    .bg-gray-900 { background: #111827; }
    .border-b-2 { border-bottom: 2px solid; }
    .border-t-2 { border-top: 2px solid; }
    .border-x-2 { border-left: 2px solid; border-right: 2px solid; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-gray-900 { border-color: #111827; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-200 { border-color: #e5e7eb; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: 1fr 1fr; }
    .gap-2 { gap: 8px; }
    .gap-4 { gap: 16px; }
    .gap-6 { gap: 24px; }
    .px-3 { padding-left: 12px; padding-right: 12px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .py-3 { padding-top: 12px; padding-bottom: 12px; }
    .pb-4 { padding-bottom: 16px; }
    .pt-6 { padding-top: 24px; }
    .mt-1 { margin-top: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .h-12 { height: 48px; }
    .ml-4 { margin-left: 16px; }
    .rounded-t-lg { border-radius: 8px 8px 0 0; }
    .rounded-b-lg { border-radius: 0 0 8px 8px; }
    .capitalize { text-transform: capitalize; }
    /* badge */
    .inline-flex { display: inline-flex; }
    .border { border: 1px solid #d1d5db; }
    .rounded-full { border-radius: 9999px; }
    .px-2\\.5 { padding-left: 10px; padding-right: 10px; }
    .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
    @media print { body { padding: 0; } @page { margin: 0.5in; } }
  </style>
</head>
<body>${content}</body>
</html>`);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle>Field Installation Order</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-0.5 mt-1">
                  {project?.name && project?.clientName && (
                    <p className="text-sm text-muted-foreground">{project.name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{project?.foremanName || "No foreman assigned"}</p>
                </div>
              </DialogDescription>
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
        </DialogHeader>

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
              {/* Selected / manual items — editable */}
              {editItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {!fio ? "Selected items — edit as needed:" : "Add or adjust labor items to assign to the foreman."}
                  </p>
                  {editItems.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2 items-end border rounded-lg p-3 bg-muted/20">
                      <div className="space-y-1">
                        <Label className="text-xs">Service / Product</Label>
                        <Input value={item.product_name} onChange={(e) => updateItem(idx, "product_name", e.target.value)} className="h-8 text-sm" placeholder="e.g., Labor - Concrete Pour" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="h-8 text-sm" placeholder="hr, sq ft" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">$/Unit</Label>
                        <Input type="number" value={item.labor_cost_per_unit} onChange={(e) => updateItem(idx, "labor_cost_per_unit", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
            /* ── View Mode ── */
            <div ref={printRef} className="bg-white space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b-2 border-gray-900">
                <div>
                  <h2 className="text-lg font-bold">Field Installation Order</h2>
                  <div className="text-sm space-y-0.5 mt-1">
                    <div className="font-semibold">{project?.foremanName}</div>
                    <div className="text-gray-600">{project?.foreman?.phone || project?.foremanPhone || "—"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold">{project?.name}</h2>
                  <div className="text-sm space-y-0.5 mt-1 text-gray-600">
                    <div>{project?.clientName}</div>
                    {project?.startDate && <div>Start: {new Date(project.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
                  </div>
                  <Badge variant="outline" className="mt-1 capitalize">{fio?.status}</Badge>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 bg-gray-100 px-3 py-2 rounded-t-lg font-semibold text-xs border-b-2 border-gray-300">
                  <div>Scope of Work</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Unit</div>
                  <div className="text-right">$/Unit</div>
                  <div className="text-right">Total</div>
                </div>
                <div className="border-x-2 border-b-2 border-gray-300 rounded-b-lg">
                  {(fio?.items || []).map((item: any, idx: number) => (
                    <div key={item.id} className={`grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 px-3 py-2 text-xs ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${idx !== (fio.items.length - 1) ? "border-b border-gray-200" : ""}`}>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-right">{item.quantity}</div>
                      <div className="text-right">{item.unit}</div>
                      <div className="text-right">{formatCurrency(item.labor_cost_per_unit)}</div>
                      <div className="text-right font-semibold">{formatCurrency(item.total_labor ?? item.quantity * item.labor_cost_per_unit)}</div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-4 px-3 py-3 bg-gray-900 text-white font-bold text-xs rounded-b-lg">
                    <span>TOTAL LABOR PAYMENT:</span>
                    <span className="text-sm">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-gray-300">
                <div>
                  <div className="font-semibold mb-2 text-sm">Butler & Associates Construction, Inc.</div>
                  <div className="border-b-2 border-gray-900 h-12 mb-2" />
                  <div className="text-xs text-gray-600">Signature <span className="ml-4">Date: _______________</span></div>
                </div>
                <div>
                  <div className="font-semibold mb-2 text-sm">Crew Foreman — {project?.foremanName}</div>
                  <div className="border-b-2 border-gray-900 h-12 mb-2" />
                  <div className="text-xs text-gray-600">Signature <span className="ml-4">Date: _______________</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
