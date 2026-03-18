import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  Settings,
  FileText,
} from "lucide-react";
import { estimateTemplates, products } from "../../data/estimate-templates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export function EstimateTemplateManager() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = estimateTemplates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Estimate Template Manager</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create and manage estimate workflows
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">
            Templates ({estimateTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="products">
            Products & Pricing ({products.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {template.steps.length} steps
                        </span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {template.calculationRules.length} calculation rules
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {template.description}
                  </p>

                  {/* Steps Preview */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Workflow Steps:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {template.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className="p-3 border rounded-lg bg-muted/50"
                        >
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Step {index + 1}
                          </div>
                          <div className="text-sm font-semibold">{step.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {step.fields.length} fields
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Calculation Rules Preview */}
                  {template.calculationRules.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-semibold">Calculation Rules:</h4>
                      <div className="space-y-1">
                        {template.calculationRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="text-xs p-2 bg-muted/50 rounded border"
                          >
                            <span className="font-medium">{rule.description}</span>
                            <span className="text-muted-foreground ml-2">
                              ({rule.type})
                            </span>
                            {rule.conditionalOn && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Conditional
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No templates found</p>
            </div>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage products, materials, and pricing used in estimates
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>

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
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                        Unit
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                        Cost
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                        Markup %
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                        Price
                      </th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((product) => (
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
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground">
                            {product.unit}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm font-medium">
                            {formatCurrency(product.costPerUnit)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
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
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
