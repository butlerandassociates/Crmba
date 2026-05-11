import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, FileText, Send, ChevronLeft, Loader2, Calendar, Package, X, Pencil, ShieldCheck, Building2, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { purchaseOrdersAPI } from "../api/purchase-orders";
import { suppliersAPI, Supplier } from "../api/suppliers";
import { activityLogAPI } from "../api/activity-log";
import { notificationsAPI } from "../utils/api";
import { productsAPI } from "../api/products";
import { usePermissions } from "../hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const projectId  = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID  ?? "yohhdvwifjgarnaxrbev";
const publicAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? "";

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

interface MaterialLine {
  id: string;
  product_name: string;
  color: string;
  quantity: number;
  unit: string;
  availableColors: string[];
  isCustom?: boolean;
}

const emptyLine = (): MaterialLine => ({
  id: `line-${Date.now()}-${Math.random()}`,
  product_name: "",
  color: "",
  quantity: 1,
  unit: "EA",
  availableColors: [],
  isCustom: false,
});

export function PurchaseOrdersSheet({ open, onOpenChange, client, project, onSave }: PurchaseOrdersSheetProps) {
  const { role } = usePermissions();
  const [view, setView] = useState<View>("list");
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveLine, setConfirmRemoveLine] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Supplier combobox state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPoc, setNewSupplierPoc] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierEmailError, setNewSupplierEmailError] = useState("");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  // PM info
  const [pmProfile, setPmProfile] = useState<any>(null);

  // Form state
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState<"morning" | "afternoon" | "late afternoon">("morning");
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<MaterialLine[]>([emptyLine()]);

  // Proposal-based materials
  const [proposalMaterials, setProposalMaterials] = useState<MaterialLine[]>([]);
  const [dbUnits, setDbUnits] = useState<string[]>(["SF", "LF", "EA", "Lump Sum"]);
  const [productSupplierMap, setProductSupplierMap] = useState<Record<string, string | null>>({});
  const [sentPoItemNames, setSentPoItemNames] = useState<Set<string>>(new Set());
  const [allProducts, setAllProducts] = useState<{ name: string; unit: string }[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredSuppliers = suppliers.filter((s) =>
    s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.poc_name || "").toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const loadPOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const [posData, unitsData, suppliersData] = await Promise.all([
        purchaseOrdersAPI.getByClient(client.id),
        productsAPI.getUnits().catch(() => [] as any[]),
        suppliersAPI.getAll(),
      ]);
      setPos(posData);
      // Track items already in ANY existing PO (any status incl. draft) so Zone 1 only shows truly unordered materials
      const sentNames = new Set<string>();
      posData.forEach((po: any) => {
        (po.items || []).forEach((item: any) => { if (item.product_name) sentNames.add(item.product_name); });
      });
      setSentPoItemNames(sentNames);
      setSuppliers(suppliersData);
      if (unitsData.length > 0) setDbUnits(unitsData.map((u: any) => u.name as string));

      // Build product name → supplier_id map for auto-filtering on supplier selection
      const { data: prods } = await supabase.from("products_services").select("name, unit, supplier_id");
      if (prods?.length) {
        const map: Record<string, string | null> = {};
        prods.forEach((p: any) => { if (p.name) map[p.name] = p.supplier_id ?? null; });
        setProductSupplierMap(map);
        setAllProducts(prods.filter((p: any) => p.name).map((p: any) => ({ name: p.name as string, unit: (p.unit || "EA") as string })));
      }

      // Fetch accepted proposal line items for this client
      const { data: prop } = await supabase
        .from("estimates")
        .select("id, line_items:estimate_line_items(id, product_name, quantity, unit)")
        .eq("client_id", client.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prop?.line_items?.length) {
        setProposalMaterials(prop.line_items.map((li: any) => ({
          id: `line-${Date.now()}-${Math.random()}`,
          product_name: li.product_name || "",
          color: "",
          quantity: Number(li.quantity) || 1,
          unit: li.unit || "EA",
          availableColors: [],
        })));
      }

      // Fetch PM profile from project
      if (project?.project_manager_id) {
        const { data: pm } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, phone, email")
          .eq("id", project.project_manager_id)
          .single();
        setPmProfile(pm);
      }
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

  const resetForm = (editing = false) => {
    setSelectedSupplier(null);
    setSupplierSearch("");
    setShowAddSupplier(false);
    setDeliveryDate("");
    setDeliveryTime("morning");
    setNotes("");
    setMaterials([emptyLine()]);
    setErrors({});
    setIsEditing(false);
    setConfirmDelete(false);
  };

  const handleEditPo = (po: any) => {
    // Restore supplier from saved denormalised fields
    if (po.supplier_id) {
      const found = suppliers.find((s) => s.id === po.supplier_id);
      setSelectedSupplier(found ?? null);
      setSupplierSearch(found?.supplier_name ?? po.supplier_name ?? "");
    } else if (po.supplier_name) {
      setSupplierSearch(po.supplier_name);
      setSelectedSupplier(null);
    }
    setDeliveryDate(po.delivery_date || "");
    setDeliveryTime(po.delivery_time || "morning");
    setNotes(po.notes || "");
    setMaterials(
      (po.items || []).length > 0
        ? po.items.map((item: any) => ({
            id: `line-${Date.now()}-${Math.random()}`,
            product_name: item.product_name,
            color: item.color || "",
            quantity: item.quantity,
            unit: item.unit || "EA",
            availableColors: [],
            isCustom: !proposalMaterials.some((m) => m.product_name === item.product_name) && !!item.product_name,
          }))
        : [emptyLine()]
    );
    setErrors({});
    setIsEditing(true);
    setView("create");
  };

  const getSupplierFields = () => ({
    supplier_id: selectedSupplier?.id,
    supplier_name: selectedSupplier?.supplier_name ?? supplierSearch.trim(),
    supplier_poc_name: selectedSupplier?.poc_name ?? undefined,
    supplier_email: selectedSupplier?.email ?? undefined,
  });

  const handleUpdatePo = async (sendNow = false) => {
    if (!selectedPo?.id) return;
    const supplierName = selectedSupplier?.supplier_name ?? supplierSearch.trim();
    const newErrors: Record<string, string> = {};
    if (!supplierName) newErrors.supplier = "Supplier is required";
    const namedLines = materials.filter((m) => m.product_name.trim() && m.product_name !== "__pick__");
    if (namedLines.some((m) => !m.quantity || Number(m.quantity) <= 0)) newErrors.materials = "All materials must have a quantity greater than 0";
    if (sendNow) {
      if (!deliveryDate) newErrors.deliveryDate = "Delivery date is required before sending";
      if (!namedLines.length) newErrors.materials = "At least one material is required before sending";
      if (!selectedSupplier?.email) newErrors.supplier = "Selected supplier must have an email address to send";
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      await purchaseOrdersAPI.update(selectedPo.id, {
        ...getSupplierFields(),
        delivery_address: [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
        delivery_date: deliveryDate || undefined,
        delivery_time: deliveryTime,
        notes: notes || undefined,
        ...(sendNow ? { status: "sent" } : {}),
      });
      const validItems = materials.filter((m) => m.product_name.trim() && m.product_name !== "__pick__");
      await purchaseOrdersAPI.updateItems(selectedPo.id, validItems.map((item, i) => ({
        product_name: item.product_name,
        color: item.color || undefined,
        quantity: Number(item.quantity) || 0,
        unit: item.unit,
        sort_order: i,
      })));

      if (sendNow && selectedSupplier?.email) {
        setSending(true);
        const html = buildPoEmailHtml();
        await fetch(`https://${projectId}.supabase.co/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            to: selectedSupplier.email,
            subject: selectedPo?.status !== "draft"
              ? "Updated Purchase Order from Butler & Associates Construction"
              : "Purchase Order from Butler & Associates Construction",
            html,
            from_name: "Butler & Associates Construction",
          }),
        }).catch(() => {});
        notificationsAPI.create({
          type: "po_sent",
          title: selectedPo?.status !== "draft" ? "Purchase Order Resent" : "Purchase Order Sent",
          message: `PO ${selectedPo?.status !== "draft" ? "resent" : "sent"} to ${supplierName} — ${`${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim()}`,
          link: client?.id ? `/clients/${client.id}` : "/",
          metadata: { client_id: client?.id, project_id: project?.id },
        }).catch(() => {});
        activityLogAPI.create({ client_id: client?.id, action_type: "po_sent", description: `Purchase order sent to ${supplierName}` }).catch(() => {});
        toast.success(`Purchase order sent to ${selectedSupplier.poc_name || selectedSupplier.supplier_name} at ${selectedSupplier.email}`);
      } else {
        activityLogAPI.create({ client_id: client?.id, action_type: "po_updated", description: `Purchase order updated — supplier: ${supplierName}` }).catch(() => {});
        toast.success("Purchase order updated");
      }

      const fresh = await purchaseOrdersAPI.getByClient(client.id);
      setPos(fresh);
      setSelectedPo(fresh.find((p: any) => p.id === selectedPo.id) ?? selectedPo);
      resetForm();
      setView("detail");
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update purchase order");
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const handleSendExistingPo = async () => {
    if (!selectedPo?.id) return;
    if (!selectedPo.supplier_email) { toast.error("This supplier has no email address on file — edit the PO or update the supplier"); return; }
    if (!selectedPo.delivery_date) { toast.error("A delivery date is required before sending — edit the PO to add one"); return; }
    const items = selectedPo.items || [];
    if (!items.length) { toast.error("At least one material is required before sending — edit the PO to add materials"); return; }
    setSending(true);
    try {
      const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
      const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
      const pmFullName = pmProfile ? `${pmProfile.first_name ?? ""} ${pmProfile.last_name ?? ""}`.trim() : "Butler & Associates";
      const pmPhone = pmProfile?.phone ?? null;
      const supplierName = selectedPo.supplier_name || "—";
      const supplierPoc = selectedPo.supplier_poc_name ?? null;
      const supplierEmail = selectedPo.supplier_email;
      const deliveryLabel = new Date(`${selectedPo.delivery_date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      const timeLabel = deliveryTimeLabel(selectedPo.delivery_time || "morning");
      const rowsHtml = items.map((item: any) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${item.product_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${item.color || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;">${item.unit}</td>
        </tr>`).join("");
      const rowsHtml2 = items.map((item: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;">${item.product_name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;opacity:0.65;">${item.color || "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;text-align:center;color:#3A3A38;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;opacity:0.65;">${item.unit}</td>
        </tr>`).join("");
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;">
    <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:24px 32px 16px;text-align:center;">
      <img src="https://${projectId}.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px auto;background:#0A0A0A;" />
      <p style="font-size:13px;font-weight:600;color:#BB984D;margin:0 0 6px 0;letter-spacing:0.04em;">Butler &amp; Associates Construction, Inc.</p>
      <p style="font-size:14px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#ffffff;margin:0;">Purchase Order</p>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;">
      <div style="padding:28px 32px;border-bottom:1px solid #E8E4DC;"><table style="width:100%;border-collapse:collapse;"><tr>
        <td style="width:33%;vertical-align:top;padding-right:16px;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Deliver To</p><p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${clientName}</p>${clientAddress ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${clientAddress}</p>` : ""}</td>
        <td style="width:34%;vertical-align:top;padding:0 16px;border-left:1px solid #E8E4DC;border-right:1px solid #E8E4DC;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Ordered By</p><p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${pmFullName}</p>${pmPhone ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${pmPhone}</p>` : ""}<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">Butler &amp; Associates Construction</p></td>
        <td style="width:33%;vertical-align:top;padding-left:16px;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Supplier</p><p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${supplierName}</p>${supplierPoc ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${supplierPoc}</p>` : ""}${supplierEmail ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${supplierEmail}</p>` : ""}</td>
      </tr></table></div>
      <div style="padding:20px 32px;background:#FAFAF8;border-bottom:1px solid #E8E4DC;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Requested Delivery</p><table style="border-collapse:collapse;"><tr><td style="padding-right:40px;vertical-align:top;"><p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0 0 3px;">Date</p><p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${deliveryLabel}</p></td><td style="vertical-align:top;"><p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0 0 3px;">Time Window</p><p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${timeLabel}</p></td></tr></table></div>
      <div style="padding:24px 32px;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 12px 0;">Materials</p><table style="width:100%;border-collapse:collapse;border:1px solid #E8E4DC;overflow:hidden;"><thead><tr style="background:#0A0A0A;"><th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Material</th><th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Color / Spec</th><th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Qty</th><th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Unit</th></tr></thead><tbody>${rowsHtml2}</tbody></table></div>
      ${selectedPo.notes ? `<div style="padding:0 32px 24px;"><div style="border:1px solid #E8E4DC;border-radius:4px;padding:14px 16px;background:#FAFAF8;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Delivery Notes</p><p style="font-size:13px;color:#3A3A38;line-height:1.6;margin:0;">${selectedPo.notes}</p></div></div>` : ""}
      <div style="padding:20px 32px;border-top:1px solid #E8E4DC;text-align:center;"><p style="font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0 0 4px 0;">Butler &amp; Associates Construction, Inc.</p><p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0;">Questions? <a href="mailto:info@butlerconstruction.co" style="color:#BB984D;text-decoration:none;">info@butlerconstruction.co</a></p></div>
    </div>
  </div>
</body></html>`;

      await purchaseOrdersAPI.update(selectedPo.id, { status: "sent" });
      await fetch(`https://${projectId}.supabase.co/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ to: supplierEmail, subject: "Purchase Order from Butler & Associates Construction", html, from_name: "Butler & Associates Construction" }),
      }).catch(() => {});
      setSelectedPo((prev: any) => ({ ...prev, status: "sent" }));
      setPos((prev) => prev.map((p) => p.id === selectedPo.id ? { ...p, status: "sent" } : p));
      activityLogAPI.create({ client_id: client?.id, action_type: "po_sent", description: `Purchase order sent to ${supplierName}` }).catch(() => {});
      notificationsAPI.create({
        type: "po_sent",
        title: "Purchase Order Sent",
        message: `PO sent to ${supplierName}${clientName ? ` — ${clientName}` : ""}`,
        link: client?.id ? `/clients/${client.id}` : "/",
        metadata: { client_id: client?.id, project_id: project?.id },
      }).catch(() => {});
      toast.success(`Purchase order sent to ${selectedPo.supplier_poc_name || supplierName} at ${supplierEmail}`);
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send purchase order");
    } finally {
      setSending(false);
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

  const handleApprovePo = async () => {
    if (!selectedPo?.id) return;
    setApproving(true);
    try {
      const updated = await purchaseOrdersAPI.approve(selectedPo.id);
      setSelectedPo((prev: any) => ({ ...prev, ...updated }));
      setPos((prev) => prev.map((p) => p.id === selectedPo.id ? { ...p, ...updated } : p));
      activityLogAPI.create({ client_id: client?.id, action_type: "po_status_updated", description: `Purchase order approved — supplier: ${selectedPo.supplier_name}` }).catch(() => {});
      toast.success("Purchase order approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve purchase order");
    } finally {
      setApproving(false);
    }
  };

  const buildPoEmailHtml = () => {
    const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
    const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
    const pmFullName = pmProfile ? `${pmProfile.first_name ?? ""} ${pmProfile.last_name ?? ""}`.trim() : "Butler & Associates";
    const pmPhone = pmProfile?.phone ?? null;
    const supplierName = (selectedSupplier?.supplier_name ?? supplierSearch.trim()) || "—";
    const supplierPoc = selectedSupplier?.poc_name ?? null;
    const supplierEmail = selectedSupplier?.email ?? null;
    const deliveryLabel = deliveryDate
      ? new Date(`${deliveryDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : "To be confirmed";
    const timeLabel = deliveryTime === "morning" ? "Morning (8am – 12pm)" : deliveryTime === "afternoon" ? "Afternoon (12pm – 4pm)" : "Late Afternoon (4pm – 6pm)";
    const validItems = materials.filter((m) => m.product_name.trim() && m.product_name !== "__pick__");
    const rowsHtml = validItems.map((item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;">${item.product_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;opacity:0.65;">${item.color || "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;text-align:center;color:#3A3A38;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#3A3A38;opacity:0.65;">${item.unit}</td>
      </tr>`).join("");

    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;">
    <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:24px 32px 16px;text-align:center;">
      <img src="https://${projectId}.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px auto;background:#0A0A0A;" />
      <p style="font-size:13px;font-weight:600;color:#BB984D;margin:0 0 6px 0;letter-spacing:0.04em;">Butler &amp; Associates Construction, Inc.</p>
      <p style="font-size:14px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#ffffff;margin:0;">Purchase Order</p>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;">
      <div style="padding:28px 32px;border-bottom:1px solid #E8E4DC;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:33%;vertical-align:top;padding-right:16px;">
            <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Deliver To</p>
            <p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${clientName}</p>
            ${clientAddress ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${clientAddress}</p>` : ""}
          </td>
          <td style="width:34%;vertical-align:top;padding:0 16px;border-left:1px solid #E8E4DC;border-right:1px solid #E8E4DC;">
            <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Ordered By</p>
            <p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${pmFullName}</p>
            ${pmPhone ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${pmPhone}</p>` : ""}
            <p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">Butler &amp; Associates Construction</p>
          </td>
          <td style="width:33%;vertical-align:top;padding-left:16px;">
            <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Supplier</p>
            <p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${supplierName}</p>
            ${supplierPoc ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${supplierPoc}</p>` : ""}
            ${supplierEmail ? `<p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:4px 0 0;">${supplierEmail}</p>` : ""}
          </td>
        </tr></table>
      </div>
      <div style="padding:20px 32px;background:#FAFAF8;border-bottom:1px solid #E8E4DC;">
        <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Requested Delivery</p>
        <table style="border-collapse:collapse;"><tr>
          <td style="padding-right:40px;vertical-align:top;">
            <p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0 0 3px;">Date</p>
            <p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${deliveryLabel}</p>
          </td>
          <td style="vertical-align:top;">
            <p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0 0 3px;">Time Window</p>
            <p style="font-size:14px;font-weight:600;color:#3A3A38;margin:0;">${timeLabel}</p>
          </td>
        </tr></table>
      </div>
      <div style="padding:24px 32px;">
        <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 12px 0;">Materials</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E8E4DC;overflow:hidden;">
          <thead><tr style="background:#0A0A0A;">
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Material</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Color / Spec</th>
            <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Qty</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#BB984D;">Unit</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${notes ? `<div style="padding:0 32px 24px;"><div style="border:1px solid #E8E4DC;border-radius:4px;padding:14px 16px;background:#FAFAF8;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Delivery Notes</p><p style="font-size:13px;color:#3A3A38;line-height:1.6;margin:0;">${notes}</p></div></div>` : ""}
      <div style="padding:20px 32px;border-top:1px solid #E8E4DC;text-align:center;">
        <p style="font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0 0 4px 0;">Butler &amp; Associates Construction, Inc.</p>
        <p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:0;">Questions? <a href="mailto:info@butlerconstruction.co" style="color:#BB984D;text-decoration:none;">info@butlerconstruction.co</a></p>
      </div>
    </div>
  </div>
</body></html>`;
  };

  const handleCreate = async (sendNow = false) => {
    const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
    const newErrors: Record<string, string> = {};
    const supplierName = selectedSupplier?.supplier_name ?? supplierSearch.trim();
    if (!supplierName) newErrors.supplier = "Supplier is required";
    const namedLines = materials.filter((m) => m.product_name.trim() && m.product_name !== "__pick__");
    if (namedLines.some((m) => !m.quantity || Number(m.quantity) <= 0)) newErrors.materials = "All materials must have a quantity greater than 0";
    if (sendNow) {
      if (!deliveryDate) newErrors.deliveryDate = "Delivery date is required before sending";
      if (!namedLines.length) newErrors.materials = "At least one material is required before sending";
      if (!selectedSupplier?.email) newErrors.supplier = "Selected supplier must have an email address to send";
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    if (!project?.id && !client?.id) { toast.error("No project linked to this client"); return; }

    setSaving(true);
    try {
      const validItems = materials.filter((m) => m.product_name.trim() && m.product_name !== "__pick__");
      await purchaseOrdersAPI.create(
        {
          project_id: project?.id,
          client_id: client?.id,
          ...getSupplierFields(),
          delivery_address: [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
          delivery_date: deliveryDate || undefined,
          delivery_time: deliveryTime,
          notes: notes || undefined,
          status: sendNow ? "sent" : "draft",
        },
        validItems.map((item, i) => ({
          product_name: item.product_name,
          color: item.color || undefined,
          quantity: Number(item.quantity) || 0,
          unit: item.unit,
          sort_order: i,
        }))
      );

      activityLogAPI.create({ client_id: client?.id, action_type: "po_created", description: `Purchase order ${sendNow ? "sent" : "saved as draft"} — supplier: ${supplierName}` }).catch(() => {});

      if (sendNow && selectedSupplier?.email) {
        setSending(true);
        const html = buildPoEmailHtml();
        await fetch(`https://${projectId}.supabase.co/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            to: selectedSupplier.email,
            subject: "Purchase Order from Butler & Associates Construction",
            html,
            from_name: "Butler & Associates Construction",
          }),
        }).catch(() => {});

        notificationsAPI.create({
          type: "po_sent",
          title: "Purchase Order Sent",
          message: `PO sent to ${supplierName}${clientName ? ` — ${clientName}` : ""}`,
          link: client?.id ? `/clients/${client.id}` : "/",
          metadata: { client_id: client?.id, project_id: project?.id },
        }).catch(() => {});

        toast.success(`Purchase order sent to ${selectedSupplier.poc_name || selectedSupplier.supplier_name} at ${selectedSupplier.email}`);
      } else {
        toast.success("Purchase order saved as draft");
      }

      resetForm();
      setView("list");
      loadPOs();
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
      setSending(false);
    }
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

  const handleSelectSupplier = (s: Supplier) => {
    setSelectedSupplier(s);
    setSupplierSearch(s.supplier_name);
    setSupplierDropdownOpen(false);
    setErrors((p) => ({ ...p, supplier: "" }));

    // Remove materials that belong to a different supplier when a supplier is selected
    if (Object.keys(productSupplierMap).length > 0) {
      setMaterials((prev) => prev.filter((mat) => {
        const mappedSupplierId = productSupplierMap[mat.product_name];
        if (!mappedSupplierId) return true;
        return mappedSupplierId === s.id;
      }));
    }
  };

  const handleSaveNewSupplier = async () => {
    if (!newSupplierName.trim()) return;
    if (newSupplierEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSupplierEmail.trim())) {
      setNewSupplierEmailError("Enter a valid email address");
      return;
    }
    setNewSupplierEmailError("");
    setSavingSupplier(true);
    try {
      const created = await suppliersAPI.create({
        supplier_name: newSupplierName.trim(),
        poc_name: newSupplierPoc.trim() || undefined,
        email: newSupplierEmail.trim() || undefined,
      });
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
      handleSelectSupplier(created);
      setShowAddSupplier(false);
      setNewSupplierName(""); setNewSupplierPoc(""); setNewSupplierEmail(""); setNewSupplierEmailError("");
      toast.success("Supplier added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add supplier");
    } finally {
      setSavingSupplier(false);
    }
  };

  const addMaterialLine = () => setMaterials((prev) => [emptyLine(), ...prev]);
  const removeMaterialLine = (id: string) => setMaterials((prev) => prev.filter((m) => m.id !== id));
  const updateMaterial = (id: string, field: keyof MaterialLine, value: any) =>
    setMaterials((prev) => prev.map((m) => m.id !== id ? m : { ...m, [field]: value }));

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const deliveryTimeLabel = (t: string) => {
    if (t === "morning") return "Morning (8am–12pm)";
    if (t === "afternoon") return "Afternoon (12pm–4pm)";
    if (t === "late afternoon") return "Late Afternoon (4pm–6pm)";
    return t;
  };

  const clientAddress = [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(", ");
  const pmName = pmProfile ? `${pmProfile.first_name ?? ""} ${pmProfile.last_name ?? ""}`.trim() : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            {view !== "list" && (
              <button
                onClick={() => {
                  if (view === "create" && isEditing) { resetForm(); setView("detail"); }
                  else { setView("list"); setSelectedPo(null); }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">
                {view === "list" ? "Purchase Orders" : view === "create" ? (isEditing ? "Edit Purchase Order" : "New Purchase Order") : `PO — ${selectedPo?.supplier_name}`}
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
              {!loading && pos.length > 0 && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { resetForm(); setView("create"); }}>
                    <Plus className="h-4 w-4 mr-1.5" />New PO
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
                    <Plus className="h-4 w-4 mr-1.5" />Create First PO
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
                        {/* Row 1: supplier + status */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-sm truncate">{po.supplier_name}</span>
                          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>
                        </div>
                        {/* Row 2: date + item count */}
                        <div className="text-xs text-muted-foreground flex items-center gap-3 mb-2">
                          {po.delivery_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(po.delivery_date)}
                            </span>
                          )}
                          <span>{po.items?.length ?? 0} item{(po.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                        </div>
                        {/* Row 3: material names */}
                        {(po.items?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {(po.items as any[]).slice(0, 5).map((item: any, i: number) => (
                              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.product_name}
                              </span>
                            ))}
                            {po.items.length > 5 && (
                              <span className="text-xs text-muted-foreground px-1">+{po.items.length - 5} more</span>
                            )}
                          </div>
                        )}
                        {/* Row 4: notes preview */}
                        {po.notes && (
                          <p className="text-xs text-muted-foreground italic line-clamp-1 mt-0.5">"{po.notes}"</p>
                        )}
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

              {/* Card 0: Supplier */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Supplier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Supplier combobox */}
                  <div className="space-y-1 relative">
                    <Label className="text-xs font-semibold">Supplier Name *</Label>
                    <Input
                      ref={supplierInputRef}
                      className={`h-9 text-sm ${errors.supplier ? "border-destructive" : ""}`}
                      placeholder="Search or select a supplier…"
                      value={supplierSearch}
                      autoComplete="off"
                      onFocus={() => setSupplierDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 150)}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setSelectedSupplier(null);
                        setSupplierDropdownOpen(true);
                        setErrors((p) => ({ ...p, supplier: "" }));
                      }}
                    />
                    {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}

                    {supplierDropdownOpen && !showAddSupplier && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {filteredSuppliers.length > 0 ? (
                          filteredSuppliers.map((s) => (
                            <button
                              key={s.id}
                              className="w-full text-left px-3 py-2.5 hover:bg-accent/60 transition-colors border-b last:border-0"
                              onMouseDown={() => handleSelectSupplier(s)}
                            >
                              <p className="text-sm font-medium">{s.supplier_name}</p>
                              {s.poc_name && <p className="text-xs text-muted-foreground">{s.poc_name}{s.email ? ` · ${s.email}` : ""}</p>}
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2.5 text-sm text-muted-foreground">No suppliers found</p>
                        )}
                        <button
                          className="w-full text-left px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/5 transition-colors border-t flex items-center gap-1.5"
                          onMouseDown={() => { setSupplierDropdownOpen(false); setShowAddSupplier(true); setNewSupplierName(supplierSearch); }}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add new supplier
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selected supplier info */}
                  {selectedSupplier && (
                    <div className="bg-muted/40 rounded-lg px-3 py-2.5 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedSupplier.supplier_name}
                        </p>
                        {selectedSupplier.poc_name && <p className="text-xs text-muted-foreground mt-0.5">POC: {selectedSupplier.poc_name}</p>}
                        {selectedSupplier.email
                          ? <p className="text-xs text-muted-foreground">{selectedSupplier.email}</p>
                          : <p className="text-xs text-amber-600 mt-0.5">No email — PO cannot be sent without one</p>
                        }
                      </div>
                      <button onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); }} className="text-muted-foreground hover:text-foreground mt-0.5">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Inline add new supplier form */}
                  {showAddSupplier && (
                    <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">New Supplier</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name *</Label>
                          <Input className="h-8 text-xs" placeholder="Supplier name" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">POC Name</Label>
                          <Input className="h-8 text-xs" placeholder="Contact name" value={newSupplierPoc} onChange={(e) => setNewSupplierPoc(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input
                            className={`h-8 text-xs ${newSupplierEmailError ? "border-destructive" : ""}`}
                            placeholder="orders@supplier.com"
                            value={newSupplierEmail}
                            onChange={(e) => { setNewSupplierEmail(e.target.value); setNewSupplierEmailError(""); }}
                          />
                          {newSupplierEmailError && <p className="text-xs text-destructive mt-0.5">{newSupplierEmailError}</p>}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs" disabled={savingSupplier || !newSupplierName.trim()} onClick={handleSaveNewSupplier}>
                          {savingSupplier ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 1: Project Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Project Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Client Name</Label>
                      <Input value={`${client?.first_name || ""} ${client?.last_name || ""}`.trim()} readOnly className="bg-muted/30 text-sm h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Client Address</Label>
                      <Input value={clientAddress} readOnly className="bg-muted/30 text-sm h-9" />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-semibold">Ordered By (PM)</Label>
                      {pmName ? (
                        <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm">{pmName}</span>
                          {pmProfile?.phone && (
                            <span className="text-sm text-muted-foreground">· {pmProfile.phone}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30">
                          <span className="text-sm text-muted-foreground">No PM assigned to this project</span>
                        </div>
                      )}
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
                      <Select value={deliveryTime} onValueChange={(v) => setDeliveryTime(v as any)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent side="bottom" align="start">
                          <SelectItem value="morning">Morning (8am – 12pm)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12pm – 4pm)</SelectItem>
                          <SelectItem value="late afternoon">Late Afternoon (4pm – 6pm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Material Line Items */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Materials</CardTitle>
                    <Button size="sm" className="bg-black hover:bg-gray-800 text-xs h-7" onClick={addMaterialLine}>
                      <Plus className="h-3 w-3 mr-1" />Add Line
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Zone 1: Proposal items not yet in the order — click to add */}
                  {(() => {
                    const thisPoItems = isEditing && selectedPo
                      ? new Set<string>((selectedPo.items || []).map((i: any) => i.product_name as string).filter(Boolean))
                      : new Set<string>();
                    const zone1 = proposalMaterials.filter((pm) =>
                      !materials.some((m) => m.product_name === pm.product_name && m.product_name !== "") &&
                      (!sentPoItemNames.has(pm.product_name) || thisPoItems.has(pm.product_name))
                    );
                    if (!zone1.length) return null;
                    return (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">From Proposal — click to add</p>
                        <div className="flex flex-wrap gap-1.5">
                          {zone1.map((pm) => (
                            <button
                              key={pm.product_name}
                              type="button"
                              onClick={() => setMaterials((prev) => {
                                const filled = prev.filter((m) => m.product_name.trim());
                                return [...filled, { ...pm, id: `line-${Date.now()}-${Math.random()}` }];
                              })}
                              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                            >
                              + {pm.product_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Zone 2: Order items (editable) */}
                  <div>
                    {materials.length > 0 && (
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b items-center mb-1">
                        <div className="col-span-4">Material</div>
                        <div className="col-span-3">Color / Spec</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-2">Unit</div>
                        <div className="col-span-1"></div>
                      </div>
                    )}
                    {materials.map((mat) => (
                      <div key={mat.id} className="grid grid-cols-12 gap-2 rounded-lg p-1.5 items-center bg-muted/20 mb-1.5">
                        <div className="col-span-4 relative">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Material name..."
                            value={mat.product_name}
                            autoComplete="off"
                            onFocus={() => setProductDropdownOpen(mat.id)}
                            onBlur={() => setTimeout(() => setProductDropdownOpen(null), 150)}
                            onChange={(e) => { updateMaterial(mat.id, "product_name", e.target.value); setProductDropdownOpen(mat.id); }}
                          />
                          {productDropdownOpen === mat.id && (() => {
                            const filtered = allProducts.filter((p) =>
                              !mat.product_name.trim() || p.name.toLowerCase().includes(mat.product_name.toLowerCase())
                            );
                            if (!filtered.length) return null;
                            return (
                              <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-background border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {filtered.map((p) => (
                                  <button
                                    key={p.name}
                                    type="button"
                                    className="w-full text-left px-2.5 py-2 hover:bg-accent/60 transition-colors border-b last:border-0"
                                    onMouseDown={() => {
                                      updateMaterial(mat.id, "product_name", p.name);
                                      updateMaterial(mat.id, "unit", p.unit);
                                      setProductDropdownOpen(null);
                                    }}
                                  >
                                    <p className="text-xs font-medium leading-tight">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.unit}</p>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="col-span-3">
                          <Input
                            className="h-8 text-xs"
                            placeholder="e.g. Charcoal Grey"
                            value={mat.color}
                            onChange={(e) => updateMaterial(mat.id, "color", e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            value={mat.quantity || ""}
                            min={1}
                            onChange={(e) => updateMaterial(mat.id, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Select value={mat.unit} onValueChange={(v) => updateMaterial(mat.id, "unit", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent side="bottom" align="start" className="max-h-52 overflow-y-auto">
                              {[...new Set([...dbUnits, mat.unit].filter(Boolean))].map((u) => (
                                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => {
                              if (!mat.product_name.trim()) removeMaterialLine(mat.id);
                              else setConfirmRemoveLine(mat.id);
                            }}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                            disabled={materials.length === 1 && !mat.product_name.trim()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {errors.materials && <p className="text-xs text-destructive px-1 mt-1">{errors.materials}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: Notes */}
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
              {/* Status pills */}
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

              {/* Delivery */}
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supplier</p>
                <p className="text-sm font-medium">{selectedPo.supplier_name || "—"}</p>
                {selectedPo.supplier_poc_name && <p className="text-xs text-muted-foreground mt-0.5">POC: {selectedPo.supplier_poc_name}</p>}
                {selectedPo.supplier_email && <p className="text-xs text-muted-foreground">{selectedPo.supplier_email}</p>}
              </div>

              {/* Materials */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Materials</p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-900 text-xs font-semibold text-white">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-3">Color / Spec</div>
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
                  {!(selectedPo.items || []).length && (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Package className="h-7 w-7 mb-1.5 opacity-20" />
                      <p className="text-sm font-medium">No line items</p>
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

        {/* Footer — detail */}
        {view === "detail" && selectedPo && (
          <div className="px-6 py-4 border-t flex justify-between gap-2">
            <div>
              {role === "admin" && (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" />Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
                {selectedPo.approved_at ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Approved {new Date(selectedPo.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                ) : role === "admin" ? (
                  <Button size="sm" variant="outline" disabled={approving} onClick={handleApprovePo} className="border-green-400 text-green-700 hover:bg-green-50">
                    {approving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                    Approve
                  </Button>
                ) : null}
                {role === "admin" && selectedPo.status === "draft" && (
                  <Button size="sm" disabled={sending} onClick={handleSendExistingPo}>
                    {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                    Send to Supplier
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleEditPo(selectedPo)}>
                  <Pencil className="h-4 w-4 mr-1.5" />Edit
                </Button>
              </div>
          </div>
        )}

        {/* Footer — create */}
        {view === "create" && (
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setView(isEditing ? "detail" : "list"); }}>Cancel</Button>
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => handleUpdatePo(false)}>
                  {saving && !sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Pencil className="h-4 w-4 mr-1.5" />}
                  Update PO
                </Button>
                {role === "admin" && (
                  <Button size="sm" disabled={saving} onClick={() => handleUpdatePo(true)}>
                    {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                    {selectedPo?.status === "draft" ? "Update & Send" : "Update & Resend"}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => handleCreate(false)}>
                  {saving && !sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}
                  Save as Draft
                </Button>
                {role === "admin" && (
                  <Button size="sm" disabled={saving} onClick={() => handleCreate(true)}>
                    {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                    Send to Supplier
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>

      {/* Remove line confirmation dialog */}
      <Dialog open={!!confirmRemoveLine} onOpenChange={(open) => { if (!open) setConfirmRemoveLine(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Material Line</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-foreground">
                "{materials.find(m => m.id === confirmRemoveLine)?.product_name || "this line"}"
              </span>{" "}
              from the order?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2 pb-2 px-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmRemoveLine(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { removeMaterialLine(confirmRemoveLine!); setConfirmRemoveLine(null); }}>
              <Trash2 className="h-4 w-4 mr-1.5" />Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the PO for{" "}
              <span className="font-medium text-foreground">"{selectedPo?.supplier_name}"</span>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2 pb-2 px-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeletePo}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
