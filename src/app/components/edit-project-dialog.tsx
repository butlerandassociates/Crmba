import { useState, useEffect } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Loader2 } from "lucide-react";
import { projectsAPI, clientsAPI, usersAPI, activityLogAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSaved: () => void;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: EditProjectDialogProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [projectManagers, setProjectManagers] = useState<any[]>([]);
  const [foremen, setForemen] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const [form, setForm] = useState({
    name: "",
    client_id: "",
    status: "prospect",
    description: "",
    start_date: "",
    end_date: "",
    total_value: "",
    project_manager_id: "",
    foreman_id: "",
    sales_rep_id: "",
  });

  // Pre-fill when project changes
  useEffect(() => {
    if (open && project) {
      setForm({
        name:               project.name ?? "",
        client_id:          project.client_id ?? "",
        status:             project.status ?? "prospect",
        description:        project.description ?? "",
        start_date:         project.start_date ?? "",
        end_date:           project.end_date ?? "",
        total_value:        project.total_value != null ? String(project.total_value) : "",
        project_manager_id: project.project_manager_id ?? "",
        foreman_id:         project.foreman_id ?? "",
        sales_rep_id:       project.sales_rep_id ?? "",
      });
      setError("");
      setTouched(false);

      clientsAPI.getAll().then(setClients).catch(console.error);

      usersAPI.getByRole("project_manager").then(setProjectManagers).catch(console.error);
      usersAPI.getByRole("foreman").then(setForemen).catch(console.error);
      usersAPI.getByRole("sales_rep").then(setSalesReps).catch(console.error);
    }
  }, [open, project]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const profileName = (p: any) =>
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();

  const nameErr   = !form.name.trim() ? "Project name is required." : form.name.trim().length < 2 ? "Min 2 characters." : "";
  const clientErr = !form.client_id ? "Please select a client." : "";
  const dateErr   = form.start_date && form.end_date && form.end_date < form.start_date ? "End date must be after start date." : "";

  const handleSave = async () => {
    setTouched(true);
    if (nameErr || clientErr || dateErr) return;

    setLoading(true);
    setError("");
    try {
      const newValue = form.total_value ? parseFloat(form.total_value) : 0;
      const oldValue = project.total_value ?? 0;

      const newPmId = (form.project_manager_id && form.project_manager_id !== "none") ? form.project_manager_id : null;
      const oldPmId = project.project_manager_id ?? null;
      const pmChanged = newPmId !== oldPmId;

      // Recalculate commission when PM changes
      let commissionUpdates: Record<string, number> = {};
      if (pmChanged) {
        if (!newPmId) {
          // PM removed — zero out commission
          commissionUpdates = { commission: 0, commission_rate: 0 };
          // Delete any pending commission_payments for this project
          await supabase
            .from("commission_payments")
            .delete()
            .eq("project_id", project.id)
            .eq("status", "pending");
        } else {
          // PM changed — look up new PM's commission_rate and recalculate
          const { data: pmProfile } = await supabase
            .from("profiles")
            .select("commission_rate")
            .eq("id", newPmId)
            .maybeSingle();
          const rate = Number(pmProfile?.commission_rate ?? 0);
          const base = newValue || oldValue;
          commissionUpdates = { commission: base * (rate / 100), commission_rate: rate };
          // Update existing pending commission_payments to the new PM
          await supabase
            .from("commission_payments")
            .update({ profile_id: newPmId, amount: base * (rate / 100) })
            .eq("project_id", project.id)
            .eq("status", "pending");
        }
      }

      await projectsAPI.update(project.id, {
        name:               form.name.trim(),
        client_id:          form.client_id,
        status:             form.status,
        description:        form.description.trim() || null,
        start_date:         form.start_date || null,
        end_date:           form.end_date || null,
        total_value:        newValue,
        project_manager_id: newPmId,
        foreman_id:         (form.foreman_id && form.foreman_id !== "none") ? form.foreman_id : null,
        sales_rep_id:       (form.sales_rep_id && form.sales_rep_id !== "none") ? form.sales_rep_id : null,
        ...commissionUpdates,
      });
      if (newValue !== oldValue) {
        activityLogAPI.create({ client_id: form.client_id, action_type: "project_value_updated", description: `Project value updated: $${oldValue.toLocaleString()} → $${newValue.toLocaleString()} — "${form.name.trim()}"` }).catch(() => {});
      } else {
        activityLogAPI.create({ client_id: form.client_id, action_type: "project_updated", description: `Project details updated: "${form.name.trim()}"` }).catch(() => {});
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Failed to save project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details below.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Project Name <span className="text-destructive">*</span></Label>
            <Input
              id="ep-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={touched && nameErr ? "border-red-500" : ""}
            />
            {touched && nameErr && <p className="text-xs text-red-500">{nameErr}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Client <span className="text-destructive">*</span></Label>
            <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger className={touched && clientErr ? "border-red-500" : ""}>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched && clientErr && <p className="text-xs text-red-500">{clientErr}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="selling">Selling</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-value">Contract Value ($)</Label>
            <Input
              id="ep-value"
              type="number"
              min="0"
              value={form.total_value}
              onChange={(e) => set("total_value", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-start">Start Date</Label>
                <Input id="ep-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-end">End Date</Label>
                <Input id="ep-end" type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className={touched && dateErr ? "border-red-500" : ""} />
              </div>
            </div>
            {touched && dateErr && <p className="text-xs text-red-500">{dateErr}</p>}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Team</Label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project Manager</Label>
              <Select value={form.project_manager_id || "none"} onValueChange={(v) => set("project_manager_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {projectManagers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Foreman</Label>
              <Select value={form.foreman_id || "none"} onValueChange={(v) => set("foreman_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {foremen.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sales Rep</Label>
              <Select value={form.sales_rep_id || "none"} onValueChange={(v) => set("sales_rep_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {salesReps.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea
              id="ep-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
