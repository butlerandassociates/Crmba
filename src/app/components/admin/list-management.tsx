import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Plus, Pencil, Trash2, Check, X, Loader2, ArrowLeft } from "lucide-react";
import { productsAPI, leadSourcesAPI } from "../../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Link } from "react-router";

interface ListItem { id: string; name: string; }

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

const appointmentTypesAPI = tableAPI("appointment_types");
const unitsAPI = tableAPI("units");

export function ListManagement() {
  const [categories,        setCategories]        = useState<ListItem[]>([]);
  const [leadSources,       setLeadSources]        = useState<ListItem[]>([]);
  const [appointmentTypes,  setAppointmentTypes]   = useState<ListItem[]>([]);
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

        <ListSection
          title="Appointment Types"
          description="Types of appointments available when scheduling with a client."
          items={appointmentTypes}
          loading={loadingApts}
          onAdd={async (name) => {
            const created = await appointmentTypesAPI.create(name, appointmentTypes.length);
            setAppointmentTypes((prev) => [...prev, created]);
          }}
          onEdit={async (id, name) => {
            const updated = await appointmentTypesAPI.update(id, name);
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
