import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, ChevronLeft, Loader2, ClipboardEdit } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { changeOrdersAPI } from "../api/change-orders";
import { toast } from "sonner";

interface ChangeOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
}

type View = "list" | "create" | "detail";

const STATUS_CONFIG = {
  draft:          { label: "Draft",          className: "bg-gray-100 text-gray-700" },
  pending_client: { label: "Pending Client", className: "bg-amber-100 text-amber-700" },
  approved:       { label: "Approved",       className: "bg-green-100 text-green-700" },
  rejected:       { label: "Rejected",       className: "bg-red-100 text-red-700" },
} as const;

const CATEGORIES = ["Materials", "Labor", "Equipment", "Permits", "Subcontractor", "Other"];
const EMPTY_ITEM = { category: "Materials", description: "", quantity: 1, unit_price: 0, total: 0 };

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function ChangeOrdersSheet({ open, onOpenChange, client, project }: ChangeOrdersSheetProps) {
  const [view, setView] = useState<View>("list");
  const [cos, setCos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCo, setSelectedCo] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  const loadCOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const data = await changeOrdersAPI.getByClient(client.id);
      setCos(data);
    } catch (err: any) {
      toast.error("Failed to load change orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setView("list");
      loadCOs();
    }
  }, [open, client?.id]);

  const resetForm = () => {
    setTitle("");
    setReason("");
    setTimelineImpact("");
    setItems([{ ...EMPTY_ITEM }]);
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }

    setSaving(true);
    try {
      await changeOrdersAPI.create(
        {
          client_id: client.id,
          project_id: project?.id,
          title: title.trim(),
          reason: reason.trim(),
          timeline_impact: timelineImpact || undefined,
        },
        items.filter((i) => i.description.trim()).map((item, i) => ({
          ...item,
          sort_order: i,
        }))
      );
      toast.success("Change order created");
      resetForm();
      setView("list");
      loadCOs();
    } catch (err: any) {
      toast.error(err.message || "Failed to create change order");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (coId: string, status: string) => {
    try {
      await changeOrdersAPI.updateStatus(coId, status);
      setCos((prev) => prev.map((c) => c.id === coId ? { ...c, status } : c));
      if (selectedCo?.id === coId) setSelectedCo((prev: any) => ({ ...prev, status }));
      toast.success(`Status updated to ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: any) =>
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        const updated = { ...item, [key]: value };
        if (key === "quantity" || key === "unit_price") {
          updated.total = (Number(key === "quantity" ? value : updated.quantity) || 0) *
                          (Number(key === "unit_price" ? value : updated.unit_price) || 0);
        }
        return updated;
      })
    );

  const totalCostImpact = items.reduce((s, i) => s + (i.total || 0), 0);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            {view !== "list" && (
              <button
                onClick={() => { setView("list"); setSelectedCo(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">
                {view === "list" ? "Change Orders" : view === "create" ? "New Change Order" : selectedCo?.title}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {client?.first_name} {client?.last_name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { resetForm(); setView("create"); }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Change Order
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cos.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardEdit className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No change orders yet</p>
                  <Button size="sm" className="mt-4" onClick={() => { resetForm(); setView("create"); }}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create First Change Order
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {cos.map((co) => {
                    const cfg = STATUS_CONFIG[co.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                    return (
                      <button
                        key={co.id}
                        className="w-full text-left border rounded-lg p-4 hover:bg-accent/40 transition-colors"
                        onClick={() => { setSelectedCo(co); setView("detail"); }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm truncate">{co.title}</span>
                              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDate(co.created_at)}</div>
                          </div>
                          <div className={`text-sm font-bold shrink-0 ${co.cost_impact >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {co.cost_impact >= 0 ? "+" : ""}{formatCurrency(co.cost_impact)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CREATE VIEW ── */}
          {view === "create" && (
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm">Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Kitchen Island Extension"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Reason for Change <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Explain why this change is being requested — visible to client"
                  rows={3}
                  className="resize-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Timeline Impact</Label>
                <Input
                  placeholder="e.g. +5 days, No change"
                  value={timelineImpact}
                  onChange={(e) => setTimelineImpact(e.target.value)}
                />
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Cost Breakdown</Label>
                  <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Category</Label>
                          <select
                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            value={item.category}
                            onChange={(e) => updateItem(i, "category", e.target.value)}
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Describe the change"
                            value={item.description}
                            onChange={(e) => updateItem(i, "description", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            value={item.quantity}
                            min={0}
                            step="0.01"
                            onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price ($)</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            value={item.unit_price}
                            min={0}
                            step="0.01"
                            onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1 h-8 px-2 border rounded-md bg-background text-xs flex items-center font-semibold">
                            {formatCurrency(item.total)}
                          </div>
                          <button
                            onClick={() => removeItem(i)}
                            disabled={items.length === 1}
                            className="text-muted-foreground hover:text-destructive h-8 flex items-center"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total Cost Impact</span>
                  <span className={`text-lg font-bold ${totalCostImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totalCostImpact >= 0 ? "+" : ""}{formatCurrency(totalCostImpact)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {view === "detail" && selectedCo && (
            <div className="p-6 space-y-5">
              {/* Status buttons */}
              <div className="flex flex-wrap gap-2">
                {(["draft", "pending_client", "approved", "rejected"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = selectedCo.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(selectedCo.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                        active
                          ? `${cfg.className} border-transparent`
                          : "bg-background text-muted-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Reason */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                <p className="text-sm">{selectedCo.reason || "—"}</p>
              </div>

              {/* Timeline */}
              {selectedCo.timeline_impact && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Timeline Impact</p>
                  <p className="text-sm">{selectedCo.timeline_impact}</p>
                </div>
              )}

              {/* Line items */}
              {(selectedCo.items || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cost Breakdown</p>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                      <div className="col-span-4">Category</div>
                      <div className="col-span-4">Description</div>
                      <div className="col-span-2 text-right">Qty × Price</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    {(selectedCo.items || []).map((item: any, i: number) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t text-sm items-center">
                        <div className="col-span-4 text-muted-foreground text-xs">{item.category}</div>
                        <div className="col-span-4 font-medium">{item.description}</div>
                        <div className="col-span-2 text-right text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
                        <div className="col-span-2 text-right font-semibold">{formatCurrency(item.total)}</div>
                      </div>
                    ))}
                    <div className="px-3 py-3 border-t bg-muted/30 flex justify-between">
                      <span className="text-sm font-medium">Total Impact</span>
                      <span className={`text-sm font-bold ${selectedCo.cost_impact >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {selectedCo.cost_impact >= 0 ? "+" : ""}{formatCurrency(selectedCo.cost_impact)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">Created {formatDate(selectedCo.created_at)}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "create" && (
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("list")}>Cancel</Button>
            <Button size="sm" disabled={saving || !title.trim() || !reason.trim()} onClick={handleCreate}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
              Save as Draft
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
