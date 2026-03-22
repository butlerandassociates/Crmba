import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import { estimateTemplates, products, Product } from "../data/estimate-templates";
import type { EstimateTemplate, EstimateField } from "../data/estimate-templates";
import { clientsAPI } from "../utils/api";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

export function EstimateBuilder() {
  const { clientId, templateId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const template = estimateTemplates.find((t) => t.id === templateId);

  useEffect(() => {
    if (clientId) clientsAPI.getById(clientId).then(setClient).catch(console.error);
  }, [clientId]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [calculatedItems, setCalculatedItems] = useState<any[]>([]);

  if (!client || !template) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Template not found</h2>
          <Link to={`/clients/${clientId}`}>
            <Button className="mt-4">Back to Client</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStepData = template.steps[currentStep];
  const isLastStep = currentStep === template.steps.length - 1;
  const progress = ((currentStep + 1) / template.steps.length) * 100;

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const validateCurrentStep = () => {
    for (const field of currentStepData.fields) {
      if (field.required && !formData[field.id]) {
        return false;
      }
    }
    return true;
  };

  const calculateEstimate = () => {
    const items: any[] = [];
    const calculations: Record<string, number> = {};

    // First pass: calculate all values
    template.calculationRules.forEach((rule) => {
      // Check if conditional
      if (rule.conditionalOn) {
        const conditionMet = formData[rule.conditionalOn.fieldId] === rule.conditionalOn.value;
        if (!conditionMet) return;
      }

      let calculatedValue = 0;

      // Parse and evaluate formula
      try {
        // Replace field IDs with actual values
        let formula = rule.calculation.formula;
        Object.keys(formData).forEach((key) => {
          const regex = new RegExp(key, 'g');
          formula = formula.replace(regex, String(formData[key] || 0));
        });

        // Evaluate the formula (basic math)
        calculatedValue = eval(formula);
        calculations[rule.id] = calculatedValue;
      } catch (error) {
        console.error('Calculation error:', error);
        calculatedValue = 0;
      }

      // Add line item if it has a product
      if (rule.calculation.productId && calculatedValue > 0) {
        const product = products.find((p) => p.id === rule.calculation.productId);
        if (product) {
          items.push({
            id: `calc-${rule.id}`,
            productName: product.name,
            quantity: Math.ceil(calculatedValue * 100) / 100, // Round to 2 decimals
            unit: product.unit,
            pricePerUnit: product.pricePerUnit,
            totalPrice: Math.ceil(calculatedValue * product.pricePerUnit * 100) / 100,
            description: rule.description,
          });
        }
      }
    });

    // Add labor estimate (simplified - would be more complex in real system)
    const squareFootage = formData.length && formData.width ? formData.length * formData.width : 0;
    if (squareFootage > 0) {
      const laborHours = Math.ceil(squareFootage / 50); // Simplified: 50 sq ft per hour
      const laborProduct = products.find((p) => p.id === 'p6');
      if (laborProduct) {
        items.push({
          id: 'labor-item',
          productName: laborProduct.name,
          quantity: laborHours,
          unit: laborProduct.unit,
          pricePerUnit: laborProduct.pricePerUnit,
          totalPrice: laborHours * laborProduct.pricePerUnit,
          description: 'Labor for installation',
        });
      }
    }

    setCalculatedItems(items);
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (isLastStep) {
        calculateEstimate();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSaveProposal = () => {
    // In real app, save to database and create proposal
    alert('Estimate saved! Proposal will be created.');
    navigate(`/clients/${clientId}`);
  };

  const renderField = (field: EstimateField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={formData[field.id] || ''}
              onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || '')}
              placeholder={field.placeholder}
              className="flex-1"
            />
            {field.unit && <span className="text-sm text-muted-foreground">{field.unit}</span>}
          </div>
        );

      case 'select':
        return (
          <Select
            value={formData[field.id] || ''}
            onValueChange={(value) => handleFieldChange(field.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={formData[field.id] || ''}
            onValueChange={(value) => handleFieldChange(field.id, value)}
          >
            <div className="space-y-2">
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <Label htmlFor={`${field.id}-${option}`} className="cursor-pointer font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  if (calculatedItems.length > 0) {
    // Show results
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/clients/${clientId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Estimate Complete</h1>
              <p className="text-sm text-muted-foreground">
                {`${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim()} - {template.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {
              setCalculatedItems([]);
              setCurrentStep(0);
              setFormData({});
            }}>
              Start Over
            </Button>
            <Button onClick={handleSaveProposal}>
              <Save className="h-4 w-4 mr-2" />
              Save as Proposal
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium">Subtotal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(subtotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium">Tax (8%)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(tax)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(total)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estimate Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                      Item
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                      Description
                    </th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                      Qty
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                      Unit
                    </th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                      Rate
                    </th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-accent/50">
                      <td className="p-3">
                        <span className="font-medium text-sm">{item.productName}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm">{item.quantity.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm">{formatCurrency(item.pricePerUnit)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (8%)</span>
                <span className="font-semibold">{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg pt-2">
                <span className="font-bold">Total</span>
                <span className="font-bold text-green-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {Object.entries(formData).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="ml-2 font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/clients/${clientId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{template.name} Estimate</h1>
            <p className="text-sm text-muted-foreground">{`${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim()}</p>
          </div>
        </div>
        <Badge variant="outline">
          Step {currentStep + 1} of {template.steps.length}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current Step */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStepData.title}</CardTitle>
          {currentStepData.description && (
            <p className="text-sm text-muted-foreground mt-1">{currentStepData.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStepData.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderField(field)}
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!validateCurrentStep()}
        >
          {isLastStep ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Calculate Estimate
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
