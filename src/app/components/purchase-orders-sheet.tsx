import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, Send, ChevronLeft, Loader2, Calendar, Package, X, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { purchaseOrdersAPI } from "../api/purchase-orders";
import { activityLogAPI } from "../api/activity-log";
import { notificationsAPI } from "../utils/api";
import { toast } from "sonner";

interface PurchaseOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSave?: () => void;
}

type View = "list" | "create" | "detail";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-700" },
  sent:      { label: "Sent",      className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmed", className: "bg-amber-100 text-amber-700" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
} as const;

const UNIT_OPTIONS = ["SF", "LF", "EA", "Lump Sum"] as const;
type UnitOption = typeof UNIT_OPTIONS[number];

interface AvailableMaterial {
  id: string;
  name: string;
  availableColors: string[];
  defaultUnit: UnitOption;
}

const AVAILABLE_MATERIALS: AvailableMaterial[] = [
  { id: "mat-001", name: "Concrete - 4000 PSI",              availableColors: ["Natural Gray", "Charcoal", "Beige"],         defaultUnit: "SF" },
  { id: "mat-002", name: "Retaining Wall Block - Allan Block",availableColors: ["Gray", "Tan", "Brown", "Charcoal"],         defaultUnit: "SF" },
  { id: "mat-003", name: "Wall Caps - Concrete",              availableColors: ["Gray", "Tan", "Brown"],                     defaultUnit: "EA" },
  { id: "mat-004", name: "Rebar #4",                          availableColors: [],                                           defaultUnit: "LF" },
  { id: "mat-005", name: "Gravel Base - 3/4 inch",            availableColors: [],                                           defaultUnit: "SF" },
  { id: "mat-006", name: "Drainage Pipe - 4 inch perforated", availableColors: ["Black"],                                    defaultUnit: "LF" },
  { id: "mat-007", name: "Geotextile Fabric",                 availableColors: [],                                           defaultUnit: "SF" },
  { id: "mat-008", name: "Pavers - Concrete",                 availableColors: ["Gray", "Tan", "Red", "Charcoal"],           defaultUnit: "SF" },
  { id: "mat-009", name: "Polymeric Sand",                    availableColors: ["Tan", "Gray"],                              defaultUnit: "Lump Sum" },
  { id: "mat-010", name: "Landscape Fabric - Commercial Grade",availableColors: [],                                           defaultUnit: "SF" },
  { id: "mat-011", name: "Deck Boards - Composite",           availableColors: ["Cedar", "Gray", "Walnut", "Weathered Wood"],defaultUnit: "LF" },
  { id: "mat-012", name: "Deck Railing - Aluminum",           availableColors: ["Black", "Bronze", "White"],                 defaultUnit: "LF" },
  { id: "mat-013", name: "Pressure Treated Lumber - 2x6",     availableColors: [],                                           defaultUnit: "LF" },
  { id: "mat-014", name: "Pressure Treated Lumber - 4x4",     availableColors: [],                                           defaultUnit: "EA" },
  { id: "mat-015", name: "Deck Screws - Stainless Steel",     availableColors: [],                                           defaultUnit: "Lump Sum" },
  { id: "mat-016", name: "Sod - Bermuda",                     availableColors: [],                                           defaultUnit: "SF" },
  { id: "mat-017", name: "Sod - Zoysia",                      availableColors: [],                                           defaultUnit: "SF" },
  { id: "mat-018", name: "Mulch - Brown",                     availableColors: ["Brown", "Black", "Red"],                   defaultUnit: "Lump Sum" },
  { id: "mat-019", name: "Edging - Steel",                    availableColors: ["Black"],                                    defaultUnit: "LF" },
  { id: "mat-020", name: "Other",                             availableColors: [],                                           defaultUnit: "EA" },
];

interface MaterialLine {
  id: string;
  product_name: string;
  color: string;
  quantity: number;
  unit: UnitOption;
  availableColors: string[];
}

const emptyLine = (): MaterialLine => ({
  id: `line-${Date.now()}-${Math.random()}`,
  product_name: "",
  color: "",
  quantity: 0,
  unit: "SF",
  availableColors: [],
});

