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
import { projectsAPI, clientsAPI, usersAPI, activityLogAPI, commissionPaymentsAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
  const [confirmInfo, setConfirmInfo] = useState<null | {
    items: { role: string; name: string; paid: number; pending: number }[];
  }>(null);
  const [checking, setChecking] = useState(false);

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

  const nameErr      = !form.name.trim() ? "Project name is required." : form.name.trim().length < 2 ? "Min 2 characters." : "";
  const clientErr    = !form.client_id ? "Please select a client." : "";
  const dateErr      = form.start_date && form.end_date && form.end_date < form.start_date ? "End date must be after start date." : "";
  const pmHasNoRate  = !!(form.project_manager_id && form.project_manager_id !== "none" && projectManagers.find((p) => p.id === form.project_manager_id)?.commission_rate === 0);
  const repHasNoRate = !!(form.sales_rep_id && form.sales_rep_id !== "none" && salesReps.find((p) => p.id === form.sales_rep_id)?.commission_rate === 0);

  /** Step 1: validate + check for at-risk commission on the person being replaced/removed. */
  const handleSave = async () => {
    setTouched(true);
    if (nameErr || clientErr || dateErr) return;

    const newPmId = (form.project_manager_id && form.project_manager_id !== "none") ? form.project_manager_id : null;
    const oldPmId = project.project_manager_id ?? null;
    const pmChanged = newPmId !== oldPmId;

    const newRepId = (form.sales_rep_id && form.sales_rep_id !== "none") ? form.sales_rep_id : null;
    const oldRepId = project.sales_rep_id ?? null;
    const repChanged = newRepId !== oldRepId;

    const checks: { role: string; profileId: string; roster: any[] }[] = [];
    if (pmChanged && oldPmId) checks.push({ role: "Project Manager", profileId: oldPmId, roster: projectManagers });
    if (repChanged && oldRepId) checks.push({ role: "Sales Rep", profileId: oldRepId, roster: salesReps });

    if (checks.length > 0) {
      setChecking(true);
      setError("");
      try {
        const items: { role: string; name: string; paid: number; pending: number }[] = [];
        for (const c of checks) {
          const rows = await commissionPaymentsAPI.getAll({ profile_id: c.profileId, project_id: project.id });
          const paid = (rows ?? []).filter((r: any) => r.status === "processed").reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
          const pending = (rows ?? []).filter((r: any) => r.status === "pending").reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
          if (paid > 0 || pending > 0) {
            const person = c.roster.find((p: any) => p.id === c.profileId);
            items.push({ role: c.role, name: person ? profileName(person) : "—", paid, pending });
          }
        }
        setChecking(false);
        if (items.length > 0) {
          setConfirmInfo({ items });
          return; // wait for explicit confirmation before saving anything
        }
      } catch (err: any) {
        setChecking(false);
        setError(err.message ?? "Failed to check commission history.");
        return;
      }
    }

    await performSave();
  };

  /** Step 2: the actual save — runs immediately if nothing was at risk, or after confirmation. */
  const performSave = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const assignNow = new Date().toISOString();

      const newValue = form.total_value ? parseFloat(form.total_value) : 0;
      const oldValue = project.total_value ?? 0;

      const newPmId = (form.project_manager_id && form.project_manager_id !== "none") ? form.project_manager_id : null;
      const oldPmId = project.project_manager_id ?? null;
      const pmChanged = newPmId !== oldPmId;

      const newForemanId = (form.foreman_id && form.foreman_id !== "none") ? form.foreman_id : null;
      const oldForemanId = project.foreman_id ?? null;
      const foremanChanged = newForemanId !== oldForemanId;

      const newRepId = (form.sales_rep_id && form.sales_rep_id !== "none") ? form.sales_rep_id : null;
      const oldRepId = project.sales_rep_id ?? null;
      const repChanged = newRepId !== oldRepId;

      // Recalculate commission when PM changes
      let commissionUpdates: Record<string, number> = {};
      if (pmChanged) {
        if (!newPmId) {
          commissionUpdates = { commission: 0, commission_rate: 0 };
          await supabase.from("commission_payments").delete().eq("project_id", project.id).eq("profile_id", oldPmId).eq("status", "pending");
        } else {
          const { data: pmProfile } = await supabase.from("profiles").select("commission_rate").eq("id", newPmId).maybeSingle();
          const rate = Number(pmProfile?.commission_rate ?? 0);
          const base = newValue || oldValue;
          commissionUpdates = { commission: base * (rate / 100), commission_rate: rate };
          const { data: existingCp } = await supabase.from("commission_payments").select("id").eq("project_id", project.id).eq("profile_id", oldPmId ?? newPmId).eq("status", "pending").maybeSingle();
          if (existingCp) {
            await supabase.from("commission_payments").update({ profile_id: newPmId, amount: base * (rate / 100) }).eq("id", existingCp.id);
          } else {
            await supabase.from("commission_payments").insert({ project_id: project.id, profile_id: newPmId, amount: base * (rate / 100), status: "pending" });
          }
        }
      }

      // Recalculate sales rep commission when sales rep changes (base = gross_profit)
      let repCommissionUpdates: Record<string, number> = {};
      const gpBase = project.gross_profit ?? 0;
      if (repChanged) {
        if (!newRepId) {
          repCommissionUpdates = { sales_rep_commission: 0, sales_rep_commission_rate: 0 };
          if (oldRepId) {
            await supabase.from("commission_payments").delete().eq("project_id", project.id).eq("profile_id", oldRepId).eq("status", "pending");
            // Also clear the client-level sales rep so a background sync effect
            // (client → project) can't silently re-assign the removed rep back onto
            // this project on next load. Only clears if it still matches the person
            // being removed, so it never clobbers an unrelated value.
            await supabase.from("clients").update({ sales_rep_id: null }).eq("id", form.client_id).eq("sales_rep_id", oldRepId);
          }
        } else {
          const { data: repProfile } = await supabase.from("profiles").select("commission_rate").eq("id", newRepId).maybeSingle();
          const rate = Number(repProfile?.commission_rate ?? 0);
          const newRepCommission = gpBase * (rate / 100);
          repCommissionUpdates = { sales_rep_commission: newRepCommission, sales_rep_commission_rate: rate };
          // Remove old rep's pending row first
          if (oldRepId && oldRepId !== newRepId) {
            await supabase.from("commission_payments").delete().eq("project_id", project.id).eq("profile_id", oldRepId).eq("status", "pending");
          }
          // Upsert new rep's row
          const { data: existingRepCp } = await supabase.from("commission_payments").select("id").eq("project_id", project.id).eq("profile_id", newRepId).eq("status", "pending").maybeSingle();
          if (existingRepCp) {
            await supabase.from("commission_payments").update({ amount: newRepCommission }).eq("id", existingRepCp.id);
          } else if (rate > 0) {
            await supabase.from("commission_payments").insert({ project_id: project.id, profile_id: newRepId, amount: newRepCommission, status: "pending" });
          }
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
        sales_rep_id:       newRepId,
        ...commissionUpdates,
        ...repCommissionUpdates,
      });

      // Sync FIO foreman assignment when foreman changes
      if (foremanChanged) {
        await supabase
          .from("field_installation_orders")
          .update({ foreman_id: newForemanId })
          .eq("project_id", project.id);
      }
      if (newValue !== oldValue) {
        activityLogAPI.create({ client_id: form.client_id, action_type: "project_value_updated", description: `Project value updated: $${oldValue.toLocaleString()} → $${newValue.toLocaleString()} — "${form.name.trim()}"` }).catch(() => {});
      } else {
        activityLogAPI.create({ client_id: form.client_id, action_type: "project_updated", description: `Project details updated: "${form.name.trim()}"` }).catch(() => {});
      }

      // Sync client status based on start date change
      if (form.start_date && form.client_id) {
        const today = new Date().toISOString().split("T")[0];
        const { data: clientData } = await supabase
          .from("clients")
          .select("status, pipeline_stage_id")
          .eq("id", form.client_id)
          .single();

        if (form.start_date > today && clientData?.status === "active") {
          // Future start date + currently Active → revert to Sold
          const { data: soldStage } = await supabase
            .from("pipeline_stages")
            .select("id")
            .ilike("name", "sold")
            .maybeSingle();
          if (soldStage) {
            await supabase
              .from("clients")
              .update({ status: "sold", pipeline_stage_id: soldStage.id })
              .eq("id", form.client_id);
            await projectsAPI.update(project.id, { status: "sold" });
            activityLogAPI.create({
              client_id: form.client_id,
              action_type: "status_changed",
              description: `Moved back to Sold — start date updated to ${form.start_date} (future date)`,
            }).catch(() => {});
            toast.success("Start date is in the future — client moved back to Sold.");
          }
        } else if (form.start_date <= today && clientData?.status === "sold") {
          // Past start date + currently Sold → move to Active
          const { data: activeStage } = await supabase
            .from("pipeline_stages")
            .select("id")
            .ilike("name", "active")
            .maybeSingle();
          if (activeStage) {
            await supabase
              .from("clients")
              .update({ status: "active", pipeline_stage_id: activeStage.id })
              .eq("id", form.client_id);
            await projectsAPI.update(project.id, { status: "active", active_at: new Date().toISOString() });
            activityLogAPI.create({
              client_id: form.client_id,
              action_type: "status_changed",
              description: `Moved to Active — start date set to ${form.start_date} (past date)`,
            }).catch(() => {});
            toast.success("Start date has passed — client moved to Active.");
          }
        }
      }

      // Record team assignment changes in history table (fire-and-forget)
      const teamChanges: { role: string; oldId: string | null; newId: string | null }[] = [];
      if (pmChanged) teamChanges.push({ role: "pm", oldId: oldPmId, newId: newPmId });
      if (foremanChanged) teamChanges.push({ role: "foreman", oldId: oldForemanId, newId: newForemanId });
      if (repChanged) teamChanges.push({ role: "sales_rep", oldId: oldRepId, newId: newRepId });
      for (const change of teamChanges) {
        if (change.oldId) {
          void Promise.resolve(
            supabase.from("project_team_assignments")
              .update({ unassigned_at: assignNow, unassigned_by: currentUser?.id ?? null })
              .eq("project_id", project.id).eq("role", change.role).is("unassigned_at", null)
          ).catch(() => {});
        }
        if (change.newId) {
          void Promise.resolve(
            supabase.from("project_team_assignments")
              .insert({ project_id: project.id, client_id: form.client_id, role: change.role, profile_id: change.newId, assigned_at: assignNow, assigned_by: currentUser?.id ?? null })
          ).catch(() => {});
        }
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
    <>
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

            {/* PM — always editable; frozen only on completed */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project Manager</Label>
              {project.status === "completed" ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <span className="text-sm font-medium">{projectManagers.find((p) => p.id === form.project_manager_id) ? profileName(projectManagers.find((p) => p.id === form.project_manager_id)) : "—"}</span>
                  <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">Locked</span>
                </div>
              ) : (
                <>
                  <Select value={form.project_manager_id || "none"} onValueChange={(v) => set("project_manager_id", v)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {projectManagers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pmHasNoRate && (() => {
                    const pm = projectManagers.find((p) => p.id === form.project_manager_id);
                    return (
                      <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <span className="mt-0.5">🚫</span>
                        <span><strong>{pm?.first_name} {pm?.last_name}</strong> has no commission rate set. Add their rate in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium text-red-800">Team settings</a> before saving.</span>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Foreman — always editable; frozen only on completed */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Foreman</Label>
              {project.status === "completed" ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <span className="text-sm font-medium">{foremen.find((p) => p.id === form.foreman_id) ? profileName(foremen.find((p) => p.id === form.foreman_id)) : "—"}</span>
                  <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">Locked</span>
                </div>
              ) : (
                <Select value={form.foreman_id || "none"} onValueChange={(v) => set("foreman_id", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {foremen.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Sales Rep — editable at any stage; warning toast after Sold; frozen only on completed */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sales Rep</Label>
              {project.status === "completed" ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <span className="text-sm font-medium">{salesReps.find((p) => p.id === form.sales_rep_id) ? profileName(salesReps.find((p) => p.id === form.sales_rep_id)) : "—"}</span>
                  <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">Locked</span>
                </div>
              ) : (
                <>
                  <Select value={form.sales_rep_id || "none"} onValueChange={(v) => set("sales_rep_id", v)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {salesReps.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{profileName(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {repHasNoRate && (() => {
                    const rep = salesReps.find((p) => p.id === form.sales_rep_id);
                    return (
                      <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <span className="mt-0.5">🚫</span>
                        <span><strong>{rep?.first_name} {rep?.last_name}</strong> has no commission rate set. Add their rate in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium text-red-800">Team settings</a> before saving.</span>
                      </div>
                    );
                  })()}
                </>
              )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || checking}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || checking || pmHasNoRate || repHasNoRate} className="min-w-[140px]">
            <span className="flex items-center justify-center gap-2 whitespace-nowrap">
              {checking ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Checking...</>
              ) : loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                "Save Changes"
              )}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!confirmInfo} onOpenChange={(v) => { if (!v) setConfirmInfo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Team Change</DialogTitle>
            <DialogDescription>
              This will affect commission already tracked on this project.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {confirmInfo?.items.map((item, i) => (
              <div key={i} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{item.role}: {item.name}</p>
                {item.paid > 0 && (
                  <p className="text-muted-foreground">Already paid: <span className="font-medium text-foreground">${item.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> — not affected</p>
                )}
                {item.pending > 0 && (
                  <p className="text-muted-foreground">Still pending: <span className="font-medium text-foreground">${item.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> — will be cancelled and added back to Net Profit</p>
                )}
              </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmInfo(null)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={() => { setConfirmInfo(null); performSave(); }}
              disabled={loading}
              className="min-w-[100px]"
            >
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Continue"}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
