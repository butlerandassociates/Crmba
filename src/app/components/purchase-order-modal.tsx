import { useState, useEffect } from "react";
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

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
      const pos = await purchaseOrdersAPI.getByProject(project.id);
      setPurchaseOrders(pos);

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

  const exportPDF = (po: any) => {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const GOLD = "#C9A84C";
    const BLACK = "#111111";
    const fmtDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
    const senderName = po.sent_by ? `${po.sent_by.first_name ?? ""} ${po.sent_by.last_name ?? ""}`.trim() : "";

    const rows = (po.items || []).map((item: any, idx: number) => `
      <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:12px;">${item.product_name}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${item.unit}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${item.quantity}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Purchase Order — ${po.supplier_name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;background:#fff;padding:40px 48px;}@page{margin:0;}table{border-collapse:collapse;width:100%;}</style>
</head><body style="display:flex;flex-direction:column;min-height:100vh;">
<div style="background:${BLACK};color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
  <div style="font-size:22px;font-weight:bold;">Butler &amp; Associates Construction</div>
  <div style="font-size:17px;font-weight:bold;color:${GOLD};">Purchase Order</div>
</div>
<div style="display:flex;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d1d5db;">
  <div>
    <div style="color:${GOLD};font-size:13px;">Supplier: ${po.supplier_name}</div>
    ${po.delivery_address ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">${po.delivery_address}</div>` : ""}
  </div>
  <div style="text-align:right;">
    <div style="font-size:13px;">Date: ${today}</div>
    ${po.delivery_date ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">Delivery: ${fmtDate(po.delivery_date)}</div>` : ""}
  </div>
</div>
<div style="margin-bottom:20px;font-size:12px;">
  <span style="color:#6b7280;">Project: </span><span style="font-weight:600;">${project.name ?? "—"}</span>
  ${project.clientName ? `&nbsp;&nbsp;<span style="color:#6b7280;">Client: </span><span>${project.clientName}</span>` : ""}
</div>
<div style="margin-bottom:24px;">
  <h3 style="font-size:15px;font-weight:bold;margin-bottom:12px;">Materials &amp; Products</h3>
  <table>
    <thead>
      <tr style="background:${BLACK};color:#fff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:bold;">Product / Material</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:80px;">Unit</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:80px;">Qty</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>
${po.notes ? `<div style="margin-bottom:32px;"><div style="font-weight:bold;font-size:13px;margin-bottom:8px;">Notes</div><p style="font-size:12px;line-height:1.65;color:#374151;">${po.notes}</p></div>` : ""}
<div style="flex:1;"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;">
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Butler &amp; Associates Construction${senderName ? ` — ${senderName}` : ""}</div>
    <div style="border-bottom:1px solid #111;margin-bottom:6px;"></div>
    <div style="font-size:11px;color:#6b7280;">Authorized Signature / Date</div>
  </div>
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Supplier / Vendor — ${po.supplier_name}</div>
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

  const formatDate = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0" style={{ width: "95vw", maxWidth: "95vw" }}>
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
                  <Label className="text-sm font-medium">Items</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/60 border-b">
                          <th className="text-left text-xs font-semibold px-3 py-2">Product / Material</th>
                          <th className="text-left text-xs font-semibold px-3 py-2 w-[18%]">Qty</th>
                          <th className="text-left text-xs font-semibold px-3 py-2 w-[18%]">Unit</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((item: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Product name"
                                  value={item.product_name}
                                  onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                                  className="h-8 text-sm"
                                />
                                {catalogItems.length > 0 && (
                                  <Select onValueChange={(val) => {
                                    const found = catalogItems.find((c: any) => c.id === val);
                                    if (found) selectCatalogItem(idx, found);
                                  }}>
                                    <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                                      <SelectValue placeholder="Proposal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {catalogItems.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.product_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-sm" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input placeholder="SF, EA…" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} className="h-8 text-sm" />
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
              /* ── View Single PO — matches Butler Purchase Order PDF design ── */
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewingPO(null)}>← Back</Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(viewingPO)}><Edit className="h-4 w-4 mr-1.5" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => exportPDF(viewingPO)}><FileDown className="h-4 w-4 mr-1.5" /> Export PDF</Button>
                </div>

                <div className="bg-white space-y-5 font-sans text-[13px]">

                  {/* Black header bar */}
                  <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 rounded-sm">
                    <span className="text-[18px] font-bold">Butler &amp; Associates Construction</span>
                    <span className="text-[15px] font-bold text-[#C9A84C]">Purchase Order</span>
                  </div>

                  {/* Supplier / Date row */}
                  <div className="flex items-start justify-between border-b border-gray-300 pb-3">
                    <div>
                      <div className="text-[#C9A84C] text-sm">Supplier: {viewingPO.supplier_name}</div>
                      {viewingPO.delivery_address && <div className="text-xs text-gray-500 mt-0.5">{viewingPO.delivery_address}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                      {viewingPO.delivery_date && <div className="text-xs text-gray-500 mt-0.5">Delivery: {formatDate(viewingPO.delivery_date)}</div>}
                    </div>
                  </div>

                  {/* Project / client */}
                  <div className="text-xs text-gray-600">
                    <span className="text-gray-400">Project: </span>
                    <span className="font-semibold text-gray-800">{project?.name ?? "—"}</span>
                    {project?.clientName && <><span className="mx-2 text-gray-300">|</span><span className="text-gray-400">Client: </span><span>{project.clientName}</span></>}
                    <span className="ml-3"><Badge variant="outline" className="capitalize text-xs">{viewingPO.status}</Badge></span>
                  </div>

                  {/* Items table */}
                  <div>
                    <h3 className="text-[14px] font-bold mb-3">Materials &amp; Products</h3>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#111111] text-white">
                          <th className="py-2.5 px-3 text-left font-semibold">Product / Material</th>
                          <th className="py-2.5 px-3 text-center font-semibold w-16">Unit</th>
                          <th className="py-2.5 px-3 text-center font-semibold w-14">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewingPO.items || []).map((item: any, idx: number) => (
                          <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                            <td className="py-2.5 px-3">{item.product_name}</td>
                            <td className="py-2.5 px-3 text-center">{item.unit}</td>
                            <td className="py-2.5 px-3 text-center">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes */}
                  {viewingPO.notes && (
                    <div>
                      <div className="font-bold text-sm mb-1">Notes</div>
                      <p className="text-xs text-gray-600 leading-relaxed">{viewingPO.notes}</p>
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-10 pt-4 border-t border-gray-300">
                    <div>
                      <div className="text-xs mb-8">
                        Butler &amp; Associates Construction
                        {viewingPO.sent_by && ` — ${viewingPO.sent_by.first_name ?? ""} ${viewingPO.sent_by.last_name ?? ""}`.trim()}
                      </div>
                      <div className="border-b border-gray-800 mb-1" />
                      <div className="text-[11px] text-gray-500">Authorized Signature / Date</div>
                    </div>
                    <div>
                      <div className="text-xs mb-8">Supplier / Vendor — {viewingPO.supplier_name}</div>
                      <div className="border-b border-gray-800 mb-1" />
                      <div className="text-[11px] text-gray-500">Signature / Date</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
                    Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
                  </div>
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
