import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Plus, Pencil, Trash2, Check, X, Loader2, ArrowLeft, Mail } from "lucide-react";
import { productsAPI, leadSourcesAPI } from "../../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Link } from "react-router";

interface ListItem { id: string; name: string; }
interface AppointmentType { id: string; name: string; email_subject: string | null; email_body: string | null; }

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
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState("");
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!addValue.trim()) return;
    setAdding(true);
    try {
      await onAdd(addValue.trim());
      setAddValue("");
      toast.success(`"${addValue.trim()}" added.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add.");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editValue.trim()) return;
    setSavingId(id);
    try {
      await onEdit(id, editValue.trim());
      setEditingId(null);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Add new — always on top */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Input
            placeholder={`Add new...`}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !addValue.trim()} className="h-8">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Add
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              {editingId === item.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEdit(item.id)} disabled={!!savingId}>
                    {savingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
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
          ))
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
const unitsAPI = tableAPI("units");

function AppointmentTypeSection({
  items, loading, onAdd, onUpdate, onDelete,
}: {
  items: AppointmentType[];
  loading: boolean;
  onAdd: (name: string) => Promise<void>;
  onUpdate: (id: string, fields: { name?: string; email_subject?: string | null; email_body?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [addValue, setAddValue]         = useState("");
  const [adding, setAdding]             = useState(false);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editName, setEditName]             = useState("");
  const [editEmailSubject, setEditEmailSubject] = useState("");
  const [editEmailBody, setEditEmailBody]   = useState("");
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const handleAdd = async () => {
    if (!addValue.trim()) return;
    setAdding(true);
    try { await onAdd(addValue.trim()); setAddValue(""); toast.success(`"${addValue.trim()}" added.`); }
    catch (err: any) { toast.error(err.message || "Failed to add."); }
    finally { setAdding(false); }
  };

  const openEdit = (item: AppointmentType) => {
    setExpandedId(item.id);
    setEditName(item.name);
    setEditEmailSubject(item.email_subject ?? "");
    setEditEmailBody(item.email_body ?? "");
  };

  const handleSave = async (id: string) => {
    setSavingId(id);
    try {
      await onUpdate(id, { name: editName.trim(), email_subject: editEmailSubject.trim() || null, email_body: editEmailBody.trim() || null });
      setExpandedId(null);
      toast.success("Updated.");
    } catch (err: any) { toast.error(err.message || "Failed to update."); }
    finally { setSavingId(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try { await onDelete(id); toast.success(`"${name}" removed.`); }
    catch (err: any) { toast.error(err.message || "Failed to delete."); }
    finally { setDeletingId(null); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Appointment Types</CardTitle>
        <p className="text-xs text-muted-foreground">Types of appointments — each can have a custom email body sent to the client.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Input placeholder="Add new..." value={addValue} onChange={(e) => setAddValue(e.target.value)}
            className="h-8 text-sm flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }} />
          <Button size="sm" onClick={handleAdd} disabled={adding || !addValue.trim()} className="h-8">
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}Add
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items yet.</p>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-lg border bg-muted/20">
            {expandedId === item.id ? (
              <div className="p-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Type Name</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Escape") setExpandedId(null); }} autoFocus />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email Subject
                  </label>
                  <Input
                    value={editEmailSubject}
                    onChange={(e) => setEditEmailSubject(e.target.value)}
                    placeholder="Your appointment is confirmed — {type} on {date}"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email Body
                  </label>
                  <Textarea
                    value={editEmailBody}
                    onChange={(e) => setEditEmailBody(e.target.value)}
                    placeholder="Hi {client_name}, your appointment has been scheduled for {date} at {time}..."
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Available variables: {"{client_name}"}, {"{date}"}, {"{time}"}, {"{type}"}, {"{address}"}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setExpandedId(null)}>
                    <X className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                  <Button size="sm" className="h-7" onClick={() => handleSave(item.id)} disabled={!!savingId}>
                    {savingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.name}</span>
                  {item.email_body && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Mail className="h-2.5 w-2.5 shrink-0" />{item.email_body}
                    </p>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id, item.name)} disabled={deletingId === item.id}>
                  {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ListManagement() {
  const [categories,        setCategories]        = useState<ListItem[]>([]);
  const [leadSources,       setLeadSources]        = useState<ListItem[]>([]);
  const [appointmentTypes,  setAppointmentTypes]   = useState<AppointmentType[]>([]);
  const [units,             setUnits]              = useState<ListItem[]>([]);

  const [loadingCats,  setLoadingCats]  = useState(true);
  const [loadingLS,    setLoadingLS]    = useState(true);
  const [loadingApts,  setLoadingApts]  = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(true);

  useEffect(() => {
    productsAPI.getCategories()
      .then(setCategories).catch(console.error).finally(() => setLoadingCats(false));
    leadSourcesAPI.getAll()
      .then(setLeadSources).catch(console.error).finally(() => setLoadingLS(false));
    appointmentTypesAPI.getAll()
      .then(setAppointmentTypes).catch(console.error).finally(() => setLoadingApts(false));
    unitsAPI.getAll()
      .then(setUnits).catch(console.error).finally(() => setLoadingUnits(false));
  }, []);

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
          onAdd={async (name) => {
            const created = await appointmentTypesAPI.create(name, appointmentTypes.length);
            setAppointmentTypes((prev) => [...prev, created]);
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
      </div>
    </div>
  );
}
