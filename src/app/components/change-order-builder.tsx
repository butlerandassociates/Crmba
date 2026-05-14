import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, FileText, Check, Upload, X, AlertTriangle, Edit2, RotateCcw, Info, Download, Eye, XCircle } from "lucide-react";
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
import { changeOrdersAPI } from "../api/change-orders";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const EMPTY_ITEM = () => ({
  id: `item-${Date.now()}-${Math.random()}`,
  category: "Materials",
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
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

  // Form
  const [coTitle, setCoTitle]               = useState("");
  const [coDescription, setCoDescription]   = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [items, setItems]                   = useState([EMPTY_ITEM()]);
  const [touched, setTouched]               = useState(false);

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [c, prods, cats] = await Promise.all([
          clientsAPI.getById(clientId),
          productsAPI.getAll(),
          productsAPI.getCategories(),
        ]);
        setClient(c);
        setDbProducts(prods);
        setCategories(cats);

        // Load accepted proposal with line items + financial fields needed for live totals
        const { data: prop } = await supabase
          .from("estimates")
          .select("id, title, total, subtotal, bad_amount, tax_amount, discount_amount, discount_percentage, stripe_fee_enabled, estimate_number, line_items:estimate_line_items(id, product_name, category, labor_cost, quantity, client_price, total_price, sort_order)")
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
              setItems(co.items.map((i: any) => ({
                id: i.id || EMPTY_ITEM().id,
                category: i.category || "Materials",
                description: i.description || "",
                quantity: i.quantity || 1,
                unit_price: i.unit_price || 0,
                total: i.total || 0,
              })));
            }
            if (Array.isArray(co.modifications) && co.modifications.length > 0) {
              const modsMap: Record<string, any> = {};
              co.modifications.forEach((mod: any) => { modsMap[mod.estimate_item_id] = mod; });
              setModifications(modsMap);
            }
          }
        } else {
          // No coId — check if a draft CO already exists and redirect to it
          const draft = cos.find((c: any) => c.status === "draft");
          if (draft) {
            navigate(`/clients/${clientId}/change-order/${draft.id}`, { replace: true });
            return;
          }
        }
      } catch (err) {
        toast.error("Failed to load — please refresh.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId, coId]);

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
      return { ...item, category: categoryName, description: product.name, unit_price: unitPrice, total: (Number(item.quantity) || 1) * unitPrice };
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
        unit_price: Number(i.unit_price),
        total: Number(i.total),
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
        unit_price: Number(i.unit_price),
        total: Number(i.total),
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

  const handleExportPDF = async () => {
    const element = exportRef.current;
    if (!element) return;
    setDownloading(true);
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

      pdf.save(`ChangeOrder-${coTitle.trim().replace(/\s+/g, "-") || "CO"}.pdf`);
      if (clientId) activityLogAPI.create({ client_id: clientId, action_type: "co_pdf_exported", description: `Change order PDF exported: "${coTitle.trim()}"` }).catch(() => {});
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF — please try again.");
    } finally {
      setDownloading(false);
    }
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

  // Subtotal — stored proposal.subtotal as base + deltas from mods + new CO items
  // (avoids floating-point gap between stored subtotal and sum of individual line_item.total_price)
  const modSubtotalDelta = Object.values(modifications).reduce((s: number, mod: any) => {
    const li = (proposal?.line_items || []).find((l: any) => l.id === mod.estimate_item_id);
    if (!li) return s;
    if (mod.action === 'delete') return s - Number(li.total_price || 0);
    if (mod.action === 'edit') return s + (Number(mod.total_price || 0) - Number(li.total_price || 0));
    return s;
  }, 0);
  const newCoSubtotal = items.filter(i => i.description.trim()).reduce((s, i) => s + Number(i.total || 0), 0);
  const liveSubtotal = (proposal?.subtotal || 0) + modSubtotalDelta + newCoSubtotal;

  // Discount — preserve original; if % discount recompute proportionally with new subtotal
  const discountPct = proposal?.discount_percentage || 0;
  const originalDiscountAmount = proposal?.discount_amount || 0;
  const liveDiscountAmount = discountPct > 0
    ? Math.round(liveSubtotal * (discountPct / 100) * 100) / 100
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

  // Tax — scale proportionally using ratio from original (preserves $0 for unknown zip)
  const origSubtotalForTax = (proposal?.subtotal || 0) - (proposal?.discount_amount || 0);
  const taxRatio = origSubtotalForTax > 0 ? (proposal?.tax_amount || 0) / origSubtotalForTax : 0;
  const liveTax = Math.round(liveSubtotalAfterDiscount * taxRatio * 100) / 100;

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

  const isMerged = existingCO?.status === "merged";
  const canMerge = !!(proposal && approvalVerified && approvalFileUrl && !isMerged);

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Top bar */}
      <div className="shrink-0 bg-background border-b px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${clientId}`)} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{client.first_name} {client.last_name}</p>
            <p className="font-semibold text-sm truncate">{isEdit ? "Edit Change Order" : "New Change Order"}</p>
          </div>
          {isEdit && existingCO && existingCO.status !== "merged" && (
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isMerged && (
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving || merging || downloading}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
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
          {!isMerged && (
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
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timeline Impact <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. 3 additional days"
                value={timelineImpact}
                onChange={e => setTimelineImpact(e.target.value)}
              />
            </div>
          </div>

          {/* CO Line Items */}
          <div className="bg-background border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Change Order Items</h2>
              <Button size="sm" variant="outline" onClick={() => setItems(prev => [...prev, EMPTY_ITEM()])}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1 hidden sm:grid">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Total</div>
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
                    {categories.length > 0 && (
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
                      <div className="col-span-12 sm:col-span-5">
                        <Input
                          placeholder="Description *"
                          value={item.description}
                          onChange={e => updateItem(item.id, "description", e.target.value)}
                          className={`h-8 text-sm ${touched && !item.description.trim() ? "border-destructive" : ""}`}
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.quantity}
                          onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-right"
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-2 text-right text-sm font-medium tabular-nums pr-1">
                        {fmt(item.total)}
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CO Totals */}
            <div className="border-t pt-4 space-y-1">
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Original Contract Total</span>
                <span className="tabular-nums">{fmt(originalTotal)}</span>
              </div>
              <div className={`flex justify-between text-sm font-medium ${coImpact >= 0 ? "text-green-700" : "text-red-600"}`}>
                <span>Change Order Impact</span>
                <span className="tabular-nums">{coImpact >= 0 ? "+" : ""}{fmt(coImpact)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>New Contract Total</span>
                <span className="tabular-nums text-primary">{fmt(newTotal)}</span>
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
                onCheckedChange={v => setApprovalVerified(!!v)}
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
                        <span className="tabular-nums">{fmt(liveSubtotal)}</span>
                      </div>
                      {liveBad > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>BAD{liveBad !== originalBad && <span className="ml-1 text-[10px] px-1 rounded bg-yellow-100 text-yellow-700 font-medium">updated</span>}</span>
                          <span className="tabular-nums">{fmt(liveBad)}</span>
                        </div>
                      )}
                      {liveTax > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Sales Tax</span>
                          <span className="tabular-nums">{fmt(liveTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                        <span>New Total</span>
                        <span className="tabular-nums text-primary">{fmt(newTotal)}</span>
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
          <div className="flex-1 overflow-y-auto bg-[#525659] thin-scroll">
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
                {existingCO?.status === "pending_client" && (
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
