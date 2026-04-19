import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Plus, Pencil, Trash2, Check, X, Loader2, ArrowLeft, Mail, Search, ShieldCheck, Star, List, MessageSquare, MapPin, ShieldAlert, Lock, FileSignature } from "lucide-react";
import { productsAPI, leadSourcesAPI, rolesAPI, permissionsAPI } from "../../utils/api";
import { SkeletonList } from "../ui/page-loader";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Link } from "react-router";

interface ListItem { id: string; name: string; }
interface AppointmentType { id: string; name: string; email_subject: string | null; email_body: string | null; }
interface EmailTemplate { id: string; name: string; subject: string; body_html: string; }

interface ListSectionProps {
  title: string;
  description: string;
  items: ListItem[];
  loading: boolean;
  onAdd: (name: string) => Promise<void>;
  onEdit: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function ListSection({ title, description, items, loading, onAdd, onEdit, onDelete }: ListSectionProps) {
  const [addValue, setAddValue]     = useState("");
  const [adding, setAdding]         = useState(false);
  const [addTouched, setAddTouched] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState("");
  const [editTouched, setEditTouched] = useState(false);
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch]         = useState("");

  const addError = addValue.trim().length === 0 ? "Name is required."
    : addValue.trim().length < 2 ? "Name must be at least 2 characters." : "";
  const editError = editValue.trim().length === 0 ? "Name is required."
    : editValue.trim().length < 2 ? "Name must be at least 2 characters." : "";

