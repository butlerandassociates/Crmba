import { useState, useEffect, useRef } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
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
import { SkeletonList } from "../ui/page-loader";
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
  round_up: false,
});

// ── Visual Formula Builder ─────────────────────────────────────────────────────
type Token = { id: string; type: "var" | "op" | "num"; value: string; label?: string };

function FormulaBuilder({
  value,
  onChange,
  variables,
}: {
  value: string;
  onChange: (v: string) => void;
  variables: { id: string; label: string }[];
}) {
  const [tokens, setTokens] = useState<Token[]>(() => {
    if (!value.trim()) return [];
    return value.trim().split(/\s+/).map((v, i) => {
      const isOp = ["+", "-", "*", "/", "(", ")", "%"].includes(v);
      const isNum = !isNaN(Number(v));
      const varMatch = variables.find((vr) => vr.id === v);
      return {
        id: `t-${i}`,
        type: isOp ? "op" : isNum ? "num" : "var",
        value: v,
        label: varMatch?.label,
      };
    });
  });
  const [numInput, setNumInput] = useState("");

  const pushToken = (token: Omit<Token, "id">) => {
    const newTokens = [...tokens, { ...token, id: `t-${Date.now()}` }];
    setTokens(newTokens);
    onChange(newTokens.map((t) => t.value).join(" "));
  };

  const removeToken = (id: string) => {
    const newTokens = tokens.filter((t) => t.id !== id);
    setTokens(newTokens);
    onChange(newTokens.map((t) => t.value).join(" "));
  };

  const clearAll = () => { setTokens([]); onChange(""); };

  const OPERATORS = ["+", "-", "*", "/", "(", ")", "%"];

  return (
    <div className="space-y-3 bg-slate-50 border rounded-lg p-4">
      {/* Step 1 — Pick a variable */}
      {variables.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">1. Click a field to use it</p>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => pushToken({ type: "var", value: v.id, label: v.label })}
                className="px-2.5 py-1 rounded-md bg-blue-100 border border-blue-300 text-blue-800 text-xs font-medium hover:bg-blue-200 transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Operators */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">2. Add an operator</p>
        <div className="flex gap-2">
          {OPERATORS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => pushToken({ type: "op", value: op })}
              className="w-9 h-9 rounded-md bg-slate-200 border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-300 transition-colors"
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3 — Number */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">3. Or type a number</p>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            placeholder="e.g. 27"
            value={numInput}
            onChange={(e) => setNumInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && numInput.trim()) {
                pushToken({ type: "num", value: numInput.trim() });
                setNumInput("");
              }
            }}
            className="h-9 w-32 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (numInput.trim()) {
                pushToken({ type: "num", value: numInput.trim() });
                setNumInput("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Formula display */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Formula</p>
          {tokens.length > 0 && (
            <button type="button" onClick={clearAll} className="text-xs text-destructive hover:opacity-75">Clear all</button>
          )}
        </div>
        <div className="min-h-[44px] flex flex-wrap gap-1.5 p-2 bg-white border rounded-md">
          {tokens.length === 0 ? (
            <span className="text-xs text-muted-foreground self-center">Build your formula above — tokens will appear here</span>
          ) : (
            tokens.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  t.type === "var" ? "bg-blue-100 text-blue-800 border border-blue-300" :
                  t.type === "num" ? "bg-green-100 text-green-800 border border-green-300" :
                  "bg-slate-100 text-slate-700 border border-slate-300 font-mono"
                }`}
              >
                {t.type === "var" ? (t.label ?? t.value) : t.value}
                <button type="button" onClick={() => removeToken(t.id)} className="opacity-50 hover:opacity-100 ml-0.5">×</button>
              </span>
            ))
          )}
        </div>
        {tokens.length > 0 && (
          <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {tokens.map((t) => t.value).join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function EstimateTemplateManager() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbUnits, setDbUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorTouched, setEditorTouched] = useState(false);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorName, setEditorName] = useState("");
  const [editorCategory, setEditorCategory] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorSteps, setEditorSteps] = useState<any[]>([]);
  const [editorRules, setEditorRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "steps" | "rules">("info");
  const stepsTableRef = useRef<HTMLDivElement>(null);
  const rulesTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
    productsAPI.getCategories().then(setCategories).catch(console.error);
    productsAPI.getAll().then(setDbProducts).catch(console.error);
    productsAPI.getUnits().then(setDbUnits).catch(console.error);
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

  useRealtimeRefetch(loadAll, ["estimate_templates", "products"], "estimate-templates");

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

  const editorNameErr     = !editorName.trim() ? "Template name is required." : editorName.trim().length < 2 ? "Min 2 characters." : "";
  const editorCategoryErr = !editorCategory ? "Category is required." : "";

  const handleSave = async () => {
    setEditorTouched(true);
    if (editorNameErr || editorCategoryErr) return;
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
    setTimeout(() => {
      stepsTableRef.current?.scrollTo({ top: stepsTableRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
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
  const addRule = () => {
    setEditorRules([...editorRules, emptyRule()]);
    setTimeout(() => {
      rulesTableRef.current?.scrollTo({ top: rulesTableRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };
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
        <SkeletonList rows={5} />
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <FileText className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No templates found</p>
          <p className="text-xs mt-1">Create a new template to get started with estimates.</p>
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
      <Dialog open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setEditorTouched(false); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] h-[85vh] flex flex-col p-0">
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

          {/* Contextual subheader — always visible, never scrolls */}
          {activeTab === "steps" && (
            <div className="shrink-0 border-b bg-muted/30 px-6 py-2.5">
              <p className="text-xs text-muted-foreground">
                Each step is a screen the estimator sees. One row = one question. Choices: comma-separated (e.g. <code className="bg-muted px-1 rounded">4 inch, 5 inch, 6 inch</code>).
              </p>
            </div>
          )}
          {activeTab === "rules" && allFields.length > 0 && (
            <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
              <p className="text-xs font-semibold mb-2">Field variables you can use in formulas:</p>
              <div className="flex flex-wrap gap-2">
                {allFields.map((f) => (
                  <div key={f.id} className="flex items-center gap-1 text-xs">
                    <code className="bg-background border rounded px-1.5 py-0.5 font-mono">{f.id}</code>
                    <span className="text-muted-foreground">= {f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">

            {/* ── INFO TAB ── */}
            {activeTab === "info" && (
              <div className="flex-1 overflow-y-auto space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label>Template Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., Concrete Work"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    className={editorTouched && editorNameErr ? "border-red-500" : ""}
                  />
                  {editorTouched && editorNameErr && <p className="text-xs text-red-500">{editorNameErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Category <span className="text-destructive">*</span></Label>
                  <Select value={editorCategory} onValueChange={setEditorCategory}>
                    <SelectTrigger className={editorTouched && editorCategoryErr ? "border-red-500" : ""}>
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
                  {editorTouched && editorCategoryErr
                    ? <p className="text-xs text-red-500">{editorCategoryErr}</p>
                    : <p className="text-xs text-muted-foreground">When a proposal uses this category, this wizard will launch automatically.</p>
                  }
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
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div ref={stepsTableRef} className="flex-1 min-h-0 border rounded-lg overflow-auto">
                  <table className="w-full min-w-max text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r w-8">#</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 240}}>Question Label</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 110}}>Variable</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 170}}>Type</th>
                        <th className="sticky top-0 z-10 bg-muted text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r w-20">Required</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 280}}>Choices <span className="font-normal">(radio/select — comma separated)</span></th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 200}}>Hint Text</th>
                        <th className="sticky top-0 z-10 bg-muted w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editorSteps.map((step, stepIdx) => (
                        <>
                          {/* Step header row */}
                          <tr key={`step-${stepIdx}`} className="bg-muted/40 border-b border-t">
                            <td colSpan={8} className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground shrink-0">Step {stepIdx + 1}</span>
                                <Input
                                  placeholder="Step title (e.g., Project Details)"
                                  value={step.title}
                                  onChange={(e) => updateStep(stepIdx, "title", e.target.value)}
                                  className="h-7 text-xs w-56 border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:bg-background"
                                />
                                <div className="flex items-center gap-1 ml-auto">
                                  <Button variant="ghost" size="sm" onClick={() => moveStep(stepIdx, -1)} disabled={stepIdx === 0} className="h-6 w-6 p-0">
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => moveStep(stepIdx, 1)} disabled={stepIdx === editorSteps.length - 1} className="h-6 w-6 p-0">
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => removeStep(stepIdx)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Field rows */}
                          {(step.fields ?? []).map((field: any, fieldIdx: number) => (
                            <tr key={`${stepIdx}-${fieldIdx}`} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-1.5 text-xs text-muted-foreground border-r text-center">{fieldIdx + 1}</td>
                              <td className="px-1.5 py-1.5 border-r">
                                <Input
                                  value={field.label}
                                  onChange={(e) => updateField(stepIdx, fieldIdx, "label", e.target.value)}
                                  placeholder="e.g., Square Footage"
                                  className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                                />
                              </td>
                              <td className="px-3 py-1.5 border-r">
                                {field.id ? (
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{field.id}</code>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-1.5 py-1.5 border-r">
                                <Select value={field.type} onValueChange={(v) => updateField(stepIdx, fieldIdx, "type", v)}>
                                  <SelectTrigger className="h-8 text-xs border-0 shadow-none focus:ring-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-3 py-1.5 border-r text-center">
                                <Checkbox
                                  checked={field.required}
                                  onCheckedChange={(v) => updateField(stepIdx, fieldIdx, "required", v)}
                                />
                              </td>
                              <td className="px-1.5 py-1.5 border-r">
                                {(field.type === "radio" || field.type === "select") ? (
                                  <Input
                                    value={Array.isArray(field.options) ? field.options.join(", ") : ""}
                                    onChange={(e) =>
                                      updateField(stepIdx, fieldIdx, "options",
                                        e.target.value.split(",").map((s: string) => s.trimStart()).filter(Boolean)
                                      )
                                    }
                                    placeholder="Option 1, Option 2, Option 3"
                                    className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                                  />
                                ) : (
                                  <span className="px-3 text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-1.5 py-1.5 border-r">
                                <Input
                                  value={field.help_text ?? ""}
                                  onChange={(e) => updateField(stepIdx, fieldIdx, "help_text", e.target.value)}
                                  placeholder="Optional hint..."
                                  className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeField(stepIdx, fieldIdx)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}

                          {/* Add question row */}
                          <tr key={`add-${stepIdx}`} className="border-b bg-muted/10">
                            <td colSpan={8} className="px-3 py-1.5">
                              <Button variant="ghost" size="sm" onClick={() => addField(stepIdx)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                                <Plus className="h-3 w-3 mr-1" /> Add Question to Step {stepIdx + 1}
                              </Button>
                            </td>
                          </tr>
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Step
                </Button>
              </div>
            )}

            {/* ── CALCULATIONS TAB ── */}
            {activeTab === "rules" && (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Spreadsheet table */}
                <div ref={rulesTableRef} className="flex-1 min-h-0 border rounded-lg overflow-auto">
                  <table className="w-full min-w-max text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-8 border-r">#</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 220}}>Rule Name</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 220}}>Product</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 280}}>
                          Formula
                          <span className="font-normal text-muted-foreground ml-1">(use field IDs above)</span>
                        </th>
                        <th className="sticky top-0 z-10 bg-muted text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r w-24">Round Up</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 130}}>Unit</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 180}}>Only when field</th>
                        <th className="sticky top-0 z-10 bg-muted text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground border-r" style={{minWidth: 160}}>= equals</th>
                        <th className="sticky top-0 z-10 bg-muted w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editorRules.map((rule, ruleIdx) => (
                        <tr key={rule.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground border-r">{ruleIdx + 1}</td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Input
                              value={rule.description}
                              onChange={(e) => updateRule(ruleIdx, "description", e.target.value)}
                              placeholder="e.g. Mortar bags"
                              className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Select
                              value={rule.product_name || "_none"}
                              onValueChange={(v) => updateRule(ruleIdx, "product_name", v === "_none" ? "" : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-0 shadow-none focus-visible:ring-1">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs">— None —</SelectItem>
                                {dbProducts.map((p: any) => (
                                  <SelectItem key={p.id} value={p.name} className="text-xs">{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Input
                              value={rule.formula}
                              onChange={(e) => updateRule(ruleIdx, "formula", e.target.value)}
                              placeholder="e.g. islandLF * 3"
                              className="h-8 text-xs font-mono border-0 shadow-none focus-visible:ring-1"
                            />
                          </td>
                          <td className="px-1.5 py-1.5 border-r text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Checkbox
                                checked={!!rule.round_up}
                                onCheckedChange={(v) => updateRule(ruleIdx, "round_up", !!v)}
                              />
                              <span className="text-[10px] text-muted-foreground">whole #</span>
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Select
                              value={rule.unit || "_none"}
                              onValueChange={(v) => updateRule(ruleIdx, "unit", v === "_none" ? "" : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-0 shadow-none focus-visible:ring-1">
                                <SelectValue placeholder="Default" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs">— Default —</SelectItem>
                                {dbUnits.map((u: any) => (
                                  <SelectItem key={u.id} value={u.name} className="text-xs">{u.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Select
                              value={rule.conditional_field_id || "_none"}
                              onValueChange={(v) => updateRule(ruleIdx, "conditional_field_id", v === "_none" ? "" : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-0 shadow-none focus-visible:ring-1">
                                <SelectValue placeholder="Always" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none" className="text-xs">Always apply</SelectItem>
                                {allFields.map((f) => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1.5 py-1.5 border-r">
                            <Input
                              value={rule.conditional_value}
                              onChange={(e) => updateRule(ruleIdx, "conditional_value", e.target.value)}
                              placeholder="e.g. Brick Veneer"
                              className="h-8 text-xs border-0 shadow-none focus-visible:ring-1"
                              disabled={!rule.conditional_field_id}
                            />
                          </td>
                          <td className="px-1.5 py-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRule(ruleIdx)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {editorRules.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                            No calculation rules yet. Click "Add Row" to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <Button variant="outline" onClick={addRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
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
