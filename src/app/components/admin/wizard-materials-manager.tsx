import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Plus, Edit, Trash2, Star, Loader2, Wand2 } from "lucide-react";
import { wizardVariantsAPI } from "../../utils/api";
import { toast } from "sonner";

// Display config — which wizard/role groups we manage
const GROUPS: { wizard_type: string; role: string; wizardLabel: string; roleLabel: string; hasCap: boolean }[] = [
  { wizard_type: "retaining_walls", role: "gravity_wall_block", wizardLabel: "Retaining Walls", roleLabel: "Gravity Wall Blocks", hasCap: true },
  { wizard_type: "pavers", role: "paver_material", wizardLabel: "Pavers", roleLabel: "Paver Materials", hasCap: false },
];

const emptyForm = {
  id: "" as string | null,
  wizard_type: "",
  role: "",
  label: "",
  product_name: "",
  price_override: "",
  cap_product_name: "",
  cap_price_override: "",
  is_default: false,
};

export function WizardMaterialsManager({ products }: { products: any[] }) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const load = async () => {
    try { setVariants(await wizardVariantsAPI.getAll()); }
    catch (e: any) { toast.error(e.message ?? "Failed to load wizard materials."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const productNames = products.map((p) => p.name).filter(Boolean).sort();

  const openAdd = (wizard_type: string, role: string) => {
    setForm({ ...emptyForm, wizard_type, role });
    setTouched(false);
    setDialogOpen(true);
  };
  const openEdit = (v: any) => {
    setForm({
      id: v.id, wizard_type: v.wizard_type, role: v.role, label: v.label ?? "",
      product_name: v.product_name ?? "",
      price_override: v.price_override != null ? String(v.price_override) : "",
      cap_product_name: v.cap_product_name ?? "",
      cap_price_override: v.cap_price_override != null ? String(v.cap_price_override) : "",
      is_default: !!v.is_default,
    });
    setTouched(false);
    setDialogOpen(true);
  };

  const groupCfg = GROUPS.find((g) => g.role === form.role);
  const labelErr = !form.label.trim() ? "Name is required." : "";
  const productErr = !form.product_name.trim() ? "Select a product." : "";
  const hasErr = !!labelErr || !!productErr;

  const handleSave = async () => {
    setTouched(true);
    if (hasErr) return;
    setSaving(true);
    try {
      const payload = {
        wizard_type: form.wizard_type,
        role: form.role,
        label: form.label.trim(),
        product_name: form.product_name.trim(),
        price_override: form.price_override.trim() ? Number(form.price_override) : null,
        cap_product_name: groupCfg?.hasCap && form.cap_product_name.trim() ? form.cap_product_name.trim() : null,
        cap_price_override: groupCfg?.hasCap && form.cap_price_override.trim() ? Number(form.cap_price_override) : null,
      };
      let savedId = form.id;
      if (form.id) {
        await wizardVariantsAPI.update(form.id, payload);
      } else {
        const created = await wizardVariantsAPI.create(payload);
        savedId = created.id;
      }
      // Handle default toggle
      if (form.is_default && savedId) {
        await wizardVariantsAPI.setDefault(savedId, form.wizard_type, form.role);
      }
      toast.success(form.id ? "Material updated." : "Material added.");
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (v: any) => {
    try {
      await wizardVariantsAPI.setDefault(v.id, v.wizard_type, v.role);
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed to set default."); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await wizardVariantsAPI.delete(deleteTarget.id);
      toast.success("Material removed.");
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed to delete."); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="h-4 w-4" /> Wizard Materials
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Material options shown in the estimate wizards. Selecting a block auto-applies its matching cap. Prices are <span className="font-medium">pre-markup</span> unit cost.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          GROUPS.map((g) => {
            const rows = variants.filter((v) => v.wizard_type === g.wizard_type && v.role === g.role);
            return (
              <div key={`${g.wizard_type}-${g.role}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{g.wizardLabel} — {g.roleLabel}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openAdd(g.wizard_type, g.role)}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Product</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Unit Cost</th>
                        {g.hasCap && <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Cap</th>}
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.length === 0 && (
                        <tr><td colSpan={g.hasCap ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground text-sm">No materials yet — click Add.</td></tr>
                      )}
                      {rows.map((v) => (
                        <tr key={v.id} className="hover:bg-accent/40">
                          <td className="px-3 py-2.5 font-medium">
                            <span className="flex items-center gap-1.5">
                              {v.label}
                              {v.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{v.product_name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{v.price_override != null ? `$${Number(v.price_override).toFixed(2)}` : <span className="text-muted-foreground">Catalog</span>}</td>
                          {g.hasCap && <td className="px-3 py-2.5 text-muted-foreground">{v.cap_product_name ?? "—"}</td>}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {!v.is_default && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Set as default" onClick={() => handleSetDefault(v)}>
                                  <Star className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(v)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Remove" onClick={() => setDeleteTarget(v)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Material" : "Add Material"}</DialogTitle>
            <DialogDescription>
              {groupCfg ? `${groupCfg.wizardLabel} — ${groupCfg.roleLabel}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-1.5">
              <Label>Display Name <span className="text-destructive">*</span></Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Weston Stone" className={touched && labelErr ? "border-red-500" : ""} />
              {touched && labelErr && <p className="text-xs text-red-500">{labelErr}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Linked Product <span className="text-destructive">*</span></Label>
              <Select value={form.product_name || undefined} onValueChange={(v) => setForm((f) => ({ ...f, product_name: v }))}>
                <SelectTrigger className={touched && productErr ? "border-red-500" : ""}><SelectValue placeholder="Select product…" /></SelectTrigger>
                <SelectContent>
                  {productNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              {touched && productErr && <p className="text-xs text-red-500">{productErr}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Unit Cost (pre-markup)</Label>
              <Input type="number" step="0.01" value={form.price_override} onChange={(e) => setForm((f) => ({ ...f, price_override: e.target.value }))} placeholder="Leave blank to use catalog price" />
              <p className="text-[11px] text-muted-foreground">Material cost per unit before markup. Blank = use the product's catalog price.</p>
            </div>

            {groupCfg?.hasCap && (
              <>
                <div className="grid gap-1.5">
                  <Label>Matching Cap Product</Label>
                  <Select value={form.cap_product_name || undefined} onValueChange={(v) => setForm((f) => ({ ...f, cap_product_name: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select cap product…" /></SelectTrigger>
                    <SelectContent>
                      {productNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Auto-selected when this block is chosen in the wizard.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label>Cap Unit Cost (pre-markup)</Label>
                  <Input type="number" step="0.01" value={form.cap_price_override} onChange={(e) => setForm((f) => ({ ...f, cap_price_override: e.target.value }))} placeholder="Leave blank to use catalog price" />
                </div>
              </>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.is_default} onCheckedChange={(c) => setForm((f) => ({ ...f, is_default: !!c }))} />
              <span className="text-sm">Set as default (pre-selected in the wizard)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (touched && hasErr)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.id ? "Save Changes" : "Add Material")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove material?</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.label}" will no longer appear in the wizard. Existing proposals are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
