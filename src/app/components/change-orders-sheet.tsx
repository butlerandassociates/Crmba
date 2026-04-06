import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronLeft, Loader2, ClipboardEdit, Save, Send, Download, FileText, GitMerge, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { changeOrdersAPI } from "../api/change-orders";
import { estimatesAPI } from "../api/estimates";
import { toast } from "sonner";

interface ChangeOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSave?: () => void;
}

type View = "list" | "create" | "detail";

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

  // Form state
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [timelineImpact, setTimelineImpact] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM, id: "1" }]);

  const loadCOs = async () => {
    if (!client?.id) return;
    setLoading(true);
    try {
      const data = await changeOrdersAPI.getByClient(client.id);
      setCos(data);
    } catch {
      toast.error("Failed to load change orders");
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
      // non-fatal — banner just won't show
    }
  };

  useEffect(() => {
    if (open) {
      setView("list");
      loadCOs();
      loadAcceptedProposal();
    }
  }, [open, client?.id]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setTitle("");
    setReason("");
    setTimelineImpact("");
    setItems([{ ...EMPTY_ITEM, id: "1" }]);
    setErrors({});
  };

  const handleCreate = async (sendToClient = false) => {
    const newErrors: Record<string, string> = {};

    if (!title.trim())
      newErrors.title = "Title is required";
    if (!reason.trim())
      newErrors.reason = "Reason for change is required";
    if (sendToClient && !items.some((i) => i.description.trim()))
      newErrors.items = "At least one line item is required before sending to client";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

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
      toast.error("Failed to update status");
    }
  };

  const handleMerge = async () => {
    if (!selectedCo) return;
    setMerging(true);
    try {
      const { newEstimateTotal } = await changeOrdersAPI.mergeApproved(selectedCo, client.id);
      toast.success(`Merged into proposal. New contract total: ${formatCurrency(newEstimateTotal)}`);
      const merged = { ...selectedCo, status: "merged" };
      setCos((prev) => prev.map((c) => c.id === selectedCo.id ? merged : c));
      setSelectedCo(merged);
      loadAcceptedProposal();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge change order");
    } finally {
      setMerging(false);
    }
  };

  const addItem = () =>
    setItems((prev) => [...prev, { ...EMPTY_ITEM, id: Date.now().toString() }]);
  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((item) => item.id !== id));
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

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const canSend = title.trim() && reason.trim() && items.some((i) => i.description.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            {view !== "list" && (
              <button
                onClick={() => { setView("list"); setSelectedCo(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">
                {view === "list" ? "Change Orders" : view === "create" ? "New Change Order" : selectedCo?.title}
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
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Change Order
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cos.length === 0 ? (
                <div className="text-center py-16">
                  <ClipboardEdit className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">No change orders yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first change order for this project</p>
                  <Button size="sm" className="mt-4" onClick={() => { resetForm(); setView("create"); }}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create First Change Order
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {cos.map((co) => {
                    const cfg = STATUS_CONFIG[co.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
                    return (
                      <button
                        key={co.id}
                        className="w-full text-left border rounded-lg p-4 hover:bg-accent/40 transition-colors"
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
                          <div className={`text-sm font-bold shrink-0 ${(co.cost_impact || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {(co.cost_impact || 0) >= 0 ? "+" : ""}{formatCurrency(co.cost_impact || 0)}
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

              {/* Card 1: Change Order Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Change Order Details</CardTitle>
                </CardHeader>
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

              {/* Card 2: Cost Breakdown */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Cost Breakdown</CardTitle>
                    <Button variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
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
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total</Label>
                          <div className="px-3 py-2 border rounded-md bg-white font-semibold text-sm">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total Cost Impact */}
                  <div className="border-t pt-4 mt-2">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                      <span className="font-semibold text-lg">Total Cost Impact:</span>
                      <span className={`text-2xl font-bold ${totalCostImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {totalCostImpact >= 0 ? "+" : ""}${totalCostImpact.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Contract Update Banner */}
                  {contractAmount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        <strong>Contract Update:</strong> Original contract amount of{" "}
                        <strong>{formatCurrency(contractAmount)}</strong> will become{" "}
                        <strong>{formatCurrency(newContractAmount)}</strong>{" "}
                        if approved by client.
                      </p>
                    </div>
                  )}
                  {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                </CardContent>
              </Card>

              {/* Card 3: Submit Change Order */}
              <Card>
                <CardHeader>
                  <CardTitle>Submit Change Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to send this change order to the client for approval:
                  </p>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      disabled={saving || !title.trim() || !reason.trim()}
                      onClick={() => handleCreate(false)}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save as Draft
                      <span className="ml-auto text-xs text-muted-foreground">Save for later without sending</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      disabled={saving || !title.trim() || !reason.trim()}
                      onClick={() => toast.info("PDF export will be available soon")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export as PDF Proposal
                      <span className="ml-auto text-xs text-muted-foreground">Print or email manually</span>
                    </Button>

                    <Button
                      className="w-full justify-start bg-black hover:bg-gray-800"
                      disabled={saving || !canSend}
                      onClick={() => handleCreate(true)}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send to Client Portal
                      <span className="ml-auto text-xs text-gray-300">Client receives text/email notification</span>
                    </Button>
                  </div>

                  {!canSend && (
                    <p className="text-xs text-destructive">* Please fill in all required fields before sending to client</p>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {view === "detail" && selectedCo && (
            <div className="p-6 space-y-5">
              {/* Status buttons — merged is set via the Merge button, not manually */}
              <div className="flex flex-wrap gap-2">
                {(["draft", "pending_client", "approved", "rejected"] as const).filter(() => selectedCo.status !== "merged").map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const active = selectedCo.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(selectedCo.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                        active ? `${cfg.className} border-transparent` : "bg-background text-muted-foreground border-border hover:bg-accent"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
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
                        <div className="col-span-3 text-right text-xs text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
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

              {/* Contract Update info on detail */}
              {contractAmount > 0 && selectedCo.cost_impact != null && selectedCo.status !== "merged" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Contract Update:</strong> Original contract amount of{" "}
                    <strong>{formatCurrency(contractAmount)}</strong> will become{" "}
                    <strong>{formatCurrency(contractAmount + (selectedCo.cost_impact || 0))}</strong>{" "}
                    if approved by client.
                  </p>
                </div>
              )}

              {/* Merge into Proposal — only shown when approved and not yet merged */}
              {selectedCo.status === "approved" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-green-800">Ready to Merge</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      This will add the line items to the approved proposal and update the contract total by{" "}
                      <strong>{(selectedCo.cost_impact || 0) >= 0 ? "+" : ""}{formatCurrency(selectedCo.cost_impact || 0)}</strong>.
                    </p>
                  </div>
                  <Button
                    className="w-full bg-green-700 hover:bg-green-800 text-white"
                    onClick={handleMerge}
                    disabled={merging}
                  >
                    {merging
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <GitMerge className="h-4 w-4 mr-2" />}
                    Merge into Proposal
                  </Button>
                </div>
              )}

              {/* Merged confirmation */}
              {selectedCo.status === "merged" && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
                  <Check className="h-4 w-4 text-purple-600 shrink-0" />
                  <p className="text-sm text-purple-800">
                    This change order has been merged into the approved proposal. The contract total has been updated.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">Created {formatDate(selectedCo.created_at)}</p>
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
}
