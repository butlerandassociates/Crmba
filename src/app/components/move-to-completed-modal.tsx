import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Loader2, CheckCircle2, XCircle, DollarSign, HardHat, Camera, FileText, ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { activityLogAPI } from "../utils/api";
import { toast } from "sonner";

interface MoveToCompletedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
}

interface GateStatus {
  projectPaidInFull:        boolean | null;
  crewPaidInFull:           boolean | null;
  sitePhotosUploaded:       boolean | null;
  certificateUploaded:      boolean | null;
  subcontractorUploaded:    boolean | null;
}

export function MoveToCompletedModal({ open, onOpenChange, client, project, onSuccess }: MoveToCompletedModalProps) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [gates, setGates]       = useState<GateStatus>({
    projectPaidInFull:     null,
    crewPaidInFull:        null,
    sitePhotosUploaded:    null,
    certificateUploaded:   null,
    subcontractorUploaded: null,
  });

  useEffect(() => {
    if (open && client && project) checkGates();
  }, [open, client?.id, project?.id]);

  const checkGates = async () => {
    setLoading(true);
    try {
      const [paymentsRes, fioRes, filesRes] = await Promise.all([
        // 1. Project payments
        supabase.from("project_payments")
          .select("id, is_paid, amount")
          .eq("client_id", client.id),

        // 2. FIO crew payments
        supabase.from("field_installation_orders")
          .select(`
            id,
            items:field_installation_order_items(quantity, labor_cost_per_unit),
            payments:fio_crew_payments(amount_paid)
          `)
          .eq("project_id", project.id),

        // 3. Client files — photos, certificate, subcontractor
        supabase.from("client_files")
          .select("id, file_type")
          .eq("client_id", client.id),
      ]);

      // Gate 1 — project paid in full
      const payments = paymentsRes.data ?? [];
      const projectPaidInFull = payments.length > 0 && payments.every((p: any) => p.is_paid);

      // Gate 2 — crew paid in full
      const fios = fioRes.data ?? [];
      let crewPaidInFull = true;
      if (fios.length === 0) {
        crewPaidInFull = true; // no FIOs = no crew to pay
      } else {
        for (const fio of fios) {
          const totalLabor = (fio.items ?? []).reduce(
            (s: number, it: any) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0
          );
          const totalPaid = (fio.payments ?? []).reduce(
            (s: number, p: any) => s + (parseFloat(p.amount_paid) || 0), 0
          );
          if (totalLabor > 0 && totalPaid < totalLabor) { crewPaidInFull = false; break; }
        }
      }

      // Gates 3-5 — file categories
      const files = filesRes.data ?? [];
      const fileTypes = new Set(files.map((f: any) => f.file_type));
      const sitePhotosUploaded    = fileTypes.has("photo");
      const certificateUploaded   = fileTypes.has("certificate");
      const subcontractorUploaded = fileTypes.has("subcontractor");

      setGates({ projectPaidInFull, crewPaidInFull, sitePhotosUploaded, certificateUploaded, subcontractorUploaded });
    } catch (err) {
      console.error("Gate check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const allPassed = Object.values(gates).every((v) => v === true);

  const handleComplete = async () => {
    if (!allPassed) return;
    setSaving(true);
    try {
      await supabase.from("clients").update({ status: "completed" }).eq("id", client.id);
      if (project?.id) {
        await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
      }
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: "Job marked as Completed — all completion gates satisfied",
      });
      toast.success("Job marked as Completed!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as completed.");
    } finally {
      setSaving(false);
    }
  };

  const GATE_ITEMS = [
    {
      key:   "projectPaidInFull" as keyof GateStatus,
      icon:  <DollarSign className="h-4 w-4" />,
      label: "Project paid in full",
      hint:  "All payment milestones must be marked as paid",
    },
    {
      key:   "crewPaidInFull" as keyof GateStatus,
      icon:  <HardHat className="h-4 w-4" />,
      label: "Crew paid in full",
      hint:  "All FIO crew payments must match total labor amount",
    },
    {
      key:   "sitePhotosUploaded" as keyof GateStatus,
      icon:  <Camera className="h-4 w-4" />,
      label: "Completed job site photos uploaded",
      hint:  "Upload at least one file with category \"Site Photo\"",
    },
    {
      key:   "certificateUploaded" as keyof GateStatus,
      icon:  <ClipboardCheck className="h-4 w-4" />,
      label: "Signed certificate of completion uploaded",
      hint:  "Upload the signed certificate with category \"Certificate of Completion\"",
    },
    {
      key:   "subcontractorUploaded" as keyof GateStatus,
      icon:  <FileText className="h-4 w-4" />,
      label: "Signed subcontractor agreement uploaded",
      hint:  "Upload the signed DocuSign PDF with category \"Subcontractor Agreement\"",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Mark Job as Completed</DialogTitle>
          <DialogDescription>
            All requirements must be satisfied before this job can be marked as completed.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            GATE_ITEMS.map(({ key, icon, label, hint }) => {
              const passed = gates[key];
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className={`mt-0.5 ${passed ? "text-green-600" : "text-red-500"}`}>
                    {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-muted-foreground ${passed ? "text-green-700" : "text-red-600"}`}>
                        {icon}
                      </span>
                      <p className={`text-sm font-medium ${passed ? "text-green-800" : "text-red-800"}`}>
                        {label}
                      </p>
                    </div>
                    {!passed && (
                      <p className="text-xs text-red-600 mt-0.5">{hint}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {!loading && !allPassed && (
            <p className="text-xs text-muted-foreground pt-1 text-center">
              Complete all requirements above to mark this job as finished.
            </p>
          )}
        </div>

        <DialogFooter className="px-6 pb-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!allPassed || saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Mark as Completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
