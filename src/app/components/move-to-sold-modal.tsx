import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
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
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usersAPI, fioAPI, activityLogAPI } from "../utils/api";
import { toast } from "sonner";

interface MoveToSoldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
}

export function MoveToSoldModal({ open, onOpenChange, client, project, onSuccess }: MoveToSoldModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [contractSigned, setContractSigned] = useState(false);

  // Step 2
  const [foremen, setForemen] = useState<any[]>([]);
  const [projectManagers, setProjectManagers] = useState<any[]>([]);
  const [selectedForeman, setSelectedForeman] = useState("");
  const [selectedPM, setSelectedPM] = useState("");
  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<any[]>([]);

  // Step 3
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setContractSigned(false);
      setSelectedForeman("");
      setSelectedPM("");
      setSuggestedItems([]);
      setCheckedIds(new Set());
      setSelectedItems([]);
      setStartDate("");
      setEndDate("");
      return;
    }
    usersAPI.getByRole("foreman").then(setForemen).catch(console.error);
    usersAPI.getByRole("project_manager").then(setProjectManagers).catch(console.error);
    fetchLaborItems();
  }, [open]);

  const fetchLaborItems = async () => {
    if (!client?.id) return;
    const { data: estimates } = await supabase
      .from("estimates")
      .select("id")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!estimates || estimates.length === 0) return;
    const { data: items } = await supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimates[0].id)
      .gt("labor_cost", 0);
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

  const updateSelectedItem = (id: string, key: string, value: any) => {
    setSelectedItems(selectedItems.map((i) => i.id === id ? { ...i, [key]: value } : i));
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

  const handleConfirm = async () => {
    if (!startDate) { toast.error("Please select a start date"); return; }
    setSaving(true);
    try {
      // 1. Update client status to sold
      await supabase.from("clients").update({ status: "sold" }).eq("id", client.id);

      // 2. Calculate financials from latest estimate
      let financials: Record<string, number> = {};
      if (client?.id) {
        const { data: estimates } = await supabase
          .from("estimates")
          .select("id, total, subtotal")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (estimates && estimates.length > 0) {
          const { data: lineItems } = await supabase
            .from("estimate_line_items")
            .select("material_cost, labor_cost, quantity")
            .eq("estimate_id", estimates[0].id);

          const totalValue = Number(estimates[0].total || estimates[0].subtotal || 0);
          const totalCosts = (lineItems || []).reduce(
            (s: number, item: any) =>
              s + (Number(item.material_cost || 0) + Number(item.labor_cost || 0)) * Number(item.quantity || 1),
            0
          );
          const grossProfit = totalValue - totalCosts;
          const profitMargin = totalValue > 0 ? (grossProfit / totalValue) * 100 : 0;

          // Fetch commission_rate from project (or default to 0)
          const { data: proj } = await supabase
            .from("projects")
            .select("commission_rate")
            .eq("id", project?.id)
            .single();
          const commissionRate = Number(proj?.commission_rate ?? 0);
          const commission = totalValue * (commissionRate / 100);

          financials = { total_value: totalValue, total_costs: totalCosts, gross_profit: grossProfit, profit_margin: profitMargin, commission };
        }
      }

      // 3. Update project with crew + dates + financials
      if (project?.id) {
        await supabase.from("projects").update({
          foreman_id: selectedForeman || null,
          project_manager_id: selectedPM || null,
          start_date: startDate,
          end_date: endDate || null,
          status: "sold",
          ...financials,
        }).eq("id", project.id);

        // 4. Create FIO if labor items selected
        if (selectedItems.length > 0) {
          const fioItems = selectedItems.map((item) => ({
            product_name: item.product_name,
            unit: item.unit,
            quantity: parseFloat(item.quantity) || 0,
            labor_cost_per_unit: parseFloat(item.labor_cost_per_unit) || 0,
            notes: "",
          }));
          await fioAPI.create(
            { project_id: project.id, foreman_id: selectedForeman || undefined },
            fioItems
          );
        }
      }

      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: `Client moved to Sold${financials.total_value ? ` — Project value ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(financials.total_value)}` : ""}`,
      }).catch(() => {});
      toast.success("Client moved to Sold");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to move to Sold");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Move to Sold</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {step === 1 ? "Contract Confirmation" : step === 2 ? "Assign Crew & Labor" : "Schedule Project"}
          </DialogDescription>
          {/* Step indicators */}
          <div className="flex gap-2 mt-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1 — Contract */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Before moving this client to Sold, confirm that a DocuSign contract has been signed.
              </p>
              <div
                className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${contractSigned ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                onClick={() => setContractSigned(!contractSigned)}
              >
                <Checkbox checked={contractSigned} onCheckedChange={(v) => setContractSigned(!!v)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">DocuSign contract has been signed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Confirm the client has signed the contract before proceeding to Sold.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Crew + Labor */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Project Manager</Label>
                  <Select value={selectedPM} onValueChange={setSelectedPM}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select PM" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectManagers.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.first_name} {pm.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Foreman</Label>
                  <Select value={selectedForeman} onValueChange={setSelectedForeman}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Foreman" />
                    </SelectTrigger>
                    <SelectContent>
                      {foremen.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.first_name} {f.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Labor items from proposal — select which to assign to FIO:</p>
                {suggestedItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">No labor items found in proposal.</p>
                )}
                {suggestedItems.map((item) => {
                  const checked = checkedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "bg-muted/20"}`}
                      onClick={() => toggleItem(item)}
                    >
                      <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-primary pointer-events-none" />
                      <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                      <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                      <span className="text-xs font-semibold">{formatCurrency(item.labor_cost_per_unit)}/unit</span>
                    </div>
                  );
                })}

                {/* Editable selected items */}
                {selectedItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Edit selected items if needed:</p>
                    {selectedItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-[2fr,1fr,1fr] gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Item</Label>
                          <Input value={item.product_name} onChange={(e) => updateSelectedItem(item.id, "product_name", e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" value={item.quantity} onChange={(e) => updateSelectedItem(item.id, "quantity", e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input value={item.unit} onChange={(e) => updateSelectedItem(item.id, "unit", e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Schedule */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Set the project start and end dates for the assigned crew.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" min={startDate} />
                </div>
              </div>
              {selectedForeman && foremen.find(f => f.id === selectedForeman) && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <span className="font-medium">Crew: </span>
                  {foremen.find(f => f.id === selectedForeman)?.first_name} {foremen.find(f => f.id === selectedForeman)?.last_name}
                  {startDate && <span className="ml-2 text-muted-foreground">· Starts {new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            {step === 1 ? "Cancel" : <><ChevronLeft className="h-4 w-4 mr-1" /> Back</>}
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              disabled={step === 1 && !contractSigned}
              onClick={() => setStep(step + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleConfirm} disabled={saving || !startDate}>
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Confirm & Move to Sold
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
