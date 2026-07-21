import { useState, useEffect, Fragment } from "react";
import { formatCurrency } from "@/app/utils/format";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { useParams, Link, useNavigate, useBlocker } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Download,
  Mail,
  Eye,
  Share2,
  Loader2,
  XCircle,
  CheckCircle2,
  Wand2,
  ChevronDown,
  ChevronUp,
  Package,
  FolderOpen,
  PenLine,
  X,
  Pencil,
  Paperclip,
  RotateCcw,
  Ban,
  BadgePercent,
  Check,
  Clock,
  BarChart2,
} from "lucide-react";
import { estimatesAPI, clientsAPI, productsAPI, estimateTemplatesAPI, wizardVariantsAPI, activityLogAPI, notificationsAPI, warrantyAPI } from "../utils/api";
import type { WarrantySection } from "../utils/api";
import { usePermissions } from "../hooks/usePermissions";
import { useViewAs } from "../contexts/view-as-context";
import { TemplateWizard } from "./wizards/template-wizard";
import { ConcreteWizard } from "./wizards/concrete-wizard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProposalExport } from "./proposal-export";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { PageLoader, SkeletonCards } from "./ui/page-loader";

export function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, role } = usePermissions();
  const { viewAsRole } = useViewAs();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [portalToken, setPortalToken] = useState<string | null>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saveTouched, setSaveTouched] = useState(false);
  const [editLineItems, setEditLineItems] = useState<any[]>([]);
  // Client-facing notes per category (keyed by category name), shown on the proposal + PDF
  const [categoryNotes, setCategoryNotes] = useState<Record<string, string>>({});
  const [editingBad, setEditingBad] = useState(false);
  const [badInputValue, setBadInputValue] = useState("");
  const [badOverride, setBadOverride] = useState<number | null>(null);

  // Expanded line item rows (internal cost details)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Item picker
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState("");
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [wizardVariants, setWizardVariants] = useState<any[]>([]);

  // Custom item form (inside picker)
  const [customItem, setCustomItem] = useState({ name: "", category: "", qty: 1, unit: "", materialCost: 0, laborCost: 0, markup: 0 });
  const [customValidated, setCustomValidated] = useState(false);
  const customCostPerUnit = customItem.materialCost + customItem.laborCost;
  const customPricePerUnit = customCostPerUnit * (1 + customItem.markup / 100);
  const formatC = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const resetCustomItem = () => {
    setCustomItem({ name: "", category: "", qty: 1, unit: "", materialCost: 0, laborCost: 0, markup: 0 });
    setCustomValidated(false);
  };

  const handleAddCustomItem = () => {
    setCustomValidated(true);
    if (!customItem.name.trim() || !customItem.category.trim() || !customItem.unit.trim()) return;
    const isLabor = ["labor", "installation"].includes(customItem.category.trim().toLowerCase());
    setEditLineItems((prev) => [...prev, {
      id: `new-${Date.now()}`,
      fromPicker: true,
      name: customItem.name.trim(),
      product_name: customItem.name.trim(),
      category: customItem.category.trim(),
      quantity: customItem.qty || 1,
      fio_qty: isLabor ? (customItem.qty || 1) : 0,
      unit: customItem.unit.trim(),
      client_price: customPricePerUnit,
      price_per_unit: customPricePerUnit,
      material_cost: customItem.materialCost,
      labor_cost: customItem.laborCost,
      cost_per_unit: customCostPerUnit,
      markup_percent: customItem.markup,
      total_price: (customItem.qty || 1) * customPricePerUnit,
    }]);
    resetCustomItem();
    setPickerCategory("");
    setShowItemPicker(false);
  };

  // Wizard edit
  const [templates, setTemplates] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardCategory, setWizardCategory] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<any>(null);

  // Custom sections + rename
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  // Append wizard (wizard on saved drafts)
  const [showAppendWizard, setShowAppendWizard] = useState(false);
  const [appendWizardCategory, setAppendWizardCategory] = useState("");
  const [appendTemplate, setAppendTemplate] = useState<any>(null);

  // New section wizard (same type, different location — e.g. "Back Pavers")
  const [newSectionWizardTemplate, setNewSectionWizardTemplate] = useState<any>(null);
  const [showNewSectionWizardDialog, setShowNewSectionWizardDialog] = useState(false);
  const [newSectionWizardName, setNewSectionWizardName] = useState("");

  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [markingAccepted, setMarkingAccepted] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [proposalEmailTemplate, setProposalEmailTemplate] = useState<{ subject: string | null; body: string | null }>({ subject: null, body: null });
  const [warrantySections, setWarrantySections] = useState<WarrantySection[]>([]);
  const [warrantyDisclaimer, setWarrantyDisclaimer] = useState("");
  const [attachProposalPdf, setAttachProposalPdf] = useState(true);
  const [clientHasAcceptedProposal, setClientHasAcceptedProposal] = useState(false);

  // Savings & Fees
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountLabel, setDiscountLabel] = useState("");
  const [stripeFeeEnabled, setStripeFeeEnabled] = useState(false);
  const [showSavingsDialog, setShowSavingsDialog] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);

  useEffect(() => {
    productsAPI.getCategories().then(setDbCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    estimateTemplatesAPI.getAll().then(setTemplates).catch(console.error);
    wizardVariantsAPI.getAll().then(setWizardVariants).catch(console.error);
    supabase
      .from("proposal_reviews")
      .select("reviewer_name, rating, review_text, show_in_email")
      .eq("is_active", true)
      .eq("show_in_email", true)
      .order("sort_order")
      .then(({ data }) => setReviews(data ?? []));
    supabase.from("company_settings")
      .select("proposal_email_subject, proposal_email_body")
      .limit(1).maybeSingle()
      .then(({ data }) => setProposalEmailTemplate({ subject: data?.proposal_email_subject ?? null, body: data?.proposal_email_body ?? null }));
    warrantyAPI.getAll()
      .then(({ sections, disclaimer }) => { setWarrantySections(sections); setWarrantyDisclaimer(disclaimer); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    estimatesAPI.getById(id).then((est) => {
      setProposal(est);
      setEditTitle(est.title ?? "");
      setEditDescription(est.description ?? "");
      setEditLineItems(est.line_items ?? []);
      setCategoryNotes((est.category_notes ?? {}) as Record<string, string>);
      setCustomSections((est.wizard_inputs?._customSections ?? []) as string[]);
      const initCats = [...new Set([...(est.line_items ?? []).map((li: any) => li.category).filter(Boolean), ...(est.wizard_inputs?._customSections ?? [])])];
      setSectionOrder(initCats as string[]);
      const dtype = (est.discount_type as "percent" | "fixed") ?? "percent";
      setDiscountType(dtype);
      setDiscountValue(dtype === "fixed" ? (est.discount_amount ?? 0) : (est.discount_percentage ?? 0));
      setDiscountLabel(est.discount_label ?? "");
      setStripeFeeEnabled(est.stripe_fee_enabled ?? false);
      if (est?.client_id) {
        clientsAPI.getById(est.client_id).then(setClient).catch(console.error);
        Promise.resolve(supabase.from("client_portal_tokens").select("token").eq("client_id", est.client_id).eq("is_active", true).maybeSingle())
          .then(({ data }) => { if (data?.token) setPortalToken(data.token); }).catch(() => {});
        supabase.from("estimates")
          .select("id")
          .eq("client_id", est.client_id)
          .eq("status", "accepted")
          .neq("id", est.id)
          .limit(1)
          .then(({ data }) => setClientHasAcceptedProposal((data ?? []).length > 0));
      }
    }).catch((err) => {
      console.error("proposal-detail getById error:", err);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!proposal) return;
    const titleChanged = editTitle !== (proposal.title ?? "");
    const descChanged = editDescription !== (proposal.description ?? "");
    const originalItems = proposal.line_items ?? [];
    const itemsChanged =
      editLineItems.length !== originalItems.length ||
      editLineItems.some((item) => item.id?.startsWith("new-")) ||
      editLineItems.some((item, i) => {
        const orig = originalItems[i];
        if (!orig) return true;
        return (
          Number(item.quantity) !== Number(orig.quantity) ||
          Number(item.client_price ?? item.price_per_unit) !== Number(orig.client_price ?? orig.price_per_unit) ||
          (item.client_note ?? "") !== (orig.client_note ?? "")
        );
      });
    const notesChanged = JSON.stringify(categoryNotes ?? {}) !== JSON.stringify(proposal.category_notes ?? {});
    const feesChanged =
      discountValue !== (proposal.discount_type === "fixed" ? (proposal.discount_amount ?? 0) : (proposal.discount_percentage ?? 0)) ||
      discountType !== ((proposal.discount_type as "percent" | "fixed") ?? "percent") ||
      discountLabel !== (proposal.discount_label ?? "") ||
      stripeFeeEnabled !== (proposal.stripe_fee_enabled ?? false);
    setIsDirty(titleChanged || descChanged || itemsChanged || notesChanged || feesChanged);
  }, [editTitle, editDescription, editLineItems, categoryNotes, discountValue, discountType, discountLabel, stripeFeeEnabled, proposal]);

  // Block in-app navigation (browser back, nav links) — shows custom Save/Leave dialog
  const blocker = useBlocker(isDirty);
  useEffect(() => {
    if (blocker.state === "blocked") setShowUnsavedDialog(true);
  }, [blocker.state]);

  // Intercept Ctrl+R and F5 — show custom dialog instead of browser reload
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isDirty) return;
      if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
        e.preventDefault();
        setPendingReload(true);
        setShowUnsavedDialog(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty]);

  // Fallback for browser reload button (can't show custom modal — native dialog only)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (showPreview && proposal) {
      setPreviewPages([]);
      generatePreviewImages();
    }
  }, [showPreview]);

  useRealtimeRefetch(() => {
    if (!id) return;
    estimatesAPI.getById(id).then((est) => {
      setProposal(est);
      // Preserve any unsaved local items (new-* ids) so realtime events from
      // wizard DB writes don't wipe out items the user just added via picker
      setEditLineItems((prev) => {
        const unsaved = prev.filter((li) => String(li.id ?? "").startsWith("new-"));
        return [...(est.line_items ?? []), ...unsaved];
      });
    }).catch(console.error);
  }, ["estimates", "estimate_line_items"], "proposal-detail");

  const BAD_CATEGORIES = ["Concrete", "Pavers", "Retaining Walls", "Sod"];
  const computedSubtotal = isDirty
    ? editLineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.client_price)), 0)
    : (proposal?.subtotal ?? 0);
  const badQualifyingSubtotal = editLineItems
    .filter((item) => BAD_CATEGORIES.includes(item.category) || Number(item.labor_cost ?? 0) > 0)
    .reduce((sum, item) => sum + Number(item.quantity) * Number(item.client_price), 0);
  const badPriceAuto = Math.round(badQualifyingSubtotal * 0.015 * 1.5 * 100) / 100;
  const activeBad = badOverride !== null ? badOverride : (isDirty ? badPriceAuto : (proposal?.bad_amount ?? 0));
  // Scale tax proportionally with subtotal changes (preserves $0 tax for unknown zip)
  const origSubtotal = proposal?.subtotal || 0;
  const taxRatio = origSubtotal > 0 ? (proposal?.tax_amount ?? 0) / origSubtotal : 0;
  const activeTax = isDirty ? Math.round(computedSubtotal * taxRatio * 100) / 100 : (proposal?.tax_amount ?? 0);
  const discountAmt = discountType === "percent"
    ? Math.round(computedSubtotal * discountValue / 100 * 100) / 100
    : Math.min(discountValue, computedSubtotal);
  const preStripeTotal = computedSubtotal + activeBad + activeTax - discountAmt;
  const stripeFeeAmt = stripeFeeEnabled ? Math.round((preStripeTotal * 0.029 + 0.30) * 100) / 100 : 0;
  const computedTotal = preStripeTotal + stripeFeeAmt;
  const computedTotalCost = editLineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * (Number(item.material_cost ?? 0) + Number(item.labor_cost ?? 0)),
    0
  );
  const computedGrossProfit = computedTotal - computedTotalCost;
  const computedProfitMargin = computedTotal > 0 ? (computedGrossProfit / computedTotal) * 100 : 0;

  // Financials breakdown
  const finMaterialCost      = editLineItems.reduce((s, i) => s + Number(i.material_cost ?? 0) * Number(i.quantity ?? 0), 0);
  const finLaborCost         = editLineItems.reduce((s, i) => s + Number(i.labor_cost ?? 0) * Number(i.quantity ?? 0), 0);
  const finAvgMarkup         = computedTotalCost > 0 ? ((computedSubtotal - computedTotalCost) / computedTotalCost) * 100 : 0;
  const finPmRate            = 3; // PM: 3% of GP — confirmed Jonathan Jul 21
  const finSalesRepRate      = 7; // Sales Rep: 7% of Subtotal — confirmed Jonathan Jul 21
  const finPmCommission      = computedGrossProfit * (finPmRate / 100);
  const finSalesRepCommission = computedSubtotal * (finSalesRepRate / 100);
  const finTotalCommission   = finPmCommission + finSalesRepCommission;

  const updateQty = (idx: number, qty: number) => {
    setEditLineItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, quantity: qty, fio_qty: qty } : item)
    );
  };

  const getWizardType = (cat: string): string => {
    const map = ((proposal?.wizard_inputs?._wizardTypeMap) ?? {}) as Record<string, string>;
    return map[cat] ?? cat;
  };

  const handleWizardEdit = (category: string) => {
    const wizardType = getWizardType(category);
    const template = templates.find((t: any) => t.category === wizardType) ?? templates.find((t: any) => t.category === category);
    setActiveTemplate(template ?? null);
    setWizardCategory(category);
    setShowWizard(true);
  };

  const handleWizardComplete = async (items: any[], formData?: Record<string, any>) => {
    if (!proposal?.id) return;
    // Delete old items for this category — must succeed before inserting
    const oldIds = editLineItems
      .filter((li) => li.category === wizardCategory && li.id && !li.id.startsWith("new-"))
      .map((li) => li.id);
    if (oldIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("estimate_line_items")
        .delete()
        .in("id", oldIds);
      if (deleteError) {
        toast.error("Failed to replace wizard items — please try again.");
        return;
      }
    }
    // Insert new items only after delete confirmed
    const newRows = items.map((item, i) => ({
      estimate_id: proposal.id,
      category: wizardCategory,
      name: item.productName,
      product_name: item.productName,
      description: item.description ?? null,
      quantity: item.quantity,
      fio_qty: item.fioQty ?? ((item.laborCost ?? 0) > 0 ? item.quantity : 0),
      unit: item.unit,
      material_cost: item.materialCost ?? 0,
      labor_cost: item.laborCost ?? 0,
      markup_percent: item.markupPercent ?? 0,
      client_price: Math.round((item.pricePerUnit ?? 0) * 100) / 100,
      total_price: Math.round((item.quantity ?? 0) * (item.pricePerUnit ?? 0) * 100) / 100,
      sort_order: i,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from("estimate_line_items")
      .insert(newRows)
      .select();
    if (insertError) {
      toast.error("Failed to save wizard items — please try again.");
      return;
    }
    // Update local state — remove old, add new
    const freshItems = inserted ?? newRows.map((r, i) => ({ ...r, id: `new-${Date.now()}-${i}` }));
    const updatedItems = [
      ...editLineItems.filter((li) => li.category !== wizardCategory),
      ...freshItems,
    ];
    setEditLineItems(updatedItems);

    // Immediately sync subtotal + total back to DB so PDF always matches UI
    const newSubtotal = updatedItems.reduce(
      (sum, item) => sum + (Number(item.quantity) * Number(item.client_price ?? item.pricePerUnit ?? 0)),
      0
    );
    const wizBadQualifying = updatedItems
      .filter((item) => BAD_CATEGORIES.includes(item.category) || Number(item.labor_cost ?? 0) > 0)
      .reduce((s, item) => s + Number(item.quantity) * Number(item.client_price ?? item.pricePerUnit ?? 0), 0);
    const wizBad = badOverride !== null ? badOverride : Math.round(wizBadQualifying * 0.015 * 1.5 * 100) / 100;
    const wizOrigSubtotal = proposal.subtotal || 0;
    const wizTaxRatio = wizOrigSubtotal > 0 ? (proposal.tax_amount ?? 0) / wizOrigSubtotal : 0;
    const wizTax = Math.round(newSubtotal * wizTaxRatio * 100) / 100;
    const newTotal = newSubtotal + wizBad + wizTax;
    await supabase.from("estimates").update({ subtotal: newSubtotal, total: newTotal, bad_amount: wizBad, tax_amount: wizTax }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, subtotal: newSubtotal, total: newTotal }));

    // Save wizard inputs so we can pre-fill next time
    if (formData) {
      const updatedInputs = { ...(proposal.wizard_inputs ?? {}), [wizardCategory]: formData };
      await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
      setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
    }
    setSectionOrder((prev) => prev.includes(wizardCategory) ? prev : [...prev, wizardCategory]);
    setShowWizard(false);
    toast.success(`${wizardCategory} items updated`);
  };

  const handleRenameCategory = async (oldCat: string, newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed || trimmed === oldCat) { setRenamingCat(null); return; }
    setEditLineItems((prev) => prev.map((li) => li.category === oldCat ? { ...li, category: trimmed } : li));
    setSectionOrder((prev) => prev.map((c) => c === oldCat ? trimmed : c));
    const updatedCustomSections = customSections.map((s) => s === oldCat ? trimmed : s);
    setCustomSections(updatedCustomSections);
    const existingMap = ((proposal?.wizard_inputs?._wizardTypeMap) ?? {}) as Record<string, string>;
    const originalType = existingMap[oldCat] ?? oldCat;
    const updatedMap = { ...existingMap };
    delete updatedMap[oldCat];
    if (originalType !== trimmed) updatedMap[trimmed] = originalType;
    const existingInputs = (proposal?.wizard_inputs ?? {}) as Record<string, any>;
    const oldFormData = existingInputs[oldCat] ?? existingInputs[originalType];
    const updatedInputs: Record<string, any> = { ...existingInputs, _wizardTypeMap: updatedMap, _customSections: updatedCustomSections };
    if (oldFormData) updatedInputs[trimmed] = oldFormData;
    await supabase.from("estimate_line_items").update({ category: trimmed }).eq("estimate_id", proposal.id).eq("category", oldCat);
    await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
    setRenamingCat(null);
  };

  const saveCustomSections = async (sections: string[]) => {
    const updatedInputs = { ...(proposal?.wizard_inputs ?? {}), _customSections: sections };
    await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
  };

  const moveSection = (cat: string, dir: 'up' | 'down') => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(cat);
      if (dir === 'up' && idx <= 0) return prev;
      if (dir === 'down' && idx >= prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleDeleteCategory = async (cat: string) => {
    const itemsInCat = editLineItems.filter((li) => li.category === cat);
    const dbIds = itemsInCat.map((li) => li.id).filter((id: any) => id && !String(id).startsWith("new-"));
    if (dbIds.length > 0) {
      await supabase.from("estimate_line_items").delete().in("id", dbIds);
    }
    const remainingItems = editLineItems.filter((li) => li.category !== cat);
    const newSubtotal = remainingItems.reduce((sum, it) => sum + Number(it.quantity) * Number(it.client_price ?? 0), 0);
    const newTotalCost = remainingItems.reduce((sum, it) => sum + Number(it.quantity) * (Number(it.material_cost ?? 0) + Number(it.labor_cost ?? 0)), 0);
    const newBadQualifying = remainingItems.filter((it) => BAD_CATEGORIES.includes(it.category) || Number(it.labor_cost ?? 0) > 0).reduce((sum, it) => sum + Number(it.quantity) * Number(it.client_price ?? 0), 0);
    const newBad = badOverride !== null ? badOverride : Math.round(newBadQualifying * 0.015 * 1.5 * 100) / 100;
    const origSub = proposal?.subtotal || 0;
    const newTaxRatio = origSub > 0 ? (proposal?.tax_amount ?? 0) / origSub : 0;
    const newTax = Math.round(newSubtotal * newTaxRatio * 100) / 100;
    const newDiscountAmt = discountType === "percent"
      ? Math.round(newSubtotal * discountValue / 100 * 100) / 100
      : Math.min(discountValue, newSubtotal);
    const newPreStripe = newSubtotal + newBad + newTax - newDiscountAmt;
    const newStripeFee = stripeFeeEnabled ? Math.round((newPreStripe * 0.029 + 0.30) * 100) / 100 : 0;
    const newTotal = newPreStripe + newStripeFee;
    setEditLineItems(remainingItems);
    setSectionOrder((prev) => prev.filter((c) => c !== cat));
    const updatedCustomSections = customSections.filter((s) => s !== cat);
    setCustomSections(updatedCustomSections);
    const existingMap = ((proposal?.wizard_inputs?._wizardTypeMap) ?? {}) as Record<string, string>;
    const updatedMap = { ...existingMap };
    delete updatedMap[cat];
    const updatedInputs = { ...(proposal?.wizard_inputs ?? {}), _wizardTypeMap: updatedMap, _customSections: updatedCustomSections };
    await supabase.from("estimates").update({
      subtotal: newSubtotal,
      total: newTotal,
      total_cost: newTotalCost,
      wizard_inputs: updatedInputs,
    }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs, subtotal: newSubtotal, total: newTotal, total_cost: newTotalCost }));
    setDeletingCat(null);
    toast.success(`"${cat}" section removed.`);
  };

  const handleWizardAppend = async (items: any[], formData?: Record<string, any>) => {
    if (!proposal?.id) return;
    const newRows = items.map((item, i) => ({
      estimate_id: proposal.id,
      category: appendWizardCategory,
      name: item.productName,
      product_name: item.productName,
      description: item.description ?? null,
      quantity: item.quantity,
      fio_qty: item.fioQty ?? ((item.laborCost ?? 0) > 0 ? item.quantity : 0),
      unit: item.unit,
      material_cost: item.materialCost ?? 0,
      labor_cost: item.laborCost ?? 0,
      markup_percent: item.markupPercent ?? 0,
      client_price: Math.round((item.pricePerUnit ?? 0) * 100) / 100,
      total_price: Math.round((item.quantity ?? 0) * (item.pricePerUnit ?? 0) * 100) / 100,
      sort_order: editLineItems.length + i,
    }));
    const { data: inserted, error: insertError } = await supabase.from("estimate_line_items").insert(newRows).select();
    if (insertError) { toast.error("Failed to add wizard items — please try again."); return; }
    const freshItems = inserted ?? newRows.map((r, i) => ({ ...r, id: `new-${Date.now()}-${i}` }));
    const updatedItems = [...editLineItems, ...freshItems];
    setEditLineItems(updatedItems);
    setCustomSections((prev) => prev.filter((s) => s !== appendWizardCategory));
    setSectionOrder((prev) => prev.includes(appendWizardCategory) ? prev : [...prev, appendWizardCategory]);
    const newSubtotal = updatedItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.client_price ?? 0)), 0);
    const wizBadQualifying = updatedItems.filter((it) => BAD_CATEGORIES.includes(it.category) || Number(it.labor_cost ?? 0) > 0).reduce((s, it) => s + Number(it.quantity) * Number(it.client_price ?? 0), 0);
    const wizBad = badOverride !== null ? badOverride : Math.round(wizBadQualifying * 0.015 * 1.5 * 100) / 100;
    const origSubtotal = proposal.subtotal || 0;
    const taxRatio = origSubtotal > 0 ? (proposal.tax_amount ?? 0) / origSubtotal : 0;
    const wizTax = Math.round(newSubtotal * taxRatio * 100) / 100;
    const newTotal = newSubtotal + wizBad + wizTax;
    await supabase.from("estimates").update({ subtotal: newSubtotal, total: newTotal, bad_amount: wizBad, tax_amount: wizTax }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, subtotal: newSubtotal, total: newTotal }));
    if (formData) {
      const updatedInputs = { ...(proposal.wizard_inputs ?? {}), [appendWizardCategory]: formData };
      await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
      setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
    }
    setShowAppendWizard(false);
    toast.success(`${appendWizardCategory} items added`);
  };

  const handleStartNewSectionWizard = async () => {
    const name = newSectionWizardName.trim();
    if (!name || !newSectionWizardTemplate || !proposal?.id) return;
    const nameExists = editLineItems.some((li) => li.category === name) || customSections.includes(name);
    if (nameExists) { toast.error(`A section named "${name}" already exists — choose a different name.`); return; }
    const existingMap = ((proposal?.wizard_inputs?._wizardTypeMap) ?? {}) as Record<string, string>;
    const updatedMap = { ...existingMap, [name]: newSectionWizardTemplate.category };
    const updatedInputs = { ...(proposal?.wizard_inputs ?? {}), _wizardTypeMap: updatedMap };
    await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
    setAppendWizardCategory(name);
    setAppendTemplate(newSectionWizardTemplate);
    setSectionOrder((prev) => prev.includes(name) ? prev : [...prev, name]);
    setShowNewSectionWizardDialog(false);
    setShowAppendWizard(true);
  };

  const isLocked = proposal?.status === "accepted" || proposal?.status === "voided";

  const titleErr = !editTitle.trim() ? "Proposal title is required." : "";
  const itemsErr = editLineItems.length === 0 ? "Please add at least one line item." : "";
  const totalErr = editLineItems.length > 0 && computedTotal <= 0 ? "Proposal total must be greater than $0." : "";

  const handleSave = async () => {
    if (!proposal) return;
    setSaveTouched(true);
    if (titleErr || itemsErr || totalErr) return;
    setSaving(true);
    // Snapshot state before any awaits so realtime refetches mid-save can't clobber it
    const snapshot = [...editLineItems];
    // Build sort_order map respecting current sectionOrder so PDF matches CRM view
    const sortOrderMap = new Map<string, number>();
    let sIdx = 0;
    for (const cat of sectionOrder) {
      for (const it of snapshot) {
        if (it.category === cat) { sortOrderMap.set(String(it.id ?? ''), sIdx++); }
      }
    }
    for (const it of snapshot) {
      if (!sortOrderMap.has(String(it.id ?? ''))) sortOrderMap.set(String(it.id ?? ''), sIdx++);
    }
    try {
      await estimatesAPI.update(proposal.id, {
        title: editTitle,
        description: editDescription,
        subtotal: computedSubtotal,
        total: computedTotal,
        total_cost: computedTotalCost,
        gross_profit: computedGrossProfit,
        profit_margin: computedProfitMargin,
        bad_amount: activeBad,
        tax_amount: activeTax,
        discount_type: discountType,
        discount_percentage: discountType === "percent" ? discountValue : 0,
        discount_amount: discountAmt,
        discount_label: discountLabel || null,
        stripe_fee_enabled: stripeFeeEnabled,
        stripe_fee_amount: stripeFeeAmt,
        category_notes: categoryNotes,
      });
      // Delete items that were removed from editLineItems
      const originalItemIds = (proposal.line_items ?? [])
        .map((item: any) => item.id)
        .filter(Boolean);
      const keptItemIds = new Set(
        snapshot
          .filter((item) => item.id && !String(item.id).startsWith("new-"))
          .map((item) => item.id)
      );
      const deletedIds = originalItemIds.filter((id: string) => !keptItemIds.has(id));
      if (deletedIds.length > 0) {
        await supabase.from("estimate_line_items").delete().in("id", deletedIds);
      }
      // Insert new items (added via picker/custom form during this session)
      const newItems = snapshot.filter((item) => item.id?.startsWith("new-"));
      if (newItems.length > 0) {
        const { error: insertErr } = await supabase.from("estimate_line_items").insert(
          newItems.map((item) => ({
            estimate_id: proposal.id,
            name: item.product_name ?? item.name,
            product_name: item.product_name ?? item.name,
            category: item.category ?? null,
            quantity: Number(item.quantity),
            fio_qty: item.fio_qty ?? 0,
            unit: item.unit ?? "",
            client_price: Number(item.client_price),
            price_per_unit: Number(item.client_price),
            total_price: Number(item.quantity) * Number(item.client_price),
            material_cost: item.material_cost ?? 0,
            labor_cost: item.labor_cost ?? 0,
            cost_per_unit: item.cost_per_unit ?? 0,
            markup_percent: item.markup_percent ?? 0,
            client_note: item.client_note?.trim() || null,
            sort_order: sortOrderMap.get(String(item.id ?? '')) ?? 999,
          }))
        );
        if (insertErr) throw new Error(insertErr.message);
      }
      // Update existing items
      await Promise.all(
        snapshot
          .filter((item) => !item.id?.startsWith("new-"))
          .map((item) =>
            supabase.from("estimate_line_items").update({
              product_name: item.product_name ?? item.name,
              category: item.category ?? null,
              unit: item.unit ?? "",
              quantity: item.quantity,
              client_price: Number(item.client_price),
              price_per_unit: Number(item.client_price),
              total_price: Number(item.quantity) * Number(item.client_price),
              material_cost: item.material_cost ?? 0,
              labor_cost: item.labor_cost ?? 0,
              cost_per_unit: item.cost_per_unit ?? 0,
              markup_percent: item.markup_percent ?? item.markupPercent ?? 0,
              fio_qty: item.fio_qty ?? null,
              client_note: item.client_note?.trim() || null,
              sort_order: sortOrderMap.get(String(item.id ?? '')) ?? 999,
            }).eq("id", item.id)
          )
      );
      // Refresh from DB to replace new-* ids with real DB ids — prevents duplicates from realtime merge
      const fresh = await estimatesAPI.getById(proposal.id);
      setProposal(fresh);
      setEditLineItems(fresh.line_items ?? []);
      setCategoryNotes((fresh.category_notes ?? {}) as Record<string, string>);
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_created", description: `Proposal updated: "${editTitle}" — total: $${computedTotal?.toLocaleString()}` }).catch(() => {});
      // Regen PDF when a sent proposal is edited so portal clients see the updated version
      if (proposal.status === "sent" || proposal.status === "opened") {
        saveProposalPdfOnSend(proposal.id, proposal.client_id).catch(() => {});
      }
      toast.success("Proposal saved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {/* Back button + title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-accent animate-pulse rounded-lg" />
          <div className="space-y-1">
            <div className="h-5 w-48 bg-accent animate-pulse rounded-md" />
            <div className="h-3 w-32 bg-accent animate-pulse rounded-md" />
          </div>
        </div>
        {/* 4 stat cards: Created / Sent At / Subtotal / Total — full width */}
        <SkeletonCards count={4} />
        {/* Line items table */}
        <div className="border rounded-xl p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              <div className="h-4 bg-accent animate-pulse rounded col-span-2" />
              <div className="h-4 bg-accent animate-pulse rounded" />
              <div className="h-4 bg-accent animate-pulse rounded" />
              <div className="h-4 bg-accent animate-pulse rounded" />
            </div>
          ))}
        </div>
        <PageLoader title="Loading proposal…" description="Fetching line items, pricing, tax & totals" className="min-h-[6vh]" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Proposal not found</h2>
          <Link to={`/clients?stage=${client?.status ?? ""}`}>
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Scans backwards from desiredPx to find a row of pixels that's all background/whitespace.
  // Returns the safe cut position (canvas px). Falls back to desiredPx if nothing found.
  const findSafeCutPx = (src: HTMLCanvasElement, desiredPx: number, searchBackPx: number): number => {
    if (desiredPx >= src.height) return src.height;
    const ctx = src.getContext("2d")!;
    const stripW = 120;
    const stripX = Math.floor((src.width - stripW) / 2);
    const scanTop = Math.max(0, desiredPx - searchBackPx);
    const scanH = desiredPx - scanTop;
    if (scanH <= 1) return desiredPx;
    const { data } = ctx.getImageData(stripX, scanTop, stripW, scanH);
    for (let dy = scanH - 1; dy >= 0; dy--) {
      let rowClear = true;
      for (let x = 0; x < stripW; x += 6) {
        const i = (dy * stripW + x) * 4;
        if (data[i] < 195 || data[i + 1] < 195 || data[i + 2] < 195) { rowClear = false; break; }
      }
      if (rowClear) return scanTop + dy;
    }
    return desiredPx;
  };

  const buildProposalPdf = async (container: HTMLElement): Promise<jsPDF | null> => {
    try {
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const SCALE = 3;
      const groupStartsCanvasPx: number[] = [];
      let   groupsEndCanvasPx = -1;
      const groupStartsCanvasPx2: number[] = [];
      const groupStartsCanvasPx3: number[] = [];
      const baseOpts = {
        scale: SCALE,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 10000,
        removeContainer: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          const root = el.getRootNode() as Document;
          Array.from(root.querySelectorAll('link[rel="stylesheet"], style')).forEach((s) => s.remove());
          Array.from(root.querySelectorAll('.screen-only')).forEach((s) => (s as HTMLElement).style.display = 'none');
          if (el.id === "proposal-page-body") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              groupStartsCanvasPx.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
            const endEl = el.querySelector("[data-groups-end]") as HTMLElement | null;
            if (endEl) {
              groupsEndCanvasPx = Math.round((endEl.getBoundingClientRect().top - bodyRect.top) * SCALE);
            }
          }
          if (el.id === "proposal-page-body-2") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              groupStartsCanvasPx2.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
          }
          if (el.id === "proposal-page-body-3") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              groupStartsCanvasPx3.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
          }
        },
      };

      const q = (id: string) => container.querySelector(`[id="${id}"]`) as HTMLElement | null;
      const hdrEl    = q("proposal-page-header");
      const body1El  = q("proposal-page-body");
      const body2El  = q("proposal-page-body-2");
      const body3El  = q("proposal-page-body-3");
      const lastFtrEl = q("proposal-last-footer");
      const colHdrEl = q("proposal-col-header");
      if (!hdrEl || !body1El || !colHdrEl) return null;

      const [hdrCanvas, body1Canvas, colHdrCanvas, lastFtrCanvas] = await Promise.all([
        html2canvas(hdrEl,    { ...baseOpts, backgroundColor: "#0A0A0A" }),
        html2canvas(body1El,  { ...baseOpts, backgroundColor: "#ffffff" }),
        html2canvas(colHdrEl, { ...baseOpts, backgroundColor: "#0A0A0A" }),
        lastFtrEl ? html2canvas(lastFtrEl, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const pdf   = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const pxPerPt = body1Canvas.width / pageW;
      const toPt    = (c: HTMLCanvasElement) => c.height / pxPerPt;

      const hdrH    = toPt(hdrCanvas);
      const lastFtrH = lastFtrCanvas ? toPt(lastFtrCanvas) : 48;
      const colH = toPt(colHdrCanvas);
      const colW = colHdrCanvas.width / pxPerPt;
      const colX = (pageW - colW) / 2;
      const COL_GAP = 4;

      const PAD      = 10;
      const BOTTOM_PAD = lastFtrH;
      const slot     = pageH - hdrH - BOTTOM_PAD;
      const slotFull = slot - 2 * PAD;
      const slotCol  = slot - colH - COL_GAP - 2 * PAD;

      const [body2Canvas, body3Canvas] = await Promise.all([
        body2El ? html2canvas(body2El, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
        body3El ? html2canvas(body3El, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const hImg      = hdrCanvas.toDataURL("image/jpeg", 0.97);
      const lastFtrImg = lastFtrCanvas ? lastFtrCanvas.toDataURL("image/jpeg", 0.97) : null;
      const colImg    = colHdrCanvas.toDataURL("image/jpeg", 0.97);

      const makeSlice = (src: HTMLCanvasElement, yPx: number, hPx: number): HTMLCanvasElement => {
        const h = Math.max(1, Math.min(hPx, src.height - yPx));
        const out = document.createElement("canvas");
        out.width  = src.width;
        out.height = h;
        out.getContext("2d")!.drawImage(src, 0, yPx, src.width, h, 0, 0, src.width, h);
        return out;
      };

      const renderBodyPages = (
        bodyCanvas: HTMLCanvasElement,
        showCol: boolean,
        startPage: number,
        groupStarts: number[] = groupStartsCanvasPx,
        groupsEnd: number = groupsEndCanvasPx,
      ): number => {
        const bodyH  = toPt(bodyCanvas);
        let consumed = 0;
        let pageIdx  = startPage;
        while (consumed < bodyH - 1) {
          if (pageIdx > 0) pdf.addPage();
          const isFirst  = pageIdx === startPage;
          const avail    = (!isFirst && showCol) ? slotCol : slotFull;
          const remaining = bodyH - consumed;
          let sliceH: number;
          if (remaining <= avail + 1) {
            sliceH = remaining;
          } else {
            const consumedPx  = Math.round(consumed * pxPerPt);
            const idealCutPx  = consumedPx + Math.round(avail * pxPerPt);
            const lastGroupEnd = groupsEnd > 0 ? groupsEnd : bodyCanvas.height;
            const groupEnds = groupStarts.map((start, i) => {
              if (i + 1 < groupStarts.length) return groupStarts[i + 1];
              if (groupsEnd > 0 && start >= groupsEnd) return bodyCanvas.height;
              return lastGroupEnd;
            });
            const splitIdxRaw = groupStarts.findIndex(
              (start, i) => idealCutPx > start && idealCutPx < groupEnds[i]
            );
            const splitGroupFits = splitIdxRaw !== -1 &&
              (groupEnds[splitIdxRaw] - groupStarts[splitIdxRaw]) <= Math.round(avail * pxPerPt);
            const isTotalsBodyGroup = splitIdxRaw !== -1 &&
              groupsEnd > 0 && groupStarts[splitIdxRaw] >= groupsEnd;
            const blankThreshold = isTotalsBodyGroup ? 0.50 : 0.25;
            const maxBlankPx = Math.round(avail * blankThreshold * pxPerPt);
            const splitIdx = (splitGroupFits && (idealCutPx - groupStarts[splitIdxRaw]) <= maxBlankPx)
              ? splitIdxRaw : -1;
            const orphanZonePx = Math.round(75 * pxPerPt);
            const orphanStart = groupStarts
              .filter((g) => g >= idealCutPx - orphanZonePx && g < idealCutPx)
              .sort((a, b) => a - b)[0];
            const cutBeforePx = splitIdx !== -1 ? groupStarts[splitIdx] : orphanStart;
            let safeCutPx: number;
            const minCutPx = splitIdx !== -1
              ? consumedPx + 4
              : consumedPx + Math.round(avail * 0.3 * pxPerPt);
            if (cutBeforePx !== undefined && cutBeforePx > minCutPx) {
              safeCutPx = findSafeCutPx(bodyCanvas, cutBeforePx - 2, Math.round(30 * pxPerPt));
              sliceH = Math.max((safeCutPx - consumedPx) / pxPerPt, 1);
            } else {
              safeCutPx = findSafeCutPx(bodyCanvas, idealCutPx, Math.round(90 * pxPerPt));
              sliceH = Math.max((safeCutPx - consumedPx) / pxPerPt, avail * 0.3);
            }
          }
          const sliceCanvas = makeSlice(bodyCanvas, Math.round(consumed * pxPerPt), Math.round(sliceH * pxPerPt));

          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, pageH, "F");
          pdf.addImage(hImg, "JPEG", 0, 0, pageW, hdrH);

          let bodyY = hdrH + PAD;
          if (!isFirst && showCol) {
            pdf.addImage(colImg, "JPEG", colX, hdrH + PAD, colW, colH);
            bodyY = hdrH + PAD + colH + COL_GAP;
          }

          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, bodyY, pageW, sliceH);
          consumed += sliceH;
          pageIdx++;
        }
        return pageIdx;
      };

      const nextPage  = renderBodyPages(body1Canvas, true, 0);
      const nextPage2 = body2Canvas ? renderBodyPages(body2Canvas, false, nextPage, groupStartsCanvasPx2) : nextPage;
      if (body3Canvas) renderBodyPages(body3Canvas, false, nextPage2, groupStartsCanvasPx3, -1);

      if (lastFtrImg) pdf.addImage(lastFtrImg, "JPEG", 0, pageH - lastFtrH, pageW, lastFtrH);

      return pdf;
    } catch (err: any) {
      console.error("PDF generation error:", err);
      return null;
    }
  };

  const handleDownload = async () => {
    const container = document.getElementById("proposal-export-content");
    if (!container) return;
    setDownloading(true);
    try {
      const pdf = await buildProposalPdf(container);
      if (!pdf) {
        toast.error("PDF generation failed — please try again.");
        return;
      }
      pdf.save(`Estimate-${proposal.estimate_number ?? ""}-${proposal.title ?? "Proposal"}.pdf`);
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_pdf_exported", description: `Proposal PDF exported: "${proposal.title}"` }).catch(() => {});
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error(`PDF failed: ${err?.message ?? String(err) ?? "unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  const saveProposalPdfOnSend = async (proposalId: string, clientId: string): Promise<void> => {
    const container = document.getElementById("proposal-export-content");
    if (!container) return;
    const pdf = await buildProposalPdf(container);
    if (!pdf) return;
    const blob = pdf.output("blob");
    const path = `${clientId}/proposals/${proposalId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("client-files")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (uploadErr) { console.error("[portal-pdf] upload failed:", uploadErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("client-files").getPublicUrl(path);
    await supabase.from("estimates").update({ pdf_url: publicUrl }).eq("id", proposalId);
  };

  const generatePreviewImages = async () => {
    const container = document.getElementById("proposal-export-content");
    if (!container) return;
    setPreviewLoading(true);
    try {
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const SCALE = 3;
      // Populated inside onclone (accurate layout in html2canvas iframe)
      const previewGroupStartsPx: number[] = [];
      let   previewGroupsEndPx = -1;
      const previewGroupStartsPx2: number[] = [];
      const previewGroupStartsPx3: number[] = [];
      const h2cOpts = {
        scale: SCALE, useCORS: true, allowTaint: false, logging: false,
        imageTimeout: 10000, removeContainer: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          const root = el.getRootNode() as Document;
          Array.from(root.querySelectorAll('link[rel="stylesheet"], style')).forEach((s) => s.remove());
          Array.from(root.querySelectorAll('.screen-only')).forEach((s) => (s as HTMLElement).style.display = 'none');
          if (el.id === "proposal-page-body") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              previewGroupStartsPx.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
            const endEl = el.querySelector("[data-groups-end]") as HTMLElement | null;
            if (endEl) {
              previewGroupsEndPx = Math.round((endEl.getBoundingClientRect().top - bodyRect.top) * SCALE);
            }
          }
          if (el.id === "proposal-page-body-2") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              previewGroupStartsPx2.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
          }
          if (el.id === "proposal-page-body-3") {
            const bodyRect = el.getBoundingClientRect();
            Array.from(el.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>).forEach((g) => {
              previewGroupStartsPx3.push(Math.round((g.getBoundingClientRect().top - bodyRect.top) * SCALE));
            });
          }
        },
      };

      const q = (id: string) => container.querySelector(`[id="${id}"]`) as HTMLElement | null;
      const hdrEl = q("proposal-page-header"), body1El = q("proposal-page-body"),
            body2El = q("proposal-page-body-2"), body3El = q("proposal-page-body-3"),
            lastFtrElPrev = q("proposal-last-footer"),
            colHdrEl = q("proposal-col-header");
      if (!hdrEl || !body1El || !colHdrEl) return;

      // Capture header, body1, colHeader, last-footer first to compute page slot dimensions
      const [hdrC, body1C, colC, lastFtrC] = await Promise.all([
        html2canvas(hdrEl,    { ...h2cOpts, backgroundColor: "#0A0A0A" }),
        html2canvas(body1El,  { ...h2cOpts, backgroundColor: "#ffffff" }),
        html2canvas(colHdrEl, { ...h2cOpts, backgroundColor: "#0A0A0A" }),
        lastFtrElPrev ? html2canvas(lastFtrElPrev, { ...h2cOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const pageW_pt = 595.28, pageH_pt = 841.89;
      const pxPerPt  = body1C.width / pageW_pt;
      const pageW_px = body1C.width;
      const pageH_px = Math.round(pageH_pt * pxPerPt);

      const toPt  = (c: HTMLCanvasElement) => c.height / pxPerPt;
      const hdrH  = toPt(hdrC), colH = toPt(colC);
      const lastFtrH_prev = lastFtrC ? toPt(lastFtrC) : 48;
      const colW  = colC.width / pxPerPt;
      const colX  = (pageW_pt - colW) / 2;
      const COL_GAP = 4, PAD = 10;
      const slot    = pageH_pt - hdrH - lastFtrH_prev;
      const slotFull = slot - 2 * PAD;
      const slotCol  = slot - colH - COL_GAP - 2 * PAD;

      const [body2C, body3C] = await Promise.all([
        body2El ? html2canvas(body2El, { ...h2cOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
        body3El ? html2canvas(body3El, { ...h2cOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const makeSlice = (src: HTMLCanvasElement, yPx: number, hPx: number): HTMLCanvasElement => {
        const h = Math.max(1, Math.min(hPx, src.height - yPx));
        const out = document.createElement("canvas");
        out.width = src.width; out.height = h;
        out.getContext("2d")!.drawImage(src, 0, yPx, src.width, h, 0, 0, src.width, h);
        return out;
      };

      const pages: string[] = [];

      const renderToPages = (
        bodyCanvas: HTMLCanvasElement,
        showCol: boolean,
        groupStarts: number[] = previewGroupStartsPx,
        groupsEnd: number = previewGroupsEndPx,
      ) => {
        const bodyH = toPt(bodyCanvas);
        let consumed = 0, pageNum = 0;
        while (consumed < bodyH - 1) {
          const needsCol  = pageNum > 0 && showCol;
          const avail     = needsCol ? slotCol : slotFull;
          const remaining = bodyH - consumed;
          let sliceH: number;
          if (remaining <= avail + 1) {
            sliceH = remaining;
          } else {
            const consumedPx   = Math.round(consumed * pxPerPt);
            const idealCutPx   = consumedPx + Math.round(avail * pxPerPt);
            const lastGroupEndP = groupsEnd > 0 ? groupsEnd : bodyCanvas.height;
            const groupEndsP = groupStarts.map((start, i) => {
              if (i + 1 < groupStarts.length) return groupStarts[i + 1];
              if (groupsEnd > 0 && start >= groupsEnd) return bodyCanvas.height;
              return lastGroupEndP;
            });
            const splitIdxPRaw = groupStarts.findIndex(
              (start, i) => idealCutPx > start && idealCutPx < groupEndsP[i]
            );
            const splitGroupFitsP = splitIdxPRaw !== -1 &&
              (groupEndsP[splitIdxPRaw] - groupStarts[splitIdxPRaw]) <= Math.round(avail * pxPerPt);
            const isTotalsBodyGroupP = splitIdxPRaw !== -1 &&
              groupsEnd > 0 && groupStarts[splitIdxPRaw] >= groupsEnd;
            const blankThresholdP = isTotalsBodyGroupP ? 0.50 : 0.25;
            const maxBlankPxP = Math.round(avail * blankThresholdP * pxPerPt);
            const splitIdxP = (splitGroupFitsP && (idealCutPx - groupStarts[splitIdxPRaw]) <= maxBlankPxP)
              ? splitIdxPRaw : -1;
            const orphanZonePx = Math.round(75 * pxPerPt);
            const orphanStartP = groupStarts
              .filter((g) => g >= idealCutPx - orphanZonePx && g < idealCutPx)
              .sort((a, b) => a - b)[0];
            const cutBeforeP   = splitIdxP !== -1 ? groupStarts[splitIdxP] : orphanStartP;
            let safeCutPx: number;
            const minCutPxP = splitIdxP !== -1
              ? consumedPx + 4
              : consumedPx + Math.round(avail * 0.3 * pxPerPt);
            if (cutBeforeP !== undefined && cutBeforeP > minCutPxP) {
              safeCutPx = findSafeCutPx(bodyCanvas, cutBeforeP - 2, Math.round(30 * pxPerPt));
              sliceH = Math.max((safeCutPx - consumedPx) / pxPerPt, 1);
            } else {
              safeCutPx = findSafeCutPx(bodyCanvas, idealCutPx, Math.round(90 * pxPerPt));
              sliceH = Math.max((safeCutPx - consumedPx) / pxPerPt, avail * 0.3);
            }
          }
          const slice    = makeSlice(bodyCanvas, Math.round(consumed * pxPerPt), Math.round(sliceH * pxPerPt));

          const page = document.createElement("canvas");
          page.width = pageW_px; page.height = pageH_px;
          const ctx = page.getContext("2d")!;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageW_px, pageH_px);
          ctx.drawImage(hdrC, 0, 0);

          let bodyY_px = Math.round((hdrH + PAD) * pxPerPt);
          if (needsCol) {
            ctx.drawImage(colC, Math.round(colX * pxPerPt), Math.round((hdrH + PAD) * pxPerPt));
            bodyY_px = Math.round((hdrH + PAD + colH + COL_GAP) * pxPerPt);
          }
          ctx.drawImage(slice, 0, bodyY_px);

          pages.push(page.toDataURL("image/jpeg", 0.96));
          consumed += sliceH;
          pageNum++;
        }
      };

      renderToPages(body1C, true);
      if (body2C) renderToPages(body2C, false, previewGroupStartsPx2);
      if (body3C) renderToPages(body3C, false, previewGroupStartsPx3, -1);

      // Draw last-page footer (dark bar + thank you) on the very last preview page
      if (lastFtrC && pages.length > 0) {
        const lastImg = new Image();
        lastImg.src = pages[pages.length - 1];
        await new Promise<void>((res) => { lastImg.onload = () => res(); });
        const lastCanvas = document.createElement("canvas");
        lastCanvas.width = pageW_px; lastCanvas.height = pageH_px;
        const ctx2 = lastCanvas.getContext("2d")!;
        ctx2.drawImage(lastImg, 0, 0);
        ctx2.drawImage(lastFtrC, 0, pageH_px - lastFtrC.height);
        pages[pages.length - 1] = lastCanvas.toDataURL("image/jpeg", 0.96);
      }

      setPreviewPages(pages);
    } catch (err: any) {
      console.error("Preview generation error:", err);
      toast.error(`Preview failed: ${err?.message ?? String(err) ?? "unknown error"}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleMarkAccepted = async () => {
    if (!proposal) return;
    setMarkingAccepted(true);
    try {
      const now = new Date().toISOString();
      const { data: { user: acceptedUser } } = await supabase.auth.getUser();
      await supabase.from("estimates").update({
        status: "accepted",
        accepted_at: now,
        accepted_by: acceptedUser?.id ?? null,
      }).eq("id", proposal.id);

      // Auto-void all draft/sent proposals for this client — client-declined stays as "declined"
      const { data: voidedProposals } = await supabase.from("estimates")
        .update({ status: "voided", voided_at: now })
        .eq("client_id", proposal.client_id)
        .neq("id", proposal.id)
        .in("status", ["draft", "sent", "opened"])
        .select("id, title, estimate_number");
      (voidedProposals ?? []).forEach((vp: any) => {
        activityLogAPI.create({
          client_id: proposal.client_id,
          action_type: "status_changed",
          description: `Proposal ${vp.title} — voided by accepted proposal ${proposal.title}`,
        }).catch(() => {});
      });

      // Sync project financials from accepted proposal
      await supabase.from("projects").update({
        gross_profit:   proposal.gross_profit  ?? 0,
        profit_margin:  proposal.profit_margin ?? 0,
        total_value:    proposal.total         ?? 0,
      }).eq("client_id", proposal.client_id).neq("status", "completed");

      activityLogAPI.create({
        client_id: proposal.client_id,
        action_type: "status_changed",
        description: `Proposal manually accepted: "${proposal.title}"`,
      }).catch(() => {});
      notificationsAPI.create({
        type: "proposal_accepted",
        title: "Proposal Accepted",
        message: `Accepted the proposal "${proposal.title}".`,
        link: `/proposals/${proposal.id}`,
        metadata: { proposal_id: proposal.id, client_id: proposal.client_id, client_name: client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "" },
      }).catch(() => {});
      setProposal({ ...proposal, status: "accepted", accepted_at: now });
      toast.success("Proposal marked as accepted");
    } catch {
      toast.error("Failed to update proposal status");
    } finally {
      setMarkingAccepted(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!proposal) return;
    setReverting(true);
    try {
      await supabase.from("estimates").update({
        status: "draft",
        accepted_at: null,
        accepted_by: null,
        voided_at: null,
      }).eq("id", proposal.id);
      activityLogAPI.create({
        client_id: proposal.client_id,
        action_type: "proposal_created",
        description: `Proposal reverted to draft by admin: "${proposal.title}"`,
      }).catch(() => {});
      setProposal({ ...proposal, status: "draft", accepted_at: null, accepted_by: null, voided_at: null });
      setShowRevertDialog(false);
      toast.success("Proposal reverted to draft");
    } catch {
      toast.error("Failed to revert proposal");
    } finally {
      setReverting(false);
    }
  };

  const handleEmail = () => {
    const firstName = (client?.first_name ?? "").trim() || "there";
    const defaultBody = `Hi ${firstName},\n\nPlease review our proposal for your project. By clicking the button below; you can view, accept, or decline the proposal. Once accepted, we will receive a notification and will reach out to discuss next steps!\n\nPlease let us know if you have any questions!`;
    const templateBody = proposalEmailTemplate.body?.trim()
      ? proposalEmailTemplate.body.trim().replace(/\{client_first_name\}/g, firstName)
      : defaultBody;
    const templateSubject = proposalEmailTemplate.subject?.trim()
      ? proposalEmailTemplate.subject.trim()
          .replace(/\{client_name\}/g, `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || firstName)
          .replace(/\{proposal_title\}/g, proposal.title ?? "")
      : `Proposal: ${proposal.title}`;
    setEmailTo(client?.email ?? "");
    setEmailSubject(templateSubject);
    setEmailMessage(templateBody);
    setAttachProposalPdf(true);
    setShowEmailDialog(true);
  };

  const generatePdfBase64 = async (): Promise<string | null> => {
    const container = document.getElementById("proposal-export-content");
    if (!container) return null;
    try {
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const SCALE = 3;
      const baseOpts = {
        scale: SCALE, useCORS: true, allowTaint: false, logging: false,
        imageTimeout: 10000, removeContainer: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          const root = el.getRootNode() as Document;
          Array.from(root.querySelectorAll('link[rel="stylesheet"], style')).forEach((s) => s.remove());
          Array.from(root.querySelectorAll('.screen-only')).forEach((s) => (s as HTMLElement).style.display = 'none');
        },
      };

      const q = (id: string) => container.querySelector(`[id="${id}"]`) as HTMLElement | null;
      const hdrEl = q("proposal-page-header"), body1El = q("proposal-page-body"),
            body2El = q("proposal-page-body-2"), body3El = q("proposal-page-body-3"),
            lastFtrEl_b64 = q("proposal-last-footer"),
            colHdrEl = q("proposal-col-header");
      if (!hdrEl || !body1El || !colHdrEl) return null;

      const [hdrCanvas, body1Canvas, colHdrCanvas, lastFtrCanvas_b64] = await Promise.all([
        html2canvas(hdrEl,    { ...baseOpts, backgroundColor: "#0A0A0A" }),
        html2canvas(body1El,  { ...baseOpts, backgroundColor: "#ffffff" }),
        html2canvas(colHdrEl, { ...baseOpts, backgroundColor: "#0A0A0A" }),
        lastFtrEl_b64 ? html2canvas(lastFtrEl_b64, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const pdf   = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const pxPerPt = body1Canvas.width / pageW;
      const toPt    = (c: HTMLCanvasElement) => c.height / pxPerPt;

      const hdrH = toPt(hdrCanvas);
      const lastFtrH_b64 = lastFtrCanvas_b64 ? toPt(lastFtrCanvas_b64) : 48;
      const colH = toPt(colHdrCanvas);
      const colW = colHdrCanvas.width / pxPerPt;
      const colX = (pageW - colW) / 2;
      const COL_GAP = 4;

      const PAD = 10;
      const slot     = pageH - hdrH - lastFtrH_b64;
      const slotFull = slot - 2 * PAD;
      const slotCol  = slot - colH - COL_GAP - 2 * PAD;

      const [body2Canvas, body3Canvas] = await Promise.all([
        body2El ? html2canvas(body2El, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
        body3El ? html2canvas(body3El, { ...baseOpts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const hImg          = hdrCanvas.toDataURL("image/jpeg", 0.97);
      const lastFtrImg_b64 = lastFtrCanvas_b64 ? lastFtrCanvas_b64.toDataURL("image/jpeg", 0.97) : null;
      const colImg        = colHdrCanvas.toDataURL("image/jpeg", 0.97);

      const makeSliceB64 = (src: HTMLCanvasElement, yPx: number, hPx: number): HTMLCanvasElement => {
        const h = Math.max(1, Math.min(hPx, src.height - yPx));
        const out = document.createElement("canvas");
        out.width  = src.width;
        out.height = h;
        out.getContext("2d")!.drawImage(src, 0, yPx, src.width, h, 0, 0, src.width, h);
        return out;
      };

      const renderPages = (bodyCanvas: HTMLCanvasElement, showCol: boolean, startPage: number): number => {
        const bodyH  = toPt(bodyCanvas);
        let consumed = 0;
        let pageIdx  = startPage;
        while (consumed < bodyH - 1) {
          if (pageIdx > 0) pdf.addPage();
          const isFirst = pageIdx === startPage;
          const avail   = (!isFirst && showCol) ? slotCol : slotFull;
          const sliceH  = Math.min(avail, bodyH - consumed);
          const sliceCanvas = makeSliceB64(bodyCanvas, Math.round(consumed * pxPerPt), Math.round(sliceH * pxPerPt));
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, pageH, "F");
          pdf.addImage(hImg, "JPEG", 0, 0, pageW, hdrH);
          let bodyY = hdrH + PAD;
          if (!isFirst && showCol) {
            pdf.addImage(colImg, "JPEG", colX, hdrH + PAD, colW, colH);
            bodyY = hdrH + PAD + colH + COL_GAP;
          }
          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, bodyY, pageW, sliceH);
          consumed += sliceH;
          pageIdx++;
        }
        return pageIdx;
      };

      const nextPage  = renderPages(body1Canvas, true, 0);
      const nextPage2 = body2Canvas ? renderPages(body2Canvas, false, nextPage) : nextPage;
      if (body3Canvas) renderPages(body3Canvas, false, nextPage2);

      if (lastFtrImg_b64) pdf.addImage(lastFtrImg_b64, "JPEG", 0, pageH - lastFtrH_b64, pageW, lastFtrH_b64);

      return pdf.output("datauristring").split(",")[1];
    } catch (err) {
      console.error("PDF generation error:", err);
      return null;
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject.trim()) return;
    setSendingEmail(true);
    try {
      const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";

      // Use client portal URL — that's where client reviews & accepts proposals now
      const { data: tokenRow } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("client_id", proposal.client_id)
        .eq("is_active", true)
        .maybeSingle();
      const proposalLink = tokenRow?.token
        ? `https://client.butlerconstruction.co/portal/${tokenRow.token}?tab=proposals`
        : `${window.location.origin}/p/${proposal.id}`;
      const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

      // Build scope summary rows (one row per category or item)
      const lineItems: any[] = proposal?.line_items ?? [];
      const catMap: Record<string, number> = {};
      const uncatItems: { name: string; total: number }[] = [];
      for (const item of lineItems) {
        const cat = item.category ?? null;
        const total = item.total_price ?? (Number(item.quantity || 1) * Number(item.client_price || item.price_per_unit || 0));
        if (cat) { catMap[cat] = (catMap[cat] ?? 0) + total; }
        else uncatItems.push({ name: item.product_name ?? item.name ?? "Item", total });
      }
      const scopeRows = [
        ...Object.entries(catMap).map(([name, total]) => ({ name, total })),
        ...uncatItems,
      ];
      const scopeTableRows = scopeRows.map(r =>
        `<tr><td style="padding:10px 16px;font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;border-bottom:1px solid #F5F3EF;">${r.name}</td><td style="padding:10px 16px;font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;text-align:right;border-bottom:1px solid #F5F3EF;font-variant-numeric:tabular-nums;">${fmt(r.total)}</td></tr>`
      ).join("");
      const grandTotal = fmt((proposal?.subtotal ?? 0) + (proposal?.bad_amount ?? 0) + (proposal?.tax_amount ?? 0) - (proposal?.discount_amount ?? 0));

      // Build review quotes (show up to 2)
      const topReviews = reviews.slice(0, 2);
      const reviewsHtml = topReviews.length > 0 ? `
        <div style="margin:0 0 28px 0;">
          <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 14px 0;">What Our Clients Say</p>
          ${topReviews.map(r => `
            <div style="background:#F5F3EF;border-left:3px solid #BB984D;padding:12px 16px;margin:0 0 10px 0;border-radius:0 4px 4px 0;">
              <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;line-height:1.7;margin:0 0 6px 0;font-style:italic;">"${r.review_text}"</p>
              <p style="font-family:Inter,sans-serif;font-size:11px;color:#BB984D;font-weight:500;margin:0;">— ${r.reviewer_name} ${"★".repeat(r.rating)}</p>
            </div>
          `).join("")}
        </div>
      ` : "";

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header — centered B&A logo + company name -->
    <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="56" style="height:56px;width:auto;display:block;margin:0 auto 12px auto;" />
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    </div>
    <!-- Gold rule -->
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>

    <!-- Body -->
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">

      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 16px 0;">Your Proposal Is Ready</p>

      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 28px 0;">${emailMessage.replace(/\n/g, '<br>')}</p>

      <!-- Scope of Work summary -->
      ${scopeRows.length > 0 ? `
      <div style="margin:0 0 28px 0;">
        <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Scope of Work</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #E8E4DC;">
          <tr style="background:#0A0A0A;">
            <td style="padding:10px 16px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;">Item</td>
            <td style="padding:10px 16px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;text-align:right;">Amount</td>
          </tr>
          ${scopeTableRows}
          <tr style="background:#F5F3EF;border-top:2px solid #E8E4DC;">
            <td style="padding:14px 16px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0A0A0A;">Total Investment</td>
            <td style="padding:14px 16px;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#BB984D;text-align:right;font-variant-numeric:tabular-nums;">${grandTotal}</td>
          </tr>
        </table>
      </div>
      ` : ""}

      <!-- CTA — placed right under the scope/total card (before reviews) so clients see it -->
      <div style="text-align:center;margin:0 0 28px 0;">
        <a href="${proposalLink}" style="display:inline-block;background:#0A0A0A;color:#BB984D;padding:14px 40px;border-radius:4px;text-decoration:none;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.08em;">
          View Proposal
        </a>
      </div>

      ${reviewsHtml}

      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;text-align:center;">
        This proposal is valid for 30 days. Questions? Reply to this email or call
        <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0 0 0;">
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
    </div>

  </div>
</body>
</html>`;
      let attachments: { content: string; filename: string; type: string; disposition: string }[] | undefined;
      if (attachProposalPdf) {
        const pdfBase64 = await generatePdfBase64();
        if (pdfBase64) {
          attachments = [{
            content: pdfBase64,
            filename: `${proposal.title} - ${clientName}.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          }];
        }
      }

      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: emailTo, subject: emailSubject, html, from_name: "Butler & Associates Construction", attachments },
      });
      if (error) throw error;
      await estimatesAPI.updateStatus(proposal.id, "sent");
      setProposal({ ...proposal, status: "sent", sent_at: new Date().toISOString() });
      setShowEmailDialog(false);
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_sent", description: `Proposal sent to client: "${proposal.title}" — ${emailTo}` }).catch(() => {});
      saveProposalPdfOnSend(proposal.id, proposal.client_id).catch(() => {});
      toast.success("Proposal sent to " + clientName);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-background border-b px-4 py-3 -mx-4 -mt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isDirty) setShowUnsavedDialog(true);
              else navigate(`/clients/${proposal.client_id}`);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Client
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{proposal.title}</h1>
              <Badge variant="outline" className={
                proposal.status === "accepted" ? "border-green-300 text-green-700 bg-green-50"
                : proposal.status === "declined" ? "border-red-300 text-red-700 bg-red-50"
                : proposal.status === "opened"   ? "border-purple-300 text-purple-700 bg-purple-50"
                : proposal.status === "sent"     ? "border-blue-300 text-blue-700 bg-blue-50"
                : proposal.status === "voided"   ? "border-gray-300 text-gray-400 bg-gray-50"
                : "border-gray-200 text-gray-500"
              }>{proposal.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {proposal.status !== "voided" && (
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          )}

          {proposal.status !== "voided" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Share2 className="h-4 w-4 mr-2" />
                  Export to Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Share Proposal</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {can("can_send_proposals") && (
                  proposal.status === "declined" && clientHasAcceptedProposal ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <DropdownMenuItem disabled>
                            <Mail className="h-4 w-4 mr-2 opacity-40" />
                            <span className="opacity-40">Email to Client</span>
                          </DropdownMenuItem>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Another proposal is already accepted</TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuItem onClick={handleEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email to Client
                    </DropdownMenuItem>
                  )
                )}
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isLocked && (
            proposal.status === "declined" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" disabled className="border-green-200 text-green-400 cursor-not-allowed">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Accepted
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {clientHasAcceptedProposal
                    ? "Another proposal is already accepted"
                    : "Reset to Sent first, then accept"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="outline"
                onClick={handleMarkAccepted}
                disabled={markingAccepted}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                {markingAccepted
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Mark as Accepted
              </Button>
            )
          )}

          {(proposal.status === "accepted" || proposal.status === "voided") && role === "admin" && (
            proposal.status === "voided" && clientHasAcceptedProposal ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" disabled className="border-orange-300 text-orange-300 cursor-not-allowed">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert to Draft
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Another proposal is already accepted</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="outline" onClick={() => setShowRevertDialog(true)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert to Draft
              </Button>
            )
          )}

          {!isLocked && (
            <Button variant="outline" size="sm" onClick={() => setShowSavingsDialog(true)}>
              <BadgePercent className="h-4 w-4 mr-2" />
              Savings & Fees
            </Button>
          )}

          {(role === "admin" || role === "sales_rep") && viewAsRole !== "project_manager" && (
            <Button variant="outline" size="sm" onClick={() => setShowFinancials(true)}>
              <BarChart2 className="h-4 w-4 mr-2" />
              Financials
            </Button>
          )}

          {!isLocked && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          )}

          {/* Delete — allowed for any non-accepted proposal (accepted = active job, protected) */}
          {proposal.status !== "accepted" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delete Proposal Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { if (!deleting) setShowDeleteDialog(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{proposal.title}&quot;? This permanently removes the proposal and all its line items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await estimatesAPI.delete(proposal.id);
                  activityLogAPI.create({
                    client_id: proposal.client_id,
                    action_type: "proposal_deleted",
                    description: `Proposal deleted: "${proposal.title}"`,
                  }).catch(() => {});
                  toast.success("Proposal deleted");
                  navigate(`/clients/${proposal.client_id}`);
                } catch (err: any) {
                  toast.error(err.message || "Failed to delete proposal");
                  setDeleting(false);
                }
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proposal Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{proposal.created_at ? formatDate(proposal.created_at) : "—"}</p>
            <p className="text-xs text-muted-foreground">#{proposal.estimate_number}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent At</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{proposal.sent_at ? formatDate(proposal.sent_at) : "Not sent"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(proposal.subtotal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(computedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sent — awaiting client banner */}
      {proposal.status === "sent" && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <Clock className="h-4 w-4 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Awaiting Client Review</p>
            <p className="text-xs text-orange-700 mt-0.5">This proposal has been sent to the client and is pending their review.</p>
          </div>
        </div>
      )}

      {/* Opened — client has viewed banner */}
      {proposal.status === "opened" && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <Eye className="h-4 w-4 text-purple-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-purple-800">Client Has Viewed This Proposal</p>
            <p className="text-xs text-purple-700 mt-0.5">The client opened this proposal but hasn't accepted or declined yet.</p>
          </div>
        </div>
      )}

      {/* Accepted banner */}
      {proposal.status === "accepted" && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Proposal Accepted</p>
            {proposal.accepted_at && (
              <p className="text-xs text-green-700 mt-0.5">Accepted on {formatDate(proposal.accepted_at)}</p>
            )}
          </div>
        </div>
      )}

      {/* Declined banner */}
      {proposal.status === "declined" && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Proposal Declined</p>
              {proposal.declined_at && (
                <p className="text-xs text-red-700 mt-0.5">Declined on {formatDate(proposal.declined_at)}</p>
              )}
              {proposal.decline_reason && (
                <p className="text-sm text-red-700 mt-1.5 italic">"{proposal.decline_reason}"</p>
              )}
            </div>
          </div>
          {clientHasAcceptedProposal ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled className="shrink-0 text-xs cursor-not-allowed opacity-50">
                    Reset to Sent
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Another proposal is already accepted</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={async () => {
                await supabase.from("estimates").update({
                  status: "sent",
                  declined_at: null,
                  decline_reason: null,
                }).eq("id", proposal.id);
                activityLogAPI.create({ client_id: proposal.client_id, action_type: "status_changed", description: `Proposal reset to Sent: "${proposal.title}" — previous decline reversed` }).catch(() => {});
                setProposal({ ...proposal, status: "sent", declined_at: null, decline_reason: null });
              }}
            >
              Reset to Sent
            </Button>
          )}
        </div>
      )}

      {/* Voided banner */}
      {proposal.status === "voided" && (
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <Ban className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-600">Proposal Voided</p>
            <p className="text-xs text-gray-500 mt-0.5">This proposal automatically voided when another proposal accepted.</p>
          </div>
        </div>
      )}

      {/* Proposal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {isLocked
              ? <><Label>Title</Label><p className="text-sm font-medium">{editTitle}</p></>
              : <>
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={saveTouched && titleErr ? "border-red-500" : ""}
                  />
                  {saveTouched && titleErr && <p className="text-xs text-red-500">{titleErr}</p>}
                </>
            }
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            {isLocked
              ? <p className="text-sm text-muted-foreground">{editDescription || "—"}</p>
              : <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            }
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className={saveTouched && (itemsErr || totalErr) ? "border-red-500" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          {!isLocked && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Wand2 className="h-4 w-4" />
                    Add via Wizard
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel><span className="text-xs">Select wizard</span></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {templates.map((t: any) => {
                    const wizardTypeMap = ((proposal?.wizard_inputs?._wizardTypeMap) ?? {}) as Record<string, string>;
                    const existingCat = Object.keys(wizardTypeMap).find((k) => wizardTypeMap[k] === t.category)
                      ?? (editLineItems.some((li) => li.category === t.category) ? t.category : null);
                    const targetCat = existingCat ?? t.category;
                    return (
                      <Fragment key={t.id ?? t.category}>
                        <DropdownMenuItem onClick={() => {
                          if (existingCat) {
                            handleWizardEdit(targetCat);
                          } else {
                            setAppendWizardCategory(targetCat);
                            setAppendTemplate(t);
                            setShowAppendWizard(true);
                          }
                        }}>
                          {existingCat ? `Edit "${targetCat}" in Wizard` : t.category}
                        </DropdownMenuItem>
                        {existingCat && (
                          <DropdownMenuItem onClick={() => {
                            setNewSectionWizardTemplate(t);
                            setNewSectionWizardName("");
                            setShowNewSectionWizardDialog(true);
                          }}>
                            + New {t.category} section…
                          </DropdownMenuItem>
                        )}
                      </Fragment>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => { setNewSectionName(""); setShowAddSectionDialog(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Section
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowItemPicker(true); setPickerCategory(""); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Item
              </Button>
            </div>
          )}
        </CardHeader>
        {saveTouched && (itemsErr || totalErr) && (
          <div className="px-6 pb-3">
            <p className="text-xs text-red-500">{itemsErr || totalErr}</p>
          </div>
        )}
        <CardContent className="p-0">
          {(() => {
            // Group items by category
            const groups: Record<string, any[]> = {};
            editLineItems.forEach((item, idx) => {
              const cat = item.category || "(No Category)";
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push({ ...item, _idx: idx });
            });
            customSections.forEach((s) => { if (!groups[s]) groups[s] = []; });
            return (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b bg-muted/20">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Item</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-24">FIO Qty</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-24">Qty</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-24">Unit</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-28">Rate</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase w-28">Total</th>
                      <th className="p-3 w-8"></th>
                      <th className="p-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(() => {
                      const allCats = [...new Set([...sectionOrder.filter((c) => groups[c]), ...Object.keys(groups).filter((c) => !sectionOrder.includes(c))])];
                      return allCats.map((cat) => {
                      const groupItems = groups[cat] as any[];
                      const hasWizard = templates.some((t: any) => t.category === cat || t.category === getWizardType(cat));
                      const catIdx = allCats.indexOf(cat);
                      return (
                        <Fragment key={cat}>
                          {/* Category header row */}
                          <tr className="border-b border-t">
                            <td colSpan={8} className="px-4 py-2 bg-muted/30">
                              <div className="flex items-center justify-between">
                                {renamingCat === cat ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      autoFocus
                                      value={renameValue}
                                      onChange={(e) => setRenameValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat, renameValue); if (e.key === "Escape") setRenamingCat(null); }}
                                      className="text-xs font-semibold uppercase tracking-wide border border-input rounded px-2 py-0.5 bg-background w-48 focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    <button onClick={() => handleRenameCategory(cat, renameValue)} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setRenamingCat(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 group">
                                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{cat}</span>
                                    {!isLocked && (
                                      <button
                                        onClick={() => { setRenamingCat(cat); setRenameValue(cat); }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  {!isLocked && (
                                    <div className="flex items-center mr-1">
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={catIdx === 0} onClick={() => moveSection(cat, 'up')}><ChevronUp className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" disabled={catIdx === allCats.length - 1} onClick={() => moveSection(cat, 'down')}><ChevronDown className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  )}
                                  {!isLocked && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => {
                                      const isDbCat = dbCategories.some((c: any) => c.name === cat);
                                      if (isDbCat) { setPickerCategory(cat); } else { resetCustomItem(); setCustomItem((p) => ({ ...p, category: cat })); setPickerCategory("__custom__"); }
                                      setShowItemPicker(true);
                                    }}>
                                      <Plus className="h-3.5 w-3.5" />Add Item
                                    </Button>
                                  )}
                                  {hasWizard && !isLocked && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleWizardEdit(cat)}>
                                      <Wand2 className="h-3.5 w-3.5" />
                                      Edit in Wizard
                                    </Button>
                                  )}
                                  {!isLocked && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setDeletingCat(cat)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {groupItems.length === 0 && !isLocked && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-xs text-muted-foreground italic">No items yet —</p>
                                  <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => {
                                    const isDbCat = dbCategories.some((c: any) => c.name === cat);
                                    if (isDbCat) { setPickerCategory(cat); } else { resetCustomItem(); setCustomItem((p) => ({ ...p, category: cat })); setPickerCategory("__custom__"); }
                                    setShowItemPicker(true);
                                  }}>
                                    <Plus className="h-3 w-3" />Add Item
                                  </Button>
                                  {hasWizard && (
                                    <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => handleWizardEdit(cat)}>
                                      <Wand2 className="h-3 w-3" />Add via Wizard
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {/* Category client note — shown under the section header on the proposal + PDF */}
                          {(!isLocked || categoryNotes[cat]?.trim()) && (
                            <tr>
                              <td colSpan={8} className="px-4 pb-2 pt-0 bg-muted/30">
                                {isLocked ? (
                                  <p className="text-xs text-blue-700 whitespace-pre-wrap">{categoryNotes[cat]}</p>
                                ) : (
                                  <Input
                                    placeholder={`Client note for "${cat}" (optional) — shows on the proposal`}
                                    value={categoryNotes[cat] ?? ""}
                                    onChange={(e) => setCategoryNotes((prev) => ({ ...prev, [cat]: e.target.value }))}
                                    className="h-7 text-xs"
                                  />
                                )}
                              </td>
                            </tr>
                          )}
                          {groupItems.map((item: any) => {
                            const idx = item._idx;
                            const rowKey = item.id ?? String(idx);
                            const isExpanded = expandedRows.has(rowKey);
                            const laborCost = Number(item.labor_cost ?? 0);
                            const materialCost = Number(item.material_cost ?? 0);
                            const markupPct = Number(item.markup_percent ?? 0);
                            return (
                              <Fragment key={rowKey}>
                                <tr key={rowKey} className="hover:bg-accent/50">
                                  <td className="p-3">
                                    <div className="text-sm font-medium">{item.name ?? item.product_name ?? ""}</div>
                                    {item.description && (
                                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                                    )}
                                    {/* Client note — shown to the client on the proposal + PDF */}
                                    {!isLocked ? (
                                      <Input
                                        placeholder="Client note (optional)…"
                                        value={item.client_note ?? ""}
                                        onChange={(e) => setEditLineItems((prev) => prev.map((li, i) => i === idx ? { ...li, client_note: e.target.value } : li))}
                                        className="h-7 text-xs mt-1.5 max-w-md"
                                      />
                                    ) : item.client_note ? (
                                      <div className="text-xs text-blue-700 mt-1 whitespace-pre-wrap">{item.client_note}</div>
                                    ) : null}
                                  </td>
                                  <td className="p-3">
                                    {isLocked
                                      ? <span className="text-sm text-muted-foreground w-20 block">{item.fio_qty ?? 0}</span>
                                      : <Input type="number" min={0} step="any" value={item.fio_qty ?? 0} placeholder="0"
                                          onChange={(e) => { const val = e.target.value === "" ? null : Number(e.target.value); setEditLineItems((prev) => prev.map((li, i) => i === idx ? { ...li, fio_qty: val } : li)); }}
                                          className="w-20" />
                                    }
                                  </td>
                                  <td className="p-3">
                                    {isLocked
                                      ? <span className="text-sm w-20 block">{item.quantity}</span>
                                      : <Input type="number" min={0} step="any" value={item.quantity} onChange={(e) => updateQty(idx, Number(e.target.value))} className="w-20" />
                                    }
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">{item.unit ?? ""}</td>
                                  <td className="p-3 text-sm">{formatCurrency(Number(item.client_price))}</td>
                                  <td className="p-3">
                                    <span className="font-semibold text-sm">{formatCurrency(Number(item.quantity) * Number(item.client_price))}</span>
                                  </td>
                                  <td className="p-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => setExpandedRows((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
                                        return next;
                                      })}
                                    >
                                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                  </td>
                                  <td className="p-3">
                                    {!isLocked && (
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPendingDeleteIdx(idx)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr key={`${rowKey}-expanded`} className="bg-muted/30">
                                    <td colSpan={8} className="pr-[200px] pl-6 py-3">
                                      <div className="flex items-center justify-end gap-8 text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground font-medium uppercase tracking-wide">Crew Cost/Unit</span>
                                          <span className="font-semibold">{formatCurrency(laborCost)}</span>
                                        </div>
                                        <div className="h-3 w-px bg-border" />
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground font-medium uppercase tracking-wide">Material/Unit</span>
                                          <span className="font-semibold">{formatCurrency(materialCost)}</span>
                                        </div>
                                        <div className="h-3 w-px bg-border" />
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground font-medium uppercase tracking-wide">Cost/Unit</span>
                                          <span className="font-semibold">{formatCurrency(laborCost + materialCost)}</span>
                                        </div>
                                        <div className="h-3 w-px bg-border" />
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-muted-foreground font-medium uppercase tracking-wide">Markup</span>
                                          <span className="font-semibold text-amber-600">{parseFloat(markupPct.toFixed(2))}%</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    });
                  })()}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Totals */}
          <div className="border-t p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatCurrency(computedSubtotal)}</span>
            </div>
            {activeBad > 0 && (
              <div className="flex justify-between text-sm items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Base, Aggregate & Disposal</span>
                  {badOverride !== null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-orange-300 text-orange-600">manual</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {editingBad ? (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">$</span>
                      <input
                        type="number" step="0.01"
                        className="w-24 border rounded px-1 py-0.5 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        value={badInputValue}
                        onChange={(e) => setBadInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseFloat(badInputValue);
                            setBadOverride(!isNaN(val) && val >= 0 ? val : null);
                            setEditingBad(false);
                          }
                          if (e.key === "Escape") setEditingBad(false);
                        }}
                        autoFocus
                      />
                      <button type="button" className="text-xs text-green-600 font-medium"
                        onClick={() => { const val = parseFloat(badInputValue); setBadOverride(!isNaN(val) && val >= 0 ? val : null); setEditingBad(false); }}>✓</button>
                      <button type="button" className="text-xs text-muted-foreground"
                        onClick={() => setEditingBad(false)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold">{formatCurrency(activeBad)}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Override BAD amount"
                        onClick={() => { setBadInputValue(activeBad.toFixed(2)); setEditingBad(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {badOverride !== null && (
                        <button type="button" className="text-xs text-muted-foreground hover:text-destructive"
                          title="Reset to original" onClick={() => setBadOverride(null)}>↩</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{proposal.tax_label ?? "Tax"}</span>
              <span className="font-semibold">{formatCurrency(proposal.tax_amount ?? 0)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">
                  {discountLabel || (discountType === "percent" ? `Discount (${discountValue}%)` : "Discount")}
                </span>
                <span className="font-semibold text-green-700">− {formatCurrency(discountAmt)}</span>
              </div>
            )}
            {stripeFeeEnabled && stripeFeeAmt > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">CC Processing Fee (2.9% + $0.30)</span>
                <span className="font-semibold">{formatCurrency(stripeFeeAmt)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg pt-2 border-t">
              <span className="font-bold">Total</span>
              <span className="font-bold text-green-600">{formatCurrency(computedTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item Picker Dialog */}
      <Dialog open={showItemPicker} onOpenChange={(o) => { setShowItemPicker(o); if (!o) setPickerCategory(""); }}>
        <DialogContent className="h-[85vh] flex flex-col p-0 gap-0" style={{ width: "95vw", maxWidth: 1100 }}>
          <DialogHeader className="px-6 py-5 pr-16 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold">Add Item</DialogTitle>
                <DialogDescription className="mt-0.5">Select a category on the left, then click a product to add it</DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 shrink-0"
                onClick={() => { setPickerCategory("__custom__"); resetCustomItem(); }}
              >
                <PenLine className="h-3.5 w-3.5" />
                Custom Item
              </Button>
            </div>
          </DialogHeader>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Categories sidebar */}
            <div className="w-52 shrink-0 border-r bg-muted/30 flex flex-col">
              <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Categories</p>
              <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 thin-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
                {dbCategories.map((cat: any) => (
                  <button
                    key={cat.id}
                    onClick={() => setPickerCategory(cat.name)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      pickerCategory === cat.name
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
                {(() => {
                  const dbCatNames = dbCategories.map((c: any) => c.name);
                  const proposalCats = [...new Set(editLineItems.map((li: any) => li.category).filter(Boolean))] as string[];
                  const extraCats = proposalCats.filter((c) => !dbCatNames.includes(c) && !customSections.includes(c));
                  if (extraCats.length === 0) return null;
                  return (
                    <>
                      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">In This Proposal</p>
                      {extraCats.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { resetCustomItem(); setCustomItem((prev) => ({ ...prev, category: cat })); setPickerCategory("__custom__"); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            pickerCategory === "__custom__" && customItem.category === cat
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </>
                  );
                })()}
                {customSections.length > 0 && (
                  <>
                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Custom Sections</p>
                    {customSections.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setCustomItem((prev) => ({ ...prev, category: s }));
                          setPickerCategory("__custom__");
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          pickerCategory === "__custom__" && customItem.category === s
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Products panel — fills all remaining width */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {pickerCategory === "__custom__" ? (
                <div className="flex-1 overflow-y-auto px-8 py-6 thin-scroll">
                  <div className="max-w-lg">
                    <p className="text-base font-semibold mb-0.5">Custom Item</p>
                    <p className="text-xs text-muted-foreground mb-5">Add a one-off product or service. It won't be saved to the catalog.</p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Item Name <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="e.g. Custom Lighting Install"
                            value={customItem.name}
                            onChange={(e) => setCustomItem((p) => ({ ...p, name: e.target.value }))}
                            className={customValidated && !customItem.name.trim() ? "border-red-400" : ""}
                          />
                          {customValidated && !customItem.name.trim() && <p className="text-xs text-red-500">Required</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Category <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="e.g. Landscaping, Lighting"
                            value={customItem.category}
                            onChange={(e) => setCustomItem((p) => ({ ...p, category: e.target.value }))}
                            className={customValidated && !customItem.category.trim() ? "border-red-400" : ""}
                          />
                          {customValidated && !customItem.category.trim() && <p className="text-xs text-red-500">Required</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Quantity</Label>
                          <Input type="number" min={0} value={customItem.qty}
                            onChange={(e) => setCustomItem((p) => ({ ...p, qty: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Unit <span className="text-destructive">*</span></Label>
                          <Input placeholder="e.g. SF, LF, EA, HR" value={customItem.unit}
                            onChange={(e) => setCustomItem((p) => ({ ...p, unit: e.target.value }))}
                            className={customValidated && !customItem.unit.trim() ? "border-red-400" : ""} />
                          {customValidated && !customItem.unit.trim() && <p className="text-xs text-red-500">Required</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Material Cost / Unit ($)</Label>
                          <Input type="number" min={0} step={0.01} value={customItem.materialCost}
                            onChange={(e) => setCustomItem((p) => ({ ...p, materialCost: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Labor Cost / Unit ($)</Label>
                          <Input type="number" min={0} step={0.01} value={customItem.laborCost}
                            onChange={(e) => setCustomItem((p) => ({ ...p, laborCost: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Markup (%)</Label>
                          <Input type="number" min={0} step={1} value={customItem.markup}
                            onChange={(e) => setCustomItem((p) => ({ ...p, markup: parseFloat(e.target.value) || 0 }))} />
                        </div>
                      </div>
                      {customCostPerUnit > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                          <span className="text-muted-foreground">Price / unit</span>
                          <span className="font-bold text-primary">{formatC(customPricePerUnit)}</span>
                          <span className="text-muted-foreground">Line total</span>
                          <span className="font-bold">{formatC((customItem.qty || 1) * customPricePerUnit)}</span>
                        </div>
                      )}
                      <Button className="w-full" onClick={handleAddCustomItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Proposal
                      </Button>
                    </div>
                  </div>
                </div>
              ) : !pickerCategory ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <p className="text-sm">← Select a category to browse products</p>
                </div>
              ) : (() => {
                const products = dbProducts.filter((p: any) => p.category?.name === pickerCategory);
                if (products.length === 0) return (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">No products in this category</p>
                    <p className="text-xs mt-1">Add products in the Admin Portal to use them here.</p>
                  </div>
                );
                return (
                  <>
                    <div className="px-6 pt-5 pb-3 shrink-0 border-b">
                      <p className="text-base font-semibold">{pickerCategory}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{products.length} product{products.length !== 1 ? "s" : ""} — click to add</p>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-5 thin-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
                      <div className="grid grid-cols-2 gap-4">
                        {products.map((product: any) => {
                          const cost = (product.material_cost ?? 0) + (product.labor_cost ?? 0);
                          const price = cost * (1 + (product.markup_percentage ?? 0) / 100);
                          return (
                            <button
                              key={product.id}
                              onClick={() => {
                                setEditLineItems((prev) => [...prev, {
                                  id: `new-${Date.now()}`,
                                  fromPicker: true,
                                  name: product.name,
                                  product_name: product.name,
                                  category: product.category?.name ?? pickerCategory,
                                  quantity: 1,
                                  fio_qty: (product.labor_cost ?? 0) > 0 ? 1 : 0,
                                  unit: product.unit ?? "",
                                  client_price: price,
                                  price_per_unit: price,
                                  material_cost: product.material_cost ?? 0,
                                  labor_cost: product.labor_cost ?? 0,
                                  markup_percent: product.markup_percentage ?? 0,
                                  cost_per_unit: (product.material_cost ?? 0) + (product.labor_cost ?? 0),
                                  total_price: price,
                                }]);
                                setShowItemPicker(false);
                                setPickerCategory("");
                              }}
                              className="text-left p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all group flex flex-col gap-2"
                            >
                              <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug">{product.name}</div>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
                              )}
                              <div className="flex items-baseline gap-1 pt-1 mt-auto border-t border-border/50">
                                <span className="text-sm font-bold text-primary">{formatC(price)}</span>
                                <span className="text-xs text-muted-foreground">/ {product.unit || "unit"}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard Edit Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit {wizardCategory} — Wizard
            </DialogTitle>
            <DialogDescription>
              Complete the wizard to replace the existing {wizardCategory} line items
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {showWizard && (
              activeTemplate ? (
                <TemplateWizard
                  template={activeTemplate}
                  dbProducts={dbProducts}
                  wizardVariants={wizardVariants}
                  onComplete={handleWizardComplete}
                  onCancel={() => setShowWizard(false)}
                  initialData={proposal?.wizard_inputs?.[wizardCategory] ?? undefined}
                />
              ) : templates.some((t: any) => t.category === wizardCategory) ? (
                <ConcreteWizard
                  onComplete={handleWizardComplete}
                  onCancel={() => setShowWizard(false)}
                  initialData={proposal?.wizard_inputs?.[wizardCategory] ?? undefined}
                />
              ) : null
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>Create a custom named section to organize your line items</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <Label>Section name</Label>
            <Input
              autoFocus
              placeholder="e.g. Concrete Walkway"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = newSectionName.trim();
                  if (!name) return;
                  const updated = customSections.includes(name) ? customSections : [...customSections, name];
                  setCustomSections(updated);
                  setSectionOrder((prev) => prev.includes(name) ? prev : [...prev, name]);
                  saveCustomSections(updated);
                  setShowAddSectionDialog(false);
                }
              }}
            />
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddSectionDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              const name = newSectionName.trim();
              if (!name) return;
              const updated = customSections.includes(name) ? customSections : [...customSections, name];
              setCustomSections(updated);
              setSectionOrder((prev) => prev.includes(name) ? prev : [...prev, name]);
              saveCustomSections(updated);
              setShowAddSectionDialog(false);
            }}>
              Add Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirm Dialog */}
      <Dialog open={!!deletingCat} onOpenChange={(o) => { if (!o) setDeletingCat(null); }}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Delete "{deletingCat}" section?</DialogTitle>
            <DialogDescription>
              {editLineItems.filter((li) => li.category === deletingCat).length > 0
                ? `This will permanently remove all ${editLineItems.filter((li) => li.category === deletingCat).length} item(s) in this section.`
                : "This empty section will be removed."}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingCat(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deletingCat && handleDeleteCategory(deletingCat)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Section Name Dialog — prompts for a name before opening wizard for a second same-type section */}
      <Dialog open={showNewSectionWizardDialog} onOpenChange={setShowNewSectionWizardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Name this section</DialogTitle>
            <DialogDescription>
              You already have a {newSectionWizardTemplate?.category} section. Give this new one a name (e.g. &quot;Back {newSectionWizardTemplate?.category}&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={`e.g. Back ${newSectionWizardTemplate?.category ?? ""}`}
              value={newSectionWizardName}
              onChange={(e) => setNewSectionWizardName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStartNewSectionWizard(); }}
              autoFocus
            />
          </div>
          <div className="px-6 pb-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowNewSectionWizardDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleStartNewSectionWizard} disabled={!newSectionWizardName.trim()}>Open Wizard</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Append Wizard Dialog */}
      <Dialog open={showAppendWizard} onOpenChange={setShowAppendWizard}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Add {appendWizardCategory} via Wizard
            </DialogTitle>
            <DialogDescription>
              Wizard items will be added to this proposal without removing existing items
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {showAppendWizard && (
              appendTemplate ? (
                <TemplateWizard
                  template={appendTemplate}
                  dbProducts={dbProducts}
                  wizardVariants={wizardVariants}
                  onComplete={handleWizardAppend}
                  onCancel={() => setShowAppendWizard(false)}
                />
              ) : (
                <ConcreteWizard
                  onComplete={handleWizardAppend}
                  onCancel={() => setShowAppendWizard(false)}
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog — full-width PDF viewer */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="h-[95vh] p-0 overflow-hidden flex flex-col gap-0 [&>button:last-child]:hidden" style={{ width: 900, maxWidth: "95vw" }}>
          {/* Sticky toolbar — stays visible while document scrolls */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#3c3c3c] text-white shrink-0">
            <span className="text-sm font-medium opacity-80">
              Estimate #{proposal.estimate_number} — {proposal.title}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-gray-900 border-white h-7 text-xs hover:bg-transparent hover:text-white hover:border-white"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                {downloading ? "Generating…" : "Download PDF"}
              </Button>
              <button
                onClick={() => setShowPreview(false)}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable PDF viewer area */}
          <div className="flex-1 overflow-y-auto bg-[#525659] thin-scroll-dark">
            <div className="py-8 flex flex-col items-center gap-6">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3 text-white/60 mt-20">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Generating preview…</span>
                </div>
              ) : previewPages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Page ${i + 1}`}
                  style={{ width: 794, display: "block", boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="flex flex-col p-0 gap-0" style={{ maxHeight: "85vh" }}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Email Proposal</DialogTitle>
            <DialogDescription>
              Send this proposal directly to {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : ""}
            </DialogDescription>
          </DialogHeader>
          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 thin-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
            {client && !client.email && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 flex items-center justify-between gap-2">
                <span>No email address on this client record — add one before sending.</span>
                <a href={`/clients/${proposal.client_id}`} className="font-medium underline whitespace-nowrap">Edit Client</a>
              </div>
            )}
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={emailTo} readOnly className="bg-muted text-muted-foreground cursor-default" />
            </div>
            <div className="space-y-2">
              <Label>Subject <span className="text-destructive">*</span></Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={!emailSubject.trim() ? "border-red-500" : ""}
              />
              {!emailSubject.trim() && <p className="text-xs text-red-500">Subject is required.</p>}
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} rows={8} className="resize-none" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="attach-pdf-checkbox"
                checked={attachProposalPdf}
                onChange={(e) => setAttachProposalPdf(e.target.checked)}
                className="h-4 w-4 rounded border cursor-pointer accent-primary"
              />
              <label htmlFor="attach-pdf-checkbox" className="text-sm cursor-pointer select-none flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Attach Proposal PDF
              </label>
            </div>
            <p className="text-xs text-muted-foreground">A "View Proposal" button linking to the proposal page will be included automatically.</p>
          </div>
          {/* Fixed footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setShowEmailPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailTo || !emailSubject.trim() || !client?.email}>
              {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog — shows exactly what client receives */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="flex flex-col p-0 gap-0" style={{ width: "680px", maxWidth: "95vw", height: "85vh" }}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              This is exactly what {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "the client"} will see in their inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg">
            <iframe
              srcDoc={(() => {
                // Preview uses portal URL if token available, else public fallback
                const proposalLink = portalToken
                  ? `https://client.butlerconstruction.co/portal/${portalToken}?tab=proposals`
                  : `${window.location.origin}/p/${proposal?.id}`;
                const fmtP = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
                const lineItemsP: any[] = proposal?.line_items ?? [];
                const catMapP: Record<string, number> = {};
                const uncatP: { name: string; total: number }[] = [];
                for (const item of lineItemsP) {
                  const cat = item.category ?? null;
                  const total = item.total_price ?? (Number(item.quantity || 1) * Number(item.client_price || item.price_per_unit || 0));
                  if (cat) { catMapP[cat] = (catMapP[cat] ?? 0) + total; }
                  else uncatP.push({ name: item.product_name ?? item.name ?? "Item", total });
                }
                const scopeRowsP = [...Object.entries(catMapP).map(([n, t]) => ({ name: n, total: t })), ...uncatP];
                const scopeHtmlP = scopeRowsP.map(r =>
                  `<tr><td style="padding:10px 16px;font-size:13px;color:#3A3A38;border-bottom:1px solid #F5F3EF;">${r.name}</td><td style="padding:10px 16px;font-size:13px;color:#3A3A38;text-align:right;border-bottom:1px solid #F5F3EF;">${fmtP(r.total)}</td></tr>`
                ).join("");
                const grandTotalP = fmtP((proposal?.subtotal ?? 0) + (proposal?.bad_amount ?? 0) + (proposal?.tax_amount ?? 0) - (proposal?.discount_amount ?? 0));
                const topReviewsP = reviews.slice(0, 2);
                const reviewsHtmlP = topReviewsP.length > 0 ? `
                  <div style="margin:0 0 28px 0;">
                    <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 14px 0;">What Our Clients Say</p>
                    ${topReviewsP.map(r => `<div style="background:#F5F3EF;border-left:3px solid #BB984D;padding:12px 16px;margin:0 0 10px 0;border-radius:0 4px 4px 0;"><p style="font-size:12px;color:#3A3A38;line-height:1.7;margin:0 0 6px 0;font-style:italic;">"${r.review_text}"</p><p style="font-size:11px;color:#BB984D;font-weight:500;margin:0;">— ${r.reviewer_name} ${"★".repeat(r.rating)}</p></div>`).join("")}
                  </div>` : "";
                return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>*{font-family:Inter,Helvetica,Arial,sans-serif}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:4px}</style></head>
<body style="margin:0;padding:0;background:#F5F3EF;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
    <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="B&amp;A" height="56" style="height:56px;width:auto;display:block;margin:0 auto 12px auto;" onerror="this.style.display='none'"/>
    <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
  <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
    <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 16px 0;">Your Proposal Is Ready</p>
    <p style="font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 28px 0;">${emailMessage.replace(/\n/g, '<br>')}</p>
    ${scopeRowsP.length > 0 ? `<div style="margin:0 0 28px 0;"><p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Scope of Work</p><table width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #E8E4DC;"><tr style="background:#0A0A0A;"><td style="padding:10px 16px;font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;">Item</td><td style="padding:10px 16px;font-size:9px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;text-align:right;">Amount</td></tr>${scopeHtmlP}<tr style="background:#F5F3EF;border-top:2px solid #E8E4DC;"><td style="padding:14px 16px;font-size:14px;font-weight:700;color:#0A0A0A;">Total Investment</td><td style="padding:14px 16px;font-size:22px;color:#BB984D;text-align:right;">${grandTotalP}</td></tr></table></div>` : ""}
    <div style="text-align:center;margin:0 0 28px 0;"><a href="${proposalLink}" style="display:inline-block;background:#0A0A0A;color:#BB984D;padding:14px 40px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.08em;">View Proposal</a></div>
    ${reviewsHtmlP}
    <p style="font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;text-align:center;">This proposal is valid for 30 days. Questions? Reply to this email or call <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.</p>
  </div>
  <div style="text-align:center;padding:20px 0 0 0;">
    <p style="font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    <p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
  </div>
</div>
</body></html>`;
              })()}
              className="w-full h-full border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes guard */}
      <Dialog open={showUnsavedDialog} onOpenChange={(o) => {
        if (!o) {
          setPendingReload(false);
          if (blocker.state === "blocked") blocker.reset?.();
          setShowUnsavedDialog(false);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>You have unsaved changes to this proposal. What would you like to do?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => {
              setShowUnsavedDialog(false);
              setPendingReload(false);
              if (pendingReload) window.location.reload();
              else if (blocker.state === "blocked") blocker.proceed?.();
              else navigate(`/clients/${proposal.client_id}`);
            }}>Leave</Button>
            <Button className="flex-1" onClick={() => {
              setShowUnsavedDialog(false);
              setPendingReload(false);
              if (blocker.state === "blocked") blocker.reset?.();
              handleSave();
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove line item confirmation */}
      <Dialog open={pendingDeleteIdx !== null} onOpenChange={(open) => { if (!open) setPendingDeleteIdx(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove item?</DialogTitle>
            <DialogDescription>
              {pendingDeleteIdx !== null && editLineItems[pendingDeleteIdx]
                ? `Are you sure you want to remove "${editLineItems[pendingDeleteIdx].product_name || editLineItems[pendingDeleteIdx].name}" from this proposal?`
                : "Are you sure you want to remove this item?"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 px-6 py-4">
            <Button variant="outline" onClick={() => setPendingDeleteIdx(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (pendingDeleteIdx !== null) {
                setEditLineItems((prev) => prev.filter((_, i) => i !== pendingDeleteIdx));
                setPendingDeleteIdx(null);
              }
            }}>
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revert to Draft confirmation */}
      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revert to Draft?</DialogTitle>
            <DialogDescription>
              This will unlock the proposal for editing and return it to draft status. If it was accepted, financials will no longer count until re-accepted. If it was voided, it will become an active draft again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 px-6 py-4">
            <Button variant="outline" onClick={() => setShowRevertDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevertToDraft} disabled={reverting}>
              {reverting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Revert to Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Savings & Fees Dialog */}
      <Dialog open={showSavingsDialog} onOpenChange={setShowSavingsDialog}>
        <DialogContent className="max-w-md p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b">
            <DialogTitle>Savings & Fees</DialogTitle>
            <DialogDescription>Apply a discount or pass the credit card processing fee to the client</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-6">
            {/* Discount */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Discount</p>
              <div className="flex gap-2">
                <div className="flex border rounded-md overflow-hidden shrink-0">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${discountType === "percent" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                    onClick={() => setDiscountType("percent")}
                  >%</button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${discountType === "fixed" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                    onClick={() => setDiscountType("fixed")}
                  >$</button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step={discountType === "percent" ? "0.1" : "1"}
                  value={discountValue || ""}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder={discountType === "percent" ? "e.g. 5" : "e.g. 500"}
                  className="flex-1"
                />
              </div>
              {discountAmt > 0 && (
                <p className="text-xs text-muted-foreground">= {formatCurrency(discountAmt)} off subtotal</p>
              )}
              <div>
                <Label className="text-sm text-muted-foreground">Custom Label (optional)</Label>
                <Input
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  placeholder="e.g. Loyalty Discount, Promotional Offer…"
                  className="mt-1.5"
                />
              </div>
            </div>
            {/* Stripe processing fee */}
            <div className="space-y-2 border-t pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Credit Card Processing Fee</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Passes Stripe fee (2.9% + $0.30) to client</p>
                </div>
                <input
                  type="checkbox"
                  id="stripe-fee-toggle"
                  checked={stripeFeeEnabled}
                  onChange={(e) => setStripeFeeEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border cursor-pointer accent-primary"
                />
              </div>
              {stripeFeeEnabled && stripeFeeAmt > 0 && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                  Fee added to total: <span className="font-semibold text-foreground">{formatCurrency(stripeFeeAmt)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end">
            <Button onClick={() => setShowSavingsDialog(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financials Dialog */}
      <Dialog open={showFinancials} onOpenChange={setShowFinancials}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b">
            <DialogTitle>Projected Financials</DialogTitle>
            <DialogDescription>Based on current saved line items</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-5">

            {role === "sales_rep" ? (
              <>
                {/* Sales Rep view — Revenue total, GP %, own commission only */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(computedSubtotal)}</span></div>
                    {activeBad > 0 && <div className="flex justify-between"><span className="text-muted-foreground">BAD</span><span>{formatCurrency(activeBad)}</span></div>}
                    {activeTax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(activeTax)}</span></div>}
                    {discountAmt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-green-600">− {formatCurrency(discountAmt)}</span></div>}
                    {stripeFeeAmt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Stripe Fee</span><span>{formatCurrency(stripeFeeAmt)}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5"><span>Total</span><span>{formatCurrency(computedTotal)}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Profitability</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Projected GP %</span>
                      <span className={computedProfitMargin >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{computedProfitMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Commission</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span>Your Commission ({finSalesRepRate}% of Subtotal)</span>
                      <span>{formatCurrency(finSalesRepCommission)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Admin / PM view — full breakdown */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(computedSubtotal)}</span></div>
                    {activeBad > 0 && <div className="flex justify-between"><span className="text-muted-foreground">BAD</span><span>{formatCurrency(activeBad)}</span></div>}
                    {activeTax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(activeTax)}</span></div>}
                    {discountAmt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-green-600">− {formatCurrency(discountAmt)}</span></div>}
                    {stripeFeeAmt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Stripe Fee</span><span>{formatCurrency(stripeFeeAmt)}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5"><span>Total Revenue</span><span>{formatCurrency(computedTotal)}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Costs</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Material Cost</span><span>{formatCurrency(finMaterialCost)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Labor Cost</span><span>{formatCurrency(finLaborCost)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5"><span>Total Cost</span><span>{formatCurrency(computedTotalCost)}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Profitability</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Profit</span>
                      <span className={computedGrossProfit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{formatCurrency(computedGrossProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GP %</span>
                      <span className={computedProfitMargin >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{computedProfitMargin.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Markup</span>
                      <span className="font-semibold">{finAvgMarkup.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Commission</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PM Commission ({finPmRate}% of GP)</span>
                      <span>{formatCurrency(finPmCommission)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Rep Commission ({finSalesRepRate}% of Subtotal)</span>
                      <span>{formatCurrency(finSalesRepCommission)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5">
                      <span>Total Commission Pool</span>
                      <span>{formatCurrency(finTotalCommission)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
          <div className="px-6 py-4 border-t flex justify-end">
            <Button onClick={() => setShowFinancials(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Off-screen export content for download — NOT hidden so html2canvas can capture it */}
      <div style={{ position: "absolute", left: -9999, top: 0, width: 794, pointerEvents: "none", opacity: 0 }}>
        <div id="proposal-export-content">
          <ProposalExport
            proposal={{
              ...proposal,
              subtotal: computedSubtotal,
              bad_amount: activeBad,
              tax_amount: activeTax,
              discount_amount: discountAmt,
              discount_percentage: discountType === "percent" ? discountValue : 0,
              discount_label: discountLabel || null,
              discount_type: discountType,
              stripe_fee_amount: stripeFeeAmt,
              stripe_fee_enabled: stripeFeeEnabled,
              total: computedTotal,
            }}
            client={client}
            reviews={reviews}
            warrantySections={warrantySections}
            warrantyDisclaimer={warrantyDisclaimer}
          />
        </div>
      </div>
    </div>
  );
}
