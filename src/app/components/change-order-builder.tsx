import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, FileText, Check, CheckCircle2, Clock, Upload, X, AlertTriangle, Edit2, RotateCcw, Info, Download, Eye, XCircle, Send, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ChangeOrderExport } from "./change-order-export";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Dialog, DialogContent } from "./ui/dialog";
import { clientsAPI, productsAPI, activityLogAPI } from "../utils/api";
import { projectId, publicAnonKey } from "utils/supabase/info";
import { changeOrdersAPI } from "../api/change-orders";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const EMPTY_ITEM = () => ({
  id: `item-${Date.now()}-${Math.random()}`,
  category: "Materials",
  description: "",
  quantity: 1,
  unit: "",
  unit_price: 0,
  total: 0,
  material_cost: 0, // per-unit material cost (from product) — used for 9%-on-materials tax
  fromProduct: false,
});


export function ChangeOrderBuilder() {
  const { clientId, coId } = useParams<{ clientId: string; coId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!coId;

  // Data
  const [client, setClient]         = useState<any>(null);
  const [proposal, setProposal]     = useState<any>(null);
  const [project, setProject]       = useState<any>(null);
  const [existingCO, setExistingCO] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [globalMarkupPct, setGlobalMarkupPct] = useState(0);

  // Form
  const [coTitle, setCoTitle]               = useState("");
  const [coDescription, setCoDescription]   = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [items, setItems]                   = useState([EMPTY_ITEM()]);
  const [touched, setTouched]               = useState(false);
  const [taxRate, setTaxRate]               = useState(0); // client zip sales-tax rate (e.g. 9 for Huntsville)

  // Product picker per row
  const [pickerState, setPickerState] = useState<Record<string, { categoryId: string }>>({});

  // Modifications to existing proposal items
  type Modification = { action: 'edit' | 'delete'; estimate_item_id: string; original_quantity: number; original_client_price: number; original_total: number; quantity: number; client_price: number; total_price: number };
  const [modifications, setModifications] = useState<Record<string, Modification>>({});
  const [editingProposalItemId, setEditingProposalItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Approval gate
  const [approvalVerified, setApprovalVerified] = useState(false);
  const [approvalFile, setApprovalFile]         = useState<File | null>(null);
  const [approvalFileUrl, setApprovalFileUrl]   = useState("");
  const [uploadingFile, setUploadingFile]       = useState(false);

  // UI
  const [showProposal, setShowProposal] = useState(true);
  const [saving, setSaving]             = useState(false);
  const [merging, setMerging]           = useState(false);
  const [downloading, setDownloading]   = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [adminApproving, setAdminApproving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [allCos, setAllCos]               = useState<any[]>([]);
  const [showCoPicker, setShowCoPicker]   = useState(false);
  const [showCoEmailPreview, setShowCoEmailPreview] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const initialItemsRef = useRef<string>("");
  const initialModsRef  = useRef<string>("");
  const loadedRef = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [c, prods, cats, settingsRes] = await Promise.all([
          clientsAPI.getById(clientId),
          productsAPI.getAll(),
          productsAPI.getCategories(),
          supabase.from("company_settings").select("global_markup_percent").limit(1).maybeSingle(),
        ]);
        setClient(c);
        setDbProducts(prods);
        setCategories(cats);

        // Look up the client's sales-tax rate by zip (same source as proposals)
        if (c?.zip) {
          const { data: zr } = await supabase
            .from("zip_tax_rates").select("total_rate").eq("zip_code", String(c.zip).trim()).maybeSingle();
          if (zr?.total_rate) setTaxRate(Number(zr.total_rate));
        }
        if (settingsRes.data?.global_markup_percent) {
          setGlobalMarkupPct(Number(settingsRes.data.global_markup_percent));
        }

        // Load accepted proposal with line items + financial fields needed for live totals
        const { data: prop } = await supabase
          .from("estimates")
          .select("id, title, total, subtotal, bad_amount, tax_amount, discount_amount, discount_percentage, stripe_fee_enabled, estimate_number, line_items:estimate_line_items(id, product_name, category, labor_cost, material_cost, quantity, client_price, total_price, sort_order)")
          .eq("client_id", clientId)
          .eq("status", "accepted")
          .order("accepted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setProposal(prop);

        // Load client's active project (needed for mergeApproved to update project total)
        const { data: proj } = await supabase
          .from("projects")
          .select("id, name")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setProject(proj);

        // Load existing COs — if editing load by coId, else redirect to latest draft
        const cos = await changeOrdersAPI.getByClient(clientId);
        setAllCos(cos);
        if (coId) {
          const co = cos.find((c: any) => c.id === coId);
          if (co) {
            setExistingCO(co);
            setCoTitle(co.title || "");
            setCoDescription(co.reason || "");
            setTimelineImpact(co.timeline_impact || "");
            setApprovalVerified(co.approval_verified || false);
            setApprovalFileUrl(co.approval_file_url || "");
            if ((co.items || []).length > 0) {
              const loadedItems = co.items.map((i: any) => ({
                id: i.id || EMPTY_ITEM().id,
                category: i.category || "Materials",
                description: i.description || "",
                quantity: i.quantity || 1,
                unit: i.unit || "",
                unit_price: i.unit_price || 0,
                total: i.total || 0,
                material_cost: i.material_cost || 0,
                fromProduct: false,
              }));
              setItems(loadedItems);
              initialItemsRef.current = JSON.stringify(loadedItems.map(({ id: _id, fromProduct: _fp, ...rest }) => rest));
            }
            const modsMap: Record<string, any> = {};
            if (Array.isArray(co.modifications) && co.modifications.length > 0) {
              co.modifications.forEach((mod: any) => { modsMap[mod.estimate_item_id] = mod; });
              setModifications(modsMap);
            }
            initialModsRef.current = JSON.stringify(modsMap);
          }
        } else {
          // No coId — new blank CO form; user can switch to existing COs via the CO switcher
        }
      } catch (err) {
        toast.error("Failed to load — please refresh.");
      } finally {
        setLoading(false);
        loadedRef.current = true;
      }
    };
    load();
  }, [clientId, coId]);

  // Refresh CO status in real-time (e.g. client approves/rejects from portal)
  // Only updates existingCO — does NOT reset form fields (coTitle, items, etc.)
  useRealtimeRefetch(async () => {
    if (!coId || !clientId) return;
    const cos = await changeOrdersAPI.getByClient(clientId);
    setAllCos(cos);
    const co = cos.find((c: any) => c.id === coId);
    if (co) setExistingCO(co);
  }, ["change_orders"], `co-builder-${coId}`);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const dirty = coTitle.trim() || items.some(i => i.description.trim());
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [coTitle, items]);

  // ── Items ─────────────────────────────────────────────────────────────────
  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        updated.total = (Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0);
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      // Can't remove the last row — reset it to empty so the form stays valid
      setItems([EMPTY_ITEM()]);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const applyProduct = (itemId: string, productId: string) => {
    const product = dbProducts.find(p => p.id === productId);
    if (!product) return;
    const materialCost = product.material_cost ?? 0;
    const laborCost    = product.labor_cost ?? 0;
    const markup       = product.markup_percentage ?? 0;
    const costPerUnit  = materialCost + laborCost;
    const unitPrice    = costPerUnit * (1 + markup / 100);
    const categoryName = product.category?.name || "Materials";
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, category: categoryName, description: product.name, unit: product.unit || item.unit, unit_price: unitPrice, total: (Number(item.quantity) || 1) * unitPrice, material_cost: materialCost, fromProduct: true };
    }));
    setPickerState(prev => ({ ...prev, [itemId]: { categoryId: "" } }));
  };

  // ── Proposal item modifications ──────────────────────────────────────────
  const handleDeleteProposalItem = (li: any) => {
    setModifications(prev => ({
      ...prev,
      [li.id]: { action: 'delete', estimate_item_id: li.id, original_quantity: li.quantity, original_client_price: li.client_price, original_total: li.total_price, quantity: li.quantity, client_price: li.client_price, total_price: li.total_price },
    }));
    setEditingProposalItemId(null);
  };

  const handleStartEditProposalItem = (li: any) => {
    const existing = modifications[li.id];
    setEditingProposalItemId(li.id);
    setEditQty(String(existing?.quantity ?? li.quantity ?? 1));
    setEditPrice(String(existing?.client_price ?? li.client_price ?? 0));
  };

  const handleSaveProposalItemEdit = (li: any) => {
    const qty = parseFloat(editQty) || 0;
    const price = parseFloat(editPrice) || 0;
    setModifications(prev => ({
      ...prev,
      [li.id]: { action: 'edit', estimate_item_id: li.id, original_quantity: li.quantity, original_client_price: li.client_price, original_total: li.total_price, quantity: qty, client_price: price, total_price: qty * price },
    }));
    setEditingProposalItemId(null);
  };

  const handleRestoreProposalItem = (itemId: string) => {
    setModifications(prev => { const next = { ...prev }; delete next[itemId]; return next; });
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleApprovalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setApprovalFile(file);
    setUploadingFile(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `co-approvals/${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("client-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("client-files").getPublicUrl(path);
      setApprovalFileUrl(publicUrl);
      if (existingCO?.id) {
        await supabase.from("change_orders").update({ approval_file_url: publicUrl }).eq("id", existingCO.id);
      }
      toast.success("Approval document uploaded.");
    } catch {
      toast.error("Failed to upload file — try again.");
      setApprovalFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Save / Merge ──────────────────────────────────────────────────────────
  const validate = () => {
    setTouched(true);
    if (!coTitle.trim()) { toast.error("Change order name is required."); return false; }
    const filledItems = items.filter(i => i.description.trim());
    const hasMods = Object.keys(modifications).length > 0;
    if (filledItems.length === 0 && !hasMods) { toast.error("Add at least one line item or modify an existing proposal item."); return false; }
    if (filledItems.some(i => !i.description.trim())) { toast.error("All line items need a description."); return false; }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const coData = {
        client_id: clientId!,
        project_id: project?.id ?? undefined,
        title: coTitle.trim(),
        reason: coDescription.trim(),
        timeline_impact: timelineImpact.trim(),
        status: "draft" as const,
        approval_verified: approvalVerified,
        approval_file_url: approvalFileUrl || undefined,
      };
      // Filter out empty placeholder rows before saving
      const coItems = items.filter(i => i.description.trim()).map(i => ({
        category: i.category,
        description: i.description,
        quantity: Number(i.quantity),
        unit: i.unit || "",
        unit_price: Number(i.unit_price),
        total: Number(i.total),
        material_cost: Number(i.material_cost || 0),
      }));
      const modsArray = Object.values(modifications);
      if (isEdit && existingCO) {
        await changeOrdersAPI.update(existingCO.id, coData as any, coItems, modsArray);
        toast.success("Change order updated.");
      } else {
        const created = await changeOrdersAPI.create(coData, coItems, modsArray);
        // Save approval fields on newly created CO then redirect to its edit URL
        if (approvalFileUrl || approvalVerified) {
          await supabase.from("change_orders").update({
            approval_verified: approvalVerified,
            approval_file_url: approvalFileUrl || null,
          }).eq("id", created.id);
        }
        setExistingCO({ ...created, id: created.id });
        navigate(`/clients/${clientId}/change-order/${created.id}`, { replace: true });
        toast.success("Change order saved as draft.");
      }
      // Reset dirty tracking so Back button won't warn after a successful save
      initialItemsRef.current = JSON.stringify(items.map(({ id: _id, fromProduct: _fp, ...rest }) => rest));
      initialModsRef.current  = JSON.stringify(modifications);
      activityLogAPI.create({
        client_id: clientId!,
        action_type: "change_order_created",
        description: `Change order "${coTitle.trim()}" ${isEdit ? "updated" : "created"} — draft`,
      }).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const buildCoEmailPreviewHtml = () => {
    const firstName = client?.first_name ?? "Client";
    const amountStr = coImpact >= 0 ? `+${fmt(coImpact)}` : fmt(coImpact);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;"><tr>
      <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
        <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="B&amp;A" height="56" style="height:56px;width:auto;display:block;margin:0 auto 14px auto;border:0;outline:none;"/>
        <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
      </td>
    </tr></table>
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Message from Butler &amp; Associates</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Hi ${firstName},</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">A change order on your project requires your approval before work can continue.</p>
      ${coTitle.trim() ? `<p style="font-family:Inter,sans-serif;font-size:15px;font-weight:400;color:#0A0A0A;margin:0 0 12px 0;">${coTitle.trim()}</p>` : ""}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4DC;border-radius:4px;overflow:hidden;margin:0 0 20px 0;">
        <tr style="background:#F5F3EF;">
          <td style="font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;padding:8px 12px;">Original Contract</td>
          <td style="font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;padding:8px 12px;text-align:right;">${fmt(originalTotal)}</td>
        </tr>
        <tr>
          <td style="font-family:Inter,sans-serif;font-size:13px;color:#BB984D;font-weight:600;padding:8px 12px;border-top:1px solid #E8E4DC;">Change Order</td>
          <td style="font-family:Inter,sans-serif;font-size:13px;color:#BB984D;font-weight:600;padding:8px 12px;text-align:right;border-top:1px solid #E8E4DC;">${amountStr}</td>
        </tr>
        <tr style="background:#0A0A0A;">
          <td style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#BB984D;padding:8px 12px;">New Contract Total</td>
          <td style="font-family:Inter,sans-serif;font-size:13px;font-weight:600;color:#BB984D;padding:8px 12px;text-align:right;">${fmt(newTotal)}</td>
        </tr>
      </table>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Open your portal to review the details and approve or decline.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="#" style="display:inline-block;background:#0A0A0A;color:#BB984D;font-family:Inter,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:4px;">Review Change Order →</a>
      </div>
      <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;text-align:center;">Questions? Reply to this email or reach us at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.</p>
    </div>
    <div style="text-align:center;padding:20px 0 0 0;">
      <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
      <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
    </div>
  </div>
</body>
</html>`;
  };

  const handleSendToClient = async () => {
    if (!validate()) return;
    setSendingToClient(true);
    try {
      const coItems = items.filter(i => i.description.trim()).map(i => ({
        category: i.category,
        description: i.description,
        quantity: Number(i.quantity),
        unit: i.unit || "",
        unit_price: Number(i.unit_price),
        total: Number(i.total),
        material_cost: Number(i.material_cost || 0),
      }));
      const modsArray = Object.values(modifications);

      let coIdToUse: string;

      if (isEdit && existingCO) {
        // Update existing CO to pending_client — also store total snapshots and true coImpact
        await supabase.from("change_orders").update({
          title: coTitle.trim(),
          reason: coDescription.trim(),
          timeline_impact: timelineImpact.trim(),
          status: "pending_client",
          cost_impact: coImpact,
          original_total: originalTotal,
          new_total: newTotal,
          updated_at: new Date().toISOString(),
        }).eq("id", existingCO.id);
        await supabase.from("change_order_items").delete().eq("co_id", existingCO.id);
        if (coItems.length > 0) {
          await supabase.from("change_order_items").insert(
            coItems.map((item, i) => ({ ...item, co_id: existingCO.id, sort_order: i }))
          );
        }
        coIdToUse = existingCO.id;
        setExistingCO((prev: any) => ({ ...prev, status: "pending_client" }));
      } else {
        // Save new CO directly as pending_client — store total snapshots and true coImpact
        const created = await changeOrdersAPI.create(
          { client_id: clientId!, project_id: project?.id, title: coTitle.trim(), reason: coDescription.trim(), timeline_impact: timelineImpact.trim(), status: "pending_client", original_total: originalTotal, new_total: newTotal, cost_impact: coImpact },
          coItems,
          modsArray
        );
        coIdToUse = created.id;
        setExistingCO({ ...created, status: "pending_client" });
        navigate(`/clients/${clientId}/change-order/${created.id}`, { replace: true });
      }

      // Fetch client portal token
      const { data: tokenRow } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("client_id", clientId!)
        .eq("is_active", true)
        .maybeSingle();

      if (!tokenRow?.token) {
        // No portal token — CO is still sent (status updated) but no email
        activityLogAPI.create({
          client_id: clientId!,
          action_type: "co_status_updated",
          description: `Change order "${coTitle.trim()}" sent to client for review (no portal email — portal link not generated yet)`,
        }).catch(() => {});
        toast.warning("Change order marked as pending. No portal link found — generate a client portal link first to send an email notification.");
        setShowSendConfirm(false);
        return;
      }

      // Send portal notification email
      await fetch(`https://${projectId}.supabase.co/functions/v1/send-portal-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": publicAnonKey },
        body: JSON.stringify({
          type: "co_pending",
          client_id: clientId,
          token: tokenRow.token,
          entity_id: coIdToUse,
          payload: { title: coTitle.trim(), amount: coImpact },
        }),
      });

      activityLogAPI.create({
        client_id: clientId!,
        action_type: "co_status_updated",
        description: `Change order "${coTitle.trim()}" sent to client for review — email notification sent`,
      }).catch(() => {});

      saveCoPdfOnSend(coIdToUse).catch(() => {});
      // Reset dirty tracking so Back button won't warn after a successful send
      initialItemsRef.current = JSON.stringify(items.map(({ id: _id, fromProduct: _fp, ...rest }) => rest));
      initialModsRef.current  = JSON.stringify(modifications);
      toast.success(`Change order sent to ${client.first_name} ${client.last_name} for review.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send — please try again.");
    } finally {
      setSendingToClient(false);
      setShowSendConfirm(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCO) return;
    setDeleting(true);
    try {
      await changeOrdersAPI.delete(existingCO.id);
      activityLogAPI.create({
        client_id: clientId!,
        action_type: "change_order_voided",
        description: `Change order "${existingCO.title}" deleted`,
      }).catch(() => {});
      toast.success("Change order deleted.");
      navigate(`/clients/${clientId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete — please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAdminApprove = async () => {
    if (!existingCO) return;
    setAdminApproving(true);
    try {
      await supabase.from("change_orders").update({
        status: "approved",
        updated_at: new Date().toISOString(),
      }).eq("id", existingCO.id);
      setExistingCO((prev: any) => ({ ...prev, status: "approved" }));
      activityLogAPI.create({
        client_id: clientId!,
        action_type: "change_order_approved",
        description: `Change order "${existingCO.title}" approved directly by admin ($0 impact)`,
      }).catch(() => {});
      toast.success("Change order approved. Upload proof and apply it to the proposal.");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve — please try again.");
    } finally {
      setAdminApproving(false);
    }
  };

  const handleApplyToProposal = async () => {
    if (!validate()) return;
    if (!approvalVerified) { toast.error("Please confirm you have received client approval before applying."); return; }
    if (!approvalFileUrl) { toast.error("Please upload proof of client approval."); return; }
    if (!proposal) { toast.error("No accepted proposal found — cannot merge."); return; }

    setMerging(true);
    try {
      // Save/update CO first with approval info
      const coData = {
        client_id: clientId!,
        title: coTitle.trim(),
        reason: coDescription.trim(),
        timeline_impact: timelineImpact.trim(),
        status: "approved" as const,
        approval_verified: true,
        approval_file_url: approvalFileUrl,
      };
      const coItems = items.filter(i => i.description.trim()).map(i => ({
        category: i.category,
        description: i.description,
        quantity: Number(i.quantity),
        unit: i.unit || "",
        unit_price: Number(i.unit_price),
        total: Number(i.total),
        material_cost: Number(i.material_cost || 0),
      }));

      let co: any;
      if (isEdit && existingCO) {
        // Update status + approval on existing CO
        await supabase.from("change_orders").update({
          title: coData.title,
          reason: coData.reason,
          timeline_impact: coData.timeline_impact,
          project_id: project?.id ?? existingCO.project_id,
          status: "approved",
          approval_verified: true,
          approval_file_url: approvalFileUrl,
          updated_at: new Date().toISOString(),
        }).eq("id", existingCO.id);
        await supabase.from("change_order_items").delete().eq("co_id", existingCO.id);
        await supabase.from("change_order_items").insert(
          coItems.map((item, i) => ({ ...item, co_id: existingCO.id, sort_order: i }))
        );
        co = { ...existingCO, ...coData, project_id: project?.id ?? existingCO.project_id, items: coItems, cost_impact: coItems.reduce((s, i) => s + i.total, 0) };
      } else {
        // Create CO then save approval fields
        const created = await changeOrdersAPI.create(
          { client_id: clientId!, project_id: project?.id, title: coData.title, reason: coData.reason, timeline_impact: coData.timeline_impact, status: "approved" },
          coItems
        );
        await supabase.from("change_orders").update({
          approval_verified: true,
          approval_file_url: approvalFileUrl,
        }).eq("id", created.id);
        co = { ...created, items: coItems };
      }

      // Merge into proposal (pass modifications so edits/deletes are applied)
      const { newEstimateTotal } = await changeOrdersAPI.mergeApproved(co, clientId!, Object.values(modifications));

      activityLogAPI.create({
        client_id: clientId!,
        action_type: "change_order_created",
        description: `Change order "${coTitle.trim()}" approved and merged into proposal — new total ${fmt(newEstimateTotal)}`,
      }).catch(() => {});

      toast.success(`Change order applied! New proposal total: ${fmt(newEstimateTotal)}`);
      navigate(`/clients/${clientId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to apply — please try again.");
    } finally {
      setMerging(false);
    }
  };

  const buildCoPdf = async (element: HTMLElement): Promise<jsPDF | null> => {
    try {
      const imgs = Array.from(element.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2, useCORS: true, allowTaint: false, logging: false,
        imageTimeout: 10000, removeContainer: true,
        onclone: (_doc, el) => {
          const root = el.getRootNode() as Document;
          root.querySelectorAll?.("link[rel='stylesheet'], style").forEach((s) => s.remove());
        },
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerPt = canvas.width / pageW;
      const totalImgHPt = canvas.height / pxPerPt;

      const findSafeCutPx = (cutPx: number, lookbackPx = 120): number => {
        const ctx = canvas.getContext("2d")!;
        const stripX = Math.floor(canvas.width * 0.1);
        const stripW = Math.floor(canvas.width * 0.8);
        for (let y = cutPx; y >= Math.max(0, cutPx - lookbackPx); y--) {
          const d = ctx.getImageData(stripX, y, stripW, 1).data;
          let clear = true;
          for (let p = 0; p < d.length; p += 4) {
            if (d[p] < 195 || d[p + 1] < 195 || d[p + 2] < 195) { clear = false; break; }
          }
          if (clear) return y;
        }
        return cutPx;
      };

      let consumedPt = 0;
      let firstPage = true;
      while (consumedPt < totalImgHPt - 1) {
        const remainPt = totalImgHPt - consumedPt;
        let sliceHPt: number;
        if (remainPt <= pageH) {
          sliceHPt = remainPt;
        } else {
          const cutPx = Math.round((consumedPt + pageH) * pxPerPt);
          const safePx = findSafeCutPx(cutPx);
          sliceHPt = Math.max(safePx / pxPerPt - consumedPt, pageH * 0.3);
        }
        const srcY = Math.round(consumedPt * pxPerPt);
        const srcH = Math.min(Math.round(sliceHPt * pxPerPt), canvas.height - srcY);
        if (srcH <= 0) break;
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = srcH;
        slice.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const renderHPt = (srcH / canvas.width) * pageW;
        if (!firstPage) pdf.addPage();
        firstPage = false;
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, renderHPt);
        consumedPt += srcH / pxPerPt;
      }

      return pdf;
    } catch (err) {
      console.error("PDF export error:", err);
      return null;
    }
  };

  const handleExportPDF = async () => {
    const element = exportRef.current;
    if (!element) return;
    setDownloading(true);
    try {
      const pdf = await buildCoPdf(element);
      if (!pdf) {
        toast.error("Failed to generate PDF — please try again.");
        return;
      }
      pdf.save(`ChangeOrder-${coTitle.trim().replace(/\s+/g, "-") || "CO"}.pdf`);
      if (clientId) activityLogAPI.create({ client_id: clientId, action_type: "co_pdf_exported", description: `Change order PDF exported: "${coTitle.trim()}"` }).catch(() => {});
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF — please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const saveCoPdfOnSend = async (coId: string): Promise<void> => {
    const element = exportRef.current;
    if (!element || !clientId) return;
    const pdf = await buildCoPdf(element);
    if (!pdf) return;
    const blob = pdf.output("blob");
    const path = `${clientId}/change-orders/${coId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("client-files")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (uploadErr) { console.error("[portal-pdf] CO upload failed:", uploadErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("client-files").getPublicUrl(path);
    await supabase.from("change_orders").update({ pdf_url: publicUrl }).eq("id", coId);
  };

  const handlePreview = async () => {
    const element = exportRef.current;
    if (!element) return;
    setPreviewPages([]);
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const imgs = Array.from(element.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2, useCORS: true, allowTaint: false, logging: false,
        imageTimeout: 10000, removeContainer: true,
        onclone: (_doc, el) => {
          const root = el.getRootNode() as Document;
          root.querySelectorAll?.("link[rel='stylesheet'], style").forEach((s) => s.remove());
        },
      });

      // Slice canvas into A4-height pages
      const A4_RATIO = 841.89 / 595.28;
      const pageHeightPx = Math.round(canvas.width * A4_RATIO);
      const pages: string[] = [];
      let offsetY = 0;
      while (offsetY < canvas.height) {
        const sliceH = Math.min(pageHeightPx, canvas.height - offsetY);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext("2d")!.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pages.push(slice.toDataURL("image/jpeg", 0.92));
        offsetY += sliceH;
      }
      setPreviewPages(pages);
    } catch {
      toast.error("Failed to generate preview — please try again.");
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const BAD_CATEGORIES = ["Concrete", "Pavers", "Retaining Walls", "Sod"];
  const originalTotal = proposal?.total || 0;
  const originalBad = proposal?.bad_amount ?? 0;
  const originalTax = proposal?.tax_amount ?? 0;

  // Subtotal — re-sum the proposal's line items (the SAME basis mergeApproved uses) plus
  // deltas from mods + new CO items. Using the re-summed line total instead of the stored
  // aggregate proposal.subtotal keeps this live preview penny-accurate vs. the merged result.
  const modSubtotalDelta = Object.values(modifications).reduce((s: number, mod: any) => {
    const li = (proposal?.line_items || []).find((l: any) => l.id === mod.estimate_item_id);
    if (!li) return s;
    if (mod.action === 'delete') return s - Number(li.total_price || 0);
    if (mod.action === 'edit') return s + (Number(mod.total_price || 0) - Number(li.total_price || 0));
    return s;
  }, 0);
  const newCoSubtotal = items.filter(i => i.description.trim()).reduce((s, i) => s + Number(i.total || 0), 0);
  const originalLineSubtotal = (proposal?.line_items || []).reduce((s: number, li: any) => s + Number(li.total_price || 0), 0);
  const liveSubtotal = originalLineSubtotal + modSubtotalDelta + newCoSubtotal;

  // Discount — preserve original; if % discount recompute proportionally with new subtotal
  const discountPct = proposal?.discount_percentage || 0;
  const originalDiscountAmount = proposal?.discount_amount || 0;
  // No intermediate rounding — mergeApproved computes the % discount unrounded, so matching
  // it here keeps the live total penny-identical to the merged proposal.
  const liveDiscountAmount = discountPct > 0
    ? liveSubtotal * (discountPct / 100)
    : originalDiscountAmount;
  const liveSubtotalAfterDiscount = liveSubtotal - liveDiscountAmount;

  // BAD — stored bad_amount as base + apply deltas from each change (preserves manual overrides)
  // Delta from edits/deletes of existing qualifying proposal items
  const modBadDelta = Object.values(modifications).reduce((s: number, mod: any) => {
    const li = (proposal?.line_items || []).find((l: any) => l.id === mod.estimate_item_id);
    if (!li) return s;
    const qualifies = BAD_CATEGORIES.includes(li.category) || Number(li.labor_cost || 0) > 0;
    if (!qualifies) return s;
    if (mod.action === 'delete') return s + (-Number(li.total_price || 0) * 0.015 * 1.5);
    if (mod.action === 'edit') return s + ((Number(mod.total_price || 0) - Number(li.total_price || 0)) * 0.015 * 1.5);
    return s;
  }, 0);
  // Delta from new qualifying CO items
  const coBadQualifying = items.filter(i => i.description.trim() && BAD_CATEGORIES.includes(i.category)).reduce((s, i) => s + Number(i.total || 0), 0);
  const coBadDelta = coBadQualifying * 0.015 * 1.5;
  const liveBad = Math.round((originalBad + modBadDelta + coBadDelta) * 100) / 100;

  // Tax — ADDITIVE: keep the original proposal's tax and only ADD the zip rate (e.g.
  // 9%) on the change order's OWN net new materials (new items + edit/delete deltas),
  // same as proposals (labor never taxed). This never retroactively changes an active
  // job's existing tax. If the zip rate is unknown, no tax is added (original kept).
  const isTaxableItem = (name: string, matCost: number) => {
    const prod = dbProducts.find((p: any) => String(p.name || "").toLowerCase() === String(name || "").toLowerCase());
    return prod ? prod.sales_tax_rate != null : matCost > 0;
  };
  let liveTax = Number(originalTax) || 0; // preserve original baseline
  if (taxRate > 0) {
    // material delta from edits/deletes of original items
    const modMaterialDelta = Object.values(modifications).reduce((s: number, mod: any) => {
      const li = (proposal?.line_items || []).find((l: any) => l.id === mod.estimate_item_id);
      if (!li) return s;
      const matCost = Number(li.material_cost || 0);
      if (!isTaxableItem(li.product_name, matCost)) return s;
      if (mod.action === "delete") return s - Number(li.quantity || 0) * matCost;
      if (mod.action === "edit")   return s + (Number(mod.quantity || 0) - Number(li.quantity || 0)) * matCost;
      return s;
    }, 0);
    // 9% on new CO items' material
    const coMaterial = items.filter(i => i.description.trim()).reduce((s, i) => {
      const matCost = Number(i.material_cost || 0);
      return s + (isTaxableItem(i.description, matCost) ? Number(i.quantity || 0) * matCost : 0);
    }, 0);
    liveTax = Math.round((Number(originalTax || 0) + (coMaterial + modMaterialDelta) * (taxRate / 100)) * 100) / 100;
  }

  // CC Processing Fee — recompute from live pre-stripe total (2.9% + $0.30 flat)
  const livePreStripeTotal = liveSubtotalAfterDiscount + liveBad + liveTax;
  const liveStripeFee = proposal?.stripe_fee_enabled
    ? Math.round((livePreStripeTotal * 0.029 + 0.30) * 100) / 100
    : 0;

  const newTotal = livePreStripeTotal + liveStripeFee;
  const coImpact = newTotal - originalTotal;

  // Group proposal line items by category
  const proposalGroups = (() => {
    const items: any[] = proposal?.line_items || [];
    const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const map: Record<string, any[]> = {};
    sorted.forEach(item => {
      const cat = item.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return Object.entries(map);
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Client not found.</p>
        <Link to="/clients"><Button className="mt-4">Back to Clients</Button></Link>
      </div>
    );
  }

  const isMerged         = existingCO?.status === "merged";
  const isPending        = existingCO?.status === "pending_client";
  const isOpened         = existingCO?.status === "opened";
  const isClientApproved = existingCO?.status === "approved";
  const isClientRejected = existingCO?.status === "rejected";
  const isApproved       = isClientApproved || isClientRejected;
  const showSendBtn      = !isMerged && !isClientApproved;
  const canSend          = showSendBtn && !!coTitle.trim() && items.some(i => i.description.trim());
  const canMerge   = !!(proposal && approvalVerified && approvalFileUrl && !isMerged);

  // For merged COs, show stored snapshots so the summary reflects what was actually approved
  const displayOriginalTotal = isMerged && existingCO?.pre_merge_total != null
    ? Number(existingCO.pre_merge_total)
    : originalTotal;
  const displayNewTotal = isMerged && existingCO?.post_merge_total != null
    ? Number(existingCO.post_merge_total)
    : newTotal;
  const displayCoImpact = displayNewTotal - displayOriginalTotal;

  const isDirty = loadedRef.current && (
    (initialItemsRef.current !== "" && JSON.stringify(items.map(({ id: _id, fromProduct: _fp, ...rest }) => rest)) !== initialItemsRef.current) ||
    JSON.stringify(modifications) !== initialModsRef.current
  );

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Top bar */}
      <div className="shrink-0 bg-background border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => {
            if (isDirty) { setShowBackConfirm(true); } else { navigate(`/clients/${clientId}`); }
          }} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{client.first_name} {client.last_name}</p>
            <p className="font-semibold text-sm truncate">{isEdit ? "Edit Change Order" : "New Change Order"}</p>
          </div>
          {isEdit && existingCO && existingCO.status !== "merged" && existingCO.status !== "approved" && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting || saving || merging}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {/* CO Switcher — only show when multiple COs exist */}
          {allCos.length > 0 && (
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7 px-2.5"
                onClick={() => setShowCoPicker(p => !p)}
              >
                <FileText className="h-3.5 w-3.5" />
                {allCos.length} CO{allCos.length !== 1 ? "s" : ""}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {showCoPicker && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-background border rounded-lg shadow-lg w-64 py-1" onClick={() => setShowCoPicker(false)}>
                  {allCos.map((co, idx) => {
                    const isCurrent = co.id === coId;
                    const statusColors: Record<string, string> = {
                      draft: "bg-gray-100 text-gray-700",
                      pending_client: "bg-amber-100 text-amber-700",
                      opened: "bg-blue-100 text-blue-700",
                      approved: "bg-green-100 text-green-700",
                      rejected: "bg-red-100 text-red-700",
                      merged: "bg-purple-100 text-purple-700",
                    };
                    const statusLabel: Record<string, string> = {
                      draft: "Draft", pending_client: "Pending", opened: "Opened",
                      approved: "Approved", rejected: "Rejected", merged: "Merged",
                    };
                    return (
                      <button
                        key={co.id}
                        className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2 ${isCurrent ? "bg-accent/50" : ""}`}
                        onClick={() => {
                          if (isCurrent) return;
                          const doNav = () => navigate(`/clients/${clientId}/change-order/${co.id}`);
                          if (isDirty) { if (window.confirm("You have unsaved changes. Switch anyway?")) doNav(); }
                          else doNav();
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">CO {idx + 1} — {co.title || "Untitled"}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[co.status] || "bg-gray-100 text-gray-700"}`}>
                          {statusLabel[co.status] || co.status}
                        </span>
                      </button>
                    );
                  })}
                  <div className="border-t mt-1 pt-1">
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 text-xs font-medium text-primary"
                      onClick={() => {
                        const doNav = () => navigate(`/clients/${clientId}/change-order`);
                        if (isDirty) { if (window.confirm("You have unsaved changes. Start a new CO anyway?")) doNav(); }
                        else doNav();
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> New Change Order
                    </button>
                  </div>
                </div>
              )}
              {showCoPicker && <div className="fixed inset-0 z-40" onClick={() => setShowCoPicker(false)} />}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isMerged && !isPending && !isClientApproved && !isClientRejected && (
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving || merging || downloading || sendingToClient}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          )}
          {showSendBtn && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCoEmailPreview(true)} disabled={!coTitle.trim()}>
                <Eye className="h-4 w-4" />Preview Email
              </Button>
              <Button
                size="sm"
                variant={isPending ? "outline" : "default"}
                className={isPending ? "border-blue-400 text-blue-600 hover:bg-blue-50" : "bg-blue-600 hover:bg-blue-700 text-white"}
                disabled={!canSend || sendingToClient || saving || merging || downloading}
                onClick={() => setShowSendConfirm(true)}
              >
                <span className="flex items-center gap-2">
                  {sendingToClient ? <Loader2 className="h-4 w-4 animate-spin" /> : (isPending || isClientRejected) ? <RefreshCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {sendingToClient ? "Sending…" : (isPending || isClientRejected) ? "Resend to Client" : "Save & Send"}
                </span>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={downloading || saving || merging || !coTitle.trim()}>
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={downloading || saving || merging || !coTitle.trim()}>
            <span className="flex items-center gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </span>
          </Button>
          {isEdit && existingCO && !isMerged && !isClientApproved && !isClientRejected && !isPending && coImpact === 0 && (
            <Button size="sm" variant="outline"
              className="border-green-400 text-green-700 hover:bg-green-50"
              onClick={handleAdminApprove}
              disabled={adminApproving || saving || merging}
            >
              {adminApproving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve Directly
            </Button>
          )}
          {!isMerged && !isClientRejected && (
            <Button size="sm" onClick={() => { if (!validate()) return; setShowApplyConfirm(true); }} disabled={merging || saving || downloading || !canMerge}
              className="bg-green-600 hover:bg-green-700 text-white">
              {merging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Apply to Proposal
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-hidden">
          <div className="h-full max-w-6xl mx-auto px-6 grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: CO Form ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 h-full overflow-y-auto py-8 space-y-6">

          {/* Merged read-only banner */}
          {isMerged && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
              <Check className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-800">This change order has been merged</p>
                <p className="text-xs text-purple-700 mt-0.5">It is now part of the accepted proposal and cannot be edited. You can preview or export the PDF.</p>
              </div>
            </div>
          )}

          {/* Pending client approval banner */}
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <Clock className="h-4 w-4 text-orange-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Awaiting Client Approval</p>
                <p className="text-xs text-orange-700 mt-0.5">This change order has been sent to the client and is pending their review. You can resend the email if needed.</p>
              </div>
            </div>
          )}

          {/* Client has opened banner */}
          {isOpened && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <Eye className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Client Has Viewed This Change Order</p>
                <p className="text-xs text-blue-700 mt-0.5">The client opened this change order but hasn't approved or declined yet.</p>
              </div>
            </div>
          )}

          {/* Declined by client banner */}
          {isClientRejected && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Declined by Client</p>
                <p className="text-xs text-red-700 mt-0.5">The client has declined this change order. You can resend it as-is, or create a new change order with different terms.</p>
              </div>
            </div>
          )}

          {/* Approved by client banner */}
          {isClientApproved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Approved by Client</p>
                <p className="text-xs text-green-700 mt-0.5">The client has approved this change order. Upload the signed document above and apply it to the proposal.</p>
              </div>
            </div>
          )}

          {/* CO Details */}
          <div className="bg-background border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-base">Change Order Details</h2>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Add outdoor lighting, Upgrade to stamped concrete"
                value={coTitle}
                onChange={e => setCoTitle(e.target.value)}
                className={touched && !coTitle.trim() ? "border-destructive" : ""}
                disabled={isClientApproved || isClientRejected || isMerged}
              />
              {touched && !coTitle.trim() && <p className="text-xs text-destructive">Name is required.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(Why is this change necessary?)</span></Label>
              <Textarea
                placeholder="Describe why this change is needed..."
                value={coDescription}
                onChange={e => setCoDescription(e.target.value)}
                rows={3}
                disabled={isClientApproved || isClientRejected || isMerged}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timeline Impact <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. 3 additional days"
                value={timelineImpact}
                onChange={e => setTimelineImpact(e.target.value)}
                disabled={isClientApproved || isClientRejected || isMerged}
              />
            </div>
          </div>

          {/* CO Line Items */}
          <div className="bg-background border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Change Order Items</h2>
              {!isClientApproved && !isClientRejected && !isMerged && (
                <Button size="sm" variant="outline" onClick={() => setItems(prev => [...prev, EMPTY_ITEM()])}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1 hidden sm:grid">
              <div className="col-span-4">Description</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-center">Unit</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const catProducts = categories.length > 0 && pickerState[item.id]?.categoryId
                  ? dbProducts.filter(p => (p.category?.id ?? p.service_category_id) === pickerState[item.id].categoryId)
                  : [];

                return (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-muted/10">
                    {/* Product picker */}
                    {categories.length > 0 && !isClientApproved && !isClientRejected && !isMerged && (
                      <div className="flex gap-2">
                        <Select
                          value={pickerState[item.id]?.categoryId || ""}
                          onValueChange={catId => {
                            const catName = categories.find((c: any) => c.id === catId)?.name || "Materials";
                            setPickerState(prev => ({ ...prev, [item.id]: { categoryId: catId } }));
                            updateItem(item.id, "category", catName);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 bg-blue-50 border-blue-200 text-blue-700">
                            <SelectValue placeholder="Browse by category…" />
                          </SelectTrigger>
                          <SelectContent side="bottom" align="start" className="max-h-52 overflow-y-auto">
                            {categories.map((c: any) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {catProducts.length > 0 && (
                          <Select onValueChange={pid => applyProduct(item.id, pid)}>
                            <SelectTrigger className="h-8 text-xs flex-1 bg-blue-50 border-blue-200 text-blue-700">
                              <SelectValue placeholder="Select product…" />
                            </SelectTrigger>
                            <SelectContent side="bottom" align="start" className="max-h-52 overflow-y-auto">
                              {catProducts.map((p: any) => {
                                const price = ((p.material_cost ?? 0) + (p.labor_cost ?? 0)) * (1 + (p.markup_percentage ?? 0) / 100);
                                return (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name} — {fmt(price)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Item fields */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-4">
                        <Input
                          placeholder="Description *"
                          value={item.description}
                          onChange={e => {
                            updateItem(item.id, "description", e.target.value);
                            if (item.fromProduct) setItems(prev => prev.map(i => i.id === item.id ? { ...i, fromProduct: false } : i));
                          }}
                          className={`h-8 text-sm ${touched && !item.description.trim() ? "border-destructive" : ""}`}
                          disabled={isClientApproved || isClientRejected || isMerged}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.quantity}
                          onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center"
                          disabled={isClientApproved || isClientRejected || isMerged}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          placeholder="e.g. SF, each"
                          value={item.unit}
                          onChange={e => updateItem(item.id, "unit", e.target.value)}
                          className="h-8 text-sm text-center"
                          disabled={isClientApproved || isClientRejected || isMerged}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                          onBlur={e => {
                            const raw = parseFloat(e.target.value) || 0;
                            if (!item.fromProduct && globalMarkupPct > 0 && raw > 0) {
                              const markedUp = Math.round(raw * (1 + globalMarkupPct / 100) * 100) / 100;
                              setItems(prev => prev.map(i => i.id === item.id ? { ...i, unit_price: markedUp, total: (Number(i.quantity) || 0) * markedUp } : i));
                            }
                          }}
                          className="h-8 text-sm text-right"
                          disabled={isClientApproved || isClientRejected || isMerged}
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-1 text-right text-sm font-medium tabular-nums pr-1">
                        {fmt(item.total)}
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        {!isClientApproved && !isClientRejected && !isMerged && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CO Totals */}
            <div className="border-t pt-4 space-y-1">
              {isMerged ? (
                <>
                  {/* Merged CO — full transparent breakdown */}
                  {(() => {
                    const proposalItemMap: Record<string, any> = Object.fromEntries(
                      (proposal?.line_items ?? []).map((li: any) => [li.id, li])
                    );
                    const coItems = items.filter(i => i.description.trim());
                    const mods = Object.values(modifications);
                    const bad = Number(proposal?.bad_amount ?? 0);
                    const tax = Number(proposal?.tax_amount ?? 0);
                    const discount = Number(proposal?.discount_amount ?? 0);
                    const sub = Number(proposal?.subtotal ?? 0);
                    const stripeFee = proposal?.stripe_fee_enabled
                      ? Math.max(0, Math.round((displayNewTotal - (sub - discount + bad + tax)) * 100) / 100)
                      : 0;
                    return (
                      <>
                        {coItems.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Items Added</p>
                            {coItems.map((i, idx) => (
                              <div key={idx} className="flex justify-between text-sm text-muted-foreground pl-2">
                                <span className="truncate mr-2">{i.description}{i.category ? <span className="text-xs text-muted-foreground/60"> · {i.category}</span> : null}</span>
                                <span className="tabular-nums text-green-700 shrink-0">+{fmt(Number(i.total))}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {mods.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Items Adjusted</p>
                            {mods.map((m, idx) => {
                              const li = proposalItemMap[m.estimate_item_id];
                              const name = li?.product_name ?? "Existing item";
                              const origTotal = Number(m.original_total ?? 0);
                              const newTotalVal = Number(m.total_price ?? 0);
                              const delta = m.action === "delete" ? -origTotal : newTotalVal - origTotal;
                              if (isNaN(delta)) return null;
                              return (
                                <div key={idx} className="flex justify-between text-sm text-muted-foreground pl-2">
                                  <span className="truncate mr-2">{name}{m.action === "delete" ? <span className="text-xs text-red-500"> · Removed</span> : <span className="text-xs text-muted-foreground/60"> · Modified</span>}</span>
                                  <span className={`tabular-nums shrink-0 ${delta >= 0 ? "text-orange-600" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{fmt(delta)}</span>
                                </div>
                              );
                            })}
                          </>
                        )}
                        <Separator className="my-1" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Final Proposal Fees</p>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{fmt(sub)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Discount</span>
                            <span className="tabular-nums text-green-700">−{fmt(discount)}</span>
                          </div>
                        )}
                        {bad > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Base, Aggregate &amp; Disposal</span>
                            <span className="tabular-nums">{fmt(bad)}</span>
                          </div>
                        )}
                        {tax > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Sales Tax</span>
                            <span className="tabular-nums">{fmt(tax)}</span>
                          </div>
                        )}
                        {stripeFee > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>CC Processing Fee</span>
                            <span className="tabular-nums">{fmt(stripeFee)}</span>
                          </div>
                        )}
                        <Separator className="my-1" />
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmt(liveSubtotal)}</span>
                  </div>
                  {liveBad > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">Base, Aggregate &amp; Disposal{liveBad !== originalBad && <span className="text-[10px] px-1 rounded bg-yellow-100 text-yellow-700 font-medium">updated</span>}</span>
                      <span className="tabular-nums">{fmt(liveBad)}</span>
                    </div>
                  )}
                  {liveTax > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">Sales Tax{liveTax !== originalTax && <span className="text-[10px] px-1 rounded bg-yellow-100 text-yellow-700 font-medium">updated</span>}</span>
                      <span className="tabular-nums">{fmt(liveTax)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Original Contract Total</span>
                <span className="tabular-nums">{fmt(displayOriginalTotal)}</span>
              </div>
              <div className={`flex justify-between text-sm font-medium ${displayCoImpact >= 0 ? "text-green-700" : "text-red-600"}`}>
                <span>Change Order Impact</span>
                <span className="tabular-nums">{displayCoImpact >= 0 ? "+" : ""}{fmt(displayCoImpact)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>New Contract Total</span>
                <span className="tabular-nums text-primary">{fmt(displayNewTotal)}</span>
              </div>
            </div>
          </div>

          {/* Approval Gate */}
          <div className="bg-background border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">Client Approval</h2>
              <Badge variant="outline" className="text-xs">Required to apply</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Before applying this change order to the proposal, confirm that the client has approved the changes
              and upload proof of approval (email, signed document, etc.).
            </p>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="approval-check"
                checked={approvalVerified}
                onCheckedChange={async v => {
                  const val = !!v;
                  setApprovalVerified(val);
                  if (existingCO?.id) {
                    await supabase.from("change_orders").update({ approval_verified: val }).eq("id", existingCO.id);
                  }
                }}
                className="mt-0.5"
              />
              <Label htmlFor="approval-check" className="cursor-pointer text-sm leading-relaxed">
                I confirm that the client has reviewed and approved this change order, and that we have received
                authorization to proceed with the updated scope and pricing.
              </Label>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label className="text-sm">Proof of Approval</Label>
              {approvalFileUrl ? (
                <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                  <FileText className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 flex-1 truncate">
                    {approvalFile?.name || "Approval document uploaded"}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-destructive"
                    onClick={() => { setApprovalFile(null); setApprovalFileUrl(""); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-3 border rounded-lg border-dashed cursor-pointer hover:bg-muted/40 transition-colors">
                  {uploadingFile
                    ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    : <Upload className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">
                    {uploadingFile ? "Uploading…" : "Upload email confirmation, signed doc, or screenshot"}
                  </span>
                  <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={handleApprovalFileChange} disabled={uploadingFile} />
                </label>
              )}
            </div>

            {!canMerge && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Both confirmation checkbox and proof of approval are required before applying to the proposal.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Existing Proposal Reference ────────────────────────── */}
        <div className="h-full overflow-y-hidden py-8 flex flex-col">
          <div className="bg-background border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
              onClick={() => setShowProposal(p => !p)}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Current Proposal
                {proposal && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {fmt(proposal.total)}
                  </Badge>
                )}
              </span>
              {showProposal ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showProposal && (
              <div className="border-t flex flex-col min-h-0 flex-1">
                {!proposal ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No accepted proposal found.</p>
                    <p className="text-xs text-muted-foreground mt-1">A proposal must be accepted before creating change orders.</p>
                  </div>
                ) : (
                  <div className="divide-y flex-1 overflow-y-auto">
                    {proposalGroups.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No line items on proposal.</p>
                    ) : (
                      proposalGroups.map(([cat, catItems]) => (
                        <div key={cat}>
                          <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {cat}
                          </div>
                          {catItems.map((li: any) => {
                            const mod = modifications[li.id];
                            const isDeleted = mod?.action === 'delete';
                            const isEdited = mod?.action === 'edit';
                            const isEditingThis = editingProposalItemId === li.id;
                            const displayQty = isEdited ? mod.quantity : li.quantity;
                            const displayPrice = isEdited ? mod.client_price : li.client_price;
                            const displayTotal = isEdited ? mod.total_price : li.total_price;
                            return (
                              <div key={li.id} className={`px-4 py-2.5 border-b last:border-0 text-sm transition-colors ${isDeleted ? 'bg-red-50/60' : isEdited ? 'bg-yellow-50/60' : ''}`}>
                                {isEditingThis ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium truncate">{li.product_name}</p>
                                    <div className="flex gap-1.5">
                                      <div className="flex-1">
                                        <p className="text-[10px] text-muted-foreground mb-0.5">Qty</p>
                                        <Input type="number" min="0" step="0.01" value={editQty} onChange={e => setEditQty(e.target.value)} className="h-7 text-xs" autoFocus />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-[10px] text-muted-foreground mb-0.5">Unit Price</p>
                                        <Input type="number" min="0" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="h-7 text-xs" />
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleSaveProposalItemEdit(li)}>Save</Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingProposalItemId(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between gap-2 items-start">
                                    <div className="flex-1 min-w-0">
                                      <p className={`truncate text-xs font-medium ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>{li.product_name}</p>
                                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                        <p className="text-[10px] text-muted-foreground">
                                          Qty: {displayQty}
                                          {isEdited && mod.original_quantity !== mod.quantity && (
                                            <span className="line-through ml-1 opacity-50">{li.quantity}</span>
                                          )}
                                        </p>
                                        {isDeleted && <span className="text-[10px] px-1 rounded bg-red-100 text-red-600 font-medium">Removed</span>}
                                        {isEdited && <span className="text-[10px] px-1 rounded bg-yellow-100 text-yellow-700 font-medium">Modified</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <span className={`tabular-nums text-xs ${isDeleted ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                                        {fmt(displayTotal || 0)}
                                      </span>
                                      {isDeleted ? (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-green-600" title="Restore" onClick={() => handleRestoreProposalItem(li.id)}>
                                          <RotateCcw className="h-3 w-3" />
                                        </Button>
                                      ) : (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-600" title="Edit" onClick={() => handleStartEditProposalItem(li)}>
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Remove" onClick={() => handleDeleteProposalItem(li)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                    <div className="px-4 py-2 bg-muted/20 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums">{fmt(isMerged ? (proposal?.subtotal ?? liveSubtotal) : liveSubtotal)}</span>
                      </div>
                      {(isMerged ? (proposal?.bad_amount ?? 0) > 0 : liveBad > 0) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>BAD</span>
                          <span className="tabular-nums">{fmt(isMerged ? (proposal?.bad_amount ?? liveBad) : liveBad)}</span>
                        </div>
                      )}
                      {(isMerged ? (proposal?.tax_amount ?? 0) > 0 : liveTax > 0) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Sales Tax</span>
                          <span className="tabular-nums">{fmt(isMerged ? (proposal?.tax_amount ?? liveTax) : liveTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                        <span>New Total</span>
                        <span className="tabular-nums text-primary">{fmt(displayNewTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
        </div>
      </div>

      {/* Off-screen export for PDF generation */}
      <div style={{ position: "absolute", left: -9999, top: 0, width: 794, pointerEvents: "none", opacity: 0 }}>
        <div ref={exportRef}>
          <ChangeOrderExport
            co={{
              title: coTitle,
              reason: coDescription,
              timeline_impact: timelineImpact,
              created_at: existingCO?.created_at || new Date().toISOString(),
              cost_impact: items.filter(i => i.description.trim()).reduce((s, i) => s + Number(i.total), 0),
              items: items.filter(i => i.description.trim()).map(i => ({
                description: i.description,
                category: i.category,
                quantity: Number(i.quantity),
                unit: i.unit || "",
                unit_price: Number(i.unit_price),
                total: Number(i.total),
              })),
            }}
            client={client}
            originalTotal={isMerged && existingCO?.pre_merge_total != null
              ? Number(existingCO.pre_merge_total)
              : (originalTotal || undefined)}
            newTotal={isMerged && existingCO?.post_merge_total != null
              ? Number(existingCO.post_merge_total)
              : (originalTotal ? newTotal : undefined)}
            modificationsDisplay={Object.values(modifications).map((mod: any) => {
              const li = (proposal?.line_items ?? []).find((l: any) => l.id === mod.estimate_item_id);
              const delta = mod.action === "delete"
                ? -Number(mod.original_total ?? 0)
                : Number(mod.total_price ?? 0) - Number(mod.original_total ?? 0);
              return {
                name: li?.product_name ?? "Existing item",
                action: mod.action,
                category: li?.category ?? null,
                delta: isNaN(delta) ? 0 : delta,
              };
            })}
          />
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="h-[95vh] p-0 overflow-hidden flex flex-col gap-0 [&>button:last-child]:hidden" style={{ width: 900, maxWidth: "95vw" }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#3c3c3c] text-white shrink-0">
            <span className="text-sm font-medium opacity-80">
              Change Order — {coTitle || "Preview"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-gray-900 border-white h-7 text-xs hover:bg-transparent hover:text-white hover:border-white"
                onClick={handleExportPDF}
                disabled={downloading}
              >
                <span className="flex items-center gap-1.5">
                  {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  {downloading ? "Generating…" : "Download PDF"}
                </span>
              </Button>
              <button onClick={() => setShowPreview(false)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#525659] thin-scroll-dark">
            <div className="py-8 flex flex-col items-center gap-6">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3 text-white/60 mt-20">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Generating preview…</span>
                </div>
              ) : previewPages.map((url, i) => (
                <img key={i} src={url} alt={`Page ${i + 1}`} style={{ width: 794, display: "block", boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Back with unsaved changes */}
      <AlertDialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved line item changes. Go back anyway? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(`/clients/${clientId}`)} className="bg-destructive hover:bg-destructive/90 text-white">
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Change Order?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  This will permanently delete <strong>"{existingCO?.title}"</strong>. This cannot be undone.
                </p>
                {existingCO?.status === "approved" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>This change order has already been <strong>approved</strong>. Deleting it will not affect the proposal — the approval is simply discarded.</p>
                  </div>
                )}
                {(existingCO?.status === "pending_client" || existingCO?.status === "opened") && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>This change order was <strong>sent to the client</strong> for review. Make sure to notify them it has been cancelled.</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Change Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send to Client — confirmation dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isPending ? "Resend to Client?" : "Save & Send to Client?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {isPending
                    ? `This will resend the portal email to ${client?.first_name} ${client?.last_name} with a direct link to review this change order.`
                    : `This will notify ${client?.first_name} ${client?.last_name} by email with a direct link to review and approve or decline this change order on their portal.`}
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change Order</span>
                    <span className="font-medium">{coTitle.trim()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-1 mt-1">
                    <span className="text-muted-foreground">Current Contract Total</span>
                    <span className="font-medium">{fmt(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change Order Impact</span>
                    <span className={`font-semibold ${coImpact >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {coImpact >= 0 ? "+" : ""}{fmt(coImpact)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                    <span>New Total</span>
                    <span className="text-primary">{fmt(newTotal)}</span>
                  </div>
                </div>
                {!isPending && (
                  <p className="text-xs text-blue-600 flex items-center gap-1.5">
                    <Send className="h-3 w-3 shrink-0" />
                    Status will change to <strong>Pending Client Review</strong>.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingToClient}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendToClient}
              disabled={sendingToClient}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendingToClient
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                : <><Send className="h-4 w-4 mr-2" />{isPending ? "Resend Email" : "Save & Send"}</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* CO Email Preview */}
      {showCoEmailPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCoEmailPreview(false)} />
          <div className="relative flex flex-col bg-background rounded-lg border shadow-lg overflow-hidden" style={{ width: "680px", maxWidth: "95vw", height: "85vh" }}>
            <div className="shrink-0 px-6 py-4 border-b flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Email Preview — Change Order</p>
                <p className="text-xs text-muted-foreground mt-0.5">This is exactly what {client?.email ?? "the client"} will receive.</p>
              </div>
              <button onClick={() => setShowCoEmailPreview(false)} className="opacity-60 hover:opacity-100 transition-opacity">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-white">
              <iframe srcDoc={buildCoEmailPreviewHtml()} className="w-full h-full border-0" title="CO Email Preview" />
            </div>
          </div>
        </div>
      )}

      {/* Apply to Proposal — confirmation dialog */}
      <AlertDialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Change Order to Proposal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">This will permanently update the accepted proposal. Review the changes below before confirming.</p>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground pb-1.5 border-b">
                    <span>Current Contract Total</span>
                    <span className="tabular-nums">{fmt(originalTotal)}</span>
                  </div>
                  {items.filter(i => i.description.trim()).length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700 font-medium">+ {items.filter(i => i.description.trim()).length} new item{items.filter(i => i.description.trim()).length > 1 ? "s" : ""} added</span>
                      <span className="tabular-nums text-green-700">{fmt(newCoSubtotal)}</span>
                    </div>
                  )}
                  {Object.values(modifications).filter(m => m.action === 'edit').length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-yellow-700 font-medium">~ {Object.values(modifications).filter(m => m.action === 'edit').length} item{Object.values(modifications).filter(m => m.action === 'edit').length > 1 ? "s" : ""} modified</span>
                      <span className="tabular-nums text-yellow-700">{fmt(Object.values(modifications).filter(m => m.action === 'edit').reduce((s, m) => s + (m.total_price - m.original_total), 0))}</span>
                    </div>
                  )}
                  {Object.values(modifications).filter(m => m.action === 'delete').length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-600 font-medium">− {Object.values(modifications).filter(m => m.action === 'delete').length} item{Object.values(modifications).filter(m => m.action === 'delete').length > 1 ? "s" : ""} removed</span>
                      <span className="tabular-nums text-red-600">−{fmt(Object.values(modifications).filter(m => m.action === 'delete').reduce((s, m) => s + m.original_total, 0))}</span>
                    </div>
                  )}
                  {liveBad !== originalBad && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>BAD adjusted</span>
                      <span className="tabular-nums">{liveBad > originalBad ? "+" : ""}{fmt(liveBad - originalBad)}</span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 flex justify-between font-semibold">
                    <span>New Contract Total</span>
                    <span className="tabular-nums text-primary">{fmt(newTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />This cannot be undone. Use Change Orders to make further adjustments.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyToProposal} disabled={merging} className="bg-green-600 hover:bg-green-700">
              {merging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirm &amp; Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
