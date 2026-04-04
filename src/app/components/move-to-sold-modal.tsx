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
  Upload, FileText, AlertCircle, Plus, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usersAPI, fioAPI, activityLogAPI, projectPaymentsAPI } from "../utils/api";
import { photosAPI } from "../api/files";
import { toast } from "sonner";

interface MoveToSoldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
}

const TOTAL_STEPS = 4;
const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function MoveToSoldModal({ open, onOpenChange, client, project, onSuccess }: MoveToSoldModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Hard gate: file uploads
  const [docusignFile, setDocusignFile] = useState<File | null>(null);
  const [depositFile, setDepositFile] = useState<File | null>(null);
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
  const [paymentMilestones, setPaymentMilestones] = useState<{ label: string; amount: string; due_date: string }[]>([
    { label: "Deposit", amount: "", due_date: "" },
    { label: "Progress Payment", amount: "", due_date: "" },
    { label: "Final Payment", amount: "", due_date: "" },
  ]);

  // Step 4 — Schedule
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setDocusignFile(null);
      setDepositFile(null);
      setSelectedForeman(""); setSelectedPM(""); setSelectedSalesRep("");
      setSuggestedItems([]); setCheckedIds(new Set()); setSelectedItems([]);
      setPaymentMilestones([
        { label: "Deposit", amount: "", due_date: "" },
        { label: "Progress Payment", amount: "", due_date: "" },
        { label: "Final Payment", amount: "", due_date: "" },
      ]);
      setStartDate(""); setEndDate("");
      return;
    }
    usersAPI.getByRole("foreman").then(setForemen).catch(console.error);
    usersAPI.getByRole("project_manager").then(setProjectManagers).catch(console.error);
    usersAPI.getByRole("sales_rep").then(setSalesReps).catch(console.error);
    fetchLaborItems();
  }, [open]);

  const fetchLaborItems = async () => {
    if (!client?.id) return;
    const { data: estimates } = await supabase
      .from("estimates").select("id").eq("client_id", client.id)
      .order("created_at", { ascending: false }).limit(1);
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
    setPaymentMilestones((prev) => [...prev, { label: "", amount: "", due_date: "" }]);

  const removeMilestone = (i: number) =>
    setPaymentMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const updateMilestone = (i: number, key: string, value: string) =>
    setPaymentMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, [key]: value } : m));

  const canProceedStep1 = !!docusignFile && !!depositFile;
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
      const { data: estimates } = await supabase
        .from("estimates").select("id, total, subtotal").eq("client_id", client.id)
        .order("created_at", { ascending: false }).limit(1);
      if (estimates && estimates.length > 0) {
        const { data: lineItems } = await supabase
          .from("estimate_line_items").select("material_cost, labor_cost, quantity")
          .eq("estimate_id", estimates[0].id);
        const totalValue = Number(estimates[0].total || estimates[0].subtotal || 0);
        const totalCosts = (lineItems || []).reduce(
          (s: number, item: any) =>
            s + (Number(item.material_cost || 0) + Number(item.labor_cost || 0)) * Number(item.quantity || 1), 0
        );
        const grossProfit = totalValue - totalCosts;
        const profitMargin = totalValue > 0 ? (grossProfit / totalValue) * 100 : 0;
        const commissionRate = 10;
        financials = { total_value: totalValue, total_costs: totalCosts, gross_profit: grossProfit, profit_margin: profitMargin, commission: totalValue * (commissionRate / 100), commission_rate: commissionRate };
      }

      // 3. Create or update project
      let projectId = project?.id;
      const projectPayload = {
        foreman_id: selectedForeman || null,
        project_manager_id: selectedPM || null,
        sales_rep_id: selectedSalesRep || null,
        start_date: startDate,
        end_date: endDate || null,
        status: "sold",
        ...financials,
      };

      if (projectId) {
        await supabase.from("projects").update(projectPayload).eq("id", projectId);
      } else {
        const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company || "Project";
        const { data: newProject, error } = await supabase
          .from("projects")
          .insert({ client_id: client.id, name: clientName, ...projectPayload })
          .select().single();
        if (error) throw new Error(error.message);
        projectId = newProject.id;
      }

      // 4. Create FIO if labor items selected
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

      // 5. Create payment milestones
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
        });
      }

      // 6. Update client status
      await supabase.from("clients").update({ status: "sold" }).eq("id", client.id);

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
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">Both documents are required before this client can be moved to Sold.</p>
              </div>

              {/* DocuSign upload */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Signed DocuSign Contract <span className="text-destructive">*</span></Label>
                <div
                  onClick={() => docusignRef.current?.click()}
                  className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${docusignFile ? "border-green-400 bg-green-50" : "hover:border-primary"}`}
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
                        <p className="text-xs text-muted-foreground">PDF, image, or Word document</p>
                      </div>
                    </>
                  )}
                </div>
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
                <p className="text-xs text-destructive">Both documents must be uploaded to proceed.</p>
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
                  <Select value={selectedSalesRep} onValueChange={setSelectedSalesRep}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Sales Rep" /></SelectTrigger>
                    <SelectContent>
                      {salesReps.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div key={i} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-2 items-end">
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs">Milestone</Label>}
                    <Input className="h-8 text-xs" placeholder="e.g. Deposit" value={m.label}
                      onChange={(e) => updateMilestone(i, "label", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs">Amount ($)</Label>}
                    <Input type="number" className="h-8 text-xs" placeholder="0.00" value={m.amount}
                      onChange={(e) => updateMilestone(i, "amount", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs">Due Date</Label>}
                    <Input type="date" className="h-8 text-xs" value={m.due_date}
                      onChange={(e) => updateMilestone(i, "due_date", e.target.value)} />
                  </div>
                  <button onClick={() => removeMilestone(i)}
                    className={`text-muted-foreground hover:text-destructive ${i === 0 ? "mt-5" : ""}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMilestone} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Milestone
              </Button>
              <p className="text-xs text-muted-foreground">Total: {fmt(paymentMilestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0))}</p>
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
              {selectedForeman && foremen.find((f) => f.id === selectedForeman) && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="font-medium">Foreman:</span> {foremen.find((f) => f.id === selectedForeman)?.first_name} {foremen.find((f) => f.id === selectedForeman)?.last_name}</p>
                  {selectedPM && projectManagers.find((p) => p.id === selectedPM) && (
                    <p><span className="font-medium">PM:</span> {projectManagers.find((p) => p.id === selectedPM)?.first_name} {projectManagers.find((p) => p.id === selectedPM)?.last_name}</p>
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
              disabled={step === 1 && !canProceedStep1}
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
