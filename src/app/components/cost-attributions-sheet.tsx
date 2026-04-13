import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, FileText, Loader2, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { receiptsAPI } from "../api/receipts";
import { activityLogAPI } from "../api/activity-log";
import { toast } from "sonner";

interface CostAttributionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onReceiptChange?: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const EMPTY = { name: "", amount: "", category: "material" as "material" | "labor", note: "" };

export function CostAttributionsSheet({ open, onOpenChange, client, project, onReceiptChange }: CostAttributionsSheetProps) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const data = await receiptsAPI.getByProject(project.id);
      setReceipts(data || []);
    } catch {
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadReceipts();
  }, [open, project?.id]);

  const totalMaterial = receipts.filter((r) => r.category === "material").reduce((s, r) => s + r.amount, 0);
  const totalLabor    = receipts.filter((r) => r.category === "labor").reduce((s, r) => s + r.amount, 0);

  const handleAdd = async () => {
    if (!form.name || !form.amount) { toast.error("Name and amount are required"); return; }
    if (!project?.id) { toast.error("No project linked yet"); return; }
    setSaving(true);
    try {
      const saved = await receiptsAPI.create(
        { project_id: project.id, name: form.name, amount: parseFloat(form.amount), category: form.category, note: form.note || undefined },
        droppedFile || undefined
      );
      setReceipts((prev) => [saved, ...prev]);
      setForm({ ...EMPTY });
      setDroppedFile(null);
      activityLogAPI.create({ client_id: client?.id, action_type: "receipt_added", description: `Receipt added: "${form.name}" — ${fmt(parseFloat(form.amount))} (${form.category})` }).catch(() => {});
      toast.success("Receipt added");
      onReceiptChange?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to add receipt");
    } finally {
      setSaving(false);
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
      toast.error("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Cost Attributions
          </SheetTitle>
          <SheetDescription className="text-xs">
            {client?.first_name} {client?.last_name} — actual material &amp; labor costs
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 p-4 border-b bg-muted/30">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Materials</p>
              <p className="font-bold text-base">{fmt(totalMaterial)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Labor</p>
              <p className="font-bold text-base">{fmt(totalLabor)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Costs</p>
              <p className="font-bold text-base">{fmt(totalMaterial + totalLabor)}</p>
            </div>
          </div>

          {/* Add Receipt Form */}
          <div className="p-4 border-b space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Receipt</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="h-8 text-sm" placeholder="e.g. Home Depot — sand" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount ($)</Label>
                <Input type="number" className="h-8 text-sm" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                >
                  <option value="material">Material</option>
                  <option value="labor">Labor</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Input className="h-8 text-sm" placeholder="Optional" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            {/* File drop */}
            <div
              className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer text-xs transition-colors ${isDragging ? "border-primary bg-primary/5" : "hover:border-primary text-muted-foreground"}`}
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

            <Button size="sm" className="w-full" disabled={saving || !form.name || !form.amount} onClick={handleAdd}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Add Receipt
            </Button>
          </div>

          {/* Receipts list */}
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : receipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No receipts yet</p>
                <p className="text-xs mt-1">Upload receipts to track material and labor costs.</p>
              </div>
            ) : (
              receipts.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{r.name}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${r.category === "material" ? "border-amber-300 text-amber-700" : "border-blue-300 text-blue-700"}`}>
                        {r.category}
                      </Badge>
                    </div>
                    {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:opacity-75">
                        <FileText className="h-3 w-3" />{r.file_name || "Receipt"}
                      </a>
                    )}
                  </div>
                  <span className="font-semibold text-sm shrink-0">{fmt(r.amount)}</span>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
