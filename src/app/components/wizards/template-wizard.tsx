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
  wizardVariants?: any[];
  onComplete: (items: any[], formData: Record<string, any>) => void;
  onCancel: () => void;
  initialData?: Record<string, any>;
}

// Which picker shows for each variant role, and which step field anchors it.
const ROLE_PICKER: Record<string, { label: string; stepFieldId: string; showWhen: (fd: Record<string, any>) => boolean }> = {
  gravity_wall_block: {
    label: "Wall block material",
    stepFieldId: "retainingWallType",
    showWhen: (fd) => fd.retainingWallType === "Gravity Wall",
  },
  paver_material: {
    label: "Paver material",
    stepFieldId: "squareFootage",
    showWhen: () => true,
  },
};

const CATEGORY_TO_WIZARD_TYPE: Record<string, string> = {
  "Retaining Walls": "retaining_walls",
  "Pavers": "pavers",
};

export function TemplateWizard({ template, dbProducts, wizardVariants = [], onComplete, onCancel, initialData }: TemplateWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(initialData ?? {});

  const steps: any[] = template.steps ?? [];
  const calcRules: any[] = template.calc_rules ?? [];

  // ── Material variants (e.g. Gravity Wall block types, paver brands) ──────────
  const wizardType = CATEGORY_TO_WIZARD_TYPE[template.category] ?? null;
  const variantsByRole: Record<string, any[]> = {};
  if (wizardType) {
    wizardVariants
      .filter((v) => v.wizard_type === wizardType)
      .forEach((v) => { (variantsByRole[v.role] ??= []).push(v); });
  }

  const defaultVariant = (role: string) =>
    variantsByRole[role]?.find((v) => v.is_default) ?? variantsByRole[role]?.[0] ?? null;
  const selectedVariant = (role: string) => {
    const chosenId = formData[`__variant_${role}`];
    return variantsByRole[role]?.find((v) => v.id === chosenId) ?? defaultVariant(role);
  };

  // Map the DEFAULT variant's product/cap names (the "anchors" baked into the calc
  // rules) → the currently-selected variant's product/cap name + price override.
  const buildSwapMap = (): Record<string, { name: string; price: number | null }> => {
    const map: Record<string, { name: string; price: number | null }> = {};
    Object.keys(variantsByRole).forEach((role) => {
      const def = defaultVariant(role);
      const sel = selectedVariant(role);
      if (!def || !sel) return;
      if (def.product_name) {
        map[def.product_name.trim().toLowerCase()] = { name: sel.product_name, price: sel.price_override ?? null };
      }
      if (def.cap_product_name) {
        map[def.cap_product_name.trim().toLowerCase()] = { name: sel.cap_product_name ?? def.cap_product_name, price: sel.cap_price_override ?? null };
      }
    });
    return map;
  };

  // Resolve a calc rule's effective product (after variant swap) + price-per-unit.
  const resolveProduct = (rule: any, swapMap: Record<string, { name: string; price: number | null }>) => {
    const swap = swapMap[(rule.product_name ?? "").trim().toLowerCase()];
    const effectiveName = swap?.name ?? rule.product_name;
    const product = dbProducts.find((p: any) =>
      (!swap && rule.product_id && p.id === rule.product_id) ||
      p.name?.trim().toLowerCase() === effectiveName?.trim().toLowerCase()
    );
    // price_override is the pre-markup unit cost for the variant (material; labor 0).
    const baseCost = swap?.price != null
      ? swap.price
      : (product?.material_cost ?? 0) + (product?.labor_cost ?? 0);
    const pricePerUnit = baseCost * (1 + (product?.markup_percentage ?? 0) / 100);
    return { effectiveName, product, pricePerUnit, baseCost };
  };

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
    const swapMap = buildSwapMap();

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
        if (rule.round_up) qty = Math.ceil(qty);
        if (deliveryOverride > 0 && rule.product_name === 'Wall Delivery' && qty > 0) {
          qty = deliveryOverride;
        }
        const { effectiveName, product, pricePerUnit } = resolveProduct(rule, swapMap);
        return {
          name: effectiveName,
          description: rule.description,
          qty: qty > 0 ? Math.ceil(qty * 10) / 10 : null,
          unit: rule.unit ?? product?.unit ?? "each",
          price: qty > 0 ? qty * pricePerUnit : null,
          hasPrice: pricePerUnit > 0,
        };
      })
      .filter((r) => r.qty !== null);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const calculateAndComplete = () => {
    const items: any[] = [];
    const vars = buildVars();
    const swapMap = buildSwapMap();
    const deliveryOverride = parseFloat(formData.deliveryLoadsOverride as string) || 0;

    calcRules.forEach((rule: any) => {
      if (rule.conditional_field_id && rule.conditional_value) {
        if (String(formData[rule.conditional_field_id]) !== rule.conditional_value) return;
      }

      let qty = safeEval(rule.formula, vars);
      if (rule.round_up) qty = Math.ceil(qty);
      if (deliveryOverride > 0 && rule.product_name === 'Wall Delivery' && qty > 0) {
        qty = deliveryOverride;
      }
      if (qty <= 0) return;

      const { effectiveName, product, pricePerUnit, baseCost } = resolveProduct(rule, swapMap);
      const swapped = swapMap[(rule.product_name ?? "").trim().toLowerCase()];
      // When a variant price override is set, treat it as material cost (labor 0 for material variants)
      const materialCost = swapped?.price != null ? swapped.price : (product?.material_cost ?? 0);
      const laborCost = swapped?.price != null ? 0 : (product?.labor_cost ?? 0);

      items.push({
        category: template.category,
        productName: product?.name ?? effectiveName,
        description: product?.description ?? rule.description,
        quantity: Math.ceil(qty * 10) / 10,
        unit: rule.unit ?? product?.unit ?? "each",
        materialCost,
        laborCost,
        costPerUnit: baseCost,
        markupPercent: product?.markup_percentage ?? 0,
        pricePerUnit,
        product_service_id: product?.id ?? null,
        // Carry the product's tax flag so wizard items are included in sales tax
        // (was missing → wizard-built proposals weren't taxing materials).
        salesTaxApplicable: (product?.sales_tax_rate ?? null) != null,
      });
    });

    onComplete(items, formData);
  };

  const progress = visibleSteps.length > 0
    ? ((currentStep + 1) / visibleSteps.length) * 100
    : 100;

  if (!activeStep) return null;

  const liveCalcs = getLiveCalcsForStep();

  // Variant pickers to show on this step (only when there's a real choice)
  const stepPickers = Object.entries(ROLE_PICKER)
    .map(([role, cfg]) => ({ role, cfg, options: variantsByRole[role] ?? [] }))
    .filter(({ cfg, options }) =>
      options.length > 1 &&
      (activeStep.fields ?? []).some((f: any) => f.id === cfg.stepFieldId) &&
      cfg.showWhen(formData)
    )
    .map((p) => ({ ...p, selectedId: selectedVariant(p.role)?.id ?? "" }));

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

          {/* Material variant pickers (e.g. Gravity Wall block type → cap auto-matches) */}
          {stepPickers.map(({ role, cfg, options, selectedId }) => {
            const sel = options.find((v) => v.id === selectedId);
            return (
              <div key={role} className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-semibold">
                  {cfg.label}<span className="text-destructive ml-1">*</span>
                </Label>
                <Select value={selectedId} onValueChange={(v) => handleFieldChange(`__variant_${role}`, v)}>
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue placeholder="Select material…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-sm">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sel?.cap_product_name && (
                  <p className="text-xs text-muted-foreground">Cap auto-set to <span className="font-medium">{sel.cap_product_name}</span></p>
                )}
              </div>
            );
          })}

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
