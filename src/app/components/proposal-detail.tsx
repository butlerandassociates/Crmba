import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
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
} from "lucide-react";
import { estimatesAPI, clientsAPI, productsAPI, estimateTemplatesAPI } from "../utils/api";
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

export function ProposalDetail() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
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

  // Item picker
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState("");
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);

  // Wizard edit
  const [templates, setTemplates] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardCategory, setWizardCategory] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const COMPLEX_CATEGORIES = ["Concrete"];

  useEffect(() => {
    productsAPI.getCategories().then(setDbCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    estimateTemplatesAPI.getAll().then(setTemplates).catch(console.error);
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

  const computedSubtotal = editLineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) * Number(item.client_price)),
    0
  );
  const computedTotal = computedSubtotal + (proposal?.tax_amount ?? 0);

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
    // Delete old items for this category from DB
    const oldIds = editLineItems
      .filter((li) => li.category === wizardCategory && !li.id?.startsWith("new-"))
      .map((li) => li.id);
    if (oldIds.length > 0) {
      await supabase.from("estimate_line_items").delete().in("id", oldIds);
    }
    // Insert new items
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
      markup_percentage: item.markupPercent ?? 0,
      client_price: item.pricePerUnit ?? 0,
      total_price: (item.quantity ?? 0) * (item.pricePerUnit ?? 0),
      sort_order: i,
    }));
    const { data: inserted } = await supabase
      .from("estimate_line_items")
      .insert(newRows)
      .select();
    // Update local state — remove old, add new
    setEditLineItems((prev) => [
      ...prev.filter((li) => li.category !== wizardCategory),
      ...(inserted ?? newRows.map((r, i) => ({ ...r, id: `new-${Date.now()}-${i}` }))),
    ]);
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
      });
      await Promise.all(
        editLineItems.map((item) =>
          item.id?.startsWith("new-")
            ? Promise.resolve()
            : supabase.from("estimate_line_items").update({
                product_name: item.product_name ?? item.name,
                unit: item.unit ?? "",
                quantity: item.quantity,
                client_price: Number(item.client_price),
                total_price: Number(item.quantity) * Number(item.client_price),
              }).eq("id", item.id)
        )
      );
      setProposal((p: any) => ({
        ...p,
        title: editTitle,
        description: editDescription,
        subtotal: computedSubtotal,
        total: computedTotal,
        line_items: editLineItems,
      }));
      toast.success("Proposal saved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Proposal not found</h2>
          <Link to="/clients">
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
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDownload = () => {
    const exportElement = document.getElementById("proposal-export-content");
    if (!exportElement) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Estimate #${proposal.estimate_number} - ${proposal.title}</title>
            <style>
              * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
              body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #111; background: #fff; }
              img { max-width: 100%; }
              table { border-collapse: collapse; }
              @page { margin: 0; size: letter portrait; }
              @media print {
                body { padding: 0.4in; }
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            <div id="proposal-content"></div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.getElementById("proposal-content")!.innerHTML = exportElement.innerHTML;
      printWindow.document.close();
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
    if (!emailTo) return;
    setSendingEmail(true);
    try {
      const proposalLink = `${window.location.origin}/p/${proposal.id}`;
      const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#111;padding:20px 24px;border-radius:8px 8px 0 0;">
            <p style="color:#fff;font-weight:700;font-size:16px;margin:0;">Butler & Associates Construction</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <p style="color:#374151;white-space:pre-line;">${emailMessage}</p>
            <div style="margin:28px 0;text-align:center;">
              <a href="${proposalLink}" style="background:#111;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
                View Proposal
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;">This proposal is valid for 30 days. Questions? Reply to this email or call us directly.</p>
          </div>
        </div>
      `;
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: emailTo, subject: emailSubject, html, from_name: "Butler & Associates Construction" },
      });
      if (error) throw error;
      await estimatesAPI.updateStatus(proposal.id, "sent");
      setProposal({ ...proposal, status: "sent", sent_at: new Date().toISOString() });
      setShowEmailDialog(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/clients/${proposal.client_id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Client
            </Button>
          </Link>
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
              <DropdownMenuItem onClick={handleEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Email to Client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
            return Object.entries(groups).map(([cat, groupItems]) => {
              const hasWizard = templates.some((t: any) => t.category === cat) || COMPLEX_CATEGORIES.includes(cat);
              return (
                <div key={cat} className="border-b last:border-0">
                  {/* Category header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{cat}</span>
                    {hasWizard && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleWizardEdit(cat)}>
                        <Wand2 className="h-3.5 w-3.5" />
                        Edit in Wizard
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-muted/20">
                        <tr>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Item</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Qty</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Unit</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Price/Unit</th>
                          <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {groupItems.map((item: any) => {
                          const idx = item._idx;
                          return (
                            <tr key={item.id} className="hover:bg-accent/50">
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
                                <Button variant="ghost" size="sm" onClick={() => setEditLineItems((prev) => prev.filter((_, i) => i !== idx))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()}

          {/* Totals */}
          <div className="border-t p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatCurrency(computedSubtotal)}</span>
            </div>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>Select a category then choose a product</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden border-t">
            {/* Categories */}
            <div className="w-48 shrink-0 overflow-y-auto border-r p-2 space-y-1">
              {dbCategories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setPickerCategory(cat.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    pickerCategory === cat.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!pickerCategory && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Select a category
                </div>
              )}
              {pickerCategory && (() => {
                const products = dbProducts.filter((p: any) => p.category?.name === pickerCategory);
                if (products.length === 0) return (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No products in this category
                  </div>
                );
                return products.map((product: any) => {
                  const cost = (product.material_cost ?? 0) + (product.labor_cost ?? 0);
                  const price = (Number(product.price_per_unit) > 0)
                    ? Number(product.price_per_unit)
                    : cost * (1 + (product.markup_percentage ?? 0) / 100);
                  const formatC = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
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
                          total_price: price,
                        }]);
                        setShowItemPicker(false);
                        setPickerCategory("");
                      }}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{product.name}</span>
                        <span className="text-sm font-semibold">{formatC(price)}<span className="text-xs text-muted-foreground font-normal">/{product.unit}</span></span>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{product.description}</p>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard Edit Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Edit {wizardCategory} — Wizard
            </DialogTitle>
            <DialogDescription>
              Complete the wizard to replace the existing {wizardCategory} line items
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {showWizard && (
              activeTemplate ? (
                <TemplateWizard
                  template={activeTemplate}
                  dbProducts={dbProducts}
                  onComplete={handleWizardComplete}
                  onCancel={() => setShowWizard(false)}
                  initialData={proposal?.wizard_inputs?.[wizardCategory] ?? undefined}
                />
              ) : COMPLEX_CATEGORIES.includes(wizardCategory) ? (
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
        <DialogContent className="max-w-[99vw] w-[99vw] h-[99vh] p-0 overflow-hidden flex flex-col gap-0 [&>button:last-child]:hidden">
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
              >
                <Download className="h-3 w-3 mr-1" />
                Download PDF
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
          <div className="flex-1 overflow-y-auto bg-[#525659]">
            {/* White document — centered in dark PDF viewer chrome */}
            <div className="py-8 px-4 flex justify-center">
              <div className="bg-white shadow-2xl w-full" style={{ maxWidth: 1050 }}>
                <ProposalExport proposal={proposal} client={client} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Proposal</DialogTitle>
            <DialogDescription>
              Send this proposal directly to {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} rows={6} />
            </div>
            <p className="text-xs text-muted-foreground">A "View Proposal" button linking to the proposal page will be included automatically.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailTo}>
              {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden export content for download */}
      <div className="hidden">
        <div id="proposal-export-content">
          <ProposalExport proposal={proposal} client={client} />
        </div>
      </div>
    </div>
  );
}
