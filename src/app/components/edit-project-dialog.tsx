import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { projectsAPI, clientsAPI } from "../utils/api";
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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      clientsAPI.getAll().then(setClients).catch(console.error);

      supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("is_active", true)
        .order("first_name")
        .then(({ data }) => setProfiles(data ?? []));
    }
  }, [open, project]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const profileName = (p: any) =>
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Project name is required."); return; }
    if (!form.client_id) { setError("Please select a client."); return; }

    setLoading(true);
    setError("");
    try {
      await projectsAPI.update(project.id, {
        name:               form.name.trim(),
        client_id:          form.client_id,
        status:             form.status,
        description:        form.description.trim() || null,
        start_date:         form.start_date || null,
        end_date:           form.end_date || null,
        total_value:        form.total_value ? parseFloat(form.total_value) : 0,
        project_manager_id: (form.project_manager_id && form.project_manager_id !== "none") ? form.project_manager_id : null,
        foreman_id:         (form.foreman_id && form.foreman_id !== "none") ? form.foreman_id : null,
        sales_rep_id:       (form.sales_rep_id && form.sales_rep_id !== "none") ? form.sales_rep_id : null,
      });
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project details below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Project Name *</Label>
            <Input
              id="ep-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={(v) => set("client_id", v)}>
              <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-start">Start Date</Label>
              <Input id="ep-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-end">End Date</Label>
              <Input id="ep-end" type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Team</Label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project Manager</Label>
              <Select value={form.project_manager_id || "none"} onValueChange={(v) => set("project_manager_id", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {profiles.map((p) => (
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
                  {profiles.map((p) => (
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
                  {profiles.map((p) => (
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
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
