import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Building2, Check, X, ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { suppliersAPI, Supplier } from "../../api/suppliers";
import { toast } from "sonner";

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state (shared for add + edit)
  const [formName, setFormName] = useState("");
  const [formPoc, setFormPoc] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      setSuppliers(await suppliersAPI.getAll());
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormName(""); setFormPoc(""); setFormEmail("");
    setFormErrors({}); setShowAdd(false); setEditingId(null);
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) errs.name = "Supplier name is required";
    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim()))
      errs.email = "Enter a valid email address";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const created = await suppliersAPI.create({
        supplier_name: formName.trim(),
        poc_name: formPoc.trim() || undefined,
        email: formEmail.trim() || undefined,
      });
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
      toast.success("Supplier added");
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to add supplier");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setFormName(s.supplier_name);
    setFormPoc(s.poc_name || "");
    setFormEmail(s.email || "");
    setFormErrors({});
    setShowAdd(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !validateForm()) return;
    setSaving(true);
    try {
      const updated = await suppliersAPI.update(editingId, {
        supplier_name: formName.trim(),
        poc_name: formPoc.trim() || undefined,
        email: formEmail.trim() || undefined,
      });
      setSuppliers((prev) => prev.map((s) => s.id === editingId ? updated : s));
      toast.success("Supplier updated");
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to update supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await suppliersAPI.delete(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Supplier deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete supplier");
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
        <ChevronLeft className="h-4 w-4" />
        Admin Portal
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage supplier contacts used on Purchase Orders</p>
        </div>
        {!showAdd && !editingId && (
          <Button size="sm" onClick={() => { setShowAdd(true); setFormName(""); setFormPoc(""); setFormEmail(""); setFormErrors({}); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Supplier
          </Button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-semibold">New Supplier</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supplier Name *</Label>
              <Input
                className={`h-9 text-sm ${formErrors.name ? "border-destructive" : ""}`}
                placeholder="e.g. SiteOne Landscape Supply"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormErrors((p) => ({ ...p, name: "" })); }}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Point of Contact</Label>
              <Input
                className="h-9 text-sm"
                placeholder="Contact name"
                value={formPoc}
                onChange={(e) => setFormPoc(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email</Label>
              <Input
                className={`h-9 text-sm ${formErrors.email ? "border-destructive" : ""}`}
                placeholder="orders@supplier.com"
                value={formEmail}
                onChange={(e) => { setFormEmail(e.target.value); setFormErrors((p) => ({ ...p, email: "" })); }}
              />
              {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={handleAdd}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Save Supplier
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : suppliers.length === 0 && !showAdd ? (
        <div className="text-center py-16 border rounded-xl">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No suppliers yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add suppliers to quickly select them when creating a Purchase Order</p>
          <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add First Supplier
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-900 text-xs font-semibold text-white">
            <div className="col-span-4">Supplier Name</div>
            <div className="col-span-3">Point of Contact</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-1"></div>
          </div>

          {suppliers.map((s, i) => (
            <div key={s.id}>
              {editingId === s.id ? (
                <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Supplier Name *</Label>
                      <Input
                        className={`h-9 text-sm ${formErrors.name ? "border-destructive" : ""}`}
                        value={formName}
                        onChange={(e) => { setFormName(e.target.value); setFormErrors((p) => ({ ...p, name: "" })); }}
                      />
                      {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Point of Contact</Label>
                      <Input className="h-9 text-sm" value={formPoc} onChange={(e) => setFormPoc(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input
                        className={`h-9 text-sm ${formErrors.email ? "border-destructive" : ""}`}
                        value={formEmail}
                        onChange={(e) => { setFormEmail(e.target.value); setFormErrors((p) => ({ ...p, email: "" })); }}
                      />
                      {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
                    <Button size="sm" disabled={saving} onClick={handleUpdate}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                      Update
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={`grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm ${i > 0 ? "border-t" : ""} hover:bg-muted/20 transition-colors`}>
                  <div className="col-span-4 font-medium truncate">{s.supplier_name}</div>
                  <div className="col-span-3 text-muted-foreground truncate">{s.poc_name || "—"}</div>
                  <div className="col-span-4 text-muted-foreground truncate">{s.email || "—"}</div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => startEdit(s)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(s.id)}
                      disabled={deletingId === s.id}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      {deletingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                "{suppliers.find((s) => s.id === deleteConfirm)?.supplier_name}"
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2 pb-2 px-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!!deletingId}
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
