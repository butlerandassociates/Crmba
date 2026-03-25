import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Plus, Trash2, FileDown, Loader2, Edit, Check, X, ShoppingCart } from "lucide-react";
import { purchaseOrdersAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface PurchaseOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
}

export function PurchaseOrderModal({ open, onOpenChange, project }: PurchaseOrderModalProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPO, setViewingPO] = useState<any | null>(null);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const emptyForm = () => ({
    supplier_name: "",
    delivery_address: project?.client?.address
      ? `${project.client.address}${project.client.city ? ", " + project.client.city : ""}${project.client.state ? ", " + project.client.state : ""}${project.client.zip ? " " + project.client.zip : ""}`
      : "",
    delivery_date: "",
    notes: "",
    items: [{ product_id: "", product_name: "", quantity: 1, unit: "" }],
  });

  const [form, setForm] = useState<any>(emptyForm());

  useEffect(() => {
    if (!open || !project?.id) return;
    loadAll();
  }, [open, project?.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pos, user] = await Promise.all([
        purchaseOrdersAPI.getByProject(project.id),
        supabase.auth.getUser(),
      ]);
      setPurchaseOrders(pos);

      // Get current user profile
      if (user.data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, email")
          .eq("id", user.data.user.id)
          .single();
        setCurrentUser(profile);
      }

      // Fetch material items from latest estimate for dropdown
      if (project?.client?.id) {
        const { data: estimates } = await supabase
          .from("estimates")
          .select("id")
          .eq("client_id", project.client.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (estimates && estimates.length > 0) {
          const { data: items } = await supabase
            .from("estimate_line_items")
            .select("*")
            .eq("estimate_id", estimates[0].id)
            .gt("material_cost", 0);
          setCatalogItems(items || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (form.items.some((i: any) => !i.product_name || !i.unit)) {
      toast.error("All items need a product name and unit");
      return;
    }
    setSaving(true);
    try {
      const items = form.items.map((item: any, idx: number) => ({
        product_id: item.product_id || undefined,
        product_name: item.product_name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit,
        sort_order: idx,
      }));

      if (editingId) {
        await purchaseOrdersAPI.update(editingId, {
          supplier_name: form.supplier_name,
          delivery_address: form.delivery_address,
          delivery_date: form.delivery_date || undefined,
          notes: form.notes,
        });
        await purchaseOrdersAPI.updateItems(editingId, items);
        toast.success("Purchase Order updated");
      } else {
        await purchaseOrdersAPI.create({
          project_id: project.id,
          supplier_name: form.supplier_name,
          delivery_address: form.delivery_address,
          delivery_date: form.delivery_date || undefined,
          notes: form.notes,
        }, items);
        toast.success("Purchase Order created");
      }
      setCreating(false);
      setEditingId(null);
      setForm(emptyForm());
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await purchaseOrdersAPI.delete(deleteConfirm.id);
      toast.success("Purchase Order deleted");
      setDeleteConfirm(null);
      if (viewingPO?.id === deleteConfirm.id) setViewingPO(null);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const openEdit = (po: any) => {
    setEditingId(po.id);
    setForm({
      supplier_name: po.supplier_name,
      delivery_address: po.delivery_address || "",
      delivery_date: po.delivery_date || "",
      notes: po.notes || "",
      items: po.items?.length > 0 ? po.items.map((i: any) => ({
        product_id: i.product_id || "",
        product_name: i.product_name,
        quantity: i.quantity,
        unit: i.unit,
      })) : [{ product_id: "", product_name: "", quantity: 1, unit: "" }],
    });
    setCreating(true);
    setViewingPO(null);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: "", product_name: "", quantity: 1, unit: "" }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) });
  const updateItem = (idx: number, key: string, value: any) => {
    setForm({
      ...form,
      items: form.items.map((item: any, i: number) => i === idx ? { ...item, [key]: value } : item),
    });
  };
  const selectCatalogItem = (idx: number, estimateItem: any) => {
    updateItem(idx, "product_name", estimateItem.product_name);
    updateItem(idx, "unit", estimateItem.unit);
    updateItem(idx, "product_id", estimateItem.product_id || "");
  };

  const exportPDF = async (po: any) => {
    setViewingPO(po);
    setTimeout(async () => {
      if (!printRef.current) return;
      try {
        const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const ratio = pdfWidth / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 10, canvas.width * ratio, canvas.height * ratio);
        pdf.save(`purchase-order-${po.supplier_name.replace(/\s+/g, "-")}.pdf`);
      } catch (e) {
        toast.error("Failed to export PDF");
      }
    }, 300);
  };

  const formatDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase Orders
                </DialogTitle>
                <DialogDescription>{project?.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : creating ? (
              /* ── Create / Edit Form ── */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Supplier Name *</Label>
                    <Input placeholder="e.g., Home Depot, SiteOne" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivery Date</Label>
                    <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Address</Label>
                  <Input placeholder="Delivery address" value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <Label>Items</Label>
                  {form.items.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2 items-end border rounded-lg p-3 bg-muted/20">
                      <div className="space-y-1">
                        <Label className="text-xs">Product Name</Label>
                        <div className="flex gap-1">
                          <Input
                            placeholder="Type or select below"
                            value={item.product_name}
                            onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                            className="h-8 text-sm"
                          />
                          {catalogItems.length > 0 && (
                            <Select onValueChange={(val) => {
                              const found = catalogItems.find((c: any) => c.id === val);
                              if (found) selectCatalogItem(idx, found);
                            }}>
                              <SelectTrigger className="h-8 w-28 text-xs shrink-0">
                                <SelectValue placeholder="From sold" />
                              </SelectTrigger>
                              <SelectContent>
                                {catalogItems.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.product_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Input placeholder="sq ft, each" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add Item
                  </Button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => { setCreating(false); setEditingId(null); }}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    {editingId ? "Save Changes" : "Create PO"}
                  </Button>
                </div>
              </div>
            ) : viewingPO ? (
              /* ── View Single PO ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewingPO(null)}>← Back</Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(viewingPO)}><Edit className="h-4 w-4 mr-1.5" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => exportPDF(viewingPO)}><FileDown className="h-4 w-4 mr-1.5" /> Export PDF</Button>
                </div>
                <div ref={printRef} className="bg-white p-6 space-y-6">
                  {/* PO Header */}
                  <div className="flex items-start justify-between pb-4 border-b-2 border-gray-900">
                    <div>
                      <h2 className="text-lg font-bold">Purchase Order</h2>
                      <div className="text-sm space-y-0.5 mt-1">
                        <div className="font-semibold">{viewingPO.supplier_name}</div>
                        {viewingPO.delivery_address && <div className="text-gray-600">{viewingPO.delivery_address}</div>}
                        {viewingPO.delivery_date && <div className="text-gray-600">Delivery: {formatDate(viewingPO.delivery_date)}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className="text-lg font-bold">Butler & Associates Construction</h2>
                      <div className="text-sm space-y-0.5 mt-1 text-gray-600">
                        {viewingPO.sent_by && (
                          <>
                            <div className="font-semibold text-gray-900">{viewingPO.sent_by.first_name} {viewingPO.sent_by.last_name}</div>
                            {viewingPO.sent_by.phone && <div>{viewingPO.sent_by.phone}</div>}
                            {viewingPO.sent_by.email && <div>{viewingPO.sent_by.email}</div>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div>
                    <div className="grid grid-cols-[3fr,1fr,1fr] gap-2 bg-gray-100 px-3 py-2 rounded-t-lg font-semibold text-xs border-b-2 border-gray-300">
                      <div>Product / Material</div>
                      <div className="text-right">Quantity</div>
                      <div className="text-right">Unit</div>
                    </div>
                    <div className="border-x-2 border-b-2 border-gray-300 rounded-b-lg">
                      {(viewingPO.items || []).map((item: any, idx: number) => (
                        <div key={item.id} className={`grid grid-cols-[3fr,1fr,1fr] gap-2 px-3 py-2.5 text-sm ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${idx !== viewingPO.items.length - 1 ? "border-b border-gray-200" : ""}`}>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-right">{item.quantity}</div>
                          <div className="text-right">{item.unit}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {viewingPO.notes && (
                    <div className="p-3 bg-gray-50 rounded border text-sm">
                      <span className="font-medium">Notes: </span>{viewingPO.notes}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── PO List ── */
              purchaseOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No purchase orders yet</p>
                  <Button size="sm" className="mt-3" onClick={() => { setCreating(true); setEditingId(null); setForm(emptyForm()); }}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create First PO
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); setForm(emptyForm()); setViewingPO(null); }}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add PO
                    </Button>
                  </div>
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-semibold">{po.supplier_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            {po.delivery_date && <span>Delivery: {formatDate(po.delivery_date)}</span>}
                            <span>{po.items?.length || 0} item{po.items?.length !== 1 ? "s" : ""}</span>
                            <Badge variant="outline" className="capitalize text-xs">{po.status}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewingPO(po)}>View</Button>
                          <Button variant="outline" size="sm" onClick={() => exportPDF(po)}><FileDown className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(po)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteConfirm({ id: po.id, name: po.supplier_name })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the PO for <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
