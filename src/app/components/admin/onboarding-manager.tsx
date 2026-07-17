import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Link, useBlocker } from "react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2,
  BookOpen, FileText, HelpCircle, ArrowLeft, CheckCircle, Settings2,
  BarChart3, Users, CheckCircle2, XCircle, Trophy, Upload, X,
} from "lucide-react";
import { SkeletonList } from "../ui/page-loader";

// ─── Types ────────────────────────────────────────────────────────────────────

type Program = { id: string; name: string; description: string; is_active: boolean };
type Module = { id: string; program_id: string; title: string; tagline: string; category: string; duration_minutes: number; sort_order: number; is_published: boolean };
type Section = { id: string; module_id: string; heading: string; content: ContentBlock[]; sort_order: number };
type Document = { id: string; program_id: string; title: string; category: string; is_required: boolean; file_size: string; effective_date: string; description: string; content: ContentBlock[]; sort_order: number; file_url: string | null };
type QuizQuestion = { id: string; program_id: string; category: string; question: string; options: string[]; correct_index: number; explanation: string; sort_order: number };
type ContentBlock =
  | { type: "body"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "callout"; callout_type: "tip" | "info" | "warning"; text: string }
  | { type: "table"; cols: string[]; rows: string[][] }
  | { type: "section_heading"; text: string };

const MODULE_CATS = ["Company", "Sales", "Estimating", "Communication", "Tools"];
const DOC_CATS = ["HR", "Compensation", "Estimating", "Sales", "Legal", "Operations"];
const QUIZ_CATS = ["Company", "Sales Process", "Estimating", "Proposals", "Communication", "CRM"];

const catColor = (c: string) => ({
  Company: "bg-blue-100 text-blue-700 border-blue-200",
  Sales: "bg-purple-100 text-purple-700 border-purple-200",
  Estimating: "bg-orange-100 text-orange-700 border-orange-200",
  Communication: "bg-green-100 text-green-700 border-green-200",
  Tools: "bg-gray-100 text-gray-600 border-gray-200",
  HR: "bg-pink-100 text-pink-700 border-pink-200",
  Compensation: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Legal: "bg-red-100 text-red-700 border-red-200",
  Operations: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "Sales Process": "bg-purple-100 text-purple-700 border-purple-200",
  Proposals: "bg-indigo-100 text-indigo-700 border-indigo-200",
  CRM: "bg-gray-100 text-gray-600 border-gray-200",
}[c] ?? "bg-gray-100 text-gray-600 border-gray-200");

// ─── Block Editor ─────────────────────────────────────────────────────────────

function BlockEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const add = (type: ContentBlock["type"]) => {
    const b: ContentBlock =
      type === "body" ? { type: "body", text: "" } :
      type === "bullets" ? { type: "bullets", items: [""] } :
      type === "callout" ? { type: "callout", callout_type: "info", text: "" } :
      type === "section_heading" ? { type: "section_heading", text: "" } :
      { type: "table", cols: ["Column 1", "Column 2"], rows: [["", ""]] };
    onChange([...blocks, b]);
  };
  const update = (i: number, b: ContentBlock) => { const n = [...blocks]; n[i] = b; onChange(n); };
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const moveUp = (i: number) => { if (!i) return; const n = [...blocks]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); };
  const moveDown = (i: number) => { if (i === blocks.length - 1) return; const n = [...blocks]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; onChange(n); };

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <div key={i} className="border rounded-lg p-3 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {block.type === "body" ? "Paragraph" : block.type === "bullets" ? "Bullet List" : block.type === "callout" ? "Callout" : block.type === "section_heading" ? "Section Heading" : "Table"}
            </span>
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(i)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(i)} disabled={i === blocks.length - 1}><ChevronDown className="h-3 w-3" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>

          {block.type === "section_heading" && (
            <Input value={block.text} onChange={e => update(i, { ...block, text: e.target.value })} placeholder="Section heading text..." className="h-9 text-sm font-semibold" />
          )}

          {block.type === "body" && (
            <Textarea value={block.text} onChange={e => update(i, { ...block, text: e.target.value })} placeholder="Write paragraph text..." rows={3} className="text-sm resize-none" />
          )}

          {block.type === "bullets" && (
            <div className="space-y-1.5">
              {block.items.map((item, j) => (
                <div key={j} className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <Input value={item} onChange={e => { const items = [...block.items]; items[j] = e.target.value; update(i, { ...block, items }); }} placeholder={`Item ${j + 1}`} className="h-8 text-sm" />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => { const items = block.items.filter((_, k) => k !== j); update(i, { ...block, items: items.length ? items : [""] }); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => update(i, { ...block, items: [...block.items, ""] })}><Plus className="h-3 w-3 mr-1" />Add item</Button>
            </div>
          )}

          {block.type === "callout" && (
            <div className="space-y-2">
              <Select value={block.callout_type} onValueChange={v => update(i, { ...block, callout_type: v as "tip" | "info" | "warning" })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tip">Tip</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
              <Textarea value={block.text} onChange={e => update(i, { ...block, text: e.target.value })} placeholder="Callout text..." rows={2} className="text-sm resize-none" />
            </div>
          )}

          {block.type === "table" && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Column headers (comma-separated)</Label>
                <Input value={block.cols.join(", ")} onChange={e => update(i, { ...block, cols: e.target.value.split(",").map(s => s.trim()) })} className="h-8 text-sm mt-1" placeholder="Col 1, Col 2, Col 3" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rows — one per line, values comma-separated</Label>
                <Textarea value={block.rows.map(r => r.join(", ")).join("\n")} onChange={e => update(i, { ...block, rows: e.target.value.split("\n").map(l => l.split(",").map(s => s.trim())) })} rows={4} className="text-sm font-mono mt-1 resize-none" placeholder={"Value 1, Value 2\nValue 3, Value 4"} />
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">Add block:</span>
        {(["section_heading", "body", "bullets", "callout", "table"] as const).map(type => (
          <Button key={type} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => add(type)}>
            <Plus className="h-3 w-3 mr-1" />
            {type === "section_heading" ? "Section" : type === "body" ? "Paragraph" : type === "bullets" ? "Bullets" : type === "callout" ? "Callout" : "Table"}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ─── Modules Tab ──────────────────────────────────────────────────────────────

function ModulesTab({ programId, onDirty }: { programId: string; onDirty?: (d: boolean) => void }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "sections">("list");
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Module | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; editing: Section | null }>({ open: false, editing: null });
  const [savingSection, setSavingSection] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string; kind: "module" | "section" } | null>(null);
  useEffect(() => { onDirty?.(dialog.open || sectionDialog.open); }, [dialog.open, sectionDialog.open]);

  const [form, setForm] = useState({ title: "", tagline: "", category: "Company", duration_minutes: 15, is_published: false, key_takeaways: [] as string[] });
  const [moduleErrors, setModuleErrors] = useState<{ title?: string }>({});
  const [secForm, setSecForm] = useState({ heading: "", content: [] as ContentBlock[] });
  const [secErrors, setSecErrors] = useState<{ heading?: string }>({});

  const loadModules = async () => {
    setLoading(true);
    const { data } = await supabase.from("onboarding_modules").select("*").eq("program_id", programId).order("sort_order");
    setModules(data ?? []);
    setLoading(false);
  };

  const loadSections = async (moduleId: string) => {
    setSectionsLoading(true);
    const { data } = await supabase.from("onboarding_sections").select("*").eq("module_id", moduleId).order("sort_order");
    setSections((data ?? []).map(s => ({ ...s, content: s.content ?? [] })));
    setSectionsLoading(false);
  };

  useEffect(() => { loadModules(); }, [programId]);

  const openEdit = (m: Module) => {
    setForm({ title: m.title, tagline: m.tagline ?? "", category: m.category, duration_minutes: m.duration_minutes, is_published: m.is_published, key_takeaways: (m as any).key_takeaways ?? [] });
    setModuleErrors({});
    setDialog({ open: true, editing: m });
  };

  const openCreate = () => {
    setForm({ title: "", tagline: "", category: "Company", duration_minutes: 15, is_published: false, key_takeaways: [] });
    setModuleErrors({});
    setDialog({ open: true, editing: null });
  };

  const saveModule = async () => {
    const errs: { title?: string } = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (Object.keys(errs).length) { setModuleErrors(errs); return; }
    setModuleErrors({});
    setSaving(true);
    try {
      if (dialog.editing) {
        const { error } = await supabase.from("onboarding_modules").update({ ...form, updated_at: new Date().toISOString() }).eq("id", dialog.editing.id);
        if (error) throw error;
        toast.success("Module updated.");
      } else {
        const maxOrder = modules.length ? Math.max(...modules.map(m => m.sort_order)) : 0;
        const { error } = await supabase.from("onboarding_modules").insert({ ...form, program_id: programId, sort_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Module created.");
      }
      setDialog({ open: false, editing: null });
      loadModules();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deleteModule = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("onboarding_modules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Module deleted."); loadModules(); }
    setDeletingId(null);
  };

  const moveModule = async (id: string, dir: "up" | "down") => {
    const idx = modules.findIndex(m => m.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= modules.length) return;
    const a = modules[idx], b = modules[swapIdx];
    await Promise.all([
      supabase.from("onboarding_modules").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("onboarding_modules").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    loadModules();
  };

  const togglePublished = async (m: Module) => {
    await supabase.from("onboarding_modules").update({ is_published: !m.is_published, updated_at: new Date().toISOString() }).eq("id", m.id);
    loadModules();
  };

  const openSections = async (m: Module) => {
    setActiveModule(m);
    setView("sections");
    await loadSections(m.id);
  };

  const openEditSection = (s: Section) => {
    setSecForm({ heading: s.heading, content: s.content ?? [] });
    setSecErrors({});
    setSectionDialog({ open: true, editing: s });
  };

  const openAddSection = () => {
    setSecForm({ heading: "", content: [] });
    setSecErrors({});
    setSectionDialog({ open: true, editing: null });
  };

  const saveSection = async () => {
    const errs: { heading?: string } = {};
    if (!secForm.heading.trim()) errs.heading = "Heading is required.";
    if (Object.keys(errs).length) { setSecErrors(errs); return; }
    setSecErrors({});
    setSavingSection(true);
    try {
      if (sectionDialog.editing) {
        const { error } = await supabase.from("onboarding_sections").update({ heading: secForm.heading, content: secForm.content }).eq("id", sectionDialog.editing.id);
        if (error) throw error;
        toast.success("Section updated.");
      } else {
        const maxOrder = sections.length ? Math.max(...sections.map(s => s.sort_order)) : 0;
        const { error } = await supabase.from("onboarding_sections").insert({ module_id: activeModule!.id, heading: secForm.heading, content: secForm.content, sort_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Section added.");
      }
      setSectionDialog({ open: false, editing: null });
      if (activeModule) loadSections(activeModule.id);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingSection(false); }
  };

  const deleteSection = async (id: string) => {
    const { error } = await supabase.from("onboarding_sections").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Section deleted."); if (activeModule) loadSections(activeModule.id); }
  };

  const moveSection = async (id: string, dir: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx], b = sections[swapIdx];
    await Promise.all([
      supabase.from("onboarding_sections").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("onboarding_sections").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (activeModule) loadSections(activeModule.id);
  };

  // ── Sections view ──
  if (view === "sections" && activeModule) {
    return (
      <div className="space-y-0">
        <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveModule(null); }} className="shrink-0 -ml-1">
                <ArrowLeft className="h-4 w-4 mr-1.5" />Back
              </Button>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{activeModule.title}</h3>
                <p className="text-xs text-muted-foreground">{sections.length} section{sections.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <Button size="sm" onClick={openAddSection}><Plus className="h-4 w-4 mr-1.5" />Add Section</Button>
          </div>
        </div>

        {sectionsLoading ? <div className="pt-6"><SkeletonList rows={4} /></div> : sections.length === 0 ? (
          <div className="text-center py-16 border rounded-xl">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No sections yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add the first section for this module.</p>
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {sections.map((s, idx) => (
              <div key={s.id} className="flex items-start gap-3 border rounded-lg px-4 py-3 bg-card">
                <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveSection(s.id, "up")}><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sections.length - 1} onClick={() => moveSection(s.id, "down")}><ChevronDown className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.heading}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(s.content ?? []).length} content block{(s.content ?? []).length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditSection(s)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ id: s.id, label: s.heading, kind: "section" })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section dialog */}
        <Dialog open={sectionDialog.open} onOpenChange={o => { if (!o) setSectionDialog({ open: false, editing: null }); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{sectionDialog.editing ? "Edit Section" : "Add Section"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div>
                <Label>Heading <span className="text-destructive">*</span></Label>
                <Input
                  value={secForm.heading}
                  onChange={e => { setSecForm(f => ({ ...f, heading: e.target.value })); if (e.target.value.trim()) setSecErrors(fe => ({ ...fe, heading: undefined })); }}
                  placeholder="Section heading..."
                  className={`mt-1${secErrors.heading ? " border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {secErrors.heading && <p className="text-xs text-destructive mt-1">{secErrors.heading}</p>}
              </div>
              <div>
                <Label className="mb-2 block">Content Blocks</Label>
                <BlockEditor blocks={secForm.content} onChange={content => setSecForm(f => ({ ...f, content }))} />
              </div>
            </div>
            <DialogFooter className="px-6 pb-4">
              <Button variant="outline" onClick={() => setSectionDialog({ open: false, editing: null })}>Cancel</Button>
              <Button onClick={saveSection} disabled={savingSection}>
                {savingSection ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : sectionDialog.editing ? "Save Changes" : "Add Section"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Module list view ──
  return (
    <div className="space-y-0">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">Training Modules</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{modules.length} module{modules.length !== 1 ? "s" : ""} — sequential order</p>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Add Module</Button>
        </div>
      </div>

      {loading ? <div className="pt-6"><SkeletonList rows={6} /></div> : modules.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No modules yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create the first training module.</p>
        </div>
      ) : (
        <div className="space-y-2 pt-4">
          {modules.map((m, idx) => (
            <div key={m.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card">
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveModule(m.id, "up")}><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === modules.length - 1} onClick={() => moveModule(m.id, "down")}><ChevronDown className="h-3.5 w-3.5" /></Button>
              </div>
              <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">{m.sort_order}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{m.title}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${catColor(m.category)}`}>{m.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.tagline}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">{m.duration_minutes} min</span>
                <div className="flex items-center gap-1.5">
                  <Switch checked={m.is_published} onCheckedChange={() => togglePublished(m)} className="scale-90" />
                  <span className="text-xs text-muted-foreground">{m.is_published ? "Live" : "Draft"}</span>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openSections(m)}>
                  <BookOpen className="h-3 w-3 mr-1" />Sections
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deletingId === m.id} onClick={() => setDeleteConfirm({ id: m.id, label: m.title, kind: "module" })}>
                  {deletingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => { if (!o) setDeleteConfirm(null); }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm?.kind === "module" ? "module" : "section"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">"{deleteConfirm?.label}"</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!deleteConfirm) return;
              if (deleteConfirm.kind === "module") await deleteModule(deleteConfirm.id);
              else await deleteSection(deleteConfirm.id);
              setDeleteConfirm(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>

      {/* Module create/edit dialog */}
      <Dialog open={dialog.open} onOpenChange={o => { if (!o) setDialog({ open: false, editing: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Module" : "Add Module"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); if (e.target.value.trim()) setModuleErrors(fe => ({ ...fe, title: undefined })); }}
                placeholder="Module title..."
                className={`mt-1${moduleErrors.title ? " border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {moduleErrors.title && <p className="text-xs text-destructive mt-1">{moduleErrors.title}</p>}
            </div>
            <div>
              <Label>Tagline <span className="text-muted-foreground font-normal">(shown in module list)</span></Label>
              <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="One-line description..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} className="mt-1" min={1} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} />
              <Label>Published (visible to employees)</Label>
            </div>
            <div>
              <Label>Key Takeaways <span className="text-muted-foreground font-normal">(shown after employee completes module)</span></Label>
              <div className="space-y-1.5 mt-1">
                {form.key_takeaways.map((kt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm shrink-0">★</span>
                    <Input value={kt} onChange={e => { const kts = [...form.key_takeaways]; kts[i] = e.target.value; setForm(f => ({ ...f, key_takeaways: kts })); }} placeholder={`Takeaway ${i + 1}`} className="h-8 text-sm" />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => setForm(f => ({ ...f, key_takeaways: f.key_takeaways.filter((_, j) => j !== i) }))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={() => setForm(f => ({ ...f, key_takeaways: [...f.key_takeaways, ""] }))}><Plus className="h-3 w-3 mr-1" />Add takeaway</Button>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-4">
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveModule} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : dialog.editing ? "Save Changes" : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ programId, onDirty }: { programId: string; onDirty?: (d: boolean) => void }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "content">("list");
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Document | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [form, setForm] = useState({ title: "", category: "HR", is_required: false, file_size: "", effective_date: "", description: "" });
  const [formErrors, setFormErrors] = useState<{ title?: string }>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [savingContent, setSavingContent] = useState(false);
  useEffect(() => { onDirty?.(dialog.open || view === "content"); }, [dialog.open, view]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("onboarding_documents").select("*").eq("program_id", programId).order("sort_order");
    setDocs((data ?? []).map(d => ({ ...d, content: d.content ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [programId]);

  const openEdit = (d: Document) => {
    setForm({ title: d.title, category: d.category, is_required: d.is_required, file_size: d.file_size ?? "", effective_date: d.effective_date ?? "", description: d.description ?? "" });
    setPendingFile(null);
    setFormErrors({});
    setDialog({ open: true, editing: d });
  };

  const openCreate = () => {
    setForm({ title: "", category: "HR", is_required: false, file_size: "", effective_date: "", description: "" });
    setPendingFile(null);
    setFormErrors({});
    setDialog({ open: true, editing: null });
  };

  const saveDoc = async () => {
    const errs: { title?: string } = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setSaving(true);
    try {
      let file_url: string | null = dialog.editing?.file_url ?? null;
      const docId = dialog.editing?.id ?? crypto.randomUUID();
      let fileSize = form.file_size;

      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
        const path = `${programId}/${docId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("onboarding-documents")
          .upload(path, pendingFile, { upsert: true });
        if (upErr) throw upErr;
        file_url = supabase.storage.from("onboarding-documents").getPublicUrl(path).data.publicUrl;
        if (!fileSize) {
          const bytes = pendingFile.size;
          fileSize = bytes >= 1_000_000
            ? `${(bytes / 1_000_000).toFixed(1)} MB`
            : `${Math.round(bytes / 1000)} KB`;
        }
      }

      const payload = {
        ...form,
        description: form.description || null,
        file_size: fileSize || null,
        effective_date: form.effective_date || null,
        file_url,
      };

      if (dialog.editing) {
        const { error } = await supabase.from("onboarding_documents")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", docId);
        if (error) throw error;
        toast.success("Document updated.");
      } else {
        const maxOrder = docs.length ? Math.max(...docs.map(d => d.sort_order)) : 0;
        const { error } = await supabase.from("onboarding_documents")
          .insert({ id: docId, ...payload, program_id: programId, sort_order: maxOrder + 1, content: [] });
        if (error) throw error;
        toast.success("Document created.");
      }
      setDialog({ open: false, editing: null });
      setPendingFile(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deleteDoc = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("onboarding_documents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Document deleted."); load(); }
    setDeletingId(null);
  };

  const moveDoc = async (id: string, dir: "up" | "down") => {
    const idx = docs.findIndex(d => d.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= docs.length) return;
    const a = docs[idx], b = docs[swapIdx];
    await Promise.all([
      supabase.from("onboarding_documents").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("onboarding_documents").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const openContent = (d: Document) => {
    setActiveDoc(d);
    setContentBlocks(d.content ?? []);
    setView("content");
  };

  const saveContent = async () => {
    if (!activeDoc) return;
    setSavingContent(true);
    const { error } = await supabase.from("onboarding_documents").update({ content: contentBlocks, updated_at: new Date().toISOString() }).eq("id", activeDoc.id);
    if (error) toast.error(error.message);
    else { toast.success("Document content saved."); load(); }
    setSavingContent(false);
  };

  // ── Content editor view ──
  if (view === "content" && activeDoc) {
    return (
      <div className="space-y-0">
        <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveDoc(null); }} className="shrink-0 -ml-1">
                <ArrowLeft className="h-4 w-4 mr-1.5" />Back
              </Button>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{activeDoc.title}</h3>
                <p className="text-xs text-muted-foreground">Document content editor</p>
              </div>
            </div>
            <Button size="sm" onClick={saveContent} disabled={savingContent}>
              {savingContent ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Content"}
            </Button>
          </div>
        </div>
        <div className="pt-4">
          <BlockEditor blocks={contentBlocks} onChange={setContentBlocks} />
        </div>
      </div>
    );
  }

  // ── Document list view ──
  return (
    <div className="space-y-0">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">Internal Documents</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{docs.filter(d => d.is_required).length} required · {docs.filter(d => !d.is_required).length} optional</p>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Add Document</Button>
        </div>
      </div>

      {loading ? <div className="pt-6"><SkeletonList rows={7} /></div> : docs.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No documents yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add the first document for this program.</p>
        </div>
      ) : (
        <div className="space-y-2 pt-4">
          {docs.map((d, idx) => (
            <div key={d.id} className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-card">
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveDoc(d.id, "up")}><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === docs.length - 1} onClick={() => moveDoc(d.id, "down")}><ChevronDown className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{d.title}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${catColor(d.category)}`}>{d.category}</span>
                  {d.is_required && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">Required</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                <p className="text-xs text-muted-foreground">{d.file_size && `${d.file_size} · `}{d.effective_date && `Effective ${d.effective_date}`}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openContent(d)}>
                  <FileText className="h-3 w-3 mr-1" />Content
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deletingId === d.id} onClick={() => setDeleteConfirm({ id: d.id, label: d.title })}>
                  {deletingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => { if (!o) setDeleteConfirm(null); }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">"{deleteConfirm?.label}"</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!deleteConfirm) return;
              await deleteDoc(deleteConfirm.id);
              setDeleteConfirm(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>

      {/* Document metadata dialog */}
      <Dialog open={dialog.open} onOpenChange={o => { if (!o) setDialog({ open: false, editing: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Document" : "Add Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); if (e.target.value.trim()) setFormErrors(fe => ({ ...fe, title: undefined })); }}
                placeholder="Document title..."
                className={`mt-1${formErrors.title ? " border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {formErrors.title && <p className="text-xs text-destructive mt-1">{formErrors.title}</p>}
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="One-line description..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>File size <span className="text-muted-foreground font-normal">(display only)</span></Label>
                <Input value={form.file_size} onChange={e => setForm(f => ({ ...f, file_size: e.target.value }))} placeholder="e.g. 2.4 MB" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Effective date</Label>
              <Input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>PDF File <span className="text-muted-foreground font-normal">(optional — replaces generated PDF)</span></Label>
              {dialog.editing?.file_url && !pendingFile && (
                <div className="mt-1 flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-muted/30">
                  <FileText className="h-4 w-4 shrink-0 text-red-500" />
                  <span className="truncate flex-1 text-muted-foreground text-xs">{dialog.editing.file_url.split("/").pop()}</span>
                  <button
                    type="button"
                    onClick={() => setDialog(d => ({ ...d, editing: d.editing ? { ...d.editing, file_url: null } : null }))}
                    className="text-destructive hover:text-destructive/80 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <label className="mt-1 flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2.5 hover:bg-accent transition-colors text-sm text-muted-foreground">
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">{pendingFile ? pendingFile.name : "Choose PDF…"}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setPendingFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {pendingFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingFile.size >= 1_000_000 ? `${(pendingFile.size / 1_000_000).toFixed(1)} MB` : `${Math.round(pendingFile.size / 1000)} KB`} · will upload on save
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_required} onCheckedChange={v => setForm(f => ({ ...f, is_required: v }))} />
              <Label>Required (employee must acknowledge before completing)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={saveDoc} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : dialog.editing ? "Save Changes" : "Create Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function QuizTab({ programId, onDirty }: { programId: string; onDirty?: (d: boolean) => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [dialog, setDialog] = useState<{ open: boolean; editing: QuizQuestion | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "Company", question: "", options: ["", "", "", ""], correct_index: 0, explanation: "" });
  const [quizErrors, setQuizErrors] = useState<{ question?: string; options?: string }>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  useEffect(() => { onDirty?.(dialog.open); }, [dialog.open]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("onboarding_quiz_questions").select("*").eq("program_id", programId).order("sort_order");
    setQuestions((data ?? []).map(q => ({ ...q, options: q.options ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [programId]);

  const openEdit = (q: QuizQuestion) => {
    const opts = [...q.options];
    while (opts.length < 4) opts.push("");
    setForm({ category: q.category, question: q.question, options: opts.slice(0, 4), correct_index: q.correct_index, explanation: q.explanation ?? "" });
    setQuizErrors({});
    setDialog({ open: true, editing: q });
  };

  const openCreate = () => {
    setForm({ category: "Company", question: "", options: ["", "", "", ""], correct_index: 0, explanation: "" });
    setQuizErrors({});
    setDialog({ open: true, editing: null });
  };

  const save = async () => {
    const errs: { question?: string; options?: string } = {};
    if (!form.question.trim()) errs.question = "Question is required.";
    if (form.options.filter(o => o.trim()).length < 2) errs.options = "At least 2 answer options are required.";
    if (Object.keys(errs).length) { setQuizErrors(errs); return; }
    const correctText = form.options[form.correct_index]?.trim();
    if (!correctText) { setQuizErrors({ options: "The correct answer cannot be blank." }); return; }
    const filteredOptions = form.options.filter(o => o.trim());
    const newCorrectIndex = filteredOptions.indexOf(correctText);
    setQuizErrors({});
    setSaving(true);
    try {
      const payload = { ...form, options: filteredOptions, correct_index: newCorrectIndex, program_id: programId };
      if (dialog.editing) {
        const { error } = await supabase.from("onboarding_quiz_questions").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", dialog.editing.id);
        if (error) throw error;
        toast.success("Question updated.");
      } else {
        const maxOrder = questions.length ? Math.max(...questions.map(q => q.sort_order)) : 0;
        const { error } = await supabase.from("onboarding_quiz_questions").insert({ ...payload, sort_order: maxOrder + 1 });
        if (error) throw error;
        toast.success("Question added.");
      }
      setDialog({ open: false, editing: null });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deleteQ = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("onboarding_quiz_questions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Question deleted."); load(); }
    setDeletingId(null);
  };

  const cats = ["All", ...QUIZ_CATS];
  const filtered = filter === "All" ? questions : questions.filter(q => q.category === filter);

  return (
    <div className="space-y-0">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-base">Quiz Questions</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{questions.length} questions · 90% pass threshold</p>
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Add Question</Button>
        </div>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-0.5">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === c ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:border-foreground/50"}`}
            >
              {c} {c !== "All" && `(${questions.filter(q => q.category === c).length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="pt-6"><SkeletonList rows={8} /></div> : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">{questions.length === 0 ? "No questions yet" : "No questions in this category"}</p>
          <p className="text-xs text-muted-foreground mt-1">{questions.length === 0 ? "Add the first quiz question." : "Select a different category or add a new question."}</p>
        </div>
      ) : (
        <div className="space-y-2 pt-4">
          {filtered.map((q, idx) => (
            <div key={q.id} className="flex items-start gap-3 border rounded-lg px-4 py-3 bg-card">
              <span className="text-sm font-bold text-muted-foreground w-6 shrink-0 pt-0.5">{idx + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${catColor(q.category)}`}>{q.category}</span>
                </div>
                <p className="font-medium text-sm">{q.question}</p>
                <div className="mt-1.5 space-y-0.5">
                  {q.options.map((opt, i) => (
                    <p key={i} className={`text-xs flex items-center gap-1.5 ${i === q.correct_index ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                      {i === q.correct_index ? <CheckCircle className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0" />}
                      {String.fromCharCode(65 + i)}. {opt}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deletingId === q.id} onClick={() => setDeleteConfirm({ id: q.id, label: q.question.substring(0, 60) })}>
                  {deletingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => { if (!o) setDeleteConfirm(null); }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question{deleteConfirm?.label ? `: "${deleteConfirm.label}…"` : ""}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!deleteConfirm) return;
              await deleteQ(deleteConfirm.id);
              setDeleteConfirm(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>

      {/* Quiz question dialog */}
      <Dialog open={dialog.open} onOpenChange={o => { if (!o) setDialog({ open: false, editing: null }); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{QUIZ_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Question <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.question}
                onChange={e => { setForm(f => ({ ...f, question: e.target.value })); if (e.target.value.trim()) setQuizErrors(fe => ({ ...fe, question: undefined })); }}
                placeholder="Write the question..."
                rows={3}
                className={`mt-1 resize-none${quizErrors.question ? " border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {quizErrors.question && <p className="text-xs text-destructive mt-1">{quizErrors.question}</p>}
            </div>
            <div className="space-y-2">
              <Label>Answer Options <span className="text-destructive">*</span></Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, correct_index: i }))}
                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${form.correct_index === i ? "border-green-500 bg-green-500" : "border-border hover:border-green-400"}`}
                  >
                    {form.correct_index === i && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <span className="text-sm font-medium text-muted-foreground w-4 shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <Input
                    value={opt}
                    onChange={e => { setForm(f => { const options = [...f.options]; options[i] = e.target.value; return { ...f, options }; }); setQuizErrors(fe => ({ ...fe, options: undefined })); }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
              {quizErrors.options
                ? <p className="text-xs text-destructive">{quizErrors.options}</p>
                : <p className="text-xs text-muted-foreground">Click the circle next to an option to mark it as the correct answer.</p>
              }
            </div>
            <div>
              <Label>Explanation <span className="text-muted-foreground font-normal">(shown after answering)</span></Label>
              <Textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Explain why the correct answer is right..." rows={3} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : dialog.editing ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TrackingTab ──────────────────────────────────────────────────────────────

type TrackProfile = { id: string; first_name: string; last_name: string; role: string };
type TrackProgress = { user_id: string; module_id: string; status: string; completed_at: string | null };
type TrackAck = { user_id: string; document_id: string; acknowledged_at: string };
type TrackAttempt = { user_id: string; score: number; pct: number; attempt_number: number; completed_at: string };

function TrackingTab({ programId }: { programId: string }) {
  const [profiles, setProfiles] = useState<TrackProfile[]>([]);
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<TrackProgress[]>([]);
  const [acks, setAcks] = useState<TrackAck[]>([]);
  const [attempts, setAttempts] = useState<TrackAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [nudging, setNudging] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<{ userId: string; name: string } | null>(null);

  const GHOST_ID = "00000000-0000-0000-0000-000000000000";

  const load = async () => {
    setLoading(true);
    const [modsRes, docsRes] = await Promise.all([
      supabase.from("onboarding_modules").select("id, title").eq("program_id", programId).order("sort_order"),
      supabase.from("onboarding_documents").select("id").eq("program_id", programId),
    ]);
    const mods = modsRes.data ?? [];
    const dIds = (docsRes.data ?? []).map((d: { id: string }) => d.id);
    const modIds = mods.map((m: { id: string }) => m.id);
    setModules(mods);
    setDocIds(dIds);
    const [profilesRes, progRes, acksRes, attemptsRes] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, role").in("role", ["sales_rep", "project_manager"]).eq("is_active", true).order("first_name"),
      supabase.from("onboarding_module_progress").select("user_id, module_id, status, completed_at").in("module_id", modIds.length > 0 ? modIds : [GHOST_ID]),
      supabase.from("onboarding_document_acknowledgments").select("user_id, document_id, acknowledged_at").in("document_id", dIds.length > 0 ? dIds : [GHOST_ID]),
      supabase.from("onboarding_quiz_attempts").select("user_id, score, pct, attempt_number, completed_at").eq("program_id", programId).order("completed_at"),
    ]);
    setProfiles(profilesRes.data ?? []);
    setProgress(progRes.data ?? []);
    setAcks(acksRes.data ?? []);
    setAttempts(attemptsRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [programId]);

  const handleNudge = async (userId: string, name: string) => {
    setNudging(userId);
    try {
      const { data, error } = await supabase.functions.invoke("send-onboarding-reminders", { body: { user_id: userId } });
      if (error) throw error;
      if (data?.sent === 0) {
        toast.info(`${name} is already at 100% — no reminder needed.`);
      } else {
        toast.success(`Reminder sent to ${name}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[nudge] edge function error:", msg);
      toast.error("Failed to send reminder.");
    }
    finally { setNudging(null); }
  };

  const handleResetQuiz = async (userId: string) => {
    setResetting(userId);
    const { error } = await supabase.from("onboarding_quiz_attempts").delete().eq("user_id", userId).eq("program_id", programId);
    if (error) { toast.error("Reset failed: " + error.message); }
    else {
      setAttempts(prev => prev.filter(a => a.user_id !== userId));
      toast.success(`Quiz reset for ${name}.`);
    }
    setResetting(null);
  };

  if (loading) return <div className="pt-4"><SkeletonList rows={5} /></div>;

  if (profiles.length === 0) {
    return (
      <div className="text-center py-16 border rounded-xl">
        <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">No employees found</p>
        <p className="text-xs text-muted-foreground mt-1">No sales reps or project managers have accounts yet.</p>
      </div>
    );
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const employeeStats = profiles.map(profile => {
    const completedMods = progress.filter(p => p.user_id === profile.id && p.status === "completed").length;
    const userAcks      = acks.filter(a => a.user_id === profile.id).length;
    const userAttempts  = attempts.filter(a => a.user_id === profile.id);
    const bestPct       = userAttempts.length > 0 ? Math.max(...userAttempts.map(a => Number(a.pct))) : 0;
    const quizPassed    = bestPct >= 90;
    const overallPct    = Math.round(
      (completedMods / Math.max(modules.length, 1)) * 50 +
      (userAcks      / Math.max(docIds.length,  1)) * 30 +
      (quizPassed ? 20 : 0)
    );
    const latestMod     = [...progress.filter(p => p.user_id === profile.id && p.completed_at)].sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
    const latestAck     = [...acks.filter(a => a.user_id === profile.id)].sort((a, b) => new Date((b as any).acknowledged_at).getTime() - new Date((a as any).acknowledged_at).getTime())[0];
    const latestAttempt = userAttempts[userAttempts.length - 1] ?? null;
    const completionDate = overallPct >= 100
      ? [latestMod?.completed_at, (latestAck as any)?.acknowledged_at, latestAttempt?.completed_at]
          .filter(Boolean).sort().reverse()[0] ?? null
      : null;
    return { profile, completedMods, userAcks, userAttempts, bestPct, quizPassed, overallPct, latestAttempt, completionDate };
  });

  const completedCount   = employeeStats.filter(e => e.overallPct >= 100).length;
  const inProgressCount  = employeeStats.filter(e => e.overallPct > 0 && e.overallPct < 100).length;
  const notStartedCount  = employeeStats.filter(e => e.overallPct === 0).length;
  const completedEmployees = employeeStats.filter(e => e.overallPct >= 100);
  const incompleteEmployees = employeeStats.filter(e => e.overallPct < 100);

  return (
    <div className="pt-4 space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",       value: profiles.length,  cls: "" },
          { label: "Completed",   value: completedCount,   cls: "text-green-600" },
          { label: "In Progress", value: inProgressCount,  cls: "text-amber-600" },
          { label: "Not Started", value: notStartedCount,  cls: "text-muted-foreground" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="border rounded-xl p-4 bg-card text-center">
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Employee Progress</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{profiles.length} employee{profiles.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Modules</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Docs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Quiz</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {incompleteEmployees.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">All employees have completed onboarding.</td></tr>
            )}
            {incompleteEmployees.map(({ profile, completedMods, userAcks, userAttempts, bestPct, quizPassed, overallPct, latestAttempt }) => {
              const fullName = `${profile.first_name} ${profile.last_name}`;
              return (
                <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{fullName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-20 bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${overallPct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{overallPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-muted-foreground">{profile.role.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {completedMods === modules.length && modules.length > 0
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        : <div className="h-3.5 w-3.5" />}
                      <span>{completedMods}/{modules.length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {userAcks === docIds.length && docIds.length > 0
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        : <div className="h-3.5 w-3.5" />}
                      <span>{userAcks}/{docIds.length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {userAttempts.length === 0 ? (
                      <span className="text-muted-foreground text-xs">Not started</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {quizPassed
                          ? <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        <span>{bestPct.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground">({userAttempts.length}/3)</span>
                        {latestAttempt && (
                          <span className="text-xs text-muted-foreground hidden lg:inline">
                            · {new Date(latestAttempt.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-xs" disabled={nudging === profile.id}
                        onClick={() => handleNudge(profile.id, fullName)}>
                        {nudging === profile.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Nudge"}
                      </Button>
                      {userAttempts.length > 0 && (
                        <Button size="sm" variant="outline" className="text-xs" disabled={resetting === profile.id}
                          onClick={() => setResetConfirm({ userId: profile.id, name: fullName })}>
                          {resetting === profile.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reset Quiz"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Completion Records ── */}
      {completedEmployees.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
              <Trophy className="h-4 w-4" />Completion Records
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{completedEmployees.length} employee{completedEmployees.length !== 1 ? "s" : ""} completed onboarding</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-green-200 dark:border-green-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Quiz Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-100 dark:divide-green-900/50">
                {completedEmployees.map(({ profile, bestPct, userAttempts, completionDate }) => (
                  <tr key={profile.id} className="bg-green-50/40 dark:bg-green-950/10 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="font-medium">{profile.first_name} {profile.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{profile.role.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold">{bestPct.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground">({userAttempts.length} attempt{userAttempts.length !== 1 ? "s" : ""})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {completionDate
                        ? new Date(completionDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Quiz confirmation */}
      <AlertDialog open={!!resetConfirm} onOpenChange={o => { if (!o) setResetConfirm(null); }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset quiz attempts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all quiz attempts for <span className="font-semibold">{resetConfirm?.name}</span> and allow them to start over. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!resetConfirm) return;
              await handleResetQuiz(resetConfirm.userId);
              setResetConfirm(null);
            }}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progDialog, setProgDialog] = useState(false);
  const [progForm, setProgForm] = useState({ name: "", description: "", due_date: "" });
  const [savingProg, setSavingProg] = useState(false);
  const [adminDirty, setAdminDirty] = useState(false);
  const [activeManagerTab, setActiveManagerTab] = useState("modules");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [adminWarnOpen, setAdminWarnOpen] = useState(false);
  const adminBlocker = useBlocker(adminDirty);

  const loadPrograms = async () => {
    setLoading(true);
    const { data } = await supabase.from("onboarding_programs").select("*").order("id");
    const list = data ?? [];
    setPrograms(list);
    if (list.length > 0 && !selectedProgramId) setSelectedProgramId(list[0].id);
    setLoading(false);
  };

  useEffect(() => { loadPrograms(); }, []);

  useEffect(() => {
    if (adminBlocker.state === "blocked") setAdminWarnOpen(true);
  }, [adminBlocker.state]);

  useEffect(() => {
    if (!adminDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [adminDirty]);

  const saveProgram = async () => {
    if (!progForm.name.trim()) { toast.error("Program name is required."); return; }
    setSavingProg(true);
    const { error } = await supabase.from("onboarding_programs").insert({ name: progForm.name, description: progForm.description || null, due_date: progForm.due_date || null, is_active: true });
    if (error) toast.error(error.message);
    else { toast.success("Program created."); setProgDialog(false); setProgForm({ name: "", description: "", due_date: "" }); loadPrograms(); }
    setSavingProg(false);
  };

  const selectedProgram = programs.find(p => p.id === selectedProgramId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div>
            <h1 className="text-2xl font-bold">Onboarding Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage training modules, documents, and quiz questions</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setProgForm({ name: "", description: "", due_date: "" }); setProgDialog(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />New Program
          </Button>
        </div>

        {/* Program selector */}
        {programs.length > 1 && (
          <div className="flex items-center gap-2 pb-3 overflow-x-auto">
            {programs.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProgramId(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${selectedProgramId === p.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="pt-6"><SkeletonList rows={5} /></div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <Settings2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No programs yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first onboarding program to get started.</p>
          <Button onClick={() => { setProgForm({ name: "", description: "", due_date: "" }); setProgDialog(true); }}><Plus className="h-4 w-4 mr-2" />Create Program</Button>
        </div>
      ) : selectedProgram ? (
        <Tabs value={activeManagerTab} onValueChange={val => {
          if (adminDirty) { setPendingTab(val); setAdminWarnOpen(true); return; }
          setActiveManagerTab(val);
        }} className="w-full">
          <div className="sticky top-[88px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 pb-0 border-b">
            <TabsList className="grid grid-cols-4 max-w-lg">
              <TabsTrigger value="modules"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Modules</TabsTrigger>
              <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" />Documents</TabsTrigger>
              <TabsTrigger value="quiz"><HelpCircle className="h-3.5 w-3.5 mr-1.5" />Quiz</TabsTrigger>
              <TabsTrigger value="tracking"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Tracking</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="modules" className="mt-0"><ModulesTab programId={selectedProgram.id} onDirty={setAdminDirty} /></TabsContent>
          <TabsContent value="documents" className="mt-0"><DocumentsTab programId={selectedProgram.id} onDirty={setAdminDirty} /></TabsContent>
          <TabsContent value="quiz" className="mt-0"><QuizTab programId={selectedProgram.id} onDirty={setAdminDirty} /></TabsContent>
          <TabsContent value="tracking" className="mt-0 px-4 pb-8"><TrackingTab programId={selectedProgram.id} /></TabsContent>
        </Tabs>
      ) : null}

      {/* New program dialog */}
      <Dialog open={progDialog} onOpenChange={o => { if (!o) setProgDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Program</DialogTitle></DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>Program Name</Label>
              <Input value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sales Onboarding, Foreman Training..." className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={progForm.description} onChange={e => setProgForm(f => ({ ...f, description: e.target.value }))} placeholder="One-line description..." className="mt-1" />
            </div>
            <div>
              <Label>Completion Due Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={progForm.due_date} onChange={e => setProgForm(f => ({ ...f, due_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgDialog(false)}>Cancel</Button>
            <Button onClick={saveProgram} disabled={savingProg}>
              {savingProg ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes warning */}
      <AlertDialog open={adminWarnOpen} onOpenChange={open => {
        if (!open) { if (adminBlocker.state === "blocked") adminBlocker.reset?.(); setPendingTab(null); }
        setAdminWarnOpen(open);
      }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes that will be lost if you leave this tab or page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAdminWarnOpen(false);
              setAdminDirty(false);
              if (adminBlocker.state === "blocked") adminBlocker.proceed?.();
              else if (pendingTab) { setActiveManagerTab(pendingTab); setPendingTab(null); }
            }}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>
    </div>
  );
}
