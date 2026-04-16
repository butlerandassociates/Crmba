import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronLeft, Loader2, ClipboardEdit, Save, Send, Download, FileText, GitMerge, Check, CreditCard, Edit, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { changeOrdersAPI } from "../api/change-orders";
import { activityLogAPI } from "../api/activity-log";
import { estimatesAPI } from "../api/estimates";
import { projectPaymentsAPI } from "../api/project-payments";
import { projectsAPI } from "../api/projects";
import { ChangeOrderExport } from "./change-order-export";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ChangeOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSave?: () => void;
}

type View = "list" | "create" | "edit" | "detail" | "payment";

const STATUS_CONFIG = {
  draft:          { label: "Draft",          className: "bg-gray-100 text-gray-700" },
  pending_client: { label: "Pending Client", className: "bg-amber-100 text-amber-700" },
  approved:       { label: "Approved",       className: "bg-green-100 text-green-700" },
  rejected:       { label: "Rejected",       className: "bg-red-100 text-red-700" },
  merged:         { label: "Merged",         className: "bg-purple-100 text-purple-700" },
} as const;

const CATEGORIES = ["Materials", "Labor", "Equipment", "Permits", "Subcontractor", "Other"];
const EMPTY_ITEM = { id: "", category: "Materials", description: "", quantity: 1, unit_price: 0, total: 0 };

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function ChangeOrdersSheet({ open, onOpenChange, client, project, onSave }: ChangeOrdersSheetProps) {
  const [view, setView] = useState<View>("list");
  const [cos, setCos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCo, setSelectedCo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [acceptedProposal, setAcceptedProposal] = useState<any>(null);
  const [merging, setMerging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mergedTotal, setMergedTotal] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Payment schedule update state
  const [milestones, setMilestones] = useState<any[]>([]);
  const [savingPayments, setSavingPayments] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM, id: "1" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Unsaved changes tracking
  const isDirty = title.trim() !== "" || reason.trim() !== "" || items.some((i) => i.description.trim() !== "");
  const isEditOrCreate = view === "create" || view === "edit";

  // Export ref
  const exportRef = useRef<HTMLDivElement>(null);

  const loadCOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const data = await changeOrdersAPI.getByClient(client.id);
      setCos(data);
    } catch {
      toast.error("Failed to load change orders — please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const loadAcceptedProposal = async () => {
    if (!client?.id) return;
    try {
      const proposal = await estimatesAPI.getAccepted(client.id);
      setAcceptedProposal(proposal);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (open) {
      setView("list");
      loadCOs();
      loadAcceptedProposal();
    }
  }, [open, client?.id]);

  // Unsaved changes — warn on browser close/refresh
  useEffect(() => {
    if (!isEditOrCreate || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [view, isDirty]);

  const resetForm = () => {
    setTitle("");
    setReason("");
    setTimelineImpact("");
    setItems([{ ...EMPTY_ITEM, id: "1" }]);
    setErrors({});
  };

  // Intercept back navigation when form is dirty
  const handleBack = () => {
    if (isEditOrCreate && isDirty) {
      if (!window.confirm("You have unsaved changes. Leave without saving?")) return;
    }
    if (view === "edit") { setView("detail"); }
    else { setView("list"); setSelectedCo(null); }
  };

  // Intercept sheet close when form is dirty
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isEditOrCreate && isDirty) {
      if (!window.confirm("You have unsaved changes. Leave without saving?")) return;
    }
    if (!nextOpen) { resetForm(); setView("list"); setSelectedCo(null); }
    onOpenChange(nextOpen);
  };

  // Open edit view pre-populated with selected CO data
  const handleOpenEdit = () => {
    if (!selectedCo) return;
    setTitle(selectedCo.title || "");
    setReason(selectedCo.reason || "");
    setTimelineImpact(selectedCo.timeline_impact || "");
    setItems(
      (selectedCo.items || []).length > 0
        ? selectedCo.items.map((i: any, idx: number) => ({
            id: String(idx + 1),
            category: i.category || "Materials",
            description: i.description || "",
            quantity: i.quantity || 1,
            unit_price: i.unit_price || 0,
            total: i.total || 0,
          }))
        : [{ ...EMPTY_ITEM, id: "1" }]
    );
    setErrors({});
    setView("edit");
  };

  // Save edits to a draft CO
  const handleUpdate = async () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!reason.trim()) newErrors.reason = "Reason for change is required";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const updated = await changeOrdersAPI.update(
        selectedCo.id,
        { title: title.trim(), reason: reason.trim(), timeline_impact: timelineImpact || undefined },
        items.filter((i) => i.description.trim()).map((item, i) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: i,
        }))
      );
      // Reload items from DB so detail view is fresh
      const fresh = await changeOrdersAPI.getByClient(client.id);
      const freshCo = fresh.find((c) => c.id === selectedCo.id) || { ...selectedCo, ...updated };
      setSelectedCo(freshCo);
      setCos(fresh);
      activityLogAPI.create({ client_id: client.id, action_type: "co_updated", description: `Change order updated: "${title.trim()}"` }).catch(() => {});
      toast.success("Change order updated");
      setView("detail");
    } catch (err: any) {
      toast.error(err.message || "Failed to update change order");
    } finally {
      setSaving(false);
    }
  };

  // Delete a CO with confirmation
  const handleDelete = async (coId: string) => {
    setDeleting(true);
    try {
      await changeOrdersAPI.delete(coId);
      setCos((prev) => prev.filter((c) => c.id !== coId));
      setDeleteConfirm(null);
      if (selectedCo?.id === coId) { setSelectedCo(null); setView("list"); }
      activityLogAPI.create({ client_id: client.id, action_type: "co_deleted", description: `Change order deleted: "${selectedCo?.title ?? "CO"}"` }).catch(() => {});
      toast.success("Change order deleted");
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (sendToClient = false) => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!reason.trim()) newErrors.reason = "Reason for change is required";
    if (sendToClient && !items.some((i) => i.description.trim()))
      newErrors.items = "At least one line item is required before sending to client";

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      await changeOrdersAPI.create(
        {
          client_id: client.id,
          project_id: project?.id,
          title: title.trim(),
          reason: reason.trim(),
          timeline_impact: timelineImpact || undefined,
          status: sendToClient ? "pending_client" : "draft",
        },
        items.filter((i) => i.description.trim()).map((item, i) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: i,
        }))
      );
      activityLogAPI.create({ client_id: client.id, action_type: "co_created", description: `Change order "${title.trim()}" ${sendToClient ? "sent to client portal" : "saved as draft"}` }).catch(() => {});
      toast.success(sendToClient ? "Change order sent to client portal" : "Change order saved as draft");
      resetForm();
      setView("list");
      loadCOs();
      onSave?.();
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
      toast.error("Failed to update status — please try again.");
    }
  };

  const handleMerge = async () => {
    if (!selectedCo) return;
    setMerging(true);
    try {
      const { newEstimateTotal } = await changeOrdersAPI.mergeApproved(selectedCo, client.id);
      setMergedTotal(newEstimateTotal);
      // Sync project total_value so financials stay accurate
      if (project?.id) {
        await projectsAPI.update(project.id, { total_value: newEstimateTotal }).catch(() => {});
      }
      activityLogAPI.create({ client_id: client.id, action_type: "co_merged", description: `Change order "${selectedCo.title}" merged — new contract total: ${formatCurrency(newEstimateTotal)}` }).catch(() => {});
      toast.success(`Merged into proposal. New contract total: ${formatCurrency(newEstimateTotal)}`);
      const merged = { ...selectedCo, status: "merged" };
      setCos((prev) => prev.map((c) => c.id === selectedCo.id ? merged : c));
      setSelectedCo(merged);
      loadAcceptedProposal();

      // Load payment milestones and go to payment update view
      if (project?.id) {
        const payments = await projectPaymentsAPI.getByProject(project.id);
        setMilestones((payments || []).map((p: any) => ({ ...p, newAmount: p.amount })));
        setView("payment");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to merge change order");
    } finally {
      setMerging(false);
    }
  };

  const handleSavePayments = async () => {
    setSavingPayments(true);
    try {
      await Promise.all(
        milestones.map((m) =>
          projectPaymentsAPI.update(m.id, { amount: Number(m.newAmount) || m.amount })
        )
      );
      activityLogAPI.create({ client_id: client.id, action_type: "payment_milestone_added", description: `Payment schedule updated after change order merge` }).catch(() => {});
      toast.success("Payment schedule updated");
      setView("detail");
      onSave?.();
    } catch {
      toast.error("Failed to update payment schedule");
    } finally {
      setSavingPayments(false);
    }
  };

  const handleExportPDF = async () => {
    const element = exportRef.current;
    if (!element || !selectedCo) return;
    setDownloading(true);
    try {
      const imgs = Array.from(element.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(imgs.map((img) => new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })));

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 10000,
        removeContainer: true,
        onclone: (_doc, el) => {
          const root = el.getRootNode() as Document;
          root.querySelectorAll?.("link[rel='stylesheet'], style").forEach((s) => s.remove());
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
      pdf.save(`ChangeOrder-${selectedCo.title?.replace(/\s+/g, "-") ?? "CO"}.pdf`);
      activityLogAPI.create({ client_id: client.id, action_type: "co_pdf_exported", description: `Change order PDF exported: "${selectedCo.title}"` }).catch(() => {});
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF — please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM, id: Date.now().toString() }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));
  const updateItem = (id: string, key: string, value: any) =>
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [key]: value };
        if (key === "quantity" || key === "unit_price") {
          updated.total =
            (Number(key === "quantity" ? value : updated.quantity) || 0) *
            (Number(key === "unit_price" ? value : updated.unit_price) || 0);
        }
        return updated;
      })
    );

  const totalCostImpact = items.reduce((s, i) => s + (i.total || 0), 0);
  const contractAmount = project?.total_value || 0;
  const newContractAmount = contractAmount + totalCostImpact;
  const milestonesTotal = milestones.reduce((s, m) => s + (Number(m.newAmount) || 0), 0);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const canSend = title.trim() && reason.trim() && items.some((i) => i.description.trim());

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              {view !== "list" && (
                <button
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <SheetTitle className="text-base">
                  {view === "list" ? "Change Orders"
                    : view === "create" ? "New Change Order"
                    : view === "edit" ? "Edit Change Order"
                    : view === "payment" ? "Update Payment Schedule"
                    : selectedCo?.title}
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
                {acceptedProposal && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">Source of Truth — Approved Proposal</p>
                      <p className="text-xs text-amber-700 truncate">
                        #{acceptedProposal.estimate_number}{acceptedProposal.title ? ` · ${acceptedProposal.title}` : ""} · {formatCurrency(acceptedProposal.total)}
                      </p>
                    </div>
                  </div>
                )}
                {!loading && cos.length > 0 && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => { resetForm(); setView("create"); }}>
                      <Plus className="h-4 w-4 mr-1.5" /> New Change Order
                    </Button>
                  </div>
                )}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ClipboardEdit className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No change orders yet</p>
                    <p className="text-xs mt-1">Create your first change order for this project.</p>
                    <Button size="sm" className="mt-4" onClick={() => { resetForm(); setView("create"); }}>
                      <Plus className="h-4 w-4 mr-1.5" /> Create First Change Order
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cos.map((co) => {
                      const cfg = STATUS_CONFIG[co.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                      return (
                        <div key={co.id} className="border rounded-lg hover:bg-accent/30 transition-colors">
                          <div
                            className="p-4 cursor-pointer"
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
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold shrink-0 ${(co.cost_impact || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {(co.cost_impact || 0) >= 0 ? "+" : ""}{formatCurrency(co.cost_impact || 0)}
                                </span>
                                {co.status !== "merged" && (
                                  <button
                                    className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                                    title="Delete change order"
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: co.id, title: co.title }); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE VIEW ── */}
            {view === "create" && (
              <div className="p-4 space-y-4">
                {acceptedProposal && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">Amending Approved Proposal</p>
                      <p className="text-xs text-amber-700 truncate">
                        #{acceptedProposal.estimate_number}{acceptedProposal.title ? ` · ${acceptedProposal.title}` : ""} · {formatCurrency(acceptedProposal.total)}
                      </p>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader><CardTitle>Change Order Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="co-title">Title *</Label>
                      <Input
                        id="co-title"
                        placeholder="e.g. Kitchen Island Extension"
                        value={title}
                        className={errors.title ? "border-destructive" : ""}
                        onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                      />
                      {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-reason">Reason for Change *</Label>
                      <Textarea
                        id="co-reason"
                        placeholder="Explain why this change is being requested..."
                        rows={4}
                        className={`resize-none ${errors.reason ? "border-destructive" : ""}`}
                        value={reason}
                        onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: "" })); }}
                      />
                      {errors.reason
                        ? <p className="text-xs text-destructive">{errors.reason}</p>
                        : <p className="text-xs text-muted-foreground">This will be visible to the client on the change order</p>
                      }
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-timeline">Timeline Impact</Label>
                      <Input
                        id="co-timeline"
                        placeholder="e.g. +5 days, No change, -2 days"
                        value={timelineImpact}
                        onChange={(e) => setTimelineImpact(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Cost Breakdown</CardTitle>
                      <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-2" /> Add Line Item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Line Item {index + 1}</span>
                          {items.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-md text-sm"
                              value={item.category}
                              onChange={(e) => updateItem(item.id, "category", e.target.value)}
                            >
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              placeholder="e.g. Additional granite countertop"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, "description", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input type="number" min="0" step="0.01" value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit Price ($)</Label>
                            <Input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <div className="px-3 py-2 border rounded-md bg-white font-semibold text-sm">${item.total.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 mt-2">
                      <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                        <span className="font-semibold text-lg">Total Cost Impact:</span>
                        <span className={`text-2xl font-bold ${totalCostImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalCostImpact >= 0 ? "+" : ""}${totalCostImpact.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {contractAmount > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900">
                          <strong>Contract Update:</strong> Original {formatCurrency(contractAmount)} → <strong>{formatCurrency(newContractAmount)}</strong> if approved.
                        </p>
                      </div>
                    )}
                    {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Submit Change Order</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Choose how to handle this change order:</p>
                    <div className="space-y-3">
                      <Button variant="outline" className="w-full justify-start"
                        disabled={saving || !title.trim() || !reason.trim()}
                        onClick={() => handleCreate(false)}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save as Draft
                        <span className="ml-auto text-xs text-muted-foreground">Save for later without sending</span>
                      </Button>

                      <Button variant="outline" className="w-full justify-start"
                        disabled={saving || !title.trim() || !reason.trim()}
                        onClick={() => handleCreate(false).then(() => { /* PDF after save handled in detail view */ })}>
                        <Download className="h-4 w-4 mr-2" />
                        Save Draft (Export PDF from detail)
                        <span className="ml-auto text-xs text-muted-foreground">Save first, then export from detail</span>
                      </Button>

                      <Button className="w-full justify-start bg-black hover:bg-gray-800"
                        disabled={saving || !canSend}
                        onClick={() => handleCreate(true)}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Send to Client Portal
                        <span className="ml-auto text-xs text-gray-300">Client receives notification</span>
                      </Button>
                    </div>
                    {!canSend && (
                      <p className="text-xs text-destructive">* Fill in all required fields before sending to client</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── DETAIL VIEW ── */}
            {view === "detail" && selectedCo && (
              <div className="p-6 space-y-5">
                {/* Status buttons */}
                <div className="flex flex-wrap gap-2">
                  {(["draft", "pending_client", "approved", "rejected"] as const)
                    .filter(() => selectedCo.status !== "merged")
                    .map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const active = selectedCo.status === s;
                      return (
                        <button key={s}
                          onClick={() => handleStatusUpdate(selectedCo.id, s)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                            active ? `${cfg.className} border-transparent` : "bg-background text-muted-foreground border-border hover:bg-accent"
                          }`}>
                          {cfg.label}
                        </button>
                      );
                    })}
                </div>

                {/* Edit / Delete / Export actions */}
                <div className="flex gap-2">
                  {selectedCo.status === "draft" && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleOpenEdit}>
                      <Edit className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleExportPDF} disabled={downloading}>
                    {downloading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                    Export PDF
                  </Button>
                  {selectedCo.status !== "merged" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-red-50 border-destructive/30"
                      onClick={() => setDeleteConfirm({ id: selectedCo.id, title: selectedCo.title })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-900 text-xs font-semibold text-white">
                        <div className="col-span-3">Category</div>
                        <div className="col-span-4">Description</div>
                        <div className="col-span-3 text-right">Qty × Price</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {(selectedCo.items || []).map((item: any, i: number) => (
                        <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t text-sm items-center">
                          <div className="col-span-3 text-muted-foreground text-xs">{item.category}</div>
                          <div className="col-span-4 font-medium">{item.description}</div>
                          <div className="col-span-3 text-right text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price)}</div>
                          <div className="col-span-2 text-right font-semibold">{formatCurrency(item.total)}</div>
                        </div>
                      ))}
                      <div className="px-3 py-3 border-t bg-muted/30 flex justify-between">
                        <span className="text-sm font-semibold">Total Cost Impact</span>
                        <span className={`text-sm font-bold ${(selectedCo.cost_impact || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {(selectedCo.cost_impact || 0) >= 0 ? "+" : ""}{formatCurrency(selectedCo.cost_impact || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contract update */}
                {contractAmount > 0 && selectedCo.cost_impact != null && selectedCo.status !== "merged" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Contract Update:</strong> {formatCurrency(contractAmount)} → <strong>{formatCurrency(contractAmount + (selectedCo.cost_impact || 0))}</strong> if approved.
                    </p>
                  </div>
                )}

                {/* Merge button */}
                {selectedCo.status === "approved" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-green-800">Ready to Merge</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Adds line items to the approved proposal and updates the contract total by{" "}
                        <strong>{(selectedCo.cost_impact || 0) >= 0 ? "+" : ""}{formatCurrency(selectedCo.cost_impact || 0)}</strong>.
                        You'll then update the payment schedule.
                      </p>
                    </div>
                    <Button className="w-full bg-green-700 hover:bg-green-800 text-white" onClick={handleMerge} disabled={merging}>
                      {merging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
                      Approve & Merge into Proposal
                    </Button>
                  </div>
                )}

                {/* Merged confirmation */}
                {selectedCo.status === "merged" && (
                  <div className="space-y-3">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                      <Check className="h-4 w-4 text-purple-600 shrink-0" />
                      <p className="text-sm text-purple-800">
                        Merged into the approved proposal. Contract total updated.
                        {mergedTotal && <strong> New total: {formatCurrency(mergedTotal)}</strong>}
                      </p>
                    </div>
                    {project?.id && (
                      <Button variant="outline" className="w-full" onClick={async () => {
                        const payments = await projectPaymentsAPI.getByProject(project.id);
                        setMilestones((payments || []).map((p: any) => ({ ...p, newAmount: p.amount })));
                        setView("payment");
                      }}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Update Payment Schedule
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">Created {formatDate(selectedCo.created_at)}</p>
              </div>
            )}

            {/* ── EDIT VIEW (draft only) ── */}
            {view === "edit" && selectedCo && (
              <div className="p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800">Editing a draft change order — locked once approved or merged.</p>
                </div>

                <Card>
                  <CardHeader><CardTitle>Change Order Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Title *</Label>
                      <Input
                        id="edit-title"
                        value={title}
                        className={errors.title ? "border-destructive" : ""}
                        onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
                      />
                      {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-reason">Reason for Change *</Label>
                      <Textarea
                        id="edit-reason"
                        rows={4}
                        className={`resize-none ${errors.reason ? "border-destructive" : ""}`}
                        value={reason}
                        onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: "" })); }}
                      />
                      {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-timeline">Timeline Impact</Label>
                      <Input
                        id="edit-timeline"
                        placeholder="e.g. +5 days, No change"
                        value={timelineImpact}
                        onChange={(e) => setTimelineImpact(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Cost Breakdown</CardTitle>
                      <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-2" /> Add Line Item
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Line Item {index + 1}</span>
                          {items.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-md text-sm"
                              value={item.category}
                              onChange={(e) => updateItem(item.id, "category", e.target.value)}
                            >
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => updateItem(item.id, "description", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input type="number" min="0" step="0.01" value={item.quantity}
                              onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit Price ($)</Label>
                            <Input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <div className="px-3 py-2 border rounded-md bg-white font-semibold text-sm">${item.total.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                        <span className="font-semibold">Total Cost Impact:</span>
                        <span className={`text-xl font-bold ${totalCostImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalCostImpact >= 0 ? "+" : ""}${totalCostImpact.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setView("detail")}>Cancel</Button>
                      <Button className="flex-1" disabled={saving} onClick={handleUpdate}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── PAYMENT SCHEDULE VIEW ── */}
            {view === "payment" && (
              <div className="p-6 space-y-5">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800">Change Order Merged Successfully</p>
                  <p className="text-xs text-green-700 mt-1">
                    Update the payment schedule below to reflect the new contract total.
                    {mergedTotal && <> New contract total: <strong>{formatCurrency(mergedTotal)}</strong></>}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Payment Milestones</p>
                  {milestones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No payment milestones</p>
                      <p className="text-xs mt-1">Milestones are created when a project is moved to sold.</p>
                    </div>
                  ) : (
                    milestones.map((m, i) => (
                      <div key={m.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{m.label}</span>
                          {m.is_paid && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Current Amount</Label>
                            <div className="text-sm font-medium mt-0.5">{formatCurrency(m.amount)}</div>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs" htmlFor={`milestone-${i}`}>New Amount</Label>
                            <Input
                              id={`milestone-${i}`}
                              type="number"
                              min="0"
                              step="0.01"
                              className="mt-0.5"
                              value={m.newAmount}
                              disabled={m.is_paid}
                              onChange={(e) =>
                                setMilestones((prev) =>
                                  prev.map((p, pi) => pi === i ? { ...p, newAmount: e.target.value } : p)
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Totals summary */}
                {milestones.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Milestones Total</span>
                      <span className="font-semibold">{formatCurrency(milestonesTotal)}</span>
                    </div>
                    {mergedTotal != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">New Contract Total</span>
                        <span className="font-semibold">{formatCurrency(mergedTotal)}</span>
                      </div>
                    )}
                    {mergedTotal != null && Math.abs(milestonesTotal - mergedTotal) > 1 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                        ⚠ Milestones total ({formatCurrency(milestonesTotal)}) doesn't match contract total ({formatCurrency(mergedTotal)}). Adjust amounts to balance.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setView("detail")}>
                    Skip for Now
                  </Button>
                  <Button className="flex-1" onClick={handleSavePayments} disabled={savingPayments}>
                    {savingPayments ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                    Save Payment Schedule
                  </Button>
                </div>
              </div>
            )}

          </div>
        </SheetContent>
      </Sheet>

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Delete Change Order?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  "<span className="font-medium text-foreground">{deleteConfirm.title}</span>" will be permanently removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" disabled={deleting} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirm.id)}
              >
                {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen export for PDF generation */}
      <div style={{ position: "absolute", left: -9999, top: 0, width: 794, pointerEvents: "none", opacity: 0 }}>
        <div ref={exportRef}>
          {selectedCo && (
            <ChangeOrderExport
              co={selectedCo}
              client={client}
              originalTotal={contractAmount || undefined}
              newTotal={contractAmount && selectedCo.cost_impact ? contractAmount + selectedCo.cost_impact : undefined}
            />
          )}
        </div>
      </div>
    </>
  );
}
