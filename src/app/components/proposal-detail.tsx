import { useState, useEffect } from "react";
import { formatCurrency } from "@/app/utils/format";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { useParams, Link, useNavigate } from "react-router";
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
} from "lucide-react";
import { estimatesAPI, clientsAPI, productsAPI, estimateTemplatesAPI, activityLogAPI, notificationsAPI } from "../utils/api";
import { usePermissions } from "../hooks/usePermissions";
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
import { PageLoader, SkeletonCards } from "./ui/page-loader";

export function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLineItems, setEditLineItems] = useState<any[]>([]);
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

  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [markingAccepted, setMarkingAccepted] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    productsAPI.getCategories().then(setDbCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    estimateTemplatesAPI.getAll().then(setTemplates).catch(console.error);
    supabase
      .from("proposal_reviews")
      .select("reviewer_name, rating, review_text")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setReviews(data ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    estimatesAPI.getById(id).then((est) => {
      setProposal(est);
      setEditTitle(est.title ?? "");
      setEditDescription(est.description ?? "");
      setEditLineItems(est.line_items ?? []);
      if (est?.client_id) {
        clientsAPI.getById(est.client_id).then(setClient).catch(console.error);
      }
    }).catch(console.error).finally(() => setLoading(false));
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
          Number(item.client_price ?? item.price_per_unit) !== Number(orig.client_price ?? orig.price_per_unit)
        );
      });
    setIsDirty(titleChanged || descChanged || itemsChanged);
  }, [editTitle, editDescription, editLineItems, proposal]);

  useRealtimeRefetch(() => {
    if (!id) return;
    estimatesAPI.getById(id).then((est) => {
      setProposal(est);
      setEditLineItems(est.line_items ?? []);
    }).catch(console.error);
  }, ["estimates", "estimate_line_items"], "proposal-detail");

  const computedSubtotal = editLineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.client_price)),
    0
  );
  const activeBad = badOverride !== null ? badOverride : (proposal?.bad_amount ?? 0);
  const computedTotal = computedSubtotal + (proposal?.tax_amount ?? 0) + activeBad;
  const computedTotalCost = editLineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * (Number(item.material_cost ?? 0) + Number(item.labor_cost ?? 0)),
    0
  );
  const computedGrossProfit = computedTotal - computedTotalCost;
  const computedProfitMargin = computedTotal > 0 ? (computedGrossProfit / computedTotal) * 100 : 0;

  const updateQty = (idx: number, qty: number) => {
    setEditLineItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item)
    );
  };

  const handleWizardEdit = (category: string) => {
    const template = templates.find((t: any) => t.category === category);
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
      unit: item.unit,
      material_cost: item.materialCost ?? 0,
      labor_cost: item.laborCost ?? 0,
      markup_percent: item.markupPercent ?? 0,
      client_price: item.pricePerUnit ?? 0,
      total_price: (item.quantity ?? 0) * (item.pricePerUnit ?? 0),
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
    const newTotal = newSubtotal + (proposal.tax_amount ?? 0) + activeBad;
    await supabase.from("estimates").update({ subtotal: newSubtotal, total: newTotal }).eq("id", proposal.id);
    setProposal((p: any) => ({ ...p, subtotal: newSubtotal, total: newTotal }));

    // Save wizard inputs so we can pre-fill next time
    if (formData) {
      const updatedInputs = { ...(proposal.wizard_inputs ?? {}), [wizardCategory]: formData };
      await supabase.from("estimates").update({ wizard_inputs: updatedInputs }).eq("id", proposal.id);
      setProposal((p: any) => ({ ...p, wizard_inputs: updatedInputs }));
    }
    setShowWizard(false);
    toast.success(`${wizardCategory} items updated`);
  };

  const handleSave = async () => {
    if (!proposal) return;
    setSaving(true);
    try {
      await estimatesAPI.update(proposal.id, {
        title: editTitle,
        description: editDescription,
        subtotal: computedSubtotal,
        total: computedTotal,
        total_cost: computedTotalCost,
        gross_profit: computedGrossProfit,
        profit_margin: computedProfitMargin,
        ...(badOverride !== null ? { bad_amount: badOverride } : {}),
      });
      // Insert new items (added via picker/custom form during this session)
      const newItems = editLineItems.filter((item) => item.id?.startsWith("new-"));
      if (newItems.length > 0) {
        await supabase.from("estimate_line_items").insert(
          newItems.map((item) => ({
            estimate_id: proposal.id,
            name: item.product_name ?? item.name,
            product_name: item.product_name ?? item.name,
            category: item.category ?? null,
            quantity: Number(item.quantity),
            unit: item.unit ?? "",
            client_price: Number(item.client_price),
            price_per_unit: Number(item.client_price),
            total_price: Number(item.quantity) * Number(item.client_price),
            material_cost: item.material_cost ?? 0,
            labor_cost: item.labor_cost ?? 0,
            cost_per_unit: item.cost_per_unit ?? 0,
            markup_percent: item.markup_percent ?? 0,
          }))
        );
      }
      // Update existing items
      await Promise.all(
        editLineItems
          .filter((item) => !item.id?.startsWith("new-"))
          .map((item) =>
            supabase.from("estimate_line_items").update({
              product_name: item.product_name ?? item.name,
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
            }).eq("id", item.id)
          )
      );
      setProposal((p: any) => ({
        ...p,
        title: editTitle,
        description: editDescription,
        subtotal: computedSubtotal,
        total: computedTotal,
        total_cost: computedTotalCost,
        gross_profit: computedGrossProfit,
        profit_margin: computedProfitMargin,
        line_items: editLineItems,
      }));
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_created", description: `Proposal updated: "${editTitle}" — total: $${computedTotal?.toLocaleString()}` }).catch(() => {});
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
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDownload = async () => {
    const element = document.getElementById("proposal-export-content");
    if (!element) return;
    setDownloading(true);
    try {
      // Pre-load all images as base64 to avoid CORS/taint issues with html2canvas
      const imgs = Array.from(element.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(imgs.map((img) => new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        img.onload = () => resolve();
        img.onerror = () => resolve(); // skip broken images, don't fail
      })));

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#F5F3EF",
        logging: false,
        imageTimeout: 10000,
        removeContainer: true,
        // Strip Tailwind/shadcn stylesheets — they use oklch which html2canvas can't parse.
        // ProposalExport is 100% inline-styled so removing external CSS is safe.
        onclone: (_doc, el) => {
          const root = el.getRootNode() as Document;
          Array.from(root.querySelectorAll('link[rel="stylesheet"], style')).forEach((s) => s.remove());
          Array.from(root.querySelectorAll('.screen-only')).forEach((s) => (s as HTMLElement).style.display = 'none');
        },
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height / canvas.width) * pageW;
      let remaining = imgH;
      let yOffset = 0;
      pdf.addImage(imgData, "JPEG", 0, yOffset, pageW, imgH);
      remaining -= pageH;
      while (remaining > 2) {
        yOffset -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, yOffset, pageW, imgH);
        remaining -= pageH;
      }
      pdf.save(`Estimate-${proposal.estimate_number ?? ""}-${proposal.title ?? "Proposal"}.pdf`);
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_pdf_exported", description: `Proposal PDF exported: "${proposal.title}"` }).catch(() => {});
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF — please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleMarkAccepted = async () => {
    if (!proposal) return;
    setMarkingAccepted(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("estimates").update({
        status: "accepted",
        accepted_at: now,
      }).eq("id", proposal.id);

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
        message: `"${proposal.title}" has been accepted.`,
        link: `/proposals/${proposal.id}`,
        metadata: { proposal_id: proposal.id, client_id: proposal.client_id },
      }).catch(() => {});
      setProposal({ ...proposal, status: "accepted", accepted_at: now });
      toast.success("Proposal marked as accepted");
    } catch {
      toast.error("Failed to update proposal status");
    } finally {
      setMarkingAccepted(false);
    }
  };

  const handleEmail = () => {
    const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
    setEmailTo(client?.email ?? "");
    setEmailSubject(`Proposal: ${proposal.title}`);
    setEmailMessage(`Hi ${clientName},\n\nPlease review our proposal for your project. You can view, accept, or decline it using the link below.\n\nBest regards,\nButler & Associates Construction`);
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject.trim()) return;
    setSendingEmail(true);
    try {
      const proposalLink = `${window.location.origin}/p/${proposal.id}`;
      const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
        </head>
        <body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

            <!-- Header -->
            <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 5px 0;">Butler &amp; Associates Construction, Inc.</p>
                    <p style="font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;font-weight:300;color:#fff;margin:0;line-height:1.3;">Crafted with intention. Built to last.</p>
                  </td>
                  <td style="vertical-align:middle;text-align:right;width:60px;">
                    <!-- White logo (larger) — uncomment to use: -->
                    <!-- <img src="https://images.squarespace-cdn.com/content/v1/67a6462842d3287ac4bbd645/da21fa34-e667-4e7e-bf6f-f9e8670503c6/Primary+Logo+WHITE.png" alt="Butler &amp; Associates" height="90" style="height:90px;width:auto;display:block;margin-left:auto;" /> -->
                    <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="48" style="height:48px;width:auto;display:block;margin-left:auto;" />
                  </td>
                </tr>
              </table>
            </div>
            <!-- Gold rule -->
            <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>

            <!-- Body -->
            <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">

              <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 20px 0;">
                Your Proposal Is Ready
              </p>

              <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;white-space:pre-line;margin:0 0 28px 0;">${emailMessage}</p>

              <div style="text-align:center;margin:0 0 28px 0;">
                <a href="${proposalLink}" style="display:inline-block;background:#0A0A0A;color:#BB984D;padding:14px 36px;border-radius:4px;text-decoration:none;font-family:Inter,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.08em;">
                  View &amp; Accept Proposal
                </a>
              </div>

              <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
                This proposal is valid for 30 days. Questions? Reply to this email or reach us at
                <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
              </p>
            </div>

            <!-- Footer -->
            <div style="text-align:center;padding:20px 0 0 0;">
              <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">
                Butler &amp; Associates Construction, Inc.
              </p>
              <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">
                6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
              </p>
            </div>

          </div>
        </body>
        </html>
      `;
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: emailTo, subject: emailSubject, html, from_name: "Butler & Associates Construction" },
      });
      if (error) throw error;
      await estimatesAPI.updateStatus(proposal.id, "sent");
      setProposal({ ...proposal, status: "sent", sent_at: new Date().toISOString() });
      setShowEmailDialog(false);
      activityLogAPI.create({ client_id: proposal.client_id, action_type: "proposal_sent", description: `Proposal sent to client: "${proposal.title}" — ${emailTo}` }).catch(() => {});
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
              <Badge variant="outline">{proposal.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
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
                <DropdownMenuItem onClick={handleEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Client
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {proposal.status !== "accepted" && (
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
          )}

          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

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
            <p className="text-xl font-bold text-green-600">{formatCurrency(proposal.total)}</p>
          </CardContent>
        </Card>
      </div>

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
        </div>
      )}

      {/* Proposal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setShowItemPicker(true); setPickerCategory(""); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            // Group items by category
            const groups: Record<string, any[]> = {};
            editLineItems.forEach((item, idx) => {
              const cat = item.category || "(No Category)";
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push({ ...item, _idx: idx });
            });
            return (
              <div className="overflow-x-auto">
                <table className="w-full">
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
                    {Object.entries(groups).map(([cat, groupItems]) => {
                      const hasWizard = templates.some((t: any) => t.category === cat);
                      return (
                        <>
                          {/* Category header row */}
                          <tr key={`cat-${cat}`} className="border-b border-t">
                            <td colSpan={8} className="px-4 py-2 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{cat}</span>
                                {hasWizard && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleWizardEdit(cat)}>
                                    <Wand2 className="h-3.5 w-3.5" />
                                    Edit in Wizard
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {groupItems.map((item: any) => {
                            const idx = item._idx;
                            const rowKey = item.id ?? String(idx);
                            const isExpanded = expandedRows.has(rowKey);
                            const laborCost = Number(item.labor_cost ?? 0);
                            const materialCost = Number(item.material_cost ?? 0);
                            const markupPct = Number(item.markup_percent ?? 0);
                            return (
                              <>
                                <tr key={rowKey} className="hover:bg-accent/50">
                                  <td className="p-3">
                                    <div className="text-sm font-medium">{item.name ?? item.product_name ?? ""}</div>
                                    {item.description && (
                                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={item.fio_qty ?? 0}
                                      placeholder="0"
                                      onChange={(e) => {
                                        const val = e.target.value === "" ? null : Number(e.target.value);
                                        setEditLineItems((prev) => prev.map((li, i) => i === idx ? { ...li, fio_qty: val } : li));
                                      }}
                                      className="w-20"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={item.quantity}
                                      onChange={(e) => updateQty(idx, Number(e.target.value))}
                                      className="w-20"
                                    />
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
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPendingDeleteIdx(idx)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
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
                                          <span className="font-semibold text-amber-600">{markupPct}%</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </>
                      );
                    })}
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
          <DialogHeader className="px-6 py-5 border-b shrink-0">
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
          <div className="flex-1 overflow-y-auto bg-[#525659] thin-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
            <div className="py-8 flex justify-center">
              <div className="bg-white shadow-2xl" style={{ width: 794 }}>
                <ProposalExport proposal={proposal} client={client} reviews={reviews} />
              </div>
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
            {client && (!client.address || !client.phone) && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                Warning: {[!client.address && "address", !client.phone && "phone"].filter(Boolean).join(" and ")} missing on this client — the proposal PDF will have blank fields.
              </div>
            )}
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
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
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailTo || !emailSubject.trim()}>
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
                const proposalLink = `${window.location.origin}/p/${proposal?.id}`;
                const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
                return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Inter:wght@400;500&display=swap" rel="stylesheet"/>
<style>::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:4px}::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.32)}*{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.18) transparent}</style>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 5px 0;">Butler &amp; Associates Construction, Inc.</p>
          <p style="font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;font-weight:300;color:#fff;margin:0;line-height:1.3;">Crafted with intention. Built to last.</p>
        </td>
        <td style="vertical-align:middle;text-align:right;width:60px;">
          <!-- White logo (larger) — uncomment to use: -->
          <!-- <img src="https://images.squarespace-cdn.com/content/v1/67a6462842d3287ac4bbd645/da21fa34-e667-4e7e-bf6f-f9e8670503c6/Primary+Logo+WHITE.png" alt="B&amp;A" height="90" style="height:90px;width:auto;display:block;margin-left:auto;" onerror="this.style.display='none'"/> -->
          <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="B&amp;A" height="48" style="height:48px;width:auto;display:block;margin-left:auto;" onerror="this.style.display='none'"/>
        </td>
      </tr>
    </table>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
  <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
    <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 20px 0;">Your Proposal Is Ready</p>
    <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;white-space:pre-line;margin:0 0 28px 0;">${emailMessage}</p>
    <div style="text-align:center;margin:0 0 28px 0;">
      <a href="${proposalLink}" style="display:inline-block;background:#0A0A0A;color:#BB984D;padding:14px 36px;border-radius:4px;text-decoration:none;font-family:Inter,sans-serif;font-size:13px;font-weight:500;letter-spacing:0.08em;">View &amp; Accept Proposal</a>
    </div>
    <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
      This proposal is valid for 30 days. Questions? Reply to this email or reach us at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
    </p>
  </div>
  <div style="text-align:center;padding:20px 0 0 0;">
    <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
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
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>You have unsaved changes to this proposal. What would you like to do?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => { setShowUnsavedDialog(false); navigate(`/clients/${proposal.client_id}`); }}>Leave</Button>
            <Button className="flex-1" onClick={() => { setShowUnsavedDialog(false); handleSave(); }}>Save</Button>
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

      {/* Off-screen export content for download — NOT hidden so html2canvas can capture it */}
      <div style={{ position: "absolute", left: -9999, top: 0, width: 794, pointerEvents: "none", opacity: 0 }}>
        <div id="proposal-export-content">
          <ProposalExport proposal={proposal} client={client} reviews={reviews} />
        </div>
      </div>
    </div>
  );
}
