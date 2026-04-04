import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, Send, CheckCircle, Truck, ChevronLeft, Loader2, Calendar, Package } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { purchaseOrdersAPI } from "../api/purchase-orders";
import { toast } from "sonner";

interface PurchaseOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
}

type View = "list" | "create" | "detail";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-700" },
  sent:      { label: "Sent",      className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmed", className: "bg-amber-100 text-amber-700" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
} as const;

const EMPTY_ITEM = { product_name: "", color: "", quantity: 1, unit: "each" };

export function PurchaseOrdersSheet({ open, onOpenChange, client, project }: PurchaseOrdersSheetProps) {
  const [view, setView] = useState<View>("list");
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("morning");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  const loadPOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const data = await purchaseOrdersAPI.getByClient(client.id);
      setPos(data);
    } catch (err: any) {
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setView("list");
      loadPOs();
    }
  }, [open, client?.id]);

  const resetForm = () => {
    setSupplierName("");
    setDeliveryDate("");
    setDeliveryTime("morning");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
  };

  const handleCreate = async () => {
    if (!supplierName.trim()) { toast.error("Supplier name is required"); return; }
    if (!project?.id && !client?.id) { toast.error("No project linked to this client"); return; }

    setSaving(true);
    try {
      const validItems = items.filter((i) => i.product_name.trim());
      await purchaseOrdersAPI.create(
        {
          project_id: project?.id,
          client_id: client?.id,
          supplier_name: supplierName.trim(),
          delivery_address: [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
          delivery_date: deliveryDate || undefined,
          delivery_time: deliveryTime,
          notes: notes || undefined,
        } as any,
        validItems.map((item, i) => ({
          product_name: item.product_name,
          color: item.color,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || "each",
          sort_order: i,
        }))
      );
      toast.success("Purchase order created");
      resetForm();
      setView("list");
      loadPOs();
    } catch (err: any) {
      toast.error(err.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (poId: string, status: string) => {
    try {
      await purchaseOrdersAPI.update(poId, { status });
      setPos((prev) => prev.map((p) => p.id === poId ? { ...p, status } : p));
      if (selectedPo?.id === poId) setSelectedPo((prev: any) => ({ ...prev, status }));
      toast.success(`Status updated to ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}`);
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: any) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item));

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
                onClick={() => { setView("list"); setSelectedPo(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">
                {view === "list" ? "Purchase Orders" : view === "create" ? "New Purchase Order" : `PO — ${selectedPo?.supplier_name}`}
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {client?.first_name} {client?.last_name}
                {client?.address && ` · ${client.address}`}
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
                  New PO
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pos.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No purchase orders yet</p>
                  <Button size="sm" className="mt-4" onClick={() => { resetForm(); setView("create"); }}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create First PO
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pos.map((po) => {
                    const cfg = STATUS_CONFIG[po.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                    return (
                      <button
                        key={po.id}
                        className="w-full text-left border rounded-lg p-4 hover:bg-accent/40 transition-colors"
                        onClick={() => { setSelectedPo(po); setView("detail"); }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm truncate">{po.supplier_name}</span>
                              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-3">
                              {po.delivery_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(po.delivery_date)}
                                </span>
                              )}
                              <span>{po.items?.length ?? 0} item{(po.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                            </div>
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
                <Label className="text-sm">Supplier / Company Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Home Depot, Oldcastle, Local Supplier"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Desired Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Time Window</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                  >
                    <option value="morning">Morning (7am–12pm)</option>
                    <option value="afternoon">Afternoon (12pm–5pm)</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>
              </div>

              {/* Materials Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Materials</Label>
                  <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-2">Color</div>
                    <div className="col-span-2">Unit</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-1"></div>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t items-center">
                      <Input
                        className="col-span-5 h-8 text-xs"
                        placeholder="Material name"
                        value={item.product_name}
                        onChange={(e) => updateItem(i, "product_name", e.target.value)}
                      />
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="—"
                        value={item.color}
                        onChange={(e) => updateItem(i, "color", e.target.value)}
                      />
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="ea"
                        value={item.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                      />
                      <Input
                        type="number"
                        className="col-span-2 h-8 text-xs"
                        value={item.quantity}
                        min={0}
                        onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      />
                      <button
                        className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Delivery Notes</Label>
                <Textarea
                  placeholder="Any special instructions for delivery..."
                  rows={3}
                  className="resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {view === "detail" && selectedPo && (
            <div className="p-6 space-y-5">
              {/* Status row */}
              <div className="flex items-center gap-3">
                {(["draft", "sent", "confirmed", "delivered"] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = selectedPo.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(selectedPo.id, s)}
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

              {/* Delivery info */}
              {(selectedPo.delivery_date || selectedPo.delivery_time) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Delivery</p>
                  <div className="flex gap-6 text-sm">
                    {selectedPo.delivery_date && (
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-semibold">{formatDate(selectedPo.delivery_date)}</p>
                      </div>
                    )}
                    {selectedPo.delivery_time && (
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="font-semibold capitalize">{selectedPo.delivery_time}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deliver to */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Deliver To</p>
                <p className="font-semibold text-sm">{client?.first_name} {client?.last_name}</p>
                {client?.address && <p className="text-sm text-muted-foreground">{[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ")}</p>}
              </div>

              {/* Materials table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Materials</p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-3">Color</div>
                    <div className="col-span-2">Unit</div>
                    <div className="col-span-2 text-right">Qty</div>
                  </div>
                  {(selectedPo.items || []).map((item: any, i: number) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t text-sm items-center">
                      <div className="col-span-5 font-medium">{item.product_name}</div>
                      <div className="col-span-3 text-muted-foreground">{item.color || "—"}</div>
                      <div className="col-span-2 text-muted-foreground">{item.unit}</div>
                      <div className="col-span-2 text-right font-semibold">{item.quantity}</div>
                    </div>
                  ))}
                  {(selectedPo.items || []).length === 0 && (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">No items</div>
                  )}
                </div>
              </div>

              {selectedPo.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-blue-900">{selectedPo.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "create" && (
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("list")}>Cancel</Button>
            <Button size="sm" disabled={saving || !supplierName.trim()} onClick={handleCreate}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
              Save as Draft
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
