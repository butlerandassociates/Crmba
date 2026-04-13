import { useState, useRef } from "react";
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
import { Loader2, Check, Upload, FileText, AlertCircle, CheckCircle2, FileSignature } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { activityLogAPI, projectPaymentsAPI } from "../utils/api";
import { photosAPI } from "../api/files";
import { toast } from "sonner";

interface MoveToActiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export function MoveToActiveModal({ open, onOpenChange, client, project, onSuccess }: MoveToActiveModalProps) {
  const [saving, setSaving] = useState(false);

  // Contract
  const [contractFile, setContractFile] = useState<File | null>(null);
  const contractRef = useRef<HTMLInputElement>(null);

  // Deposit
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const depositRef = useRef<HTMLInputElement>(null);

  const docusignComplete = client?.docusign_status === "completed";

  const contractReady = docusignComplete || !!contractFile;
  const depositReady = !!depositAmount && parseFloat(depositAmount) > 0;
  const canConfirm = contractReady && depositReady;

  const handleClose = () => {
    if (saving) return;
    setContractFile(null);
    setDepositAmount("");
    setDepositDate(new Date().toISOString().split("T")[0]);
    setDepositFile(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      // 1. Upload contract file (if not via DocuSign)
      if (contractFile) {
        await photosAPI.upload(client.id, contractFile).catch(() => {});
      }

      // 2. Upload deposit file (if provided)
      if (depositFile) {
        await photosAPI.upload(client.id, depositFile).catch(() => {});
      }

      // 3. Record deposit as a payment milestone
      const projectId = project?.id;
      if (projectId && depositAmount) {
        await projectPaymentsAPI.create({
          project_id: projectId,
          client_id: client.id,
          label: "Deposit",
          amount: parseFloat(depositAmount),
          due_date: depositDate || undefined,
          paid_date: depositDate || undefined,
          is_paid: true,
          sort_order: 0,
        }).catch(() => {});
      }

      // 4. Update client status to active
      await supabase.from("clients").update({ status: "active" }).eq("id", client.id);

      // 5. Update project status if exists
      if (projectId) {
        await supabase.from("projects").update({ status: "active" }).eq("id", projectId).catch(() => {});
      }

      // 6. Activity log
      const depositLabel = fmt(parseFloat(depositAmount));
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: `Client moved to Active — contract confirmed${docusignComplete ? " (DocuSign)" : " (uploaded)"}, deposit received: ${depositLabel}`,
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
                ? "Please upload the signed contract."
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
