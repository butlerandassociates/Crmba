import { useState, useRef } from "react";
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
import { Loader2, Check, FileText, AlertCircle, CheckCircle2, FileSignature } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { activityLogAPI, projectPaymentsAPI, projectsAPI } from "../utils/api";
import { photosAPI } from "../api/files";
import { toast } from "sonner";

interface MoveToActiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  acceptedProposal?: any;
  onSuccess: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function MoveToActiveModal({ open, onOpenChange, client, project, acceptedProposal, onSuccess }: MoveToActiveModalProps) {
  const [saving, setSaving] = useState(false);

  // Contract
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [externalContract, setExternalContract] = useState(false);
  const [externalContractNote, setExternalContractNote] = useState("");
  const contractRef = useRef<HTMLInputElement>(null);

  // Deposit
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const depositRef = useRef<HTMLInputElement>(null);

  const docusignComplete = client?.docusign_status === "completed";

  const contractReady =
    docusignComplete ||
    !!contractFile ||
    (externalContract && externalContractNote.trim() !== "");
  const depositReady = !!depositAmount && parseFloat(depositAmount) > 0;
  const canConfirm = contractReady && depositReady;

  const handleClose = () => {
    if (saving) return;
    setContractFile(null);
    setExternalContract(false);
    setExternalContractNote("");
    setDepositAmount("");
    setDepositDate(new Date().toISOString().split("T")[0]);
    setDepositFile(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      // 1. Upload contract file (if manually uploaded)
      if (contractFile) {
        await photosAPI.upload(client.id, contractFile, "contract").catch(() => {});
      }

      // 2. Upload deposit receipt (if provided)
      if (depositFile) {
        await photosAPI.upload(client.id, depositFile, "receipt").catch(() => {});
      }

      // 3. Auto-create project if one doesn't exist yet
      let resolvedProject = project;
      if (!resolvedProject?.id) {
        const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
        const projectName = acceptedProposal?.name ?? `${clientName} Project`;
        const totalValue = acceptedProposal?.total ?? acceptedProposal?.total_value ?? 0;
        resolvedProject = await projectsAPI.create({
          client_id: client.id,
          name: projectName,
          status: "active",
          total_value: totalValue,
        });
        // Link estimate to this project if we have one
        if (acceptedProposal?.id && resolvedProject?.id) {
          await supabase.from("estimates").update({ project_id: resolvedProject.id }).eq("id", acceptedProposal.id);
        }
      }

      // 4. Record deposit as a paid payment milestone
      const projectId = resolvedProject?.id;
      if (projectId && depositAmount) {
        const payment = await projectPaymentsAPI.create({
          project_id: projectId,
          client_id: client.id,
          label: "Deposit",
          amount: parseFloat(depositAmount),
          due_date: depositDate || undefined,
          sort_order: 0,
        }).catch(() => null);

        if (payment?.id) {
          await projectPaymentsAPI.update(payment.id, {
            is_paid: true,
            paid_date: depositDate || null,
          }).catch(() => {});
        }
      }

      // 5. Update client status to active
      await supabase.from("clients").update({ status: "active" }).eq("id", client.id);

      // 6. Build contract description for activity log
      let contractDesc = "contract confirmed";
      if (docusignComplete) contractDesc = "contract confirmed (DocuSign)";
      else if (externalContract) contractDesc = `contract confirmed externally (${externalContractNote.trim()})`;
      else contractDesc = "contract confirmed (uploaded)";

      const depositLabel = fmt(parseFloat(depositAmount));

      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: `Client moved to Active — ${contractDesc}, deposit received: ${depositLabel}`,
      }).catch(() => {});

      await activityLogAPI.create({
        client_id: client.id,
        action_type: "payment_received",
        description: `Deposit received: ${depositLabel}${depositDate ? ` on ${new Date(depositDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`,
      }).catch(() => {});

      toast.success("Client moved to Active — deposit recorded");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to move to Active");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Move to Active</DialogTitle>
          <DialogDescription>
            Confirm the signed contract and deposit before activating this job.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              A signed contract and deposit confirmation are required before moving a client to Active.
            </p>
          </div>

          {/* ── Contract Section ── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Signed Contract <span className="text-destructive">*</span>
            </Label>

            {docusignComplete ? (
              <div className="flex items-center gap-3 border-2 border-green-400 bg-green-50 rounded-lg px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700">DocuSign contract signed</p>
                  {client.docusign_completed_date && (
                    <p className="text-xs text-green-600">
                      Completed {new Date(client.docusign_completed_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bypass toggle */}
                <div
                  className={`flex items-start gap-3 border-2 rounded-lg px-4 py-3 cursor-pointer transition-colors ${externalContract ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  onClick={() => { setExternalContract(!externalContract); setContractFile(null); }}
                >
                  <Checkbox
                    id="externalContract"
                    checked={externalContract}
                    onCheckedChange={(checked) => { setExternalContract(!!checked); setContractFile(null); }}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="externalContract" className="cursor-pointer font-medium text-sm pointer-events-none">
                      Contract already signed externally
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      DocuSign sent outside the system, paper contract, or signed separately
                    </p>
                  </div>
                </div>

                {externalContract ? (
                  <Input
                    placeholder='Reference note, e.g. "Paper contract on file" or DocuSign envelope ID'
                    value={externalContractNote}
                    onChange={(e) => setExternalContractNote(e.target.value)}
                    className="h-9 text-sm"
                  />
                ) : (
                  <div
                    onClick={() => contractRef.current?.click()}
                    className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${contractFile ? "border-green-400 bg-green-50" : "hover:border-primary"}`}
                  >
                    <input
                      ref={contractRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*,.doc,.docx"
                      onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                    />
                    {contractFile ? (
                      <>
                        <Check className="h-5 w-5 text-green-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-green-700 truncate">{contractFile.name}</p>
                          <p className="text-xs text-green-600">Ready to upload</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <FileSignature className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Upload signed contract</p>
                          <p className="text-xs text-muted-foreground">PDF, image, or Word document</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Deposit Section ── */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Deposit Received <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date Received</Label>
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div
              onClick={() => depositRef.current?.click()}
              className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${depositFile ? "border-green-400 bg-green-50" : "hover:border-primary"}`}
            >
              <input
                ref={depositRef}
                type="file"
                className="hidden"
                accept=".pdf,image/*,.doc,.docx"
                onChange={(e) => setDepositFile(e.target.files?.[0] ?? null)}
              />
              {depositFile ? (
                <>
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-700 truncate">{depositFile.name}</p>
                    <p className="text-xs text-green-600">Receipt ready to upload</p>
                  </div>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Upload deposit confirmation <span className="text-muted-foreground font-normal">(optional)</span></p>
                    <p className="text-xs text-muted-foreground">Bank receipt, check scan, or payment screenshot</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {!canConfirm && (
            <p className="text-xs text-destructive">
              {!contractReady && !depositReady
                ? "Contract and deposit amount are required."
                : !contractReady
                ? externalContract
                  ? "Please add a reference note for the external contract."
                  : "Please upload the signed contract."
                : "Deposit amount is required."}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving || !canConfirm} onClick={handleConfirm}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            Confirm & Move to Active
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
