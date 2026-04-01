import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, Trash2, Save, Hammer, X, ChevronDown, ChevronUp, Loader2, AlertTriangle, MapPin, Pencil } from "lucide-react";
import { clientsAPI, productsAPI, estimateTemplatesAPI, estimatesAPI } from "../utils/api";
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
  unit: string;
  materialCost: number;
  laborCost: number;
  costPerUnit: number; // materialCost + laborCost
  markupPercent: number;
  pricePerUnit: number;
  totalPrice: number;
}

// Will be dynamic once templates are in DB — categories with a template show wizard button
const COMPLEX_CATEGORIES = ["Concrete", "Outdoor Kitchen", "Pergola/Pavilion"];

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

  useEffect(() => {
    productsAPI.getCategories().then(setCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    estimateTemplatesAPI.getAll().then(setTemplates).catch(console.error);
  }, []);

  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardType, setWizardType] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxSource, setTaxSource] = useState<"auto" | "unknown" | "manual">("manual");
  const [taxCounty, setTaxCounty] = useState<string>("");
  const [badOverride, setBadOverride] = useState<number | null>(null);
  const [editingBad, setEditingBad] = useState(false);
  const [badInputValue, setBadInputValue] = useState("");

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
          <Link to="/clients">
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
    } else if (COMPLEX_CATEGORIES.includes(category)) {
      // Legacy fallback for categories without a DB template yet
      setActiveTemplate(null);
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
      const pricePerUnit = product.price_per_unit
        ? product.price_per_unit
        : costPerUnit * (1 + markup / 100);

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
    const newItem: LineItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random()}`,
      totalPrice: item.quantity * item.pricePerUnit,
    };
    setLineItems([...lineItems, newItem]);
  };

  const addLineItemsFromWizard = (items: Omit<LineItem, "id" | "totalPrice">[]) => {
    const newItems = items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random()}`,
      totalPrice: item.quantity * item.pricePerUnit,
    }));
    setLineItems([...lineItems, ...newItems]);
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

  const handleSaveProposal = async () => {
    if (!proposalTitle.trim()) {
      toast.error("Please enter a proposal title");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const subtotalVal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalCostVal = lineItems.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
      const grossProfitVal = subtotalVal - totalCostVal;
      const profitMarginVal = subtotalVal > 0 ? (grossProfitVal / subtotalVal) * 100 : 0;

      const taxableVal = lineItems.reduce((sum, item) => sum + (item.quantity * item.materialCost), 0);
      const taxAmountVal = taxableVal * (taxRate / 100);

      // BAD calc for save
      const badQualifyingVal = lineItems
        .filter((item) => BAD_CATEGORIES.includes(item.category) || item.laborCost > 0)
        .reduce((sum, item) => sum + item.totalPrice, 0);
      const badPriceVal = badQualifyingVal * 0.015 * 1.5;

      const totalVal = subtotalVal + (badPriceVal > 0 ? badPriceVal : 0) + taxAmountVal;

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
        bad_amount: badPriceVal > 0 ? badPriceVal : null,
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
  const categoryProducts = dbProducts.filter(
    (p: any) => p.category?.name === selectedCategory && !COMPLEX_CATEGORIES.includes(selectedCategory)
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
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

      {/* Main Content - Full Width Vertical Layout */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Top Row: Proposal Details + Add Items + Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Proposal Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  placeholder="e.g., Backyard Patio & Outdoor Kitchen"
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                />
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
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

                {selectedCategory && !COMPLEX_CATEGORIES.includes(selectedCategory) && (
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

                {selectedCategory && COMPLEX_CATEGORIES.includes(selectedCategory) && (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <Hammer className="h-4 w-4 inline mr-2" />
                    {wizardType} wizard will guide you through the estimate
                  </div>
                )}
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proposal Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lineItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No items added yet — select a category above to get started
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Product</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-[130px]">Qty</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[110px]">Unit</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-[140px]">Rate ($)</th>
                      <th className="text-right px-6 py-3 font-semibold text-muted-foreground w-[130px]">Total</th>
                      <th className="px-4 py-3 w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedLineItems).map(([category, items]) => (
                      <>
                        {/* Category section header */}
                        <tr key={`cat-${category}`} className="bg-slate-50 border-y border-slate-200">
                          <td colSpan={6} className="px-6 py-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{category}</span>
                          </td>
                        </tr>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-3">
                              <div className="font-medium text-sm">{item.productName}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-center w-24 mx-auto"
                              />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{item.unit}</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                value={item.pricePerUnit}
                                onChange={(e) => updateLineItem(item.id, "pricePerUnit", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm text-right w-32 ml-auto"
                              />
                            </td>
                            <td className="px-6 py-3 text-right font-semibold text-sm">{formatCurrency(item.totalPrice)}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(item.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{wizardType} Estimate Builder</DialogTitle>
            <DialogDescription>
              Follow the steps to build your {wizardType.toLowerCase()} estimate
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}