import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { useParams, Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ArrowLeft, Plus, Trash2, Save, Hammer, X, ChevronDown, ChevronUp, Loader2, AlertTriangle, MapPin, Pencil, FileText, Package, PenLine } from "lucide-react";
import { clientsAPI, productsAPI, estimateTemplatesAPI, estimatesAPI, activityLogAPI } from "../utils/api";
import { TemplateWizard } from "./wizards/template-wizard";
import { ConcreteWizard } from "./wizards/concrete-wizard"; // legacy fallback
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface LineItem {
  id: string;
  category: string;
  productName: string;
  description?: string;
  quantity: number;
  fioQty?: number | null;
  unit: string;
  materialCost: number;
  laborCost: number;
  costPerUnit: number; // materialCost + laborCost
  markupPercent: number;
  pricePerUnit: number;
  totalPrice: number;
}


export function ProposalBuilder() {
  const { clientId } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  useEffect(() => {
    if (clientId) {
      clientsAPI.getById(clientId)
        .then((c) => {
          setClient(c);
          // Auto-lookup tax rate from zip code
          if (c?.zip) {
            supabase
              .from("zip_tax_rates")
              .select("total_rate, county")
              .eq("zip_code", c.zip.trim())
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setTaxRate(data.total_rate);
                  setTaxCounty(data.county);
                  setTaxSource("auto");
                } else {
                  setTaxSource("unknown");
                }
              });
          }
        })
        .catch(console.error)
        .finally(() => setLoadingClient(false));
    }
  }, [clientId]);

  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const loadProducts = () => {
    productsAPI.getCategories().then(setCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    estimateTemplatesAPI.getAll().then(setTemplates).catch(console.error);
  };

  useEffect(() => { loadProducts(); }, []);
  useRealtimeRefetch(loadProducts, ["products", "product_categories", "estimate_templates"], "proposal-builder");

  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [saveTouched, setSaveTouched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Warn before leaving with unsaved line items
  useEffect(() => {
    const isDirty = lineItems.length > 0 || proposalTitle.trim() !== "";
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [lineItems, proposalTitle]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [wizardInputs, setWizardInputs] = useState<Record<string, any>>({});
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxSource, setTaxSource] = useState<"auto" | "unknown" | "manual">("manual");
  const [taxCounty, setTaxCounty] = useState<string>("");
  const [badOverride, setBadOverride] = useState<number | null>(null);
  const [editingBad, setEditingBad] = useState(false);
  const [badInputValue, setBadInputValue] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Custom item form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: "", category: "", qty: 1, unit: "",
    materialCost: 0, laborCost: 0, markup: 0,
  });
  const customCostPerUnit = customItem.materialCost + customItem.laborCost;
  const customPricePerUnit = customCostPerUnit * (1 + customItem.markup / 100);
  const [customValidated, setCustomValidated] = useState(false);

  const resetCustomForm = () => {
    setCustomItem({ name: "", category: "", qty: 1, unit: "", materialCost: 0, laborCost: 0, markup: 0 });
    setCustomValidated(false);
    setShowCustomForm(false);
  };

  const handleAddCustomItem = () => {
    setCustomValidated(true);
    if (!customItem.name.trim() || !customItem.category.trim() || !customItem.unit.trim()) return;
    addLineItem({
      category: customItem.category.trim(),
      productName: customItem.name.trim(),
      description: undefined,
      quantity: customItem.qty || 1,
      unit: customItem.unit.trim(),
      materialCost: customItem.materialCost,
      laborCost: customItem.laborCost,
      costPerUnit: customCostPerUnit,
      markupPercent: customItem.markup,
      pricePerUnit: customPricePerUnit,
    });
    resetCustomForm();
  };

  // Qualifying categories for Base, Aggregate & Disposal
  const BAD_CATEGORIES = ["Concrete", "Pavers", "Retaining Walls", "Sod"];

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Client not found</h2>
          <Link to={`/clients?stage=${client?.status ?? ""}`}>
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedProduct("");

    // Check if a template exists for this category → show wizard
    const template = templates.find((t: any) => t.category === category);
    if (template) {
      setActiveTemplate(template);
      setWizardType(category);
      setShowWizard(true);
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProduct(productId);
    const product = dbProducts.find((p: any) => p.id === productId);

    if (product) {
      const materialCost = product.material_cost ?? 0;
      const laborCost = product.labor_cost ?? 0;
      const markup = product.markup_percentage ?? 0;
      const costPerUnit = materialCost + laborCost;
      const pricePerUnit = costPerUnit * (1 + markup / 100);

      addLineItem({
        category: selectedCategory,
        productName: product.name,
        description: product.description,
        quantity: 1,
        unit: product.unit,
        costPerUnit,
        markupPercent: markup,
        pricePerUnit,
        materialCost,
        laborCost,
      });

      setSelectedCategory("");
      setSelectedProduct("");
          }
  };

  const addLineItem = (item: Omit<LineItem, "id" | "totalPrice">) => {
    const isLabor = ["labor", "installation"].includes((item.category ?? "").toLowerCase());
    const newItem: LineItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random()}`,
      fioQty: item.fioQty ?? (isLabor ? item.quantity : 0),
      totalPrice: item.quantity * item.pricePerUnit,
    };
    setLineItems([...lineItems, newItem]);
  };

  const addLineItemsFromWizard = (items: Omit<LineItem, "id" | "totalPrice">[], formData?: Record<string, any>) => {
    const newItems = items.map((item) => {
      const isLabor = ["labor", "installation"].includes((item.category ?? "").toLowerCase());
      return {
        ...item,
        id: `item-${Date.now()}-${Math.random()}`,
        fioQty: item.fioQty ?? (isLabor ? item.quantity : 0),
        totalPrice: item.quantity * item.pricePerUnit,
      };
    });
    setLineItems([...lineItems, ...newItems]);
    if (formData && wizardType) {
      setWizardInputs((prev) => ({ ...prev, [wizardType]: formData }));
    }
    setShowWizard(false);
    setSelectedCategory("");
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Recalculate total price
          updated.totalPrice = updated.quantity * updated.pricePerUnit;
          return updated;
        }
        return item;
      })
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const titleErr = !proposalTitle.trim() ? "Proposal title is required." : "";
  const itemsErr = lineItems.length === 0 ? "Please add at least one line item." : "";
  const totalErr = lineItems.length > 0 && lineItems.reduce((sum, item) => sum + item.totalPrice, 0) <= 0 ? "Proposal total must be greater than $0." : "";

  const handleSaveProposal = async () => {
    setSaveTouched(true);
    if (titleErr || itemsErr || totalErr) return;
    setSaving(true);
    try {
      const subtotalVal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalCostVal = lineItems.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
      const revenueVal = subtotalVal + (hasBad ? badPrice : 0);
      const grossProfitVal = revenueVal - totalCostVal;
      const profitMarginVal = revenueVal > 0 ? (grossProfitVal / revenueVal) * 100 : 0;

      const taxableVal = lineItems.reduce((sum, item) => sum + (item.quantity * item.materialCost), 0);
      const taxAmountVal = taxableVal * (taxRate / 100);

      // Use badPrice from component scope — respects manual override if set
      const totalVal = subtotalVal + (hasBad ? badPrice : 0) + taxAmountVal;

      const estimate = {
        client_id: clientId,
        title: proposalTitle.trim(),
        description: proposalDescription.trim() || null,
        status: "draft",
        subtotal: subtotalVal,
        tax_amount: taxAmountVal,
        tax_label: taxRate > 0 ? `Sales Tax (${taxRate}% on materials)${taxCounty ? ` — ${taxCounty} County` : ""}` : "Sales Tax",
        total: totalVal,
        total_cost: totalCostVal,
        gross_profit: grossProfitVal,
        profit_margin: profitMarginVal,
        bad_amount: hasBad && badPrice > 0 ? badPrice : null,
        wizard_inputs: Object.keys(wizardInputs).length > 0 ? wizardInputs : undefined,
      };

      const items = lineItems.map((item) => ({
        category: item.category,
        name: item.productName,
        product_name: item.productName,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit,
        material_cost: item.materialCost,
        labor_cost: item.laborCost,
        cost_per_unit: item.costPerUnit,
        markup_percent: item.markupPercent,
        price_per_unit: item.pricePerUnit,
        client_price: item.pricePerUnit,
        total_price: item.totalPrice,
      }));

      const saved = await estimatesAPI.create(estimate, items, []);
      activityLogAPI.create({ client_id: clientId, action_type: "proposal_created", description: `Proposal created: "${proposalTitle.trim()}" — total: $${totalVal.toLocaleString()}` }).catch(() => {});
      toast.success("Proposal saved!");
      navigate(`/proposals/${saved.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Get products for selected category from DB
  const isComplexCategory = (cat: string) => templates.some((t: any) => t.category === cat);
  const categoryProducts = dbProducts.filter(
    (p: any) => p.category?.name === selectedCategory && !isComplexCategory(selectedCategory)
  );

  // Group line items by category
  const groupedLineItems = lineItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);

  // Calculate totals — tax on materials only
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxableMaterials = lineItems.reduce((sum, item) => sum + (item.quantity * item.materialCost), 0);
  const tax = taxableMaterials * (taxRate / 100);

  // Base, Aggregate & Disposal — 1.5% of qualifying scope subtotals, 50% markup
  const badQualifyingSubtotal = lineItems
    .filter((item) => BAD_CATEGORIES.includes(item.category) || item.laborCost > 0)
    .reduce((sum, item) => sum + item.totalPrice, 0);
  const badCost = badQualifyingSubtotal * 0.015;
  const badPriceAuto = badCost * 1.5; // 50% markup
  const badPrice = badOverride !== null ? badOverride : badPriceAuto;
  const hasBad = badPriceAuto > 0;

  const total = subtotal + (hasBad ? badPrice : 0) + tax;

  // Calculate cost (what it costs you)
  const totalCost = lineItems.reduce((sum, item) => sum + (item.quantity * item.costPerUnit), 0);
  const grossProfit = subtotal - totalCost;
  const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

  return (
    <div className="flex flex-col">
      {/* Header — sticky so it stays visible while scrolling */}
      <div className="sticky top-0 z-20 border-b p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/clients/${clientId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">New Proposal</h1>
              <p className="text-sm text-muted-foreground">{`${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim()}</p>
            </div>
          </div>
          <Button onClick={handleSaveProposal} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Save Proposal"}
          </Button>
        </div>
      </div>

      {/* Main Content - no inner scroll, parent main handles it */}
      <div className="p-6">

        {/* Top Row: Proposal Details + Add Items + Metrics */}
        <div className="grid grid-cols-3 gap-5 mb-6">
          {/* Proposal Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g., Backyard Patio & Outdoor Kitchen"
                  value={proposalTitle}
                  onChange={(e) => { setProposalTitle(e.target.value); }}
                  className={saveTouched && titleErr ? "border-red-500" : ""}
                />
                {saveTouched && titleErr && <p className="text-xs text-red-500">{titleErr}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  placeholder="Brief description of the project..."
                  rows={3}
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Items Section */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add Items to Proposal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">1. Select Category</Label>
                  <Select value={selectedCategory} onValueChange={handleCategorySelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => {
                        const hasTemplate = templates.some((t: any) => t.category === cat.name);
                        return (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                            {hasTemplate && <Badge variant="secondary" className="ml-2 text-xs">Wizard</Badge>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory && !isComplexCategory(selectedCategory) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">2. Select Item</Label>
                    <Select value={selectedProduct} onValueChange={handleProductSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an item to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryProducts.length > 0 ? (
                          categoryProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No products available - Add in Admin Portal</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedCategory && isComplexCategory(selectedCategory) && (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <Hammer className="h-4 w-4 inline mr-2" />
                    {wizardType} wizard will guide you through the estimate
                  </div>
                )}

                {/* Divider + Custom Item toggle */}
                <div className="pt-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <div className="flex-1 border-t" />
                    <span>or</span>
                    <div className="flex-1 border-t" />
                  </div>
                  {!showCustomForm ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5"
                      onClick={() => setShowCustomForm(true)}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Custom Item
                    </Button>
                  ) : (
                    <div className="border rounded-lg p-3 space-y-2 bg-amber-50/40 border-amber-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-amber-800">Custom Item</span>
                        <button type="button" onClick={resetCustomForm} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Name + Category */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</Label>
                          <Input
                            placeholder="e.g. Custom Lighting"
                            value={customItem.name}
                            onChange={(e) => setCustomItem((p) => ({ ...p, name: e.target.value }))}
                            className={`h-8 text-xs ${customValidated && !customItem.name.trim() ? "border-red-400" : ""}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category *</Label>
                          <Input
                            placeholder="e.g. Landscaping"
                            value={customItem.category}
                            onChange={(e) => setCustomItem((p) => ({ ...p, category: e.target.value }))}
                            className={`h-8 text-xs ${customValidated && !customItem.category.trim() ? "border-red-400" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Qty + Unit */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
                          <Input
                            type="number" min={0}
                            value={customItem.qty}
                            onChange={(e) => setCustomItem((p) => ({ ...p, qty: parseFloat(e.target.value) || 0 }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit *</Label>
                          <Input
                            placeholder="e.g. SF, LF, EA"
                            value={customItem.unit}
                            onChange={(e) => setCustomItem((p) => ({ ...p, unit: e.target.value }))}
                            className={`h-8 text-xs ${customValidated && !customItem.unit.trim() ? "border-red-400" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Costs */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Material $</Label>
                          <Input
                            type="number" min={0} step={0.01}
                            value={customItem.materialCost}
                            onChange={(e) => setCustomItem((p) => ({ ...p, materialCost: parseFloat(e.target.value) || 0 }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Labor $</Label>
                          <Input
                            type="number" min={0} step={0.01}
                            value={customItem.laborCost}
                            onChange={(e) => setCustomItem((p) => ({ ...p, laborCost: parseFloat(e.target.value) || 0 }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Markup %</Label>
                          <Input
                            type="number" min={0} step={1}
                            value={customItem.markup}
                            onChange={(e) => setCustomItem((p) => ({ ...p, markup: parseFloat(e.target.value) || 0 }))}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {/* Live price preview */}
                      {customCostPerUnit > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-amber-200">
                          <span>Price / unit</span>
                          <span className="font-semibold text-foreground">{formatCurrency(customPricePerUnit)}</span>
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        className="w-full h-8 text-xs mt-1"
                        onClick={handleAddCustomItem}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add to Proposal
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Internal Metrics */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Internal Metrics (Admin Only)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total Cost</div>
                  <div className="font-semibold">{formatCurrency(totalCost)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gross Profit</div>
                  <div className="font-semibold text-green-600">{formatCurrency(grossProfit)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Margin</div>
                  <div className="font-semibold">{profitMargin.toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full-Width Line Items Table */}
        <Card className={saveTouched && (itemsErr || totalErr) ? "border-red-500" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proposal Line Items</CardTitle>
          </CardHeader>
          {saveTouched && (itemsErr || totalErr) && (
            <div className="px-6 pb-2">
              <p className="text-xs text-red-500">{itemsErr || totalErr}</p>
            </div>
          )}
          <CardContent className="p-0">
            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No items added yet</p>
                <p className="text-xs mt-1">Select a category above to add products to this proposal.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Product</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-[110px]">FIO Qty</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-[130px]">Qty</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[110px]">Unit</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-[140px]">Rate ($)</th>
                      <th className="text-right px-6 py-3 font-semibold text-muted-foreground w-[130px]">Total</th>
                      <th className="px-2 py-3 w-[40px]"></th>
                      <th className="px-2 py-3 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedLineItems).map(([category, items]) => (
                      <>
                        {/* Category section header */}
                        <tr key={`cat-${category}`} className="bg-slate-100/80 border-y border-slate-200">
                          <td colSpan={8} className="px-6 py-2.5">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{category}</span>
                          </td>
                        </tr>
                        {items.map((item) => {
                          const isExpanded = expandedRows.has(item.id);
                          return (
                            <>
                              <tr key={item.id} className="border-b border-slate-100 hover:bg-primary/5 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-sm">{item.productName}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</div>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <Input
                                    type="number"
                                    value={item.fioQty ?? 0}
                                    onChange={(e) => updateLineItem(item.id, "fioQty" as any, parseFloat(e.target.value) || null)}
                                    className="h-9 text-sm text-center w-20 mx-auto"
                                  />
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                                    className="h-9 text-sm text-center w-24 mx-auto"
                                  />
                                </td>
                                <td className="px-4 py-4 text-muted-foreground text-sm font-medium">{item.unit}</td>
                                <td className="px-4 py-4">
                                  <Input
                                    type="number"
                                    value={item.pricePerUnit}
                                    onChange={(e) => updateLineItem(item.id, "pricePerUnit", parseFloat(e.target.value) || 0)}
                                    className="h-9 text-sm text-right w-32 ml-auto"
                                  />
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-sm">{formatCurrency(item.totalPrice)}</td>
                                <td className="px-2 py-4 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground"
                                    onClick={() => setExpandedRows((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                      return next;
                                    })}
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </td>
                                <td className="px-2 py-4 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeLineItem(item.id)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${item.id}-exp`} className="bg-muted/30 border-b border-slate-100">
                                  <td colSpan={8} className="pr-[100px] pl-6 py-3">
                                    <div className="flex items-center justify-end gap-8 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-medium uppercase tracking-wide">Crew Cost/Unit</span>
                                        <span className="font-semibold">{formatCurrency(item.laborCost)}</span>
                                      </div>
                                      <div className="h-3 w-px bg-border" />
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-medium uppercase tracking-wide">Material/Unit</span>
                                        <span className="font-semibold">{formatCurrency(item.materialCost)}</span>
                                      </div>
                                      <div className="h-3 w-px bg-border" />
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-medium uppercase tracking-wide">Cost/Unit</span>
                                        <span className="font-semibold">{formatCurrency(item.costPerUnit)}</span>
                                      </div>
                                      <div className="h-3 w-px bg-border" />
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-medium uppercase tracking-wide">Markup</span>
                                        <span className="font-semibold text-amber-600">{item.markupPercent}%</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        {lineItems.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="w-[520px] bg-white border rounded-lg p-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>

                {/* Base, Aggregate & Disposal */}
                {hasBad && (
                  <div className="flex justify-between text-sm items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Base, Aggregate & Disposal</span>
                      {badOverride === null
                        ? <Badge variant="secondary" className="text-xs px-1.5 py-0">auto</Badge>
                        : <Badge variant="outline" className="text-xs px-1.5 py-0 text-orange-600 border-orange-400">manual</Badge>
                      }
                    </div>
                    <div className="flex items-center gap-1.5">
                      {editingBad ? (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 border rounded px-1 py-0.5 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            value={badInputValue}
                            onChange={(e) => setBadInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseFloat(badInputValue);
                                if (!isNaN(val) && val >= 0) setBadOverride(val);
                                else setBadOverride(null);
                                setEditingBad(false);
                              }
                              if (e.key === "Escape") {
                                setEditingBad(false);
                                setBadInputValue(badPrice.toFixed(2));
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                            onClick={() => {
                              const val = parseFloat(badInputValue);
                              if (!isNaN(val) && val >= 0) setBadOverride(val);
                              else setBadOverride(null);
                              setEditingBad(false);
                            }}
                          >✓</button>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingBad(false);
                              setBadInputValue(badPrice.toFixed(2));
                            }}
                          >✕</button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold">{formatCurrency(badPrice)}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Override BAD amount"
                            onClick={() => {
                              setBadInputValue(badPrice.toFixed(2));
                              setEditingBad(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {badOverride !== null && (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                              title="Reset to auto"
                              onClick={() => {
                                setBadOverride(null);
                                setBadInputValue("");
                              }}
                            >↩</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Tax */}
                <div className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-foreground">Sales Tax (materials)</span>
                      {taxSource === "auto" && taxCounty && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {taxCounty}
                        </Badge>
                      )}
                      {taxSource === "unknown" && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Unknown zip
                        </Badge>
                      )}
                    </div>
                    <span className="font-semibold">{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-muted-foreground">Rate:</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={taxRate}
                      onChange={(e) => { setTaxRate(parseFloat(e.target.value) || 0); setTaxSource("manual"); }}
                      className="h-6 w-16 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>

                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-green-600">{formatCurrency(total)}</span>
                </div>

                {/* Internal GP summary — not visible to client */}
                <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Internal — Not Client Facing</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pre-Markup Cost</span>
                    <span className="font-semibold">{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected GP $</span>
                    <span className="font-semibold text-green-700">{formatCurrency(grossProfit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected GP %</span>
                    <span className="font-semibold text-green-700">{profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={(open) => { setShowWizard(open); if (!open) { setSelectedCategory(""); setActiveTemplate(null); } }}>
        <DialogContent className="max-w-[900px] w-[92vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 bg-white border-b px-8 py-6 rounded-t-lg">
            <DialogTitle className="text-xl font-bold">{wizardType} Estimate Wizard</DialogTitle>
            <DialogDescription className="text-sm">
              Answer each question below — your estimate items will be calculated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTemplate ? (
            <TemplateWizard
              template={activeTemplate}
              dbProducts={dbProducts}
              onComplete={addLineItemsFromWizard}
              onCancel={() => {
                setShowWizard(false);
                setSelectedCategory("");
                setActiveTemplate(null);
              }}
            />
          ) : wizardType === "Concrete" ? (
            // Legacy fallback — replaced once Concrete template is confirmed in DB
            <ConcreteWizard
              onComplete={addLineItemsFromWizard}
              onCancel={() => {
                setShowWizard(false);
                setSelectedCategory("");
              }}
            />
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}