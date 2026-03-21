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

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  preselectedClientId?: string;
}

const EMPTY_FORM = {
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
};

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
  preselectedClientId,
}: NewProjectDialogProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (open) {
      // Reset form every time dialog opens
      setForm({ ...EMPTY_FORM, client_id: preselectedClientId ?? "" });
      setError("");

      // Load clients
      clientsAPI.getAll().then(setClients).catch(console.error);

      // Load team members (profiles)
      supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("is_active", true)
        .order("first_name")
        .then(({ data }) => setProfiles(data ?? []));
    }
  }, [open, preselectedClientId]);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const profileName = (p: any) =>
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Project name is required."); return; }
    if (!form.client_id) { setError("Please select a client."); return; }

    setLoading(true);
    setError("");
    try {
      await projectsAPI.create({
        name: form.name.trim(),
        client_id: form.client_id,
        status: form.status,
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        total_value: form.total_value ? parseFloat(form.total_value) : 0,
        project_manager_id: (form.project_manager_id && form.project_manager_id !== "none") ? form.project_manager_id : null,
        foreman_id: (form.foreman_id && form.foreman_id !== "none") ? form.foreman_id : null,
        sales_rep_id: (form.sales_rep_id && form.sales_rep_id !== "none") ? form.sales_rep_id : null,
      });
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a new project and link it to a client.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
          {/* Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input
              id="proj-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Kitchen Remodel – Johnson"
            />
          </div>

          {/* Client */}
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

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="selling">Selling</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contract Value */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-value">Contract Value ($)</Label>
            <Input
              id="proj-value"
              type="number"
              min="0"
              value={form.total_value}
              onChange={(e) => set("total_value", e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-start">Start Date</Label>
              <Input
                id="proj-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-end">End Date</Label>
              <Input
                id="proj-end"
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </div>
          </div>

          {/* Team */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Team</Label>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Project Manager</Label>
                <Select value={form.project_manager_id} onValueChange={(v) => set("project_manager_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign PM" />
                  </SelectTrigger>
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
                <Select value={form.foreman_id} onValueChange={(v) => set("foreman_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign Foreman" />
                  </SelectTrigger>
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
                <Select value={form.sales_rep_id} onValueChange={(v) => set("sales_rep_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign Sales Rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea
              id="proj-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief project description..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
