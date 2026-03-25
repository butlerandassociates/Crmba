import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface TemplateWizardProps {
  template: any;
  dbProducts: any[];
  onComplete: (items: any[]) => void;
  onCancel: () => void;
}

export function TemplateWizard({ template, dbProducts, onComplete, onCancel }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const steps: any[] = template.steps ?? [];

  // Filter steps based on conditional_on
  const visibleSteps = steps.filter((step: any) => {
    if (!step.conditional_on) return true;
    return formData[step.conditional_on.field_id] === step.conditional_on.value;
  });

  const activeStep = visibleSteps[currentStep];

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const validateStep = () => {
    if (!activeStep) return false;
    return activeStep.fields.every((field: any) => {
      if (!field.required) return true;
      const val = formData[field.id];
      return val !== undefined && val !== "" && val !== null;
    });
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep === visibleSteps.length - 1) {
      calculateAndComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const safeEval = (formula: string, vars: Record<string, any>): number => {
    try {
      const keys = Object.keys(vars);
      const values = Object.values(vars);
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `return (${formula})`);
      return parseFloat(fn(...values)) || 0;
    } catch {
      return 0;
    }
  };

  const calculateAndComplete = () => {
    const items: any[] = [];
    const calcRules: any[] = template.calc_rules ?? [];

    // Build numeric vars from formData
    const vars: Record<string, any> = {};
    Object.entries(formData).forEach(([k, v]) => {
      const num = parseFloat(v);
      vars[k] = isNaN(num) ? v : num;
    });

    calcRules.forEach((rule: any) => {
      // Check conditional (use String() so boolean true matches "true")
      if (rule.conditional_field_id && rule.conditional_value) {
        if (String(formData[rule.conditional_field_id]) !== rule.conditional_value) return;
      }

      const qty = safeEval(rule.formula, vars);
      if (qty <= 0) return;

      // Find matching product from DB by name
      const product = dbProducts.find(
        (p: any) => p.name?.toLowerCase() === rule.product_name?.toLowerCase()
      );

      items.push({
        category: template.category,
        productName: rule.product_name,
        description: rule.description,
        quantity: Math.ceil(qty * 10) / 10,
        unit: rule.unit ?? product?.unit ?? "each",
        materialCost: product?.material_cost ?? 0,
        laborCost: product?.labor_cost ?? 0,
        costPerUnit: (product?.material_cost ?? 0) + (product?.labor_cost ?? 0),
        markupPercent: product?.markup_percentage ?? 0,
        pricePerUnit: product?.price_per_unit ?? 0,
      });
    });

    onComplete(items);
  };

  const progress = visibleSteps.length > 0
    ? ((currentStep + 1) / visibleSteps.length) * 100
    : 100;

  if (!activeStep) return null;

  const renderField = (field: any) => {
    switch (field.type) {
      case "radio":
        return (
          <div key={field.id} className="space-y-3">
            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
            <RadioGroup
              value={formData[field.id] ?? ""}
              onValueChange={(val) => handleFieldChange(field.id, val)}
            >
              <div className="grid grid-cols-2 gap-3">
                {(field.options ?? []).map((opt: string) => (
                  <div
                    key={opt}
                    className={`flex items-center gap-2 border rounded-lg p-4 cursor-pointer transition-colors ${
                      formData[field.id] === opt ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                    }`}
                  >
                    <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                    <Label htmlFor={`${field.id}-${opt}`} className="cursor-pointer font-normal flex-1">
                      {opt}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {field.id === "location" && formData[field.id] === "Backyard" && (
              <div className="text-sm p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                Note: Backyard location requires a line pump fee
              </div>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
            <Select
              value={formData[field.id] ?? ""}
              onValueChange={(val) => handleFieldChange(field.id, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt: string) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "number":
      case "measurement":
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
            <Input
              type="number"
              placeholder={field.placeholder ?? ""}
              value={formData[field.id] ?? ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            />
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} className="flex items-center gap-3">
            <Checkbox
              id={field.id}
              checked={!!formData[field.id]}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="cursor-pointer font-normal">
              {field.label}
            </Label>
          </div>
        );

      case "text":
      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
            <Input
              type="text"
              placeholder={field.placeholder ?? ""}
              value={formData[field.id] ?? ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            />
          </div>
        );
    }
  };

  // Live preview for measurement steps
  const hasMeasurements = activeStep.fields.some((f: any) =>
    ["squareFootage", "linearFeet", "length", "width"].includes(f.id)
  );
  const sqft = parseFloat(formData.squareFootage) || 0;
  const thickness = parseFloat(formData.thickness) || 0;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{activeStep.title}</span>
          <Badge variant="outline">
            Step {currentStep + 1} of {visibleSteps.length}
          </Badge>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[280px] p-6 border rounded-lg bg-muted/20 space-y-5">
        {activeStep.fields.map((field: any) => renderField(field))}

        {/* Live measurement preview */}
        {hasMeasurements && sqft > 0 && thickness > 0 && (
          <div className="text-sm p-3 bg-muted rounded">
            Concrete needed: <strong>{((sqft * (thickness / 12)) / 27).toFixed(1)} cubic yards</strong>
          </div>
        )}
        {hasMeasurements && sqft > 0 && !thickness && (
          <div className="text-sm p-3 bg-muted rounded">
            Area: <strong>{sqft} sq ft</strong>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={currentStep === 0 ? onCancel : handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>
        <Button onClick={handleNext} disabled={!validateStep()}>
          {currentStep === visibleSteps.length - 1 ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Add to Proposal
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
