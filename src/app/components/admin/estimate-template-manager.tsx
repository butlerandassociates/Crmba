import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { estimateTemplatesAPI, productsAPI } from "../../utils/api";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "radio", label: "Multiple Choice (Radio)" },
  { value: "select", label: "Dropdown" },
  { value: "number", label: "Number" },
  { value: "measurement", label: "Measurement" },
  { value: "text", label: "Text" },
  { value: "checkbox", label: "Checkbox (Yes/No)" },
];


/** Convert a human label to a camelCase field ID */
function labelToId(label: string): string {
  return label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("") || `field_${Date.now()}`;
}

function generateId() {
  return `f_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

const emptyStep = () => ({
  id: generateId(),
  title: "",
  order_index: 0,
  conditional_on: null,
  fields: [],
});

const emptyField = () => ({
  id: "",
  label: "",
  type: "radio",
  required: true,
  options: [],
  unit: "",
  placeholder: "",
  help_text: "",
});

const emptyRule = () => ({
  id: generateId(),
  description: "",
  type: "material_quantity",
  formula: "",
  product_name: "",
  unit: "",
  conditional_field_id: "",
  conditional_value: "",
});

export function EstimateTemplateManager() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorCategory, setEditorCategory] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorSteps, setEditorSteps] = useState<any[]>([]);
  const [editorRules, setEditorRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "steps" | "rules">("info");

  useEffect(() => {
    loadAll();
    productsAPI.getCategories().then(setCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await estimateTemplatesAPI.getAll();
      setTemplates(data);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setEditorName("");
    setEditorCategory("");
    setEditorDescription("");
    setEditorSteps([emptyStep()]);
    setEditorRules([]);
    setActiveTab("info");
    setEditorOpen(true);
  };

  const openEdit = (template: any) => {
    setEditingId(template.id);
    setEditorName(template.name);
    setEditorCategory(template.category);
    setEditorDescription(template.description ?? "");
    setEditorSteps(template.steps ? JSON.parse(JSON.stringify(template.steps)) : []);
    setEditorRules(template.calc_rules ? JSON.parse(JSON.stringify(template.calc_rules)) : []);
    setActiveTab("info");
    setEditorOpen(true);
  };

  const openDuplicate = (template: any) => {
    setEditingId(null);
    setEditorName(`${template.name} (Copy)`);
    setEditorCategory(template.category);
    setEditorDescription(template.description ?? "");
    setEditorSteps(template.steps ? JSON.parse(JSON.stringify(template.steps)) : []);
    setEditorRules(template.calc_rules ? JSON.parse(JSON.stringify(template.calc_rules)) : []);
    setActiveTab("info");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editorName.trim() || !editorCategory) {
      toast.error("Name and category are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editorName.trim(),
        category: editorCategory,
        description: editorDescription.trim(),
        steps: editorSteps,
        calc_rules: editorRules,
      };
      if (editingId) {
        await estimateTemplatesAPI.update(editingId, payload);
        toast.success("Template updated");
      } else {
        await estimateTemplatesAPI.create(payload);
        toast.success("Template created");
      }
      setEditorOpen(false);
      loadAll();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await estimateTemplatesAPI.delete(deleteConfirm.id);
      toast.success("Template deleted");
      setDeleteConfirm(null);
      loadAll();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  // ── Step helpers ──────────────────────────────────────────────
  const addStep = () => {
    const s = emptyStep();
    s.order_index = editorSteps.length;
    setEditorSteps([...editorSteps, s]);
  };

  const removeStep = (idx: number) => {
    setEditorSteps(editorSteps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, key: string, value: any) => {
    setEditorSteps(editorSteps.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const arr = [...editorSteps];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setEditorSteps(arr);
  };

  // ── Field helpers ─────────────────────────────────────────────
  const addField = (stepIdx: number) => {
    const f = emptyField();
    setEditorSteps(
      editorSteps.map((s, i) => (i !== stepIdx ? s : { ...s, fields: [...s.fields, f] }))
    );
  };

  const removeField = (stepIdx: number, fieldIdx: number) => {
    setEditorSteps(
      editorSteps.map((s, i) => {
        if (i !== stepIdx) return s;
        return { ...s, fields: s.fields.filter((_: any, fi: number) => fi !== fieldIdx) };
      })
    );
  };

  const updateField = (stepIdx: number, fieldIdx: number, key: string, value: any) => {
    setEditorSteps(
      editorSteps.map((s, i) => {
        if (i !== stepIdx) return s;
        const fields = s.fields.map((f: any, fi: number) => {
          if (fi !== fieldIdx) return f;
          const updated = { ...f, [key]: value };
          // Auto-generate ID when label changes (if ID is still auto-generated or empty)
          if (key === "label") {
            const currentId = f.id ?? "";
            const wasAutoGenerated =
              !currentId ||
              currentId === labelToId(f.label ?? "") ||
              currentId.startsWith("f_");
            if (wasAutoGenerated) {
              updated.id = labelToId(value);
            }
          }
          return updated;
        });
        return { ...s, fields };
      })
    );
  };

  // ── Rule helpers ──────────────────────────────────────────────
  const addRule = () => setEditorRules([...editorRules, emptyRule()]);
  const removeRule = (idx: number) => setEditorRules(editorRules.filter((_, i) => i !== idx));
  const updateRule = (idx: number, key: string, value: any) => {
    setEditorRules(editorRules.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // All fields with label + id for dropdowns
  const allFields = editorSteps.flatMap((s) =>
    (s.fields ?? []).filter((f: any) => f.id).map((f: any) => ({ id: f.id, label: f.label || f.id }))
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Estimate Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Build estimate wizards — questions, choices, and automatic calculations
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search templates..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md"
      />

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{template.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {(template.steps ?? []).length} step
                        {(template.steps ?? []).length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {(template.calc_rules ?? []).length} calc rule
                        {(template.calc_rules ?? []).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openDuplicate(template)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm({ id: template.id, name: template.name })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {(template.steps ?? []).map((step: any, idx: number) => (
                    <div key={step.id} className="p-3 border rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground mb-1">Step {idx + 1}</div>
                      <div className="text-sm font-semibold">{step.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {(step.fields ?? []).length} field
                        {(step.fields ?? []).length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
                {(template.calc_rules ?? []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {(template.calc_rules ?? []).map((rule: any) => (
                      <div
                        key={rule.id}
                        className="text-xs p-2 bg-muted/50 rounded border flex items-center gap-2"
                      >
                        <span className="font-medium">{rule.description}</span>
                        {rule.product_name && (
                          <Badge variant="secondary" className="text-xs">
                            → {rule.product_name}
                          </Badge>
                        )}
                        {rule.conditional_field_id && (
                          <Badge variant="outline" className="text-xs">
                            Conditional
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Template Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>
              Define the questions your team answers, then set up the automatic calculations.
            </DialogDescription>
          </DialogHeader>

          {/* Tab nav */}
          <div className="flex border-b shrink-0 px-6">
            {(["info", "steps", "rules"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "info" && "Basic Info"}
                {tab === "steps" && `Questions (${editorSteps.length})`}
                {tab === "rules" && `Calculations (${editorRules.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* ── INFO TAB ── */}
            {activeTab === "info" && (
              <div className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    placeholder="e.g., Concrete Work"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={editorCategory} onValueChange={setEditorCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When a proposal uses this category, this wizard will launch automatically.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief description of what this template covers..."
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── STEPS / QUESTIONS TAB ── */}
            {activeTab === "steps" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each step is a screen the estimator sees. Add the questions you need answered to build the estimate.
                </p>
                {editorSteps.map((step, stepIdx) => (
                  <Card key={step.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
                          Step {stepIdx + 1}
                        </span>
                        <Input
                          placeholder="Step title (e.g., Project Type)"
                          value={step.title}
                          onChange={(e) => updateStep(stepIdx, "title", e.target.value)}
                          className="h-8"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveStep(stepIdx, -1)}
                          disabled={stepIdx === 0}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveStep(stepIdx, 1)}
                          disabled={stepIdx === editorSteps.length - 1}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(stepIdx)}
                          className="h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(step.fields ?? []).map((field: any, fieldIdx: number) => (
                        <div
                          key={fieldIdx}
                          className="border rounded-lg p-3 bg-muted/30 space-y-3"
                        >
                          {/* Row 1: Question label — full width, prominent */}
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs text-muted-foreground">Question / Label</Label>
                              <Input
                                placeholder="e.g., Square Footage"
                                value={field.label}
                                onChange={(e) =>
                                  updateField(stepIdx, fieldIdx, "label", e.target.value)
                                }
                                className="text-base font-medium h-10"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeField(stepIdx, fieldIdx)}
                              className="h-8 w-8 p-0 mt-5 shrink-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Row 2: Type + Required */}
                          <div className="flex items-center gap-4">
                            <div className="w-52 space-y-1">
                              <Label className="text-xs text-muted-foreground">Answer Type</Label>
                              <Select
                                value={field.type}
                                onValueChange={(v) =>
                                  updateField(stepIdx, fieldIdx, "type", v)
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value} className="text-sm">
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2 mt-5">
                              <Checkbox
                                id={`req-${stepIdx}-${fieldIdx}`}
                                checked={field.required}
                                onCheckedChange={(v) =>
                                  updateField(stepIdx, fieldIdx, "required", v)
                                }
                              />
                              <Label
                                htmlFor={`req-${stepIdx}-${fieldIdx}`}
                                className="text-sm cursor-pointer"
                              >
                                Required
                              </Label>
                            </div>
                          </div>

                          {/* Options for radio/select */}
                          {(field.type === "radio" || field.type === "select") && (
                            <div className="space-y-1">
                              <Label className="text-xs">Choices (comma-separated)</Label>
                              <Input
                                placeholder="e.g., Driveway, Patio, Walkway"
                                value={
                                  Array.isArray(field.options) ? field.options.join(", ") : ""
                                }
                                onChange={(e) =>
                                  updateField(
                                    stepIdx,
                                    fieldIdx,
                                    "options",
                                    e.target.value
                                      .split(",")
                                      .map((o) => o.trim())
                                      .filter(Boolean)
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                          )}

                          {/* Hint text + generated variable name */}
                          <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs">Hint Text (optional)</Label>
                              <Input
                                placeholder="Short note shown below the field"
                                value={field.help_text ?? ""}
                                onChange={(e) =>
                                  updateField(stepIdx, fieldIdx, "help_text", e.target.value)
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            {field.id && (
                              <div className="text-xs text-muted-foreground pb-2 shrink-0">
                                Variable:{" "}
                                <code className="bg-muted px-1 py-0.5 rounded">{field.id}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addField(stepIdx)}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Question
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            )}

            {/* ── CALCULATIONS TAB ── */}
            {activeTab === "rules" && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-sm text-blue-800">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Each rule runs when the wizard finishes and adds a line item to the proposal.
                    Use the variable names from your questions in the formula.
                  </div>
                </div>

                {/* Available variables reference */}
                {allFields.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <p className="text-xs font-semibold mb-2">Available variables for formulas:</p>
                    <div className="flex flex-wrap gap-2">
                      {allFields.map((f) => (
                        <div key={f.id} className="flex items-center gap-1 text-xs">
                          <code className="bg-background border rounded px-1.5 py-0.5 font-mono">
                            {f.id}
                          </code>
                          <span className="text-muted-foreground">= {f.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editorRules.map((rule, ruleIdx) => (
                  <Card key={rule.id} className="border-2">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">
                          Rule {ruleIdx + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRule(ruleIdx)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <Label className="text-xs">Rule Name / Description</Label>
                        <Input
                          placeholder="e.g., Calculate concrete cubic yards"
                          value={rule.description}
                          onChange={(e) => updateRule(ruleIdx, "description", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Formula */}
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity Formula *</Label>
                          <Input
                            placeholder="e.g., (squareFootage * (thickness / 12)) / 27"
                            value={rule.formula}
                            onChange={(e) => updateRule(ruleIdx, "formula", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            Math using variable names above. Result = quantity added to proposal.
                          </p>
                        </div>

                        {/* Product */}
                        <div className="space-y-1">
                          <Label className="text-xs">Product to Add</Label>
                          <Select
                            value={rule.product_name || "_none"}
                            onValueChange={(v) =>
                              updateRule(ruleIdx, "product_name", v === "_none" ? "" : v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" className="text-xs">
                                — None —
                              </SelectItem>
                              {dbProducts.map((p: any) => (
                                <SelectItem key={p.id} value={p.name} className="text-xs">
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* Unit override */}
                        <div className="space-y-1">
                          <Label className="text-xs">Unit (optional override)</Label>
                          <Input
                            placeholder="e.g., cubic yards"
                            value={rule.unit}
                            onChange={(e) => updateRule(ruleIdx, "unit", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Conditional field */}
                        <div className="space-y-1">
                          <Label className="text-xs">Only apply when…</Label>
                          <Select
                            value={rule.conditional_field_id || "_none"}
                            onValueChange={(v) =>
                              updateRule(
                                ruleIdx,
                                "conditional_field_id",
                                v === "_none" ? "" : v
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Always apply" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none" className="text-xs">
                                Always apply
                              </SelectItem>
                              {allFields.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Conditional value */}
                        <div className="space-y-1">
                          <Label className="text-xs">…equals</Label>
                          <Input
                            placeholder="e.g., Backyard"
                            value={rule.conditional_value}
                            onChange={(e) =>
                              updateRule(ruleIdx, "conditional_value", e.target.value)
                            }
                            className="h-8 text-sm"
                            disabled={!rule.conditional_field_id}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" onClick={addRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Calculation Rule
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex justify-between items-center shrink-0">
            <div className="flex gap-2">
              {activeTab !== "info" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab(activeTab === "rules" ? "steps" : "info")}
                >
                  ← Previous
                </Button>
              )}
              {activeTab !== "rules" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab(activeTab === "info" ? "steps" : "rules")}
                >
                  Next →
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
