import { useState } from "react";
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
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { products } from "../../data/estimate-templates";
import { Textarea } from "../ui/textarea";

const CATEGORIES = [
  "Concrete",
  "Pavers",
  "Outdoor Kitchen",
  "Pergola/Pavilion",
  "Drainage + Irrigation",
  "Landscaping",
  "Lighting",
  "Fencing",
  "Labor",
  "Equipment",
  "Materials",
  "Other",
];

const UNITS = [
  "square foot",
  "linear foot",
  "cubic yard",
  "ton",
  "each",
  "hour",
  "day",
  "flat",
  "bag",
  "gallon",
  "pallet",
];

export function ProductManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    unit: "",
    customUnit: "",
    materialCost: "",
    laborCost: "",
    markupPercent: "50",
    description: "",
    salesTaxApplicable: false,
    additionalCosts: "",
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleAddProduct = () => {
    // In real app, save to database
    console.log("Adding product:", newProduct);
    setShowAddDialog(false);
    setNewProduct({
      name: "",
      category: "",
      unit: "",
      customUnit: "",
      materialCost: "",
      laborCost: "",
      markupPercent: "50",
      description: "",
      salesTaxApplicable: false,
      additionalCosts: "",
    });
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({
      ...product,
      customUnit: product.unit,
      materialCost: "",
      laborCost: "",
      additionalCosts: "",
      salesTaxApplicable: false,
    });
  };

  const handleSaveEdit = () => {
    // In real app, save to database
    console.log("Saving product:", editingProduct);
    setEditingProduct(null);
  };

  const calculatePrice = () => {
    const materialCost = parseFloat(newProduct.materialCost) || 0;
    const laborCost = parseFloat(newProduct.laborCost) || 0;
    const markup = parseFloat(newProduct.markupPercent) || 0;
    const additionalCosts = parseFloat(newProduct.additionalCosts) || 0;
    
    // Add sales tax to material cost if applicable (9% on materials only)
    const materialWithTax = newProduct.salesTaxApplicable 
      ? materialCost * 1.09 
      : materialCost;
    
    const totalCost = materialWithTax + laborCost + additionalCosts;
    return totalCost * (1 + markup / 100);
  };

  // Group products by category
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, typeof products>);

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
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add a new product, material, or service to your catalog
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    placeholder="e.g., Concrete Mix (3000 PSI)"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={newProduct.category}
                    onValueChange={(value) =>
                      setNewProduct({ ...newProduct, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Input
                    placeholder="e.g., square foot, each, linear foot"
                    value={newProduct.customUnit || newProduct.unit}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, customUnit: e.target.value, unit: "" })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Type your custom unit</p>
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
                  <Label>Labor Cost (per unit) *</Label>
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
                  <Label>Markup % *</Label>
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

              {newProduct.materialCost && newProduct.laborCost && newProduct.markupPercent && (
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
                      <div className="text-xs text-muted-foreground">Total Cost + Markup ({newProduct.markupPercent}%)</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(calculatePrice())}
                      </div>
                      <div className="text-xs text-muted-foreground">Client price per {newProduct.customUnit || newProduct.unit || 'unit'}</div>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={
                  !newProduct.name ||
                  !newProduct.category ||
                  (!newProduct.unit && !newProduct.customUnit) ||
                  !newProduct.materialCost ||
                  !newProduct.laborCost ||
                  !newProduct.markupPercent
                }
              >
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
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
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
                {filteredProducts.map((product) => (
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
                        {product.category}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm text-muted-foreground">
                        {product.unit}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-sm font-medium">
                        {formatCurrency(product.pricePerUnit)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary" className="text-xs">
                        {product.markupPercent}%
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(product.pricePerUnit)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-sm font-medium text-green-600">
                        {formatCurrency(product.pricePerUnit - product.pricePerUnit)}
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
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
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
            <p className="text-2xl font-bold">{products.length}</p>
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
              {new Set(products.map((p) => p.category)).size}
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
              {(
                products.reduce((sum, p) => sum + p.markupPercent, 0) /
                products.length
              ).toFixed(0)}
              %
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
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update product details, pricing, and settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    placeholder="e.g., Concrete Mix (3000 PSI)"
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={editingProduct.category}
                    onValueChange={(value) =>
                      setEditingProduct({ ...editingProduct, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Input
                    placeholder="e.g., square foot, each, linear foot"
                    value={editingProduct.customUnit || editingProduct.unit}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, customUnit: e.target.value, unit: "" })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Type your custom unit</p>
                </div>
                <div className="space-y-2">
                  <Label>Material Cost (per unit) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={formatCurrency(editingProduct.costPerUnit / 2)}
                    value={editingProduct.materialCost}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, materialCost: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Labor Cost (per unit) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={formatCurrency(editingProduct.costPerUnit / 2)}
                    value={editingProduct.laborCost}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, laborCost: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Markup % *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={editingProduct.markupPercent.toString()}
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
                  <p className="text-xs text-muted-foreground">Any other fees or costs</p>
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
                    <span className="text-muted-foreground">Current Cost:</span>
                    <span className="font-semibold">{formatCurrency(editingProduct.costPerUnit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Markup:</span>
                    <span className="font-semibold">{editingProduct.markupPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(editingProduct.pricePerUnit)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}