  const handleAdd = async () => {
    setAddTouched(true);
    if (addError) return;
    setAdding(true);
    try {
      await onAdd(addValue.trim());
      setAddValue("");
      setAddTouched(false);
      toast.success(`"${addValue.trim()}" added.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add.");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    setEditTouched(true);
    if (editError) return;
    setSavingId(id);
    try {
      await onEdit(id, editValue.trim());
      setEditingId(null);
      setEditTouched(false);
      toast.success("Updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      toast.success(`"${name}" removed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="flex flex-col min-h-[340px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-2">
        {/* Add new */}
        <div className="pb-2 border-b space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-foreground">Name</span>
            <span className="text-destructive text-xs">*</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add new..."
              value={addValue}
              onChange={(e) => { setAddValue(e.target.value); if (addTouched) setAddTouched(false); }}
              maxLength={120}
              className={`h-8 text-sm flex-1 ${addTouched && addError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <Button size="sm" onClick={handleAdd} disabled={adding} className="h-8">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Add
            </Button>
          </div>
          {addTouched && addError && <p className="text-xs text-destructive">{addError}</p>}
        </div>

        {/* Search */}
        {!loading && items.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
        )}

        {loading ? (
          <SkeletonList rows={3} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <List className="h-7 w-7 mb-2 opacity-20" />
            <p className="text-sm font-medium">{search ? "No matches found" : "No items yet"}</p>
            <p className="text-xs mt-0.5">{search ? "Try a different search term." : "Add your first item above."}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto thin-scroll space-y-0.5 max-h-52 pr-1">
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                {editingId === item.id ? (
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Name</span>
                      <span className="text-destructive text-xs">*</span>
                    </div>
                    <div className="flex gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => { setEditValue(e.target.value); if (editTouched) setEditTouched(false); }}
                        maxLength={120}
                        className={`h-8 text-sm flex-1 ${editTouched && editError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEdit(item.id); if (e.key === "Escape") { setEditingId(null); setEditTouched(false); } }}
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEdit(item.id)} disabled={!!savingId}>
                        {savingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(null); setEditTouched(false); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editTouched && editError && <p className="text-xs text-destructive">{editError}</p>}
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm py-1 px-2 rounded hover:bg-muted/50">{item.name}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(item.id); setEditValue(item.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => handleDelete(item.id, item.name)} disabled={deletingId === item.id}>
                      {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const tableAPI = (table: string) => ({
  getAll: async () => {
    const { data, error } = await supabase.from(table).select("*").eq("is_active", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  create: async (name: string, sort_order: number) => {
    // If a soft-deleted entry with the same name exists, reactivate it instead of inserting
    const { data: existing } = await supabase
      .from(table)
      .select("id")
      .eq("name", name)
      .eq("is_active", false)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from(table)
        .update({ is_active: true, sort_order })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase.from(table).insert({ name, sort_order }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  update: async (id: string, name: string) => {
    const { data, error } = await supabase.from(table).update({ name }).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from(table).update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
});

const appointmentTypesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("appointment_types")
      .select("id, name, email_subject, email_body")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as AppointmentType[];
  },
  create: async (name: string, sort_order: number) => {
    const { data: existing } = await supabase
      .from("appointment_types")
      .select("id")
      .eq("name", name)
      .eq("is_active", false)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from("appointment_types")
        .update({ is_active: true, sort_order })
        .eq("id", existing.id)
        .select("id, name, email_subject, email_body")
        .single();
      if (error) throw new Error(error.message);
      return data as AppointmentType;
    }
    const { data, error } = await supabase
      .from("appointment_types")
      .insert({ name, sort_order })
      .select("id, name, email_subject, email_body")
      .single();
    if (error) throw new Error(error.message);
    return data as AppointmentType;
  },
  update: async (id: string, fields: { name?: string; email_subject?: string | null; email_body?: string | null }) => {
    const { data, error } = await supabase
      .from("appointment_types")
      .update(fields)
      .eq("id", id)
      .select("id, name, email_subject, email_body")
      .single();
    if (error) throw new Error(error.message);
    return data as AppointmentType;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("appointment_types").update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
};
const emailTemplatesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("id, name, subject, body_html")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmailTemplate[];
  },
  create: async (fields: Omit<EmailTemplate, "id">) => {
    const { data, error } = await supabase
      .from("email_templates")
      .insert({ ...fields, is_active: true })
      .select("id, name, subject, body_html")
      .single();
    if (error) throw new Error(error.message);
    return data as EmailTemplate;
  },
  update: async (id: string, fields: Omit<EmailTemplate, "id">) => {
    const { data, error } = await supabase
      .from("email_templates")
      .update(fields)
      .eq("id", id)
      .select("id, name, subject, body_html")
      .single();
    if (error) throw new Error(error.message);
    return data as EmailTemplate;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("email_templates").update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
};

const unitsAPI        = tableAPI("units");
const scopeOfWorkAPI  = tableAPI("scope_of_work");

interface DocuSignTemplate { id: string; name: string; template_id: string; }

const docuSignTemplatesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("docusign_templates")
      .select("id, name, template_id")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as DocuSignTemplate[];
  },
  create: async (name: string, template_id: string, sort_order: number) => {
    const { data, error } = await supabase
      .from("docusign_templates")
      .insert({ name, template_id, sort_order })
      .select("id, name, template_id")
      .single();
    if (error) throw new Error(error.message);
    return data as DocuSignTemplate;
  },
  update: async (id: string, name: string, template_id: string) => {
    const { data, error } = await supabase
      .from("docusign_templates")
      .update({ name, template_id })
      .eq("id", id)
      .select("id, name, template_id")
      .single();
    if (error) throw new Error(error.message);
    return data as DocuSignTemplate;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("docusign_templates").update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
};

function DocuSignTemplatesSection({
  items, loading, onAdd, onUpdate, onDelete,
}: {
  items: DocuSignTemplate[];
  loading: boolean;
  onAdd: (name: string, template_id: string) => Promise<void>;
  onUpdate: (id: string, name: string, template_id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [sheet, setSheet]         = useState<null | "new" | DocuSignTemplate>(null);
  const [name, setName]           = useState("");
  const [templateId, setTemplateId] = useState("");
  const [touched, setTouched]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch]       = useState("");

  const nameErr       = name.trim().length === 0 ? "Template name is required." : name.trim().length < 2 ? "Min 2 characters." : "";
  const templateIdErr = templateId.trim().length === 0 ? "Template ID is required."
    : !/^[0-9a-f-]{8,}$/i.test(templateId.trim()) ? "Enter a valid DocuSign template UUID." : "";
  const hasErrors = !!nameErr || !!templateIdErr;

  const openNew = () => { setName(""); setTemplateId(""); setTouched(false); setSheet("new"); };
  const openEdit = (item: DocuSignTemplate) => { setName(item.name); setTemplateId(item.template_id); setTouched(false); setSheet(item); };
  const closeSheet = () => { setSheet(null); setTouched(false); };

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      if (sheet === "new") {
        await onAdd(name.trim(), templateId.trim());
        toast.success(`"${name.trim()}" added.`);
      } else {
        await onUpdate((sheet as DocuSignTemplate).id, name.trim(), templateId.trim());
        toast.success("Updated.");
      }
      closeSheet();
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, n: string) => {
    setDeletingId(id);
    try { await onDelete(id); toast.success(`"${n}" removed.`); }
    catch (err: any) { toast.error(err.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.template_id.toLowerCase().includes(search.toLowerCase())
  );
  const isEditing = sheet && sheet !== "new";

  return (
    <>
      <Card className="flex flex-col min-h-[340px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">DocuSign Templates</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved templates shown as fallback when DocuSign API is unavailable.
              </p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 space-y-2">
          {!loading && items.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" />
            </div>
          )}

          {loading ? (
            <SkeletonList rows={3} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <FileSignature className="h-7 w-7 mb-2 opacity-20" />
              <p className="text-sm font-medium">{search ? "No matches found" : "No templates saved yet"}</p>
              <p className="text-xs mt-0.5">{search ? "Try a different search term." : "Add a template name and ID to use as fallback."}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-1 pr-1">
              {filtered.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{item.template_id}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id, item.name)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!sheet} onOpenChange={(open: boolean) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>{isEditing ? "Edit Template" : "Add DocuSign Template"}</SheetTitle>
            <SheetDescription>
              {isEditing ? "Update the template details below." : "Save a DocuSign template ID with a friendly name."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Template Name <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. Standard Construction Contract"
                value={name}
                onChange={(e) => { setName(e.target.value); if (touched) setTouched(false); }}
                maxLength={120}
                className={touched && nameErr ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {touched && nameErr
                ? <p className="text-xs text-destructive">{nameErr}</p>
                : <p className="text-xs text-muted-foreground">Friendly name shown in the Send DocuSign dropdown.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Template ID <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. 04bbe153-e82b-46df-a17e-3edcdaabe071"
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); if (touched) setTouched(false); }}
                className={`font-mono ${touched && templateIdErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {touched && templateIdErr
                ? <p className="text-xs text-destructive">{templateIdErr}</p>
                : <p className="text-xs text-muted-foreground">
                    Find this in DocuSign → Templates → click template → copy the UUID from the URL.
                  </p>}
            </div>
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={closeSheet} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save Changes" : "Add Template"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

interface ProposalReview {
  id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  sort_order: number;
  is_active: boolean;
}

const proposalReviewsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("proposal_reviews")
      .select("id, reviewer_name, rating, review_text, sort_order, is_active")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as ProposalReview[];
  },
  create: async (fields: Omit<ProposalReview, "id">) => {
    const { data, error } = await supabase
      .from("proposal_reviews")
      .insert({ ...fields })
      .select("id, reviewer_name, rating, review_text, sort_order, is_active")
      .single();
    if (error) throw new Error(error.message);
    return data as ProposalReview;
  },
  update: async (id: string, fields: Partial<Omit<ProposalReview, "id">>) => {
    const { data, error } = await supabase
      .from("proposal_reviews")
      .update({ ...fields })
      .eq("id", id)
      .select("id, reviewer_name, rating, review_text, sort_order, is_active")
      .single();
    if (error) throw new Error(error.message);
    return data as ProposalReview;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("proposal_reviews").update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
};

function ProposalReviewsSection({
  items, loading, onAdd, onUpdate, onDelete,
}: {
  items: ProposalReview[];
  loading: boolean;
  onAdd: (fields: Omit<ProposalReview, "id">) => Promise<void>;
  onUpdate: (id: string, fields: Partial<Omit<ProposalReview, "id">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [sheet, setSheet]           = useState<null | "new" | ProposalReview>(null);
  const [name, setName]             = useState("");
  const [rating, setRating]         = useState(5);
  const [text, setText]             = useState("");
  const [isActive, setIsActive]     = useState(true);
  const [touched, setTouched]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const nameErr = name.trim().length === 0 ? "Reviewer name is required." : "";
  const textErr = text.trim().length === 0 ? "Review text is required."
    : text.trim().length < 10 ? "Review must be at least 10 characters." : "";
  const hasErrors = !!nameErr || !!textErr;

  const openNew = () => {
    setName(""); setRating(5); setText(""); setIsActive(true); setTouched(false);
    setSheet("new");
  };

  const openEdit = (item: ProposalReview) => {
    setName(item.reviewer_name); setRating(item.rating);
    setText(item.review_text); setIsActive(item.is_active); setTouched(false);
    setSheet(item);
  };

  const closeSheet = () => { setSheet(null); setTouched(false); };

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const fields = {
        reviewer_name: name.trim(),
        rating,
        review_text: text.trim(),
        is_active: isActive,
        sort_order: sheet === "new" ? items.length : (sheet as ProposalReview).sort_order,
      };
      if (sheet === "new") {
        await onAdd(fields);
        toast.success(`Review by "${name.trim()}" added.`);
      } else {
        await onUpdate((sheet as ProposalReview).id, fields);
        toast.success("Review updated.");
      }
      closeSheet();
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, n: string) => {
    setDeletingId(id);
    try { await onDelete(id); toast.success(`Review by "${n}" removed.`); }
    catch (err: any) { toast.error(err.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  };

  const isEditing = sheet && sheet !== "new";
  const activeItems = items.filter((i) => i.is_active);

  return (
    <>
      <Card className="md:col-span-2 flex flex-col min-h-[340px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Proposal Reviews</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reviews shown on proposal PDFs — {activeItems.length} active.
              </p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Review
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 space-y-2">
          {loading ? (
            <SkeletonList rows={3} />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <MessageSquare className="h-7 w-7 mb-2 opacity-20" />
              <p className="text-sm font-medium">No reviews yet</p>
              <p className="text-xs mt-0.5">Reviews will appear here once added.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-1 pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 group px-2 py-2 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.reviewer_name}</p>
                      <span className="text-xs text-amber-500 shrink-0">{"★".repeat(item.rating)}</span>
                      {!item.is_active && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">Hidden</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.review_text}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id, item.reviewer_name)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!sheet} onOpenChange={(open: boolean) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>{isEditing ? "Edit Review" : "Add Review"}</SheetTitle>
            <SheetDescription>
              {isEditing ? "Update the review details below." : "Add a client review to show on proposal PDFs."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5 space-y-5">
            {/* Reviewer Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reviewer Name <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. John Smith"
                value={name}
                onChange={(e) => { setName(e.target.value); if (touched) setTouched(false); }}
                maxLength={120}
                className={touched && nameErr ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {touched && nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
            </div>

            {/* Star Rating */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rating <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)} className="focus:outline-none">
                    <Star
                      className={`h-6 w-6 transition-colors ${star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground ml-2">{rating} / 5</span>
              </div>
            </div>

            {/* Review Text */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Review Text <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="What the client said..."
                value={text}
                onChange={(e) => { setText(e.target.value); if (touched) setTouched(false); }}
                rows={5}
                className={`resize-none ${touched && textErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {touched && textErr
                ? <p className="text-xs text-destructive">{textErr}</p>
                : <p className="text-xs text-muted-foreground">{text.length} characters</p>}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Checkbox id="review-active" checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
              <label htmlFor="review-active" className="text-sm font-medium cursor-pointer">
                Show on proposals
              </label>
              <p className="text-xs text-muted-foreground">Uncheck to hide without deleting</p>
            </div>
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={closeSheet} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save Changes" : "Add Review"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EmailTemplatesSection({
  items, loading, onAdd, onUpdate, onDelete,
}: {
  items: EmailTemplate[];
  loading: boolean;
  onAdd: (fields: Omit<EmailTemplate, "id">) => Promise<void>;
  onUpdate: (id: string, fields: Omit<EmailTemplate, "id">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [sheet, setSheet]     = useState<null | "new" | EmailTemplate>(null);
  const [name, setName]       = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch]   = useState("");

  const nameErr    = name.trim().length === 0 ? "Template name is required."
    : name.trim().length < 2 ? "Min 2 characters." : "";
  const subjectErr = subject.trim().length === 0 ? "Email subject is required."
    : subject.trim().length < 3 ? "Min 3 characters." : "";
  const bodyErr    = bodyHtml.trim().length === 0 ? "Email body is required."
    : bodyHtml.trim().length < 10 ? "Min 10 characters." : "";
  const hasErrors  = !!nameErr || !!subjectErr || !!bodyErr;

  const openNew = () => { setName(""); setSubject(""); setBodyHtml(""); setTouched(false); setSheet("new"); };
  const openEdit = (item: EmailTemplate) => {
    setName(item.name); setSubject(item.subject); setBodyHtml(item.body_html);
    setTouched(false); setSheet(item);
  };
  const closeSheet = () => { setSheet(null); setTouched(false); };

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const fields = { name: name.trim(), subject: subject.trim(), body_html: bodyHtml.trim() };
      if (sheet === "new") {
        await onAdd(fields);
        toast.success(`"${name.trim()}" added.`);
      } else {
        await onUpdate((sheet as EmailTemplate).id, fields);
        toast.success("Template updated.");
      }
      closeSheet();
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, n: string) => {
    setDeletingId(id);
    try { await onDelete(id); toast.success(`"${n}" removed.`); }
    catch (err: any) { toast.error(err.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.subject.toLowerCase().includes(search.toLowerCase())
  );
  const isEditing = sheet && sheet !== "new";

  return (
    <>
      <Card className="flex flex-col min-h-[340px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Email Templates</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outreach email templates used in the Send Email dialog.
              </p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 space-y-2">
          {!loading && items.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" />
            </div>
          )}

          {loading ? (
            <SkeletonList rows={3} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Mail className="h-7 w-7 mb-2 opacity-20" />
              <p className="text-sm font-medium">{search ? "No matches found" : "No templates yet"}</p>
              <p className="text-xs mt-0.5">{search ? "Try a different search term." : "Add your first email template above."}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-1 pr-1">
              {filtered.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Mail className="h-2.5 w-2.5 shrink-0" />{item.subject}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id, item.name)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!sheet} onOpenChange={(open: boolean) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>{isEditing ? "Edit Email Template" : "New Email Template"}</SheetTitle>
            <SheetDescription>
              {isEditing ? "Update the template details below." : "Create a reusable outreach email template."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Template Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Initial Follow Up"
                value={name}
                onChange={(e) => { setName(e.target.value); if (touched) setTouched(false); }}
                maxLength={120}
                className={touched && nameErr ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {touched && nameErr
                ? <p className="text-xs text-destructive">{nameErr}</p>
                : <p className="text-xs text-muted-foreground">Shown in the Send Email dropdown.</p>}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Subject <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Following Up — Butler & Associates Construction"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); if (touched) setTouched(false); }}
                maxLength={200}
                className={touched && subjectErr ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched && subjectErr && <p className="text-xs text-destructive">{subjectErr}</p>}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Body <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Hi {client_name}, ..."
                value={bodyHtml}
                onChange={(e) => { setBodyHtml(e.target.value); if (touched) setTouched(false); }}
                rows={10}
                className={`resize-none font-mono text-xs ${touched && bodyErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {touched && bodyErr
                ? <p className="text-xs text-destructive">{bodyErr}</p>
                : <p className="text-xs text-muted-foreground">
                    Variable: <code className="bg-muted px-1 rounded">{"{client_name}"}</code>
                  </p>}
            </div>
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={closeSheet} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save Changes" : "Add Template"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AppointmentTypeSection({
  items, loading, onAdd, onUpdate, onDelete,
}: {
  items: AppointmentType[];
  loading: boolean;
  onAdd: (name: string, subject: string | null, body: string | null) => Promise<void>;
  onUpdate: (id: string, fields: { name?: string; email_subject?: string | null; email_body?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  // Sheet state — null = closed, "new" = create, AppointmentType = edit
  const [sheet, setSheet]   = useState<null | "new" | AppointmentType>(null);
  const [name, setName]     = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody]     = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const nameErr    = name.trim().length === 0 ? "Type Name is required."
    : name.trim().length < 2 ? "Type Name must be at least 2 characters." : "";
  const subjectErr = subject.trim().length > 0 && subject.trim().length < 3
    ? "Email Subject must be at least 3 characters." : "";
  const bodyErr    = body.trim().length > 0 && body.trim().length < 10
    ? "Email Body must be at least 10 characters." : "";
  const hasErrors  = !!nameErr || !!subjectErr || !!bodyErr;

  const openNew = () => {
    setName(""); setSubject(""); setBody(""); setTouched(false);
    setSheet("new");
  };

  const openEdit = (item: AppointmentType) => {
    setName(item.name);
    setSubject(item.email_subject ?? "");
    setBody(item.email_body ?? "");
    setTouched(false);
    setSheet(item);
  };

  const closeSheet = () => { setSheet(null); setTouched(false); };

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      if (sheet === "new") {
        await onAdd(name.trim(), subject.trim() || null, body.trim() || null);
        toast.success(`"${name.trim()}" added.`);
      } else {
        await onUpdate((sheet as AppointmentType).id, {
          name: name.trim(),
          email_subject: subject.trim() || null,
          email_body: body.trim() || null,
        });
        toast.success("Updated.");
      }
      closeSheet();
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, n: string) => {
    setDeletingId(id);
    try { await onDelete(id); toast.success(`"${n}" removed.`); }
    catch (err: any) { toast.error(err.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const isEditing = sheet && sheet !== "new";

  return (
    <>
      <Card className="flex flex-col min-h-[340px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Appointment Types</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Types of appointments — each can have a custom email template.</p>
            </div>
            <Button size="sm" className="h-8 shrink-0" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 space-y-2">
          {!loading && items.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" />
            </div>
          )}

          {loading ? (
            <SkeletonList rows={3} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <List className="h-7 w-7 mb-2 opacity-20" />
              <p className="text-sm font-medium">{search ? "No matches found" : "No items yet"}</p>
              <p className="text-xs mt-0.5">{search ? "Try a different search term." : "Add your first item above."}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-1 pr-1">
              {filtered.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.email_subject && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="h-2.5 w-2.5 shrink-0" />{item.email_subject}
                      </p>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id, item.name)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right panel */}
      <Sheet open={!!sheet} onOpenChange={(open: boolean) => { if (!open) closeSheet(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>{isEditing ? "Edit Appointment Type" : "New Appointment Type"}</SheetTitle>
            <SheetDescription>
              {isEditing ? "Update the appointment type details below." : "Fill in the details to create a new appointment type."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Type Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Initial Consultation"
                value={name}
                onChange={(e) => { setName(e.target.value); if (touched) setTouched(false); }}
                maxLength={120}
                className={touched && nameErr ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {touched && nameErr
                ? <p className="text-xs text-destructive">{nameErr}</p>
                : <p className="text-xs text-muted-foreground">Max 120 characters.</p>}
            </div>

            {/* Email Subject */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Subject
                <span className="text-xs font-normal text-muted-foreground">optional</span>
              </label>
              <Input
                placeholder="e.g. Your appointment is confirmed — {type} on {date}"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                className={touched && subjectErr ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched && subjectErr
                ? <p className="text-xs text-destructive">{subjectErr}</p>
                : <p className="text-xs text-muted-foreground">Max 200 characters. Leave blank to skip email.</p>}
            </div>

            {/* Email Body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Body
                <span className="text-xs font-normal text-muted-foreground">optional</span>
              </label>
              <Textarea
                placeholder="Hi {client_name}, your appointment has been scheduled for {date} at {time}. Please contact us if you need to reschedule."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className={`resize-none ${touched && bodyErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {touched && bodyErr
                ? <p className="text-xs text-destructive">{bodyErr}</p>
                : <p className="text-xs text-muted-foreground">
                    Variables: <code className="bg-muted px-1 rounded">{"{client_name}"}</code>{" "}
                    <code className="bg-muted px-1 rounded">{"{date}"}</code>{" "}
                    <code className="bg-muted px-1 rounded">{"{time}"}</code>{" "}
                    <code className="bg-muted px-1 rounded">{"{type}"}</code>{" "}
                    <code className="bg-muted px-1 rounded">{"{address}"}</code>
                  </p>}
            </div>
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={closeSheet} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

interface ZipTaxRate { zip_code: string; county: string; total_rate: number; }

function ZipTaxSection({ items, loading, onAdd, onEdit, onDelete }: {
  items: ZipTaxRate[];
  loading: boolean;
  onAdd: (zip: string, county: string, rate: number) => Promise<void>;
  onEdit: (zip: string, county: string, rate: number) => Promise<void>;
  onDelete: (zip: string) => Promise<void>;
}) {
  const [zip, setZip]       = useState("");
  const [county, setCounty] = useState("");
  const [rate, setRate]     = useState("");
  const [adding, setAdding] = useState(false);
  const [addTouched, setAddTouched] = useState(false);
  const [editingZip, setEditingZip]     = useState<string | null>(null);
  const [editCounty, setEditCounty]     = useState("");
  const [editRate, setEditRate]         = useState("");
  const [editTouched, setEditTouched]   = useState(false);
  const [savingZip, setSavingZip]       = useState<string | null>(null);
  const [deletingZip, setDeletingZip]   = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleAdd = async () => {
    setAddTouched(true);
    if (!zip.trim() || !county.trim() || !rate) return;
    setAdding(true);
    try {
      await onAdd(zip.trim(), county.trim(), parseFloat(rate));
      setZip(""); setCounty(""); setRate(""); setAddTouched(false);
      toast.success(`Zip ${zip.trim()} added.`);
    } catch (err: any) { toast.error(err.message || "Failed to add."); }
    finally { setAdding(false); }
  };

  const handleSave = async (zipCode: string) => {
    setEditTouched(true);
    if (!editCounty.trim() || !editRate) return;
    setSavingZip(zipCode);
    try {
      await onEdit(zipCode, editCounty.trim(), parseFloat(editRate));
      setEditingZip(null); setEditTouched(false);
      toast.success("Updated.");
    } catch (err: any) { toast.error(err.message || "Failed to update."); }
    finally { setSavingZip(null); }
  };

  const filtered = items.filter((i) =>
    i.zip_code.includes(search) || i.county.toLowerCase().includes(search.toLowerCase())
  );

  const zipErr    = zip.trim().length === 0 ? "Zip Code is required." : zip.trim().length < 3 ? "Min 3 characters." : "";
  const countyErr = county.trim().length === 0 ? "County is required." : county.trim().length < 2 ? "Min 2 characters." : "";
  const rateErr   = !rate ? "Rate is required." : parseFloat(rate) <= 0 ? "Must be greater than 0." : "";
  const editCountyErr = editCounty.trim().length === 0 ? "County is required." : editCounty.trim().length < 2 ? "Min 2 characters." : "";
  const editRateErr   = !editRate ? "Rate is required." : parseFloat(editRate) <= 0 ? "Must be greater than 0." : "";

  return (
    <Card className="md:col-span-2 flex flex-col min-h-[340px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sales Tax Rates by Zip Code</CardTitle>
        <p className="text-xs text-muted-foreground">Auto-applied to proposals based on client zip code.</p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-3">
        {/* Add row */}
        <div className="pb-3 border-b space-y-1.5">
          <div className="grid grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Zip Code <span className="text-destructive">*</span></p>
              <Input
                placeholder="e.g. 90210"
                value={zip}
                onChange={(e) => { setZip(e.target.value); if (addTouched) setAddTouched(false); }}
                maxLength={10}
                className={`h-8 text-sm ${addTouched && zipErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              {addTouched && zipErr && <p className="text-xs text-destructive">{zipErr}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">County <span className="text-destructive">*</span></p>
              <Input
                placeholder="e.g. Los Angeles"
                value={county}
                onChange={(e) => { setCounty(e.target.value); if (addTouched) setAddTouched(false); }}
                maxLength={80}
                className={`h-8 text-sm ${addTouched && countyErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              {addTouched && countyErr && <p className="text-xs text-destructive">{countyErr}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Rate % <span className="text-destructive">*</span></p>
              <Input
                placeholder="e.g. 9.5"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={rate}
                onChange={(e) => { setRate(e.target.value); if (addTouched) setAddTouched(false); }}
                className={`h-8 text-sm ${addTouched && rateErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              />
              {addTouched && rateErr && <p className="text-xs text-destructive">{rateErr}</p>}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={adding} className="h-8">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}Add
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search zip or county..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" />
        </div>

        {loading ? (
          <SkeletonList rows={3} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <MapPin className="h-7 w-7 mb-2 opacity-20" />
            <p className="text-sm font-medium">{search ? "No matches found" : "No zip codes added yet"}</p>
            <p className="text-xs mt-0.5">{search ? "Try a different search term." : "Add a zip code to define your service area."}</p>
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto thin-scroll space-y-1 pr-1">
            {filtered.map((item) => (
              <div key={item.zip_code} className="flex items-center gap-2 group">
                {editingZip === item.zip_code ? (
                  <div className="flex-1 space-y-1.5 py-1">
                    <div className="flex items-end gap-2">
                      <div className="w-20 shrink-0">
                        <p className="text-xs text-muted-foreground mb-1">Zip</p>
                        <span className="text-sm font-mono">{item.zip_code}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-medium text-foreground">County <span className="text-destructive">*</span></p>
                        <Input
                          value={editCounty}
                          onChange={(e) => { setEditCounty(e.target.value); if (editTouched) setEditTouched(false); }}
                          maxLength={80}
                          className={`h-7 text-sm ${editTouched && editCountyErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {editTouched && editCountyErr && <p className="text-xs text-destructive">{editCountyErr}</p>}
                      </div>
                      <div className="w-24 space-y-1">
                        <p className="text-xs font-medium text-foreground">Rate % <span className="text-destructive">*</span></p>
                        <Input
                          type="number" step="0.01" min="0" max="100"
                          value={editRate}
                          onChange={(e) => { setEditRate(e.target.value); if (editTouched) setEditTouched(false); }}
                          className={`h-7 text-sm ${editTouched && editRateErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {editTouched && editRateErr && <p className="text-xs text-destructive">{editRateErr}</p>}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleSave(item.zip_code)} disabled={!!savingZip}>
                          {savingZip === item.zip_code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingZip(null); setEditTouched(false); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-mono text-sm w-20 shrink-0">{item.zip_code}</span>
                    <span className="text-sm flex-1">{item.county}</span>
                    <span className="text-sm font-semibold w-16 text-right">{item.total_rate}%</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { setEditingZip(item.zip_code); setEditCounty(item.county); setEditRate(String(item.total_rate)); setEditTouched(false); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => { setDeletingZip(item.zip_code); onDelete(item.zip_code).then(() => toast.success(`Zip ${item.zip_code} removed.`)).catch((e) => toast.error(e.message)).finally(() => setDeletingZip(null)); }} disabled={deletingZip === item.zip_code}>
                      {deletingZip === item.zip_code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Role { id: string; name: string; label: string; }
interface Permission { id: string; key: string; label: string; category: string; }

// ── Category combobox ──────────────────────────────────────────────────────────
function CategoryInput({ value, onChange, categories, placeholder = "e.g. Clients", invalid = false }: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useState(() => ({ current: null as HTMLDivElement | null }))[0];

  const matches = categories.filter((c) => c.toLowerCase().includes(value.toLowerCase()) && c !== value);

  return (
    <div className="relative" ref={(el) => { ref.current = el; }}>
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={`h-8 text-xs bg-background ${invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded-md shadow-md overflow-hidden">
          {matches.map((cat) => (
            <button
              key={cat}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
              onMouseDown={(e) => { e.preventDefault(); onChange(cat); setOpen(false); }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Role Permissions Card ────────────────────────────────────────────────────
function RolePermissionsCard({
  roles, permissions, loadingRoles, loadingPerms, onRolesChange, onPermissionsChange,
}: {
  roles: Role[];
  permissions: Permission[];
  loadingRoles: boolean;
  loadingPerms: boolean;
  onRolesChange: (r: Role[]) => void;
  onPermissionsChange: (p: Permission[]) => void;
}) {
  const [selectedRole, setSelectedRole]         = useState<Role | null>(null);
  const [assignedIds,   setAssignedIds]          = useState<string[]>([]);
  const [loadingAssigned, setLoadingAssigned]    = useState(false);
  const [toggling, setToggling]                  = useState<string | null>(null);

  // Roles CRUD state
  const [roleSearch,    setRoleSearch]   = useState("");
  const [addRoleLabel,  setAddRoleLabel] = useState("");
  const [addRoleTouched, setAddRoleTouched] = useState(false);
  const [addingRole,    setAddingRole]   = useState(false);
  const [editRoleId,    setEditRoleId]   = useState<string | null>(null);
  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [editRoleTouched, setEditRoleTouched] = useState(false);
  const [savingRoleId,  setSavingRoleId] = useState<string | null>(null);
  const [deletingRoleId,setDeletingRoleId] = useState<string | null>(null);

  // Permissions CRUD state
  const [permSearch,   setPermSearch]    = useState("");
  const [addPermKey,   setAddPermKey]    = useState("");
  const [addPermLabel, setAddPermLabel]  = useState("");
  const [addPermCat,   setAddPermCat]    = useState("");
  const [addingPerm,   setAddingPerm]    = useState(false);
  const [showAddPerm,  setShowAddPerm]   = useState(false);
  const [addPermTouched, setAddPermTouched] = useState(false);
  const [editPermId,   setEditPermId]    = useState<string | null>(null);
  const [editPermLabel,setEditPermLabel] = useState("");
  const [editPermKey,  setEditPermKey]   = useState("");
  const [editPermCat,  setEditPermCat]   = useState("");
  const [savingPermId, setSavingPermId]  = useState<string | null>(null);
  const [deletingPermId,setDeletingPermId] = useState<string | null>(null);

  // Load assigned permissions when role selected
  useEffect(() => {
    if (!selectedRole) { setAssignedIds([]); return; }
    setLoadingAssigned(true);
    permissionsAPI.getRolePermissions(selectedRole.id)
      .then(setAssignedIds)
      .catch(console.error)
      .finally(() => setLoadingAssigned(false));
  }, [selectedRole?.id]);

  const addRoleErr  = addRoleLabel.trim().length === 0 ? "Label is required." : addRoleLabel.trim().length < 2 ? "Min 2 characters." : "";
  const editRoleErr = editRoleLabel.trim().length === 0 ? "Label is required." : editRoleLabel.trim().length < 2 ? "Min 2 characters." : "";
  const addKeyErr   = addPermKey.trim().length === 0 ? "Key is required." : addPermKey.trim().length < 3 ? "Min 3 characters." : "";
  const addLabelErr = addPermLabel.trim().length === 0 ? "Label is required." : addPermLabel.trim().length < 2 ? "Min 2 characters." : "";
  const addCatErr   = addPermCat.trim().length === 0 ? "Category is required." : addPermCat.trim().length < 2 ? "Min 2 characters." : "";

  const filteredRoles = roles.filter((r) =>
    r.label.toLowerCase().includes(roleSearch.toLowerCase()) ||
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  const categories = Array.from(new Set(permissions.map((p) => p.category))).sort();
  const filteredPerms = permissions.filter((p) =>
    p.label.toLowerCase().includes(permSearch.toLowerCase()) ||
    p.key.toLowerCase().includes(permSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(permSearch.toLowerCase())
  );

  // ── Roles handlers ──
  const handleAddRole = async () => {
    setAddRoleTouched(true);
    if (addRoleErr) return;
    setAddingRole(true);
    try {
      const created = await rolesAPI.create(addRoleLabel.trim()) as Role;
      onRolesChange([...roles, created]);
      setAddRoleLabel(""); setAddRoleTouched(false);
      toast.success(`Role "${created.label}" added.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setAddingRole(false); }
  };

  const handleEditRole = async (id: string) => {
    setEditRoleTouched(true);
    if (editRoleErr) return;
    setSavingRoleId(id);
    try {
      const updated = await rolesAPI.update(id, editRoleLabel.trim()) as Role;
      onRolesChange(roles.map((r) => r.id === id ? updated : r));
      if (selectedRole?.id === id) setSelectedRole(updated);
      setEditRoleId(null); setEditRoleTouched(false);
      toast.success("Role updated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingRoleId(null); }
  };

  const handleDeleteRole = async (role: Role) => {
    setDeletingRoleId(role.id);
    try {
      await rolesAPI.delete(role.id);
      onRolesChange(roles.filter((r) => r.id !== role.id));
      if (selectedRole?.id === role.id) setSelectedRole(null);
      toast.success(`Role "${role.label}" deleted.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingRoleId(null); }
  };

  // ── Permissions handlers ──
  const handleAddPerm = async () => {
    setAddPermTouched(true);
    if (addKeyErr || addLabelErr || addCatErr) return;
    setAddingPerm(true);
    try {
      const created = await permissionsAPI.create(addPermKey.trim(), addPermLabel.trim(), addPermCat.trim()) as Permission;
      onPermissionsChange([...permissions, created].sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)));
      setAddPermKey(""); setAddPermLabel(""); setAddPermCat(""); setAddPermTouched(false); setShowAddPerm(false);
      toast.success(`Permission "${created.label}" added.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setAddingPerm(false); }
  };

  const handleEditPerm = async (id: string) => {
    setSavingPermId(id);
    try {
      const updated = await permissionsAPI.update(id, { key: editPermKey.trim(), label: editPermLabel.trim(), category: editPermCat.trim() }) as Permission;
      onPermissionsChange(permissions.map((p) => p.id === id ? updated : p));
      setEditPermId(null);
      toast.success("Permission updated.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingPermId(null); }
  };

  const handleDeletePerm = async (perm: Permission) => {
    setDeletingPermId(perm.id);
    try {
      await permissionsAPI.delete(perm.id);
      onPermissionsChange(permissions.filter((p) => p.id !== perm.id));
      setAssignedIds((prev) => prev.filter((id) => id !== perm.id));
      toast.success(`Permission "${perm.label}" deleted.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingPermId(null); }
  };

  const handleToggle = async (perm: Permission, checked: boolean) => {
    if (!selectedRole) return;
    setToggling(perm.id);
    try {
      await permissionsAPI.setRolePermission(selectedRole.id, perm.id, checked);
      setAssignedIds((prev) => checked ? [...prev, perm.id] : prev.filter((id) => id !== perm.id));
    } catch (e: any) { toast.error(e.message); }
    finally { setToggling(null); }
  };

  return (
    <Card className="md:col-span-2 flex flex-col h-[560px]">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Roles &amp; Permissions
        </CardTitle>
        <p className="text-xs text-muted-foreground">Manage roles and assign permissions to each role.</p>
      </CardHeader>
      <CardContent className="flex flex-1 gap-0 p-0 overflow-hidden min-h-0">

        {/* ── Left: Roles ── */}
        <div className="w-[280px] shrink-0 border-r flex flex-col p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</p>

          {/* Add role */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">Label <span className="text-destructive">*</span></p>
            <div className="flex gap-1">
              <Input
                placeholder="e.g. Project Manager"
                value={addRoleLabel}
                onChange={(e) => { setAddRoleLabel(e.target.value); if (addRoleTouched) setAddRoleTouched(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddRole(); }}
                maxLength={80}
                className={`h-7 text-xs flex-1 ${addRoleTouched && addRoleErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <Button size="sm" className="h-7 px-2" onClick={handleAddRole} disabled={addingRole}>
                {addingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
            {addRoleLabel.trim() && (
              <p className="text-xs text-muted-foreground font-mono">
                key: {addRoleLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}
              </p>
            )}
            {addRoleTouched && addRoleErr && <p className="text-xs text-destructive">{addRoleErr}</p>}
          </div>

          {/* Search */}
          {roles.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search..." value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} className="h-7 text-xs pl-6" />
            </div>
          )}

          {/* List */}
          {loadingRoles ? (
            <SkeletonList rows={3} />
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-0.5 pr-1">
              {filteredRoles.map((role) => (
                <div key={role.id}>
                  {editRoleId === role.id ? (
                    <div className="space-y-1 py-0.5">
                      <p className="text-xs font-medium text-foreground">Label <span className="text-destructive">*</span></p>
                      <div className="flex gap-1">
                        <Input
                          value={editRoleLabel}
                          onChange={(e) => { setEditRoleLabel(e.target.value); if (editRoleTouched) setEditRoleTouched(false); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleEditRole(role.id); if (e.key === "Escape") { setEditRoleId(null); setEditRoleTouched(false); } }}
                          maxLength={80}
                          className={`h-7 text-xs flex-1 ${editRoleTouched && editRoleErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleEditRole(role.id)} disabled={!!savingRoleId}>
                          {savingRoleId === role.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditRoleId(null); setEditRoleTouched(false); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {editRoleTouched && editRoleErr && <p className="text-xs text-destructive">{editRoleErr}</p>}
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${selectedRole?.id === role.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{role.label}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{role.name}</p>
                      </div>
                      <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditRoleId(role.id); setEditRoleLabel(role.label); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }} disabled={deletingRoleId === role.id}>
                          {deletingRoleId === role.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredRoles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <ShieldAlert className="h-7 w-7 mb-2 opacity-20" />
                  <p className="text-sm font-medium">{roleSearch ? "No matches" : "No roles yet"}</p>
                  <p className="text-xs mt-0.5">{roleSearch ? "Try a different search." : "Create your first role above."}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Permissions ── */}
        <div className="flex-1 flex flex-col p-4 space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedRole ? `Permissions — ${selectedRole.label}` : "Permissions"}
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddPerm((v) => !v)}>
              <Plus className="h-3 w-3" /> Add Permission
            </Button>
          </div>

          {/* Add permission form */}
          {showAddPerm && (
            <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Key <span className="text-destructive">*</span></p>
                  <Input
                    placeholder="e.g. can_edit_clients"
                    value={addPermKey}
                    onChange={(e) => setAddPermKey(e.target.value)}
                    maxLength={80}
                    className={`h-8 text-xs font-mono bg-background ${addPermTouched && addKeyErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {addPermTouched && addKeyErr && <p className="text-xs text-destructive">{addKeyErr}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Label <span className="text-destructive">*</span></p>
                  <Input
                    placeholder="e.g. Edit Clients"
                    value={addPermLabel}
                    onChange={(e) => setAddPermLabel(e.target.value)}
                    maxLength={100}
                    className={`h-8 text-xs bg-background ${addPermTouched && addLabelErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {addPermTouched && addLabelErr && <p className="text-xs text-destructive">{addLabelErr}</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Category <span className="text-destructive">*</span></p>
                  <CategoryInput
                    value={addPermCat}
                    onChange={setAddPermCat}
                    categories={categories}
                    invalid={addPermTouched && !!addCatErr}
                  />
                  {addPermTouched && addCatErr && <p className="text-xs text-destructive">{addCatErr}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground"><span className="text-destructive">*</span> Required fields</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddPerm(false); setAddPermTouched(false); setAddPermKey(""); setAddPermLabel(""); setAddPermCat(""); }}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddPerm} disabled={addingPerm}>
                    {addingPerm ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          {permissions.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search permissions..." value={permSearch} onChange={(e) => setPermSearch(e.target.value)} className="h-7 text-xs pl-6" />
            </div>
          )}

          {!selectedRole && (
            <p className="text-xs text-muted-foreground py-1">Select a role on the left to assign permissions.</p>
          )}

          {/* Permissions list */}
          {loadingPerms ? (
            <SkeletonList rows={3} />
          ) : (
            <div className="flex-1 overflow-y-auto thin-scroll space-y-3 pr-1">
              {(permSearch ? [{ cat: "Results", perms: filteredPerms }] : categories.map((cat) => ({ cat, perms: filteredPerms.filter((p) => p.category === cat) }))).map(({ cat, perms }) => {
                if (perms.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{cat}</p>
                    <div className="space-y-0.5">
                      {perms.map((perm) => (
                        <div key={perm.id} className="group">
                          {editPermId === perm.id ? (
                            <div className="p-2 bg-muted/40 rounded border space-y-2">
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Key</p>
                                  <Input value={editPermKey} onChange={(e) => setEditPermKey(e.target.value)} placeholder="e.g. can_edit_clients" className="h-7 text-xs font-mono" autoFocus />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Label</p>
                                  <Input value={editPermLabel} onChange={(e) => setEditPermLabel(e.target.value)} placeholder="e.g. Edit Clients" className="h-7 text-xs" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground">Category</p>
                                  <CategoryInput value={editPermCat} onChange={setEditPermCat} categories={categories} />
                                </div>
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditPermId(null)}>Cancel</Button>
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleEditPerm(perm.id)} disabled={!!savingPermId}>
                                  {savingPermId === perm.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                              {selectedRole && (
                                loadingAssigned || toggling === perm.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                                ) : (
                                  <Checkbox
                                    id={`perm-${perm.id}`}
                                    checked={assignedIds.includes(perm.id)}
                                    onCheckedChange={(checked) => handleToggle(perm, !!checked)}
                                    className="shrink-0"
                                  />
                                )
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm">{perm.label}</span>
                                <span className="text-xs text-muted-foreground font-mono ml-2">{perm.key}</span>
                              </div>
                              <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditPermId(perm.id); setEditPermKey(perm.key); setEditPermLabel(perm.label); setEditPermCat(perm.category); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePerm(perm)} disabled={deletingPermId === perm.id}>
                                  {deletingPermId === perm.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredPerms.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Lock className="h-7 w-7 mb-2 opacity-20" />
                  <p className="text-sm font-medium">{permSearch ? "No matches" : "No permissions yet"}</p>
                  <p className="text-xs mt-0.5">{permSearch ? "Try a different search." : "Permissions will appear once roles are configured."}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ListManagement() {
  const [categories,        setCategories]        = useState<ListItem[]>([]);
  const [leadSources,       setLeadSources]        = useState<ListItem[]>([]);
  const [appointmentTypes,  setAppointmentTypes]   = useState<AppointmentType[]>([]);
  const [units,             setUnits]              = useState<ListItem[]>([]);
  const [scopeOfWork,       setScopeOfWork]        = useState<ListItem[]>([]);
  const [zipRates,          setZipRates]           = useState<ZipTaxRate[]>([]);
  const [roles,             setRoles]              = useState<Role[]>([]);
  const [permissions,       setPermissions]        = useState<Permission[]>([]);
  const [reviews,           setReviews]            = useState<ProposalReview[]>([]);
  const [docuSignTemplates, setDocuSignTemplates]  = useState<DocuSignTemplate[]>([]);
  const [emailTemplates,    setEmailTemplates]      = useState<EmailTemplate[]>([]);

  const [loadingCats,    setLoadingCats]    = useState(true);
  const [loadingLS,      setLoadingLS]      = useState(true);
  const [loadingApts,    setLoadingApts]    = useState(true);
  const [loadingUnits,   setLoadingUnits]   = useState(true);
  const [loadingSOW,     setLoadingSOW]     = useState(true);
  const [loadingZips,    setLoadingZips]    = useState(true);
  const [loadingRoles,   setLoadingRoles]   = useState(true);
  const [loadingPerms,   setLoadingPerms]   = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingDST,     setLoadingDST]     = useState(true);
  const [loadingET,      setLoadingET]      = useState(true);


  useEffect(() => {
    supabase.from("zip_tax_rates").select("*").order("zip_code")
      .then(({ data }) => { setZipRates(data ?? []); setLoadingZips(false); });

    productsAPI.getCategories()
      .then(setCategories).catch(console.error).finally(() => setLoadingCats(false));
    leadSourcesAPI.getAll()
      .then(setLeadSources).catch(console.error).finally(() => setLoadingLS(false));
    appointmentTypesAPI.getAll()
      .then(setAppointmentTypes).catch(console.error).finally(() => setLoadingApts(false));
    unitsAPI.getAll()
      .then(setUnits).catch(console.error).finally(() => setLoadingUnits(false));
    scopeOfWorkAPI.getAll()
      .then(setScopeOfWork).catch(console.error).finally(() => setLoadingSOW(false));
    rolesAPI.getAll()
      .then((d) => setRoles(d as Role[])).catch(console.error).finally(() => setLoadingRoles(false));
    permissionsAPI.getAll()
      .then((d) => setPermissions(d as Permission[])).catch(console.error).finally(() => setLoadingPerms(false));
    proposalReviewsAPI.getAll()
      .then(setReviews).catch(console.error).finally(() => setLoadingReviews(false));
    docuSignTemplatesAPI.getAll()
      .then(setDocuSignTemplates).catch(console.error).finally(() => setLoadingDST(false));
    emailTemplatesAPI.getAll()
      .then(setEmailTemplates).catch(console.error).finally(() => setLoadingET(false));
  }, []);

  useRealtimeRefetch(
    () => {
      productsAPI.getCategories().then(setCategories).catch(console.error);
      leadSourcesAPI.getAll().then(setLeadSources).catch(console.error);
      unitsAPI.getAll().then(setUnits).catch(console.error);
      scopeOfWorkAPI.getAll().then(setScopeOfWork).catch(console.error);
      rolesAPI.getAll().then((d) => setRoles(d as Role[])).catch(console.error);
      permissionsAPI.getAll().then((d) => setPermissions(d as Permission[])).catch(console.error);
      emailTemplatesAPI.getAll().then(setEmailTemplates).catch(console.error);
    },
    ["product_categories", "lead_sources", "units", "scope_of_work", "roles", "permissions", "proposal_reviews", "docusign_templates", "email_templates"],
    "list-management"
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">List Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all dropdown lists used across the system</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListSection
          title="Product Categories"
          description="Organize products and services in the proposal builder."
          items={categories}
          loading={loadingCats}
          onAdd={async (name) => {
            const created = await productsAPI.createCategory(name);
            setCategories((prev) => [...prev, created]);
          }}
          onEdit={async (id, name) => {
            const updated = await productsAPI.updateCategory(id, name);
            setCategories((prev) => prev.map((c) => c.id === id ? updated : c));
          }}
          onDelete={async (id) => {
            await productsAPI.deleteCategory(id);
            setCategories((prev) => prev.filter((c) => c.id !== id));
          }}
        />

        <ListSection
          title="Lead Sources"
          description="Where clients come from — shown on client profiles and used in reporting."
          items={leadSources}
          loading={loadingLS}
          onAdd={async (name) => {
            const created = await leadSourcesAPI.create(name);
            setLeadSources((prev) => [...prev, created]);
          }}
          onEdit={async (id, name) => {
            const updated = await leadSourcesAPI.update(id, name);
            setLeadSources((prev) => prev.map((s) => s.id === id ? updated : s));
          }}
          onDelete={async (id) => {
            await leadSourcesAPI.delete(id);
            setLeadSources((prev) => prev.filter((s) => s.id !== id));
          }}
        />

        <AppointmentTypeSection
          items={appointmentTypes}
          loading={loadingApts}
          onAdd={async (name, subject, body) => {
            const data = await appointmentTypesAPI.create(name, appointmentTypes.length);
            const updated = await appointmentTypesAPI.update(data.id, { email_subject: subject, email_body: body });
            setAppointmentTypes((prev) => [...prev, updated]);
          }}
          onUpdate={async (id, fields) => {
            const updated = await appointmentTypesAPI.update(id, fields);
            setAppointmentTypes((prev) => prev.map((a) => a.id === id ? updated : a));
          }}
          onDelete={async (id) => {
            await appointmentTypesAPI.delete(id);
            setAppointmentTypes((prev) => prev.filter((a) => a.id !== id));
          }}
        />

        <EmailTemplatesSection
          items={emailTemplates}
          loading={loadingET}
          onAdd={async (fields) => {
            const created = await emailTemplatesAPI.create(fields);
            setEmailTemplates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
          }}
          onUpdate={async (id, fields) => {
            const updated = await emailTemplatesAPI.update(id, fields);
            setEmailTemplates((prev) => prev.map((t) => t.id === id ? updated : t));
          }}
          onDelete={async (id) => {
            await emailTemplatesAPI.delete(id);
            setEmailTemplates((prev) => prev.filter((t) => t.id !== id));
          }}
        />

        <DocuSignTemplatesSection
          items={docuSignTemplates}
          loading={loadingDST}
          onAdd={async (name, template_id) => {
            const created = await docuSignTemplatesAPI.create(name, template_id, docuSignTemplates.length);
            setDocuSignTemplates((prev) => [...prev, created]);
          }}
          onUpdate={async (id, name, template_id) => {
            const updated = await docuSignTemplatesAPI.update(id, name, template_id);
            setDocuSignTemplates((prev) => prev.map((t) => t.id === id ? updated : t));
          }}
          onDelete={async (id) => {
            await docuSignTemplatesAPI.delete(id);
            setDocuSignTemplates((prev) => prev.filter((t) => t.id !== id));
          }}
        />

        <ListSection
          title="Units"
          description="Units of measurement used in proposal line items (e.g. sq ft, hour, ton)."
          items={units}
          loading={loadingUnits}
          onAdd={async (name) => {
            const created = await unitsAPI.create(name, units.length);
            setUnits((prev) => [...prev, created]);
          }}
          onEdit={async (id, name) => {
            const updated = await unitsAPI.update(id, name);
            setUnits((prev) => prev.map((u) => u.id === id ? updated : u));
          }}
          onDelete={async (id) => {
            await unitsAPI.delete(id);
            setUnits((prev) => prev.filter((u) => u.id !== id));
          }}
        />

        <ListSection
          title="Scope of Work"
          description="Project scope types shown on client profiles and used across the system."
          items={scopeOfWork}
          loading={loadingSOW}
          onAdd={async (name) => {
            const created = await scopeOfWorkAPI.create(name, scopeOfWork.length);
            setScopeOfWork((prev) => [...prev, created]);
          }}
          onEdit={async (id, name) => {
            const updated = await scopeOfWorkAPI.update(id, name);
            setScopeOfWork((prev) => prev.map((s) => s.id === id ? updated : s));
          }}
          onDelete={async (id) => {
            await scopeOfWorkAPI.delete(id);
            setScopeOfWork((prev) => prev.filter((s) => s.id !== id));
          }}
        />

        <ProposalReviewsSection
          items={reviews}
          loading={loadingReviews}
          onAdd={async (fields) => {
            const created = await proposalReviewsAPI.create(fields);
            setReviews((prev) => [...prev, created]);
          }}
          onUpdate={async (id, fields) => {
            const updated = await proposalReviewsAPI.update(id, fields);
            setReviews((prev) => prev.map((r) => r.id === id ? updated : r));
          }}
          onDelete={async (id) => {
            await proposalReviewsAPI.delete(id);
            setReviews((prev) => prev.filter((r) => r.id !== id));
          }}
        />

        <RolePermissionsCard
          roles={roles}
          permissions={permissions}
          loadingRoles={loadingRoles}
          loadingPerms={loadingPerms}
          onRolesChange={setRoles}
          onPermissionsChange={setPermissions}
        />

        <ZipTaxSection
          items={zipRates}
          loading={loadingZips}
          onAdd={async (zip, county, rate) => {
            const { data, error } = await supabase.from("zip_tax_rates").insert({ zip_code: zip, county, total_rate: rate }).select().single();
            if (error) throw new Error(error.message);
            setZipRates((prev) => [...prev, data].sort((a, b) => a.zip_code.localeCompare(b.zip_code)));
          }}
          onEdit={async (zip, county, rate) => {
            const { error } = await supabase.from("zip_tax_rates").update({ county, total_rate: rate }).eq("zip_code", zip);
            if (error) throw new Error(error.message);
            setZipRates((prev) => prev.map((z) => z.zip_code === zip ? { ...z, county, total_rate: rate } : z));
          }}
          onDelete={async (zip) => {
            const { error } = await supabase.from("zip_tax_rates").delete().eq("zip_code", zip);
            if (error) throw new Error(error.message);
            setZipRates((prev) => prev.filter((z) => z.zip_code !== zip));
          }}
        />
      </div>
    </div>
  );
}
