import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Plus, Edit, Eye, EyeOff } from "lucide-react";
import { mockProducts } from "../../data/mock-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";

export function ProductCatalog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showMarkup, setShowMarkup] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case "each":
        return "Each";
      case "sq_ft":
        return "Sq. Ft.";
      case "linear_ft":
        return "Linear Ft.";
      case "hour":
        return "Hour";
      default:
        return unit;
    }
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Product created successfully!");
    setDialogOpen(false);
  };

  const calculateClientPrice = (basePrice: number, markup: number) => {
    return basePrice * (1 + markup / 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product & Service Catalog</h2>
          <p className="text-muted-foreground mt-1">Manage pricing, labor costs, and markup</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkup(!showMarkup)}
          >
            {showMarkup ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Markup
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Markup
              </>
            )}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product/Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <form onSubmit={handleCreateProduct}>
                <DialogHeader>
                  <DialogTitle>Add Product/Service</DialogTitle>
                  <DialogDescription>
                    Create a new product or service item with pricing and labor costs.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="prod-name">Name</Label>
                    <Input id="prod-name" placeholder="e.g., Premium Paint" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the product/service"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select required>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materials">Materials</SelectItem>
                        <SelectItem value="flooring">Flooring</SelectItem>
                        <SelectItem value="hvac">HVAC</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="construction">Construction</SelectItem>
                        <SelectItem value="labor">Labor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Select required>
                        <SelectTrigger id="unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="each">Each</SelectItem>
                          <SelectItem value="sq_ft">Square Foot</SelectItem>
                          <SelectItem value="linear_ft">Linear Foot</SelectItem>
                          <SelectItem value="hour">Hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="markup">Markup %</Label>
                      <Input
                        id="markup"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g., 30"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="base-price">Base Price (Cost)</Label>
                      <Input
                        id="base-price"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="labor-cost">Labor Cost per Unit</Label>
                      <Input
                        id="labor-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="font-medium text-blue-900">Note:</p>
                    <p className="text-blue-700 mt-1">
                      Markup will be hidden from non-admin users. Team members will only see the final client pricing.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Product</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {mockProducts.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <Badge variant="outline">{product.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-1">Unit</div>
                      <div className="font-semibold">{getUnitLabel(product.unit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-1">Base Cost</div>
                      <div className="font-semibold">{formatCurrency(product.pricePerUnit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-1">Labor Cost</div>
                      <div className="font-semibold">{formatCurrency(product.laborCostPerUnit)}</div>
                    </div>
                    {showMarkup && (
                      <div>
                        <div className="text-xs text-orange-600 uppercase mb-1 flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Markup
                        </div>
                        <div className="font-semibold text-orange-600">{product.markup}%</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground uppercase mb-1">Client Price</div>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(calculateClientPrice(product.pricePerUnit, product.markup))}
                      </div>
                    </div>
                  </div>

                  {showMarkup && (
                    <div className="pt-3 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Total Cost/Unit</div>
                          <div className="font-medium">
                            {formatCurrency(product.pricePerUnit + product.laborCostPerUnit)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Markup Amount</div>
                          <div className="font-medium text-orange-600">
                            {formatCurrency((product.pricePerUnit * product.markup) / 100)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Gross Profit/Unit</div>
                          <div className="font-medium text-green-600">
                            {formatCurrency(
                              calculateClientPrice(product.pricePerUnit, product.markup) -
                              (product.pricePerUnit + product.laborCostPerUnit)
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Profit Margin</div>
                          <div className="font-medium text-green-600">
                            {(
                              ((calculateClientPrice(product.pricePerUnit, product.markup) -
                                (product.pricePerUnit + product.laborCostPerUnit)) /
                                calculateClientPrice(product.pricePerUnit, product.markup)) *
                              100
                            ).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
