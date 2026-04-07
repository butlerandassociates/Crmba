import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
// OLD: imported from mock data — replaced with DB
// import { products } from "../../data/estimate-templates";
import { productsAPI } from "../../utils/api";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const emptyForm = {
  name: "",
  category_id: "",
  unit: "",
  materialCost: "",
  laborCost: "",
  markupPercent: "50",
  description: "",
  salesTaxApplicable: false,
  additionalCosts: "",
};

export function ProductManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState(emptyForm);

  // DB state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [addTouched, setAddTouched] = useState(false);
  const [editTouched, setEditTouched] = useState(false);

  useEffect(() => {
    supabase.from("units").select("name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setUnits((data ?? []).map((u: any) => u.name)));

    Promise.all([productsAPI.getAll(), productsAPI.getCategories()])
      .then(([prods, cats]) => {
        setAllProducts(prods || []);
        setCategories(cats || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useRealtimeRefetch(
    () => { Promise.all([productsAPI.getAll(), productsAPI.getCategories()]).then(([prods, cats]) => { setAllProducts(prods || []); setCategories(cats || []); }).catch(console.error); },
    ["products", "product_categories"],
    "product-manager"
  );

  const filteredProducts = allProducts.filter((product) => {
    const catName = product.category?.name ?? "";
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      catName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const calcPrice = (materialCost: number, laborCost: number, markup: number, salesTax: boolean, additional: number) => {
    const matWithTax = salesTax ? materialCost * 1.09 : materialCost;
    const totalCost = matWithTax + laborCost + additional;
    return totalCost * (1 + markup / 100);
  };

  const calculatePrice = () => {
    const materialCost = parseFloat(newProduct.materialCost) || 0;
    const laborCost = parseFloat(newProduct.laborCost) || 0;
    const markup = parseFloat(newProduct.markupPercent) || 0;
    const additionalCosts = parseFloat(newProduct.additionalCosts) || 0;
    return calcPrice(materialCost, laborCost, markup, newProduct.salesTaxApplicable, additionalCosts);
  };

  const getProductPrice = (p: any) => {
    const cost = Number(p.material_cost) + Number(p.labor_cost);
    return cost * (1 + Number(p.markup_percentage) / 100);
  };

  const addNameErr     = !newProduct.name.trim() ? "Product name is required." : newProduct.name.trim().length < 2 ? "Min 2 characters." : "";
  const addCategoryErr = !newProduct.category_id ? "Category is required." : "";
  const addUnitErr     = !newProduct.unit ? "Unit is required." : "";

  const editNameErr     = !editingProduct?.name?.trim() ? "Product name is required." : editingProduct?.name?.trim().length < 2 ? "Min 2 characters." : "";
  const editCategoryErr = !editingProduct?.category_id ? "Category is required." : "";
  const editUnitErr     = !editingProduct?.unit ? "Unit is required." : "";

  const handleAddProduct = async () => {
    setAddTouched(true);
    if (addNameErr || addCategoryErr || addUnitErr) return;
    try {
      setSaving(true);
      const newMaterial = parseFloat(newProduct.materialCost) || 0;
      const newLabor    = parseFloat(newProduct.laborCost) || 0;
      const newMarkup   = parseFloat(newProduct.markupPercent) || 0;
      await productsAPI.save({
        name: newProduct.name,
        category_id: newProduct.category_id,
        unit: newProduct.unit,
        material_cost: newMaterial,
        labor_cost: newLabor,
        markup_percentage: newMarkup,
        price_per_unit: (newMaterial + newLabor) * (1 + newMarkup / 100),
        sales_tax_rate: newProduct.salesTaxApplicable ? 9 : null,
        description: newProduct.description || null,
        is_active: true,
      });
      // Re-fetch to get joined category object
      const refreshed = await productsAPI.getAll();
      setAllProducts(refreshed || []);
      setShowAddDialog(false);
      setNewProduct(emptyForm);
      setAddTouched(false);
      toast.success("Product added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({
      ...product,
      materialCost: String(product.material_cost ?? ""),
      laborCost: String(product.labor_cost ?? ""),
      markupPercent: String(product.markup_percentage ?? ""),
      category_id: product.category_id ?? "",
      salesTaxApplicable: product.sales_tax_rate != null,
      additionalCosts: "",
    });
  };

  const handleSaveEdit = async () => {
    setEditTouched(true);
    if (editNameErr || editCategoryErr || editUnitErr) return;
    if (!editingProduct) return;
    try {
      setSaving(true);
      const editMaterial = parseFloat(editingProduct.materialCost) || 0;
      const editLabor    = parseFloat(editingProduct.laborCost) || 0;
      const editMarkup   = parseFloat(editingProduct.markupPercent) || 0;
      await productsAPI.save({
        id: editingProduct.id,
        name: editingProduct.name,
        category_id: editingProduct.category_id,
        unit: editingProduct.unit,
        material_cost: editMaterial,
        labor_cost: editLabor,
        markup_percentage: editMarkup,
        price_per_unit: (editMaterial + editLabor) * (1 + editMarkup / 100),
        sales_tax_rate: editingProduct.salesTaxApplicable ? 9 : null,
        description: editingProduct.description || null,
      });
      const refreshed = await productsAPI.getAll();
      setAllProducts(refreshed || []);
      setEditingProduct(null);
      setEditTouched(false);
      toast.success("Product updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await productsAPI.archive(id);
      setAllProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Product & Pricing Manager</h2>
          <p className="text-sm text-muted-foreground">
            Manage all products, materials, and pricing
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setNewProduct(emptyForm); setAddTouched(false); } }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add a new product, material, or service to your catalog
              </DialogDescription>
            </DialogHeader>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 thin-scroll">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Product Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., Concrete Mix (3000 PSI)"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className={addTouched && addNameErr ? "border-red-500" : ""}
                  />
                  {addTouched && addNameErr && <p className="text-xs text-red-500">{addNameErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={newProduct.category_id}
                    onValueChange={(value) => setNewProduct({ ...newProduct, category_id: value })}
                  >
                    <SelectTrigger className={addTouched && addCategoryErr ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addTouched && addCategoryErr && <p className="text-xs text-red-500">{addCategoryErr}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Unit <span className="text-destructive">*</span></Label>
                  <Select
                    value={newProduct.unit}
                    onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}
                  >
                    <SelectTrigger className={addTouched && addUnitErr ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addTouched && addUnitErr && <p className="text-xs text-red-500">{addUnitErr}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Material Cost (per unit) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="125.00"
                    value={newProduct.materialCost}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, materialCost: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Labor Cost (per unit)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="50.00"
                    value={newProduct.laborCost}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, laborCost: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Markup %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="30"
                    value={newProduct.markupPercent}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, markupPercent: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Costs (Optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProduct.additionalCosts}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, additionalCosts: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Any other fees or costs</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id="salesTax"
                  checked={newProduct.salesTaxApplicable}
                  onCheckedChange={(checked) =>
                    setNewProduct({ ...newProduct, salesTaxApplicable: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="salesTax" className="cursor-pointer font-medium">
                    Sales Tax Applicable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Adds 9% sales tax to material cost only (not labor)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Additional details about this product..."
                  rows={2}
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, description: e.target.value })
                  }
                />
              </div>

              {newProduct.materialCost && newProduct.markupPercent && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Material Cost</div>
                      <div className="font-semibold">
                        {formatCurrency(parseFloat(newProduct.materialCost) || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Labor Cost</div>
                      <div className="font-semibold">
                        {formatCurrency(parseFloat(newProduct.laborCost) || 0)}
                      </div>
                    </div>
                    {newProduct.additionalCosts && (
                      <div>
                        <div className="text-xs text-muted-foreground">Additional</div>
                        <div className="font-semibold">
                          {formatCurrency(parseFloat(newProduct.additionalCosts) || 0)}
                        </div>
                      </div>
                    )}
                    {newProduct.salesTaxApplicable && (
                      <div>
                        <div className="text-xs text-muted-foreground">Sales Tax (9%)</div>
                        <div className="font-semibold">
                          {formatCurrency((parseFloat(newProduct.materialCost) || 0) * 0.09)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Price ({newProduct.markupPercent}% markup)</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(calculatePrice())}
                      </div>
                      <div className="text-xs text-muted-foreground">per {newProduct.unit || 'unit'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Profit Per Unit</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(calculatePrice() - (
                          (parseFloat(newProduct.materialCost) || 0) * (newProduct.salesTaxApplicable ? 1.09 : 1) +
                          (parseFloat(newProduct.laborCost) || 0) +
                          (parseFloat(newProduct.additionalCosts) || 0)
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
            {/* Fixed footer */}
            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Product
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Product
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Category
                  </th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase">
                    Unit
                  </th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                    Cost
                  </th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase">
                    Markup
                  </th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                    Price
                  </th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                    Profit/Unit
                  </th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((product) => {
                  const cost = Number(product.material_cost) + Number(product.labor_cost);
                  const price = getProductPrice(product);
                  const profit = price - cost;
                  return (
                    <tr key={product.id} className="hover:bg-accent/50">
                      <td className="p-3">
                        <div className="font-medium text-sm">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground">
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {product.category?.name ?? "—"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-sm text-muted-foreground">
                          {product.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(cost)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {product.markup_percentage}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(price)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(profit)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{allProducts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Set(allProducts.map((p) => p.category_id).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Avg Markup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {allProducts.length > 0
                ? (allProducts.reduce((sum, p) => sum + Number(p.markup_percentage), 0) / allProducts.length).toFixed(0)
                : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Filtered Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredProducts.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Product Dialog */}
      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) { setEditingProduct(null); setEditTouched(false); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update product details, pricing, and settings
              </DialogDescription>
            </DialogHeader>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 thin-scroll">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Product Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., Concrete Mix (3000 PSI)"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className={editTouched && editNameErr ? "border-red-500" : ""}
                  />
                  {editTouched && editNameErr && <p className="text-xs text-red-500">{editNameErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select
                    value={editingProduct.category_id}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, category_id: value })}
                  >
                    <SelectTrigger className={editTouched && editCategoryErr ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editTouched && editCategoryErr && <p className="text-xs text-red-500">{editCategoryErr}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Unit <span className="text-destructive">*</span></Label>
                  <Select
                    value={editingProduct.unit}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, unit: value })}
                  >
                    <SelectTrigger className={editTouched && editUnitErr ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editTouched && editUnitErr && <p className="text-xs text-red-500">{editUnitErr}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Material Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.materialCost}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, materialCost: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Labor Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.laborCost}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, laborCost: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Markup %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.markupPercent}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, markupPercent: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Costs (Optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editingProduct.additionalCosts}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, additionalCosts: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id="editSalesTax"
                  checked={editingProduct.salesTaxApplicable}
                  onCheckedChange={(checked) =>
                    setEditingProduct({ ...editingProduct, salesTaxApplicable: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="editSalesTax" className="cursor-pointer font-medium">
                    Sales Tax Applicable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Adds 9% sales tax to material cost only (not labor)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Additional details about this product..."
                  rows={2}
                  value={editingProduct.description || ""}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Cost:</span>
                    <span className="font-semibold">
                      {formatCurrency((parseFloat(editingProduct.materialCost) || 0) + (parseFloat(editingProduct.laborCost) || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Markup:</span>
                    <span className="font-semibold">{editingProduct.markupPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client Price:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(calcPrice(
                        parseFloat(editingProduct.materialCost) || 0,
                        parseFloat(editingProduct.laborCost) || 0,
                        parseFloat(editingProduct.markupPercent) || 0,
                        editingProduct.salesTaxApplicable,
                        parseFloat(editingProduct.additionalCosts) || 0
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </div>
            {/* Fixed footer */}
            <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirm?.name}"</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteConfirm) handleDeleteProduct(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
