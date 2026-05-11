import { useState, useEffect } from "react";
import { warrantyAPI } from "../../api/warranty";
import type { WarrantySection, WarrantyItem } from "../../api/warranty";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, ShieldCheck, Loader2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import { SkeletonList } from "../ui/page-loader";

type NewItem = { scope_item: string; labor_text: string; material_note: string };
const EMPTY_ITEM: NewItem = { scope_item: "", labor_text: "", material_note: "Manufacturer warranty only" };

function ItemRow({ item, onUpdate, onDelete }: {
  item: WarrantyItem;
  onUpdate: (id: string, patch: Partial<Pick<WarrantyItem, "scope_item" | "labor_text" | "material_note">>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ scope_item: item.scope_item, labor_text: item.labor_text, material_note: item.material_note });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.scope_item.trim()) { toast.error("Scope item name is required."); return; }
    setSaving(true);
    try {
      await onUpdate(item.id, draft);
      setEditing(false);
      toast.success("Item updated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 px-4 py-3 bg-muted/30 border-t items-start">
        <Input value={draft.scope_item} onChange={(e) => setDraft((d) => ({ ...d, scope_item: e.target.value }))} placeholder="Scope item" className="h-8 text-xs" />
        <Textarea value={draft.labor_text} onChange={(e) => setDraft((d) => ({ ...d, labor_text: e.target.value }))} placeholder="Labor/craftsmanship text" className="text-xs min-h-[56px] resize-none" />
        <Input value={draft.material_note} onChange={(e) => setDraft((d) => ({ ...d, material_note: e.target.value }))} placeholder="Material note" className="h-8 text-xs" />
        <div className="flex gap-1 pt-0.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(false); setDraft({ scope_item: item.scope_item, labor_text: item.labor_text, material_note: item.material_note }); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-3 px-4 py-3 border-t items-start group hover:bg-muted/20">
      <p className="text-xs font-semibold text-foreground pt-0.5">{item.scope_item}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{item.labor_text}</p>
      <p className="text-xs text-muted-foreground italic">{item.material_note}</p>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AddItemForm({ sectionId, onAdd }: { sectionId: string; onAdd: (item: WarrantyItem) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NewItem>(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.scope_item.trim()) { toast.error("Scope item name is required."); return; }
    setSaving(true);
    try {
      const created = await warrantyAPI.createItem({ section_id: sectionId, sort_order: 999, ...draft });
      onAdd(created);
      setDraft(EMPTY_ITEM);
      setOpen(false);
      toast.success("Item added.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (!open) {
    return (
      <div className="px-4 py-2 border-t">
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Item
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t bg-muted/20 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">New Item</p>
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
        <Input value={draft.scope_item} onChange={(e) => setDraft((d) => ({ ...d, scope_item: e.target.value }))} placeholder="Scope item *" className="h-8 text-xs" />
        <Textarea value={draft.labor_text} onChange={(e) => setDraft((d) => ({ ...d, labor_text: e.target.value }))} placeholder="Labor/craftsmanship text" className="text-xs min-h-[56px] resize-none" />
        <Input value={draft.material_note} onChange={(e) => setDraft((d) => ({ ...d, material_note: e.target.value }))} placeholder="Material note" className="h-8 text-xs" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Save Item
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setOpen(false); setDraft(EMPTY_ITEM); }}>Cancel</Button>
      </div>
    </div>
  );
}

function SectionCard({ section, onUpdated, onDeleted }: {
  section: WarrantySection;
  onUpdated: (s: WarrantySection) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveTitle = async () => {
    if (!titleDraft.trim()) { toast.error("Section title is required."); return; }
    setSaving(true);
    try {
      await warrantyAPI.updateSection(section.id, titleDraft.trim());
      onUpdated({ ...section, title: titleDraft.trim() });
      setEditingTitle(false);
      toast.success("Section updated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = (itemId: string) => {
    warrantyAPI.deleteItem(itemId)
      .then(() => { onUpdated({ ...section, items: section.items.filter((i) => i.id !== itemId) }); toast.success("Item removed."); })
      .catch((e) => toast.error(e.message));
  };

  const handleUpdateItem = async (id: string, patch: Partial<Pick<WarrantyItem, "scope_item" | "labor_text" | "material_note">>) => {
    await warrantyAPI.updateItem(id, patch);
    onUpdated({ ...section, items: section.items.map((i) => i.id === id ? { ...i, ...patch } : i) });
  };

  return (
    <>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>
              "{section.title}" and all its items will be permanently removed from the warranty page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                warrantyAPI.deleteSection(section.id)
                  .then(() => { onDeleted(section.id); toast.success("Section deleted."); })
                  .catch((e) => toast.error(e.message));
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-8 text-sm font-semibold max-w-xs"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(section.title); } }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveTitle} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingTitle(false); setTitleDraft(section.title); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-75 transition-opacity"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {section.title}
              <span className="text-xs font-normal text-muted-foreground">({section.items.length} items)</span>
            </button>
          )}
          {!editingTitle && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTitle(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {expanded && (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-3 px-4 py-2 bg-muted/10 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Scope Item</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Craftsmanship & Labor</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Material Defects</p>
              <div />
            </div>

            {section.items.length === 0 && (
              <p className="px-4 py-4 text-xs text-muted-foreground italic">No items yet. Add one below.</p>
            )}
            {section.items.map((item) => (
              <ItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} />
            ))}
            <AddItemForm
              sectionId={section.id}
              onAdd={(newItem) => onUpdated({ ...section, items: [...section.items, newItem] })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function WarrantyManager() {
  const [sections, setSections] = useState<WarrantySection[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [disclaimerDraft, setDisclaimerDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDisclaimer, setSavingDisclaimer] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { sections: s, disclaimer: d } = await warrantyAPI.getAll();
      setSections(s);
      setDisclaimer(d);
      setDisclaimerDraft(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) { toast.error("Section title is required."); return; }
    setSavingSection(true);
    try {
      const created = await warrantyAPI.createSection(newSectionTitle.trim(), sections.length);
      setSections((prev) => [...prev, created]);
      setNewSectionTitle("");
      setAddingSection(false);
      toast.success("Section added.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingSection(false); }
  };

  const handleSaveDisclaimer = async () => {
    setSavingDisclaimer(true);
    try {
      await warrantyAPI.updateDisclaimer(disclaimerDraft);
      setDisclaimer(disclaimerDraft);
      toast.success("Disclaimer saved.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingDisclaimer(false); }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
          <Link to="/admin" className="no-underline"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
            Warranty Coverage
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage warranty sections shown at the bottom of every proposal.</p>
        </div>
      </div>

      {/* Sections */}
      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="space-y-3">
          {sections.length === 0 && !addingSection && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg">
              <ShieldCheck className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No warranty sections</p>
              <p className="text-xs mt-1">Add a section to display warranty coverage on proposals.</p>
            </div>
          )}
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onUpdated={(updated) => setSections((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
              onDeleted={(id) => setSections((prev) => prev.filter((s) => s.id !== id))}
            />
          ))}

          {/* Add section */}
          {addingSection ? (
            <Card className="p-4 space-y-3">
              <p className="text-sm font-semibold">New Section</p>
              <div className="flex gap-2">
                <Input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Section title (e.g. Hardscaping)"
                  className="max-w-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); if (e.key === "Escape") { setAddingSection(false); setNewSectionTitle(""); } }}
                />
                <Button onClick={handleAddSection} disabled={savingSection} className="min-w-[100px]">
                  <span className="flex items-center gap-1.5">
                    {savingSection && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add Section
                  </span>
                </Button>
                <Button variant="ghost" onClick={() => { setAddingSection(false); setNewSectionTitle(""); }}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => setAddingSection(true)}>
              <Plus className="h-4 w-4" /> Add Section
            </Button>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Document Disclaimer</CardTitle>
          <p className="text-xs text-muted-foreground">Shown as a footer note at the bottom of the warranty page (e.g. organic materials, living plants).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={disclaimerDraft}
            onChange={(e) => setDisclaimerDraft(e.target.value)}
            placeholder="Enter disclaimer text..."
            className="min-h-[100px] text-sm resize-none"
          />
          <Button
            size="sm"
            onClick={handleSaveDisclaimer}
            disabled={savingDisclaimer || disclaimerDraft === disclaimer}
            className="min-w-[120px]"
          >
            <span className="flex items-center gap-1.5">
              {savingDisclaimer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Disclaimer
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
