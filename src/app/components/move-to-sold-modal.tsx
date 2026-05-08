import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Loader2, ChevronRight, ChevronLeft, Check,
  Upload, FileText, AlertCircle, Plus, Trash2, FileSignature,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usersAPI, fioAPI, activityLogAPI, projectPaymentsAPI } from "../utils/api";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { photosAPI } from "../api/files";
import { toast } from "sonner";

interface MoveToSoldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
  hasProposal?: boolean;
}

const TOTAL_STEPS = 4;
const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function MoveToSoldModal({ open, onOpenChange, client, project, onSuccess, hasProposal = true }: MoveToSoldModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Hard gate: file uploads
  const [docusignFile, setDocusignFile] = useState<File | null>(null);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [alreadySignedExternally, setAlreadySignedExternally] = useState(false);
  const docusignRef = useRef<HTMLInputElement>(null);
  const depositRef = useRef<HTMLInputElement>(null);

  // Step 2 — Crew + FIO
  const [foremen, setForemen] = useState<any[]>([]);
  const [projectManagers, setProjectManagers] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [selectedForeman, setSelectedForeman] = useState("");
  const [selectedPM, setSelectedPM] = useState("");
  const [selectedSalesRep, setSelectedSalesRep] = useState("");
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  // Step 3 — Payment schedule
  const [paymentMilestones, setPaymentMilestones] = useState<{ label: string; amount: string; due_date: string; is_deposit: boolean }[]>([
    { label: "Deposit", amount: "", due_date: "", is_deposit: true },
    { label: "Progress Payment", amount: "", due_date: "", is_deposit: false },
    { label: "Final Payment", amount: "", due_date: "", is_deposit: false },
  ]);

  // Step 4 — Schedule
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setDocusignFile(null);
      setDepositFile(null);
      setAlreadySignedExternally(false);
      setSelectedForeman(""); setSelectedPM(""); setSelectedSalesRep("");
      setSuggestedItems([]); setCheckedIds(new Set()); setSelectedItems([]);
      setPaymentMilestones([
        { label: "Deposit", amount: "", due_date: "", is_deposit: true },
        { label: "Progress Payment", amount: "", due_date: "", is_deposit: false },
        { label: "Final Payment", amount: "", due_date: "", is_deposit: false },
      ]);
      setStartDate(""); setEndDate("");
      return;
    }
    // Pre-fill dates from existing project if already set
    setStartDate(project?.start_date ? project.start_date.split("T")[0] : "");
    setEndDate(project?.end_date ? project.end_date.split("T")[0] : "");
    usersAPI.getByRole("foreman").then(setForemen).catch(console.error);
    usersAPI.getByRole("project_manager").then(setProjectManagers).catch(console.error);
    // Pre-fill sales rep selection on open
    usersAPI.getByRole("sales_rep").then((reps) => {
      setSalesReps(reps);
      if (project?.sales_rep_id) {
        setSelectedSalesRep(project.sales_rep_id);
      } else if (client?.sales_rep_id) {
        setSelectedSalesRep(client.sales_rep_id);
      } else if (client?.id) {
        supabase
          .from("appointments")
          .select("assigned_to, assigned_to_profile:profiles!assigned_to(id, role)")
          .eq("client_id", client.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            const assignedId = data?.assigned_to;
            const assignedRole = (data?.assigned_to_profile as any)?.role;
            if (assignedId && assignedRole === "sales_rep") {
              setSelectedSalesRep(assignedId);
            }
          });
      }
    }).catch(console.error);
    fetchLaborItems();
  }, [open]);

  // Refresh lists only (no selection reset) when any profile is updated
  const refreshProfileLists = () => {
    usersAPI.getByRole("sales_rep").then(setSalesReps).catch(console.error);
    usersAPI.getByRole("project_manager").then(setProjectManagers).catch(console.error);
  };

  useRealtimeRefetch(refreshProfileLists, ["profiles"], "move-to-sold-profiles");

  const fetchLaborItems = async () => {
    if (!client?.id) return;
    const { data: estimates } = await supabase
      .from("estimates").select("id").eq("client_id", client.id)
      .eq("status", "accepted").order("created_at", { ascending: false }).limit(1);
    if (!estimates || estimates.length === 0) return;
    const { data: items } = await supabase
      .from("estimate_line_items").select("*")
      .eq("estimate_id", estimates[0].id).gt("labor_cost", 0);
    setSuggestedItems(
      (items || []).map((item: any, i: number) => ({
        id: `suggested-${i}`,
        product_name: item.product_name || item.name,
        unit: item.unit,
        quantity: item.quantity,
        labor_cost_per_unit: item.labor_cost,
      }))
    );
  };

  const toggleItem = (item: any) => {
    const next = new Set(checkedIds);
    if (next.has(item.id)) {
      next.delete(item.id);
      setSelectedItems(selectedItems.filter((i) => i.id !== item.id));
    } else {
      next.add(item.id);
      setSelectedItems([...selectedItems, { ...item }]);
    }
    setCheckedIds(next);
  };

  const addMilestone = () =>
    setPaymentMilestones((prev) => [...prev, { label: "", amount: "", due_date: "", is_deposit: false }]);

  const removeMilestone = (i: number) =>
    setPaymentMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const updateMilestone = (i: number, key: string, value: string) =>
    setPaymentMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, [key]: value } : m));

  const toggleDeposit = (i: number) =>
    setPaymentMilestones((prev) => prev.map((m, idx) => ({ ...m, is_deposit: idx === i })));

  const docusignSigned = client?.docusign_status === "completed";
  const contractSatisfied = docusignSigned || alreadySignedExternally || !!docusignFile;
  const canProceedStep1 = contractSatisfied && !!depositFile;
  const depositMilestone = paymentMilestones.find((m) => m.is_deposit);
  const canProceedStep3 = !!depositMilestone && !!depositMilestone.label.trim() && parseFloat(depositMilestone.amount || "0") > 0;
  const canConfirm = !!startDate;

  const handleConfirm = async () => {
    if (!startDate) { toast.error("Start date is required"); return; }
    setSaving(true);
    try {
      // 1. Upload gate documents to client files
      if (docusignFile) await photosAPI.upload(client.id, docusignFile).catch(() => {});
      if (depositFile)  await photosAPI.upload(client.id, depositFile).catch(() => {});

      // 2. Calculate financials from latest estimate
      let financials: Record<string, number> = {};
      let commissionRate = 0;
      let salesRepCommissionRate = 0;
      let estimateTitle = "";
      const { data: estimates } = await supabase
        .from("estimates").select("id, title, total, subtotal, total_cost").eq("client_id", client.id)
        .eq("status", "accepted").order("created_at", { ascending: false }).limit(1);
      if (estimates && estimates.length > 0) {
        estimateTitle = estimates[0].title || "";
        const subtotalVal = Number(estimates[0].subtotal || 0);
        const totalValue = Number(estimates[0].total || subtotalVal);
        const totalCosts = Number(estimates[0].total_cost || 0);
        const grossProfit = totalValue - totalCosts;
        const profitMargin = totalValue > 0 ? (grossProfit / totalValue) * 100 : 0;
        // Look up PM's commission_rate from profiles
        if (selectedPM) {
          const { data: pmProfile } = await supabase.from("profiles").select("commission_rate").eq("id", selectedPM).maybeSingle();
          commissionRate = Number(pmProfile?.commission_rate ?? 0);
        }
        if (selectedSalesRep) {
          const { data: repProfile } = await supabase.from("profiles").select("commission_rate").eq("id", selectedSalesRep).maybeSingle();
          salesRepCommissionRate = Number(repProfile?.commission_rate ?? 0);
        }
        const commissionBase = subtotalVal || totalValue;
        financials = {
          total_value: totalValue, total_costs: totalCosts, gross_profit: grossProfit, profit_margin: profitMargin,
          commission: commissionBase * (commissionRate / 100), commission_rate: commissionRate,
          sales_rep_commission: grossProfit * (salesRepCommissionRate / 100),
          sales_rep_commission_rate: salesRepCommissionRate,
        };
      }

      // 3. Create or update project — check for existing to prevent duplicates
      let projectId = project?.id;
      const { data: { user: soldUser } } = await supabase.auth.getUser();
      const projectPayload = {
        foreman_id: selectedForeman || null,
        project_manager_id: selectedPM || null,
        sales_rep_id: selectedSalesRep || null,
        start_date: startDate,
        end_date: endDate || null,
        status: "sold",
        sold_at: new Date().toISOString(),
        sold_by: soldUser?.id ?? null,
        ...financials,
      };

      if (!projectId) {
        const { data: existing } = await supabase
          .from("projects").select("id").eq("client_id", client.id).limit(1).maybeSingle();
        if (existing) projectId = existing.id;
      }

      if (projectId) {
        await supabase.from("projects").update(projectPayload).eq("id", projectId);
      } else {
        const projectName = estimateTitle || `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company || "New Project";
        const { data: newProject, error } = await supabase
          .from("projects")
          .insert({ client_id: client.id, name: projectName, ...projectPayload })
          .select().single();
        if (error) throw new Error(error.message);
        projectId = newProject.id;
      }

      // 4. Auto-create pending commission_payments rows for PM and Sales Rep
      if (selectedPM && commissionRate > 0 && financials.commission > 0 && projectId) {
        const { data: existingCp } = await supabase
          .from("commission_payments")
          .select("id")
          .eq("project_id", projectId)
          .eq("profile_id", selectedPM)
          .is("progress_payment_id", null)
          .maybeSingle();
        if (existingCp) {
          await supabase.from("commission_payments").update({ amount: financials.commission }).eq("id", existingCp.id);
        } else {
          await supabase.from("commission_payments").insert({ project_id: projectId, profile_id: selectedPM, amount: financials.commission, status: "pending" });
        }
      }
      if (selectedSalesRep && salesRepCommissionRate > 0 && financials.sales_rep_commission > 0 && projectId) {
        const { data: existingRepCp } = await supabase
          .from("commission_payments")
          .select("id")
          .eq("project_id", projectId)
          .eq("profile_id", selectedSalesRep)
          .is("progress_payment_id", null)
          .maybeSingle();
        if (existingRepCp) {
          await supabase.from("commission_payments").update({ amount: financials.sales_rep_commission }).eq("id", existingRepCp.id);
        } else {
          await supabase.from("commission_payments").insert({ project_id: projectId, profile_id: selectedSalesRep, amount: financials.sales_rep_commission, status: "pending" });
        }
      }

      // 5. Record initial team assignments in history table (fire-and-forget)
      const teamRoles: { role: string; profile_id: string | null }[] = [
        { role: "pm", profile_id: selectedPM || null },
        { role: "foreman", profile_id: selectedForeman || null },
        { role: "sales_rep", profile_id: selectedSalesRep || null },
      ];
      for (const ta of teamRoles.filter((t) => t.profile_id)) {
        void Promise.resolve(
          supabase.from("project_team_assignments")
            .update({ unassigned_at: new Date().toISOString(), unassigned_by: soldUser?.id ?? null })
            .eq("project_id", projectId).eq("role", ta.role).is("unassigned_at", null)
        ).catch(() => {});
        void Promise.resolve(
          supabase.from("project_team_assignments")
            .insert({ project_id: projectId, client_id: client.id, role: ta.role, profile_id: ta.profile_id, assigned_at: new Date().toISOString(), assigned_by: soldUser?.id ?? null })
        ).catch(() => {});
      }

      // 6. Create FIO if labor items selected
      if (selectedItems.length > 0 && projectId) {
        await fioAPI.create(
          { project_id: projectId, foreman_id: selectedForeman || undefined },
          selectedItems.map((item) => ({
            product_name: item.product_name,
            unit: item.unit || "",
            quantity: parseFloat(item.quantity) || 0,
            labor_cost_per_unit: parseFloat(item.labor_cost_per_unit) || 0,
            notes: "",
          }))
        );
      }

      // 7. Create payment milestones
      const validMilestones = paymentMilestones.filter((m) => m.label && m.amount);
      for (let i = 0; i < validMilestones.length; i++) {
        const m = validMilestones[i];
        await projectPaymentsAPI.create({
          project_id: projectId,
          client_id: client.id,
          label: m.label,
          amount: parseFloat(m.amount) || 0,
          due_date: m.due_date || undefined,
          sort_order: i,
          is_deposit: m.is_deposit,
        });
      }

      // 6. Update client status + pipeline_stage_id
      const { data: soldStage } = await supabase
        .from("pipeline_stages").select("id").ilike("name", "sold").limit(1).maybeSingle();
      await supabase.from("clients").update({
        status: "sold",
        ...(selectedSalesRep ? { sales_rep_id: selectedSalesRep } : {}),
        ...(soldStage?.id ? { pipeline_stage_id: soldStage.id } : {}),
      }).eq("id", client.id);

      await activityLogAPI.create({
        client_id: client.id,
        action_type: "project_created",
        description: `Project created${financials.total_value ? ` — value: ${fmt(financials.total_value)}` : ""}`,
      }).catch(() => {});

      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: `Client moved to Sold — proposal converted to project${financials.total_value ? ` (${fmt(financials.total_value)})` : ""}`,
      }).catch(() => {});

      toast.success("Moved to Sold — project created");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move to Sold");
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ["Contract Gate", "Assign Crew", "Payment Schedule", "Schedule Job"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Move to Sold</DialogTitle>
          <DialogDescription>
            Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}
          </DialogDescription>
          <div className="flex gap-1.5 mt-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1: Hard Gate ── */}
          {step === 1 && (
            <div className="space-y-4">
              {!hasProposal && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    <strong>No proposal found</strong> — the project will be created with a $0 value. You can update the contract value manually after moving to Sold.
                  </p>
                </div>
              )}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">A signed contract and deposit confirmation are required before moving to Sold.</p>
              </div>

              {/* Contract gate — 3 paths */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Signed Contract <span className="text-destructive">*</span></Label>

                {docusignSigned ? (
                  <div className="flex items-center gap-3 border-2 border-green-400 bg-green-50 rounded-lg px-4 py-3">
                    <FileSignature className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-700">DocuSign completed via CRM</p>
                      <p className="text-xs text-green-600">Contract is already on file — no upload needed</p>
                    </div>
                    <Check className="h-5 w-5 text-green-600 ml-auto shrink-0" />
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => { if (!alreadySignedExternally) docusignRef.current?.click(); }}
                      className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 transition-colors ${alreadySignedExternally ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-primary"} ${docusignFile ? "border-green-400 bg-green-50" : ""}`}
                    >
                      <input ref={docusignRef} type="file" className="hidden" accept=".pdf,image/*,.doc,.docx"
                        onChange={(e) => setDocusignFile(e.target.files?.[0] ?? null)} />
                      {docusignFile ? (
                        <>
                          <Check className="h-5 w-5 text-green-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-green-700 truncate">{docusignFile.name}</p>
                            <p className="text-xs text-green-600">Ready to upload</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">Upload signed contract</p>
                            <p className="text-xs text-muted-foreground">PDF, image, or Word document — scan of paper contract is fine</p>
                          </div>
                        </>
                      )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={alreadySignedExternally}
                        onChange={(e) => {
                          setAlreadySignedExternally(e.target.checked);
                          if (e.target.checked) setDocusignFile(null);
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm text-muted-foreground">Already signed externally (paper / outside CRM)</span>
                    </label>
                  </>
                )}
              </div>

              {/* Deposit upload */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Deposit Confirmation <span className="text-destructive">*</span></Label>
                <div
                  onClick={() => depositRef.current?.click()}
                  className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${depositFile ? "border-green-400 bg-green-50" : "hover:border-primary"}`}
                >
                  <input ref={depositRef} type="file" className="hidden" accept=".pdf,image/*,.doc,.docx"
                    onChange={(e) => setDepositFile(e.target.files?.[0] ?? null)} />
                  {depositFile ? (
                    <>
                      <Check className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-green-700 truncate">{depositFile.name}</p>
                        <p className="text-xs text-green-600">Ready to upload</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Upload deposit confirmation</p>
                        <p className="text-xs text-muted-foreground">Bank receipt, check scan, or payment screenshot</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!canProceedStep1 && (
                <p className="text-xs text-destructive">
                  {!contractSatisfied ? "A signed contract is required. " : ""}
                  {!depositFile ? "Deposit confirmation is required." : ""}
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Crew + FIO ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Project Manager</Label>
                  <Select value={selectedPM} onValueChange={setSelectedPM}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select PM" /></SelectTrigger>
                    <SelectContent>
                      {projectManagers.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>{pm.first_name} {pm.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    if (!selectedPM) return null;
                    const pm = projectManagers.find((p) => p.id === selectedPM);
                    if (!pm || pm.commission_rate !== 0) return null;
                    return (
                      <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <span className="mt-0.5">🚫</span>
                        <span><strong>{pm.first_name} {pm.last_name}</strong> has no commission rate set. Add their rate in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium text-red-800">Team settings</a> before moving to Sold.</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Foreman</Label>
                  <Select value={selectedForeman} onValueChange={setSelectedForeman}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Foreman" /></SelectTrigger>
                    <SelectContent>
                      {foremen.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.first_name} {f.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sales Rep</Label>
                  {(client?.sales_rep_id || project?.sales_rep_id) ? (
                    <>
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                        {(() => {
                          const rep = salesReps.find((r) => r.id === selectedSalesRep);
                          return (
                            <>
                              <span className="text-sm font-medium">{rep ? `${rep.first_name} ${rep.last_name}` : "Assigned"}</span>
                              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">Locked</span>
                            </>
                          );
                        })()}
                      </div>
                      {(() => {
                        const rep = salesReps.find((r) => r.id === selectedSalesRep);
                        if (!rep || rep.commission_rate !== 0) return null;
                        return (
                          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <span className="mt-0.5">🚫</span>
                            <span><strong>{rep.first_name} {rep.last_name}</strong> has no commission rate set. Add their rate in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium text-red-800">Team settings</a> before moving to Sold.</span>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Select value={selectedSalesRep} onValueChange={setSelectedSalesRep}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select Sales Rep" /></SelectTrigger>
                        <SelectContent>
                          {salesReps.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(() => {
                        if (!selectedSalesRep) return null;
                        const rep = salesReps.find((r) => r.id === selectedSalesRep);
                        if (!rep || rep.commission_rate !== 0) return null;
                        return (
                          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <span className="mt-0.5">🚫</span>
                            <span><strong>{rep.first_name} {rep.last_name}</strong> has no commission rate set. You cannot move to Sold until their rate is added in <a href="/team" target="_blank" rel="noopener noreferrer" className="underline font-medium text-red-800">Team settings</a>.</span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>

              {/* Labor items */}
              {suggestedItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium">Labor items from proposal — select for FIO:</p>
                  {suggestedItems.map((item) => {
                    const checked = checkedIds.has(item.id);
                    return (
                      <div key={item.id}
                        className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                        onClick={() => toggleItem(item)}
                      >
                        <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-primary pointer-events-none" />
                        <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                        <span className="text-xs font-semibold">{fmt(item.labor_cost_per_unit)}/unit</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {suggestedItems.length === 0 && (
                <p className="text-xs text-muted-foreground pt-1">No labor items found in the latest proposal.</p>
              )}
            </div>
          )}

          {/* ── Step 3: Payment Schedule ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Build the payment schedule based on the signed contract.</p>
              {paymentMilestones.map((m, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2.5 bg-muted/10">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Milestone {i + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <span className="text-xs text-muted-foreground">Deposit</span>
                        <input
                          type="checkbox"
                          title="Mark as deposit milestone"
                          checked={m.is_deposit}
                          onChange={() => toggleDeposit(i)}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                      <button onClick={() => removeMilestone(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Fields */}
                  <div className="grid grid-cols-[2fr,1fr,1fr] gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name{m.is_deposit && <span className="text-destructive ml-0.5">*</span>}</Label>
                      <Input className={`h-8 text-xs ${m.is_deposit && !m.label.trim() ? "border-destructive" : ""}`} placeholder="e.g. Deposit" value={m.label}
                        onChange={(e) => updateMilestone(i, "label", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount ($){m.is_deposit && <span className="text-destructive ml-0.5">*</span>}</Label>
                      <Input type="number" className={`h-8 text-xs ${m.is_deposit && !m.amount ? "border-destructive" : ""}`} placeholder="0.00" value={m.amount}
                        onChange={(e) => updateMilestone(i, "amount", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due Date</Label>
                      <Input type="date" className="h-8 text-xs" value={m.due_date}
                        onChange={(e) => updateMilestone(i, "due_date", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMilestone} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Milestone
              </Button>
              <p className="text-xs text-muted-foreground">Total: {fmt(paymentMilestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0))}</p>
              {!canProceedStep3 && (
                <p className="text-xs text-destructive">
                  {!depositMilestone?.label.trim() && !depositMilestone?.amount ? "Deposit name and amount are required." : !depositMilestone?.label.trim() ? "Deposit name is required." : "Deposit amount is required."}
                </p>
              )}
            </div>
          )}

          {/* ── Step 4: Schedule ── */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Set the project start and projected completion date.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Projected End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" min={startDate} />
                </div>
              </div>
              {(selectedForeman || selectedPM || selectedSalesRep) && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                  {selectedForeman && foremen.find((f) => f.id === selectedForeman) && (
                    <p><span className="font-medium">Foreman:</span> {foremen.find((f) => f.id === selectedForeman)?.first_name} {foremen.find((f) => f.id === selectedForeman)?.last_name}</p>
                  )}
                  {selectedPM && projectManagers.find((p) => p.id === selectedPM) && (
                    <p><span className="font-medium">PM:</span> {projectManagers.find((p) => p.id === selectedPM)?.first_name} {projectManagers.find((p) => p.id === selectedPM)?.last_name}</p>
                  )}
                  {selectedSalesRep && salesReps.find((r) => r.id === selectedSalesRep) && (
                    <p><span className="font-medium">Sales Rep:</span> {salesReps.find((r) => r.id === selectedSalesRep)?.first_name} {salesReps.find((r) => r.id === selectedSalesRep)?.last_name}</p>
                  )}
                  {startDate && <p><span className="font-medium">Starts:</span> {new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">The system will automatically move this job from <strong>Sold → Active</strong> on the scheduled start date.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            {step === 1 ? "Cancel" : <><ChevronLeft className="h-4 w-4 mr-1" />Back</>}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button size="sm"
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !!selectedPM && projectManagers.find((p) => p.id === selectedPM)?.commission_rate === 0) ||
                (step === 2 && !!selectedSalesRep && salesReps.find((r) => r.id === selectedSalesRep)?.commission_rate === 0) ||
                (step === 3 && !canProceedStep3)
              }
              onClick={() => setStep(step + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" disabled={saving || !canConfirm} onClick={handleConfirm}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Confirm & Move to Sold
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