export function PurchaseOrdersSheet({ open, onOpenChange, client, project, onSave }: PurchaseOrdersSheetProps) {
  const [view, setView] = useState<View>("list");
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState<"morning" | "afternoon" | "late afternoon">("morning");
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<MaterialLine[]>([emptyLine()]);

  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadPOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const data = await purchaseOrdersAPI.getByClient(client.id);
      setPos(data);
    } catch {
      toast.error("Failed to load purchase orders — please refresh.");
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
    setContactName("");
    setContactPhone("");
    setContactEmail(client?.email || "");
    setDeliveryDate("");
    setDeliveryTime("morning");
    setNotes("");
    setMaterials([emptyLine()]);
    setShowSendModal(false);
    setRecipientName("");
    setRecipientEmail("");
    setErrors({});
    setIsEditing(false);
    setConfirmDelete(false);
  };

  const handleEditPo = (po: any) => {
    setSupplierName(po.supplier_name || "");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setDeliveryDate(po.delivery_date || "");
    setDeliveryTime(po.delivery_time || "morning");
    setNotes(po.notes || "");
    setMaterials(
      (po.items || []).length > 0
        ? po.items.map((item: any) => {
            const mat = AVAILABLE_MATERIALS.find((m) => m.name === item.product_name);
            return {
              id: `line-${Date.now()}-${Math.random()}`,
              product_name: item.product_name,
              color: item.color || "",
              quantity: item.quantity,
              unit: item.unit as UnitOption,
              availableColors: mat?.availableColors || [],
            };
          })
        : [emptyLine()]
    );
    setErrors({});
    setIsEditing(true);
    setView("create");
  };

  const handleUpdatePo = async () => {
    if (!selectedPo?.id) return;
    setSaving(true);
    try {
      await purchaseOrdersAPI.update(selectedPo.id, {
        supplier_name: supplierName.trim(),
        delivery_date: deliveryDate || undefined,
        notes: notes || undefined,
      });
      const validItems = materials.filter((m) => m.product_name.trim());
      await purchaseOrdersAPI.updateItems(
        selectedPo.id,
        validItems.map((item, i) => ({
          product_name: item.product_name,
          color: item.color || undefined,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          sort_order: i,
        }))
      );
      activityLogAPI.create({ client_id: client?.id, action_type: "po_updated", description: `Purchase order updated — supplier: ${supplierName.trim()}` }).catch(() => {});
      toast.success("Purchase order updated");
      // Refresh PO list then go back to the detail view for this PO
      const fresh = await purchaseOrdersAPI.getByClient(client.id);
      setPos(fresh);
      const updatedPo = fresh.find((p: any) => p.id === selectedPo.id) ?? selectedPo;
      setSelectedPo(updatedPo);
      resetForm();
      setView("detail");
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update purchase order");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePo = async () => {
    if (!selectedPo?.id) return;
    setDeleting(true);
    try {
      await purchaseOrdersAPI.delete(selectedPo.id);
      activityLogAPI.create({ client_id: client?.id, action_type: "po_deleted", description: `Purchase order deleted — supplier: ${selectedPo.supplier_name}` }).catch(() => {});
      toast.success("Purchase order deleted");
      setConfirmDelete(false);
      setSelectedPo(null);
      setView("list");
      loadPOs();
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete purchase order");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (sendAfter = false) => {
    const newErrors: Record<string, string> = {};

    if (!supplierName.trim())
      newErrors.supplierName = "Supplier / vendor name is required";

    if (sendAfter) {
      if (!deliveryDate)
        newErrors.deliveryDate = "Delivery date is required before sending";
      if (!materials.some((m) => m.product_name.trim()))
        newErrors.materials = "At least one material must be selected before sending";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (!project?.id && !client?.id) { toast.error("No project linked to this client"); return; }

    setSaving(true);
    try {
      const validItems = materials.filter((m) => m.product_name.trim());
      await purchaseOrdersAPI.create(
        {
          project_id: project?.id,
          client_id: client?.id,
          supplier_name: supplierName.trim(),
          delivery_address: [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
          delivery_date: deliveryDate || undefined,
          delivery_time: deliveryTime,
          notes: notes || undefined,
          status: sendAfter ? "sent" : "draft",
        } as any,
        validItems.map((item, i) => ({
          product_name: item.product_name,
          color: item.color || undefined,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          sort_order: i,
        }))
      );
      activityLogAPI.create({ client_id: client?.id, action_type: "po_created", description: `Purchase order ${sendAfter ? "sent" : "saved as draft"} — supplier: ${supplierName.trim()}` }).catch(() => {});
      if (sendAfter) {
        const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
        notificationsAPI.create({
          type: "po_sent",
          title: "Purchase Order Sent",
          message: `PO sent to ${supplierName.trim()}${clientName ? ` — ${clientName}` : ""}.`,
          link: client?.id ? `/clients/${client.id}` : "/",
          metadata: { client_id: client?.id, project_id: project?.id },
        }).catch(() => {});
      }
      toast.success(sendAfter ? "Purchase order sent" : "Purchase order saved as draft");
      resetForm();
      setView("list");
      loadPOs();
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const handleSendPO = () => {
    const newErrors: Record<string, string> = {};
    if (!recipientName.trim()) newErrors.recipientName = "Recipient name is required";
    if (!recipientEmail.trim()) newErrors.recipientEmail = "Recipient email is required";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setShowSendModal(false);
    handleCreate(true);
  };

  const handleStatusUpdate = async (poId: string, status: string) => {
    try {
      await purchaseOrdersAPI.update(poId, { status });
      setPos((prev) => prev.map((p) => p.id === poId ? { ...p, status } : p));
      if (selectedPo?.id === poId) setSelectedPo((prev: any) => ({ ...prev, status }));
      const statusLabel = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label ?? status;
      activityLogAPI.create({ client_id: client?.id, action_type: "po_status_updated", description: `Purchase order status updated to "${statusLabel}"` }).catch(() => {});
      toast.success(`Status updated to ${statusLabel}`);
    } catch {
      toast.error("Failed to update status — please try again.");
    }
  };

  const addMaterialLine = () => setMaterials((prev) => [...prev, emptyLine()]);
  const removeMaterialLine = (id: string) => setMaterials((prev) => prev.filter((m) => m.id !== id));
  const updateMaterial = (id: string, field: keyof MaterialLine, value: any) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (field === "product_name") {
          const mat = AVAILABLE_MATERIALS.find((am) => am.name === value);
          return { ...m, product_name: value, unit: mat?.defaultUnit || m.unit, availableColors: mat?.availableColors || [], color: "" };
        }
        return { ...m, [field]: value };
      })
    );
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const deliveryTimeLabel = (t: string) => {
    if (t === "morning") return "Morning (8am–12pm)";
    if (t === "afternoon") return "Afternoon (12pm–4pm)";
    if (t === "late afternoon") return "Late Afternoon (4pm–6pm)";
    return t;
  };

  const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              {view !== "list" && (
                <button
                  onClick={() => {
                    if (view === "create" && isEditing) {
                      resetForm();
                      setView("detail");
                    } else {
                      setView("list");
                      setSelectedPo(null);
                    }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <SheetTitle className="text-base">
                  {view === "list" ? "Purchase Orders" : view === "create" ? (isEditing ? "Edit Purchase Order" : "New Purchase Order") : `PO — ${selectedPo?.supplier_name || selectedPo?.vendor_name}`}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {client?.first_name} {client?.last_name}
                  {/* {clientAddress && ` · ${clientAddress}`} */}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── LIST VIEW ── */}
            {view === "list" && (
              <div className="p-4 space-y-3">
                {!loading && pos.length > 0 && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => { resetForm(); setView("create"); }}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      New PO
                    </Button>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pos.length === 0 ? (
                  <div className="text-center py-16">
                    <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium">No purchase orders yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first PO for this project</p>
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
                                <span className="font-semibold text-sm truncate">{po.supplier_name || po.vendor_name}</span>
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
              <div className="p-4 space-y-4">

                {/* Card 0: Supplier / Vendor Name */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Supplier / Vendor Name</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Company you are ordering from *</Label>
                      <Input
                        placeholder="e.g. Portland Concrete Supply, Home Depot"
                        value={supplierName}
                        className={errors.supplierName ? "border-destructive" : ""}
                        onChange={(e) => { setSupplierName(e.target.value); setErrors((p) => ({ ...p, supplierName: "" })); }}
                      />
                      {errors.supplierName && <p className="text-xs text-destructive">{errors.supplierName}</p>}
                    </div>
                  </CardContent>
                </Card>

                {/* Card 1: Client & Contact Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Client &amp; Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Client Name</Label>
                        <Input value={`${client?.first_name || ""} ${client?.last_name || ""}`.trim()} readOnly className="bg-muted/30 text-sm h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Client Address</Label>
                        <Input value={clientAddress} readOnly className="bg-muted/30 text-sm h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Business Contact Name</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder="Contact at our company"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Contact Phone</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder={client?.phone || "(555) 000-0000"}
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs font-semibold">Contact Email</Label>
                        <Input
                          type="email"
                          className="h-9 text-sm"
                          placeholder={client?.email || ""}
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Delivery Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Delivery Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Desired Delivery Date</Label>
                        <Input
                          type="date"
                          className={`h-9 text-sm ${errors.deliveryDate ? "border-destructive" : ""}`}
                          value={deliveryDate}
                          onChange={(e) => { setDeliveryDate(e.target.value); setErrors((p) => ({ ...p, deliveryDate: "" })); }}
                        />
                        {errors.deliveryDate && <p className="text-xs text-destructive">{errors.deliveryDate}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Time of Day</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value as any)}
                        >
                          <option value="morning">Morning (8am – 12pm)</option>
                          <option value="afternoon">Afternoon (12pm – 4pm)</option>
                          <option value="late afternoon">Late Afternoon (4pm – 6pm)</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Material Line Items */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Material Line Items</CardTitle>
                      <Button size="sm" className="bg-black hover:bg-gray-800 text-xs h-7" onClick={addMaterialLine}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Line
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b">
                      <div className="col-span-4">Material</div>
                      <div className="col-span-3">Color</div>
                      <div className="col-span-2">Quantity</div>
                      <div className="col-span-2">Unit</div>
                      <div className="col-span-1"></div>
                    </div>

                    {materials.map((mat) => (
                      <div key={mat.id} className="grid grid-cols-12 gap-2 bg-muted/30 rounded-lg p-2 items-center">
                        <div className="col-span-4">
                          <select
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={mat.product_name}
                            onChange={(e) => updateMaterial(mat.id, "product_name", e.target.value)}
                          >
                            <option value="">Select material...</option>
                            {AVAILABLE_MATERIALS.map((am) => (
                              <option key={am.id} value={am.name}>{am.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          {mat.availableColors.length > 0 ? (
                            <select
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                              value={mat.color}
                              onChange={(e) => updateMaterial(mat.id, "color", e.target.value)}
                            >
                              <option value="">Select color...</option>
                              {mat.availableColors.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          ) : (
                            <Input value="N/A" disabled className="h-8 text-xs bg-muted/20" />
                          )}
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            value={mat.quantity || ""}
                            min={0}
                            onChange={(e) => updateMaterial(mat.id, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={mat.unit}
                            onChange={(e) => updateMaterial(mat.id, "unit", e.target.value)}
                          >
                            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          {materials.length > 1 && (
                            <button
                              onClick={() => removeMaterialLine(mat.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  {errors.materials && <p className="text-xs text-destructive px-1 pb-1">{errors.materials}</p>}
                  </CardContent>
                </Card>

                {/* Card 4: Delivery Notes */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Delivery Notes <span className="text-muted-foreground font-normal text-sm">(Optional)</span></CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Any special delivery instructions..."
                      rows={3}
                      className="resize-none text-sm"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </CardContent>
                </Card>

              </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {view === "detail" && selectedPo && (
              <div className="p-6 space-y-5">
                {/* Status row */}
                <div className="flex flex-wrap items-center gap-2">
                  {(["draft", "sent", "confirmed", "delivered"] as const).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const active = selectedPo.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusUpdate(selectedPo.id, s)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                          active ? `${cfg.className} border-transparent` : "bg-background text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {/* Delivery info — amber box */}
                {(selectedPo.delivery_date || selectedPo.delivery_time) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Delivery</p>
                    <div className="flex gap-6 text-sm">
                      {selectedPo.delivery_date && (
                        <div>
                          <p className="text-xs text-amber-700/70">Date</p>
                          <p className="font-semibold text-amber-900">{formatDate(selectedPo.delivery_date)}</p>
                        </div>
                      )}
                      {selectedPo.delivery_time && (
                        <div>
                          <p className="text-xs text-amber-700/70">Time Window</p>
                          <p className="font-semibold text-amber-900">{deliveryTimeLabel(selectedPo.delivery_time)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Deliver to */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Deliver To</p>
                  <p className="font-semibold text-sm">{client?.first_name} {client?.last_name}</p>
                  {clientAddress && <p className="text-sm text-muted-foreground">{clientAddress}</p>}
                </div>

                {/* Supplier */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supplier / Vendor</p>
                  <p className="text-sm font-medium">{selectedPo.supplier_name || selectedPo.vendor_name || "—"}</p>
                </div>

                {/* Materials table */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Materials</p>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-900 text-xs font-semibold text-white">
                      <div className="col-span-5">Material</div>
                      <div className="col-span-3">Color</div>
                      <div className="col-span-2">Unit</div>
                      <div className="col-span-2 text-right">Qty</div>
                    </div>
                    {(selectedPo.items || []).map((item: any, i: number) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t text-sm items-center">
                        <div className="col-span-5 font-medium">{item.product_name}</div>
                        <div className="col-span-3 text-muted-foreground">{item.color || "N/A"}</div>
                        <div className="col-span-2 text-muted-foreground">{item.unit}</div>
                        <div className="col-span-2 text-right font-semibold">{item.quantity}</div>
                      </div>
                    ))}
                    {(selectedPo.items || []).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <Package className="h-7 w-7 mb-1.5 opacity-20" />
                        <p className="text-sm font-medium">No line items</p>
                        <p className="text-xs mt-0.5">Edit this PO to add products or materials.</p>
                      </div>
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
          {view === "detail" && selectedPo && (
            <div className="px-6 py-4 border-t flex justify-between gap-2">
              {/* Delete side */}
              <div>
                {!confirmDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive font-medium">Delete this PO?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleting}
                      onClick={handleDeletePo}
                    >
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {/* Edit side */}
              {!confirmDelete && (
                <Button size="sm" onClick={() => handleEditPo(selectedPo)}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              )}
            </div>
          )}

          {view === "create" && (
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setView(isEditing ? "detail" : "list"); }}>Cancel</Button>
              {isEditing ? (
                <Button size="sm" disabled={saving} onClick={handleUpdatePo}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Pencil className="h-4 w-4 mr-1.5" />}
                  Update PO
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleCreate(false)}
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
                    Save as Draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => setShowSendModal(true)}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    Preview &amp; Send
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Send PO Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md border">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <p className="font-semibold text-sm">Send Purchase Order</p>
              <button onClick={() => setShowSendModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient Name</Label>
                <Input
                  placeholder="e.g. Portland Concrete Supply"
                  value={recipientName}
                  className={errors.recipientName ? "border-destructive" : ""}
                  onChange={(e) => { setRecipientName(e.target.value); setErrors((p) => ({ ...p, recipientName: "" })); }}
                />
                {errors.recipientName && <p className="text-xs text-destructive">{errors.recipientName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="orders@supplier.com"
                  value={recipientEmail}
                  className={errors.recipientEmail ? "border-destructive" : ""}
                  onChange={(e) => { setRecipientEmail(e.target.value); setErrors((p) => ({ ...p, recipientEmail: "" })); }}
                />
                {errors.recipientEmail && <p className="text-xs text-destructive">{errors.recipientEmail}</p>}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSendPO} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Send PO
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
