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
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface FIOModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
}

export function FieldInstallationOrderModal({ open, onOpenChange, project }: FIOModalProps) {
  const [fio, setFio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laborItems, setLaborItems] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
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
        // No FIO yet — fetch labor items from latest estimate to pre-populate
        setFio(null);
        const items = await fetchLaborFromEstimate();
        setEditItems(items);
        setEditMode(true); // open in create mode
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

  const exportPDF = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const ratio = pdfWidth / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 10, canvas.width * ratio, canvas.height * ratio);
      pdf.save(`field-installation-order-${project.name?.replace(/\s+/g, "-")}.pdf`);
    } catch (e) {
      toast.error("Failed to export PDF");
    }
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
              <DialogDescription>{project?.name} — {project?.foremanName || "No foreman assigned"}</DialogDescription>
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Add or adjust labor items to assign to the foreman.</p>
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
                  <div className="grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 px-3 py-3 bg-gray-900 text-white font-bold text-xs rounded-b-lg">
                    <div className="col-span-4 text-right">TOTAL LABOR PAYMENT:</div>
                    <div className="text-right text-sm">{formatCurrency(grandTotal)}</div>
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
