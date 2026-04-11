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
  onComplete: (items: any[], formData: Record<string, any>) => void;
  onCancel: () => void;
  initialData?: Record<string, any>;
}

export function TemplateWizard({ template, dbProducts, onComplete, onCancel, initialData }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(initialData ?? {});

  const steps: any[] = template.steps ?? [];
  const calcRules: any[] = template.calc_rules ?? [];

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

  // Build numeric vars from current formData
  const buildVars = () => {
    const vars: Record<string, any> = {};
    Object.entries(formData).forEach(([k, v]) => {
      const num = parseFloat(v as string);
      vars[k] = isNaN(num) ? v : num;
    });
    return vars;
  };

  // Get calc rules that have at least one variable from the current step's fields
  // AND produce a non-zero result with current formData
  const getLiveCalcsForStep = () => {
    if (!activeStep) return [];
    const stepFieldIds = new Set<string>((activeStep.fields ?? []).map((f: any) => f.id as string));
    const vars = buildVars();

    return calcRules
      .filter((rule: any) => {
        if (rule.conditional_field_id && rule.conditional_value) {
          // Conditional rule: show on the step that CONTAINS the conditional field
          // and only when the condition is currently met
          if (!stepFieldIds.has(rule.conditional_field_id)) return false;
          return String(formData[rule.conditional_field_id]) === rule.conditional_value;
        }
        // Non-conditional rule: show on the step that contains a formula variable
        // AND that variable has a value entered
        return [...stepFieldIds].some((id) => {
          const fieldId = id as string;
          return new RegExp(`\\b${fieldId}\\b`).test(rule.formula ?? "") &&
            formData[fieldId] !== undefined && formData[fieldId] !== "" && formData[fieldId] !== null;
        });
      })
      .map((rule: any) => {
        const deliveryOverride = parseFloat(formData.deliveryLoadsOverride as string) || 0;
        let qty = safeEval(rule.formula, vars);
        if (deliveryOverride > 0 && rule.product_name === 'Wall Delivery' && qty > 0) {
          qty = deliveryOverride;
        }
        const product = dbProducts.find(
          (p: any) => p.name?.trim().toLowerCase() === rule.product_name?.trim().toLowerCase()
        );
        const costPerUnit = (product?.material_cost ?? 0) + (product?.labor_cost ?? 0);
        const price = product
          ? costPerUnit * (1 + (product.markup_percentage ?? 0) / 100)
          : 0;
        return {
          name: rule.product_name,
          description: rule.description,
          qty: qty > 0 ? Math.ceil(qty * 10) / 10 : null,
          unit: rule.unit ?? product?.unit ?? "each",
          price: qty > 0 ? qty * price : null,
          hasPrice: price > 0,
        };
      })
      .filter((r) => r.qty !== null);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const calculateAndComplete = () => {
    const items: any[] = [];
    const vars = buildVars();
    const deliveryOverride = parseFloat(formData.deliveryLoadsOverride as string) || 0;

    calcRules.forEach((rule: any) => {
      if (rule.conditional_field_id && rule.conditional_value) {
        if (String(formData[rule.conditional_field_id]) !== rule.conditional_value) return;
      }

      let qty = safeEval(rule.formula, vars);
      if (deliveryOverride > 0 && rule.product_name === 'Wall Delivery' && qty > 0) {
        qty = deliveryOverride;
      }
      if (qty <= 0) return;

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
        pricePerUnit: product
          ? ((product.material_cost ?? 0) + (product.labor_cost ?? 0)) * (1 + (product.markup_percentage ?? 0) / 100)
          : 0,
        product_service_id: product?.id ?? null,
      });
    });

    onComplete(items, formData);
  };

  const progress = visibleSteps.length > 0
    ? ((currentStep + 1) / visibleSteps.length) * 100
    : 100;

  if (!activeStep) return null;

  const liveCalcs = getLiveCalcsForStep();

  const FieldLabel = ({ field }: { field: any }) => (
    <div className="space-y-0.5">
      <Label className="text-sm font-semibold">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.help_text && (
        <p className="text-xs text-muted-foreground leading-relaxed">{field.help_text}</p>
      )}
    </div>
  );

  const renderField = (field: any) => {
    switch (field.type) {
      case "radio":
        return (
          <div key={field.id} className="space-y-3">
            <FieldLabel field={field} />
            <RadioGroup
              value={formData[field.id] ?? ""}
              onValueChange={(val) => handleFieldChange(field.id, val)}
            >
              <div className="grid grid-cols-2 gap-3">
                {(field.options ?? []).map((opt: string) => (
                  <div
                    key={opt}
                    tabIndex={0}
                    className={`flex items-center gap-3 border-2 rounded-xl p-4 cursor-pointer transition-all duration-150 ${
                      formData[field.id] === opt
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-accent/30"
                    }`}
                    onClick={() => handleFieldChange(field.id, opt)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFieldChange(field.id, opt); } }}
                  >
                    <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                    <Label htmlFor={`${field.id}-${opt}`} className="cursor-pointer font-medium flex-1 pointer-events-none text-sm">
                      {opt}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {field.id === "location" && formData[field.id] === "Backyard" && (
              <div className="text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                Note: Backyard location requires a line pump fee
              </div>
            )}
          </div>
        );

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <FieldLabel field={field} />
            <Select
              value={formData[field.id] ?? ""}
              onValueChange={(val) => handleFieldChange(field.id, val)}
            >
              <SelectTrigger className="h-11 text-sm">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}…`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((opt: string) => (
                  <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "number":
      case "measurement":
        return (
          <div key={field.id} className="space-y-2">
            <FieldLabel field={field} />
            <Input
              type="number"
              placeholder={field.placeholder ?? "Enter a number…"}
              value={formData[field.id] ?? ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="h-11 text-base"
            />
          </div>
        );

      case "checkbox":
        return (
          <div
            key={field.id}
            className={`flex items-center gap-3 border-2 rounded-xl p-4 cursor-pointer transition-all duration-150 ${
              formData[field.id] ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
            onClick={() => handleFieldChange(field.id, !formData[field.id])}
          >
            <Checkbox
              id={field.id}
              checked={!!formData[field.id]}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="cursor-pointer font-medium pointer-events-none text-sm">
              {field.label}
            </Label>
          </div>
        );

      case "text":
      default:
        return (
          <div key={field.id} className="space-y-2">
            <FieldLabel field={field} />
            <Input
              type="text"
              placeholder={field.placeholder ?? ""}
              value={formData[field.id] ?? ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="h-11 text-base"
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress header — fixed, not scrollable */}
      <div className="px-8 pt-6 pb-4 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              Step {currentStep + 1} of {visibleSteps.length}
            </p>
            <h2 className="text-base font-semibold">{activeStep.title}</h2>
          </div>
          <Badge variant="outline" className="text-xs px-2.5 py-1">
            {Math.round(progress)}% complete
          </Badge>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step fields — scrollable middle */}
      <div className="flex-1 overflow-y-auto px-8 pb-4 thin-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-6">
          {activeStep.description && (
            <p className="text-sm text-muted-foreground border-b pb-3">{activeStep.description}</p>
          )}
          <div className="space-y-6">
            {activeStep.fields.map((field: any) => renderField(field))}
          </div>

          {/* Live calculations preview */}
          {liveCalcs.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Live Estimate Preview
              </p>
              {liveCalcs.map((calc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border border-primary/10 rounded-lg text-sm"
                >
                  <span className="font-medium text-foreground">{calc.name}</span>
                  <span className="font-semibold text-primary ml-4 tabular-nums">
                    {calc.qty} {calc.unit}
                    {calc.hasPrice && calc.price !== null && (
                      <span className="text-muted-foreground font-normal ml-2">
                        — {formatCurrency(calc.price)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation — fixed at bottom */}
      <div className="flex justify-between items-center px-8 py-5 border-t bg-background flex-shrink-0">
        <Button variant="outline" size="lg" onClick={currentStep === 0 ? onCancel : handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>
        <Button size="lg" onClick={handleNext} disabled={!validateStep()}>
          {currentStep === visibleSteps.length - 1 ? (
            <><Check className="h-4 w-4 mr-2" />Add to Proposal</>
          ) : (
            <>Next Step <ArrowRight className="h-4 w-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
