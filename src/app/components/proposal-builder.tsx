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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ArrowLeft, Plus, Trash2, Save, Hammer, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { clientsAPI, productsAPI, estimateTemplatesAPI, estimatesAPI } from "../utils/api";
import { TemplateWizard } from "./wizards/template-wizard";
import { ConcreteWizard } from "./wizards/concrete-wizard"; // legacy fallback
import { toast } from "sonner";

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
        .then(setClient)
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
      addLineItem({
        category: selectedCategory,
        productName: product.name,
        description: product.description,
        quantity: 1,
        unit: product.unit,
        costPerUnit: (product.material_cost ?? 0) + (product.labor_cost ?? 0),
        markupPercent: product.markup_percentage ?? 0,
        pricePerUnit: product.price_per_unit ?? 0,
        materialCost: product.material_cost ?? 0,
        laborCost: product.labor_cost ?? 0,
      });
      
      // Reset selections
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

      const estimate = {
        client_id: clientId,
        title: proposalTitle.trim(),
        description: proposalDescription.trim() || null,
        status: "draft",
        subtotal: subtotalVal,
        total: subtotalVal,
        total_cost: totalCostVal,
        gross_profit: grossProfitVal,
        profit_margin: profitMarginVal,
      };

      const items = lineItems.map((item) => ({
        category: item.category,
        product_name: item.productName,
        description: item.description || null,
        quantity: item.quantity,
        unit: item.unit,
        material_cost: item.materialCost,
        labor_cost: item.laborCost,
        cost_per_unit: item.costPerUnit,
        markup_percent: item.markupPercent,
        price_per_unit: item.pricePerUnit,
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

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

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

      {/* Main Content - Horizontal Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Proposal Details & Builder */}
        <div className="flex-1 p-4 overflow-y-auto border-r">
          <div className="space-y-4 max-w-3xl">
            {/* Proposal Info */}
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
                    rows={2}
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
                  {/* Step 1: Select Category */}
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
                              {hasTemplate && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Wizard
                                </Badge>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Select Product (only for simple categories) */}
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
                                <div className="flex items-center justify-between w-full">
                                  <span>{product.name}</span>
                                  <span className="text-xs text-muted-foreground ml-4">
                                    {formatCurrency(product.pricePerUnit)}/{product.unit}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No products available - Add in Admin Portal
                            </SelectItem>
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

            {/* Quick Stats (Admin Only) */}
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
        </div>

        {/* Right Side - Line Items & Totals */}
        <div className="w-[550px] flex flex-col bg-muted/20">
          {/* Line Items */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Proposal Line Items</h3>
                {lineItems.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No items added yet
                  </div>
                )}
              </div>

              {Object.entries(groupedLineItems).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {category}
                    </Badge>
                    <Separator className="flex-1" />
                  </div>

                  {items.map((item) => (
                    <Card key={item.id} className="bg-white">
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.productName}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <Label className="text-xs text-muted-foreground">Qty</Label>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Unit</Label>
                              <div className="h-7 flex items-center text-xs">{item.unit}</div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Rate</Label>
                              <Input
                                type="number"
                                value={item.pricePerUnit}
                                onChange={(e) =>
                                  updateLineItem(item.id, "pricePerUnit", parseFloat(e.target.value) || 0)
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t">
                            <span className="text-xs text-muted-foreground">Total:</span>
                            <span className="font-semibold text-sm">
                              {formatCurrency(item.totalPrice)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Footer */}
          {lineItems.length > 0 && (
            <div className="border-t p-4 bg-white">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="font-semibold">{formatCurrency(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-green-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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