import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { products } from "../../data/estimate-templates";

interface ConcreteWizardProps {
  onComplete: (items: any[], formData: Record<string, any>) => void;
  onCancel: () => void;
  initialData?: Record<string, any>;
}

export function ConcreteWizard({ onComplete, onCancel, initialData }: ConcreteWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(initialData ?? {
    projectType: "",
    location: "",
    squareFootage: "",
    thickness: "",
    reinforcementType: "",
    finish: "",
    sealer: "",
  });

  const steps = [
    {
      title: "Project Type",
      fields: ["projectType"],
    },
    {
      title: "Location",
      fields: ["location"],
    },
    {
      title: "Measurements",
      fields: ["squareFootage", "thickness"],
    },
    {
      title: "Reinforcement",
      fields: ["reinforcementType"],
    },
    {
      title: "Finishing",
      fields: ["finish", "sealer"],
    },
  ];

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateCurrentStep = () => {
    const currentFields = steps[currentStep].fields;
    return currentFields.every((field) => formData[field]);
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep === steps.length - 1) {
        calculateAndComplete();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const calculateAndComplete = () => {
    const items: any[] = [];
    
    // Calculate dimensions
    const squareFootage = parseFloat(formData.squareFootage) || 0;
    const thickness = parseFloat(formData.thickness) || 0;
    const cubicYards = (squareFootage * (thickness / 12)) / 27;

    // Find products
    const concreteProduct = products.find((p) => p.id === "p1"); // Concrete Mix (3500 PSI)
    const gravelProduct = products.find((p) => p.id === "p2");
    const rebarProduct = products.find((p) => p.id === "p3");
    const meshProduct = products.find((p) => p.id === "p4");
    const sealerProduct = products.find((p) => p.id === "p5");
    const laborProduct = products.find((p) => p.id === "p9");
    const pumpProduct = products.find((p) => p.id === "p8");

    // Add concrete
    if (concreteProduct && cubicYards > 0) {
      items.push({
        category: "Concrete",
        productName: `${formData.projectType} - Concrete (${thickness}")`,
        description: `${squareFootage} sq ft x ${thickness}" thick`,
        quantity: Math.ceil(cubicYards * 10) / 10,
        unit: concreteProduct.unit,
        materialCost: concreteProduct.materialCost,
        laborCost: concreteProduct.laborCost,
        costPerUnit: concreteProduct.totalCost,
        markupPercent: concreteProduct.markupPercent,
        pricePerUnit: concreteProduct.pricePerUnit,
      });
    }

    // Add gravel base
    if (gravelProduct) {
      const gravelTons = ((squareFootage * (4 / 12)) / 27) * 1.35; // 4" base
      items.push({
        category: "Concrete",
        productName: "Gravel Base (4\")",
        description: "Compacted base material",
        quantity: Math.ceil(gravelTons * 10) / 10,
        unit: gravelProduct.unit,
        materialCost: gravelProduct.materialCost,
        laborCost: gravelProduct.laborCost,
        costPerUnit: gravelProduct.totalCost,
        markupPercent: gravelProduct.markupPercent,
        pricePerUnit: gravelProduct.pricePerUnit,
      });
    }

    // Add reinforcement
    if (formData.reinforcementType === "Rebar" && rebarProduct) {
      const rebarLinearFeet = squareFootage * 0.8; // ~16" spacing estimate
      items.push({
        category: "Concrete",
        productName: "Rebar (#4)",
        description: "Steel reinforcement",
        quantity: Math.ceil(rebarLinearFeet),
        unit: rebarProduct.unit,
        materialCost: rebarProduct.materialCost,
        laborCost: rebarProduct.laborCost,
        costPerUnit: rebarProduct.totalCost,
        markupPercent: rebarProduct.markupPercent,
        pricePerUnit: rebarProduct.pricePerUnit,
      });
    } else if (formData.reinforcementType === "Wire Mesh" && meshProduct) {
      items.push({
        category: "Concrete",
        productName: "Wire Mesh (6x6)",
        description: "Welded wire fabric",
        quantity: Math.ceil(squareFootage),
        unit: meshProduct.unit,
        materialCost: meshProduct.materialCost,
        laborCost: meshProduct.laborCost,
        costPerUnit: meshProduct.totalCost,
        markupPercent: meshProduct.markupPercent,
        pricePerUnit: meshProduct.pricePerUnit,
      });
    }

    // Add sealer
    if (formData.sealer === "Yes" && sealerProduct) {
      items.push({
        category: "Concrete",
        productName: `Concrete Sealer - ${formData.finish}`,
        description: "Protective sealer application",
        quantity: Math.ceil(squareFootage),
        unit: sealerProduct.unit,
        materialCost: sealerProduct.materialCost,
        laborCost: sealerProduct.laborCost,
        costPerUnit: sealerProduct.totalCost,
        markupPercent: sealerProduct.markupPercent,
        pricePerUnit: sealerProduct.pricePerUnit,
      });
    }

    // Add install labor — $3/sqft material + $7/sqft labor, client rate $7/sqft
    if (laborProduct) {
      items.push({
        category: "Concrete",
        productName: `Install Concrete (${thickness}")`,
        description: "Form, pour, finish, and cure",
        quantity: squareFootage,
        unit: "sqft",
        materialCost: laborProduct.materialCost,
        laborCost: laborProduct.laborCost,
        costPerUnit: laborProduct.totalCost,
        markupPercent: laborProduct.markupPercent,
        pricePerUnit: laborProduct.pricePerUnit,
      });
    }

    // Add line pump fee for backyard
    if (formData.location === "Backyard" && pumpProduct) {
      items.push({
        category: "Concrete",
        productName: "Line Pump Fee",
        description: "Required for backyard access",
        quantity: 1,
        unit: pumpProduct.unit,
        materialCost: pumpProduct.materialCost,
        laborCost: pumpProduct.laborCost,
        costPerUnit: pumpProduct.totalCost,
        markupPercent: pumpProduct.markupPercent,
        pricePerUnit: pumpProduct.pricePerUnit,
      });
    }

    onComplete(items, formData);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{steps[currentStep].title}</span>
          <Badge variant="outline">
            Step {currentStep + 1} of {steps.length}
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
      <div className="min-h-[300px] p-6 border rounded-lg bg-muted/20">
        {currentStep === 0 && (
          <div className="space-y-4">
            <Label>What type of concrete project?</Label>
            <RadioGroup
              value={formData.projectType}
              onValueChange={(value) => handleFieldChange("projectType", value)}
            >
              <div className="grid grid-cols-2 gap-3">
                {["Driveway", "Patio", "Walkway", "Pool Deck"].map((type) => (
                  <div
                    key={type}
                    className={`flex items-center space-x-2 border rounded-lg p-4 cursor-pointer ${
                      formData.projectType === type ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleFieldChange("projectType", type)}
                  >
                    <RadioGroupItem value={type} id={type} />
                    <Label htmlFor={type} className="cursor-pointer font-normal flex-1 pointer-events-none">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <Label>Where is the project located?</Label>
            <RadioGroup
              value={formData.location}
              onValueChange={(value) => handleFieldChange("location", value)}
            >
              <div className="grid grid-cols-3 gap-3">
                {["Front Yard", "Backyard", "Side Yard"].map((loc) => (
                  <div
                    key={loc}
                    className={`flex items-center space-x-2 border rounded-lg p-4 cursor-pointer ${
                      formData.location === loc ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleFieldChange("location", loc)}
                  >
                    <RadioGroupItem value={loc} id={loc} />
                    <Label htmlFor={loc} className="cursor-pointer font-normal flex-1 pointer-events-none">
                      {loc}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            {formData.location === "Backyard" && (
              <div className="text-sm text-muted-foreground p-3 bg-yellow-50 border border-yellow-200 rounded">
                Note: Backyard location requires line pump fee
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Square Footage</Label>
                <Input
                  type="number"
                  placeholder="e.g. 400"
                  value={formData.squareFootage}
                  onChange={(e) => handleFieldChange("squareFootage", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Total area in square feet</p>
              </div>
              <div className="space-y-2">
                <Label>Depth (inches)</Label>
                <Select
                  value={formData.thickness}
                  onValueChange={(value) => handleFieldChange("thickness", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select depth" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4"</SelectItem>
                    <SelectItem value="5">5"</SelectItem>
                    <SelectItem value="6">6"</SelectItem>
                    <SelectItem value="8">8"</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Standard driveway: 6", Patio: 4–5"</p>
              </div>
            </div>
            {formData.squareFootage && formData.thickness && (
              <div className="text-sm p-3 bg-muted rounded">
                Concrete needed: <strong>{((parseFloat(formData.squareFootage) * (parseFloat(formData.thickness) / 12)) / 27).toFixed(1)} cubic yards</strong>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <Label>Reinforcement Type</Label>
            <RadioGroup
              value={formData.reinforcementType}
              onValueChange={(value) => handleFieldChange("reinforcementType", value)}
            >
              <div className="grid grid-cols-2 gap-3">
                {["Rebar", "Wire Mesh", "Both", "None"].map((type) => (
                  <div
                    key={type}
                    className={`flex items-center space-x-2 border rounded-lg p-4 cursor-pointer ${
                      formData.reinforcementType === type ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleFieldChange("reinforcementType", type)}
                  >
                    <RadioGroupItem value={type} id={`reinf-${type}`} />
                    <Label htmlFor={`reinf-${type}`} className="cursor-pointer font-normal flex-1 pointer-events-none">
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Concrete Finish</Label>
              <Select
                value={formData.finish}
                onValueChange={(value) => handleFieldChange("finish", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select finish type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Broom Finish">Broom Finish</SelectItem>
                  <SelectItem value="Smooth Trowel">Smooth Trowel</SelectItem>
                  <SelectItem value="Exposed Aggregate">Exposed Aggregate</SelectItem>
                  <SelectItem value="Stamped">Stamped</SelectItem>
                  <SelectItem value="Stained">Stained</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Apply Sealer?</Label>
              <RadioGroup
                value={formData.sealer}
                onValueChange={(value) => handleFieldChange("sealer", value)}
              >
                <div className="grid grid-cols-2 gap-3">
                  {["Yes", "No"].map((option) => (
                    <div
                      key={option}
                      className={`flex items-center space-x-2 border rounded-lg p-4 cursor-pointer ${
                        formData.sealer === option ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => handleFieldChange("sealer", option)}
                    >
                      <RadioGroupItem value={option} id={`sealer-${option}`} />
                      <Label htmlFor={`sealer-${option}`} className="cursor-pointer font-normal flex-1 pointer-events-none">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={currentStep === 0 ? onCancel : handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancel" : "Back"}
        </Button>
        <Button onClick={handleNext} disabled={!validateCurrentStep()}>
          {currentStep === steps.length - 1 ? (
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