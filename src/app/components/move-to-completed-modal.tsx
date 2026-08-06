import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Loader2, CheckCircle2, XCircle, DollarSign, HardHat, Camera, FileText, ClipboardCheck, Upload, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { filesAPI, activityLogAPI } from "../utils/api";
import { toast } from "sonner";

interface MoveToCompletedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  project: any;
  onSuccess: () => void;
  userRole?: string;
  /** Opens the Certificate of Completion DocuSign dialog (only available once the contract is signed) */
  onSendCertificate?: () => void;
}

interface GateStatus {
  projectPaidInFull:        boolean | null;
  crewPaidInFull:           boolean | null;
  sitePhotosUploaded:       boolean | null;
  certificateUploaded:      boolean | null;
  subcontractorUploaded:    boolean | null;
}

const SITE_PHOTO_MIN = 5;

export function MoveToCompletedModal({ open, onOpenChange, client, project, onSuccess, userRole, onSendCertificate }: MoveToCompletedModalProps) {
  const isAdmin = userRole === "admin";
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [gates, setGates]             = useState<GateStatus>({
    projectPaidInFull:     null,
    crewPaidInFull:        null,
    sitePhotosUploaded:    null,
    certificateUploaded:   null,
    subcontractorUploaded: null,
  });
  const [sitePhotoCount, setSitePhotoCount] = useState(0);
  const [uploading, setUploading]     = useState<Record<string, boolean>>({});
  const [overrides, setOverrides]     = useState<Partial<Record<keyof GateStatus, boolean>>>({});
  const [amberWarnings, setAmberWarnings] = useState<Array<{ id: string; label: string; detail: string }>>([]);

  const photoInputRef   = useRef<HTMLInputElement>(null);
  const certInputRef    = useRef<HTMLInputElement>(null);
  const subInputRef     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && client && project) checkGates();
  }, [open, client?.id, project?.id]);

  const checkGates = async () => {
    setLoading(true);
    try {
      const [paymentsRes, fioRes, filesRes, receiptsRes, estimateRes] = await Promise.all([
        supabase.from("project_payments")
          .select("id, is_paid, amount")
          .eq("client_id", client.id),
        supabase.from("field_installation_orders")
          .select(`id, items:field_installation_order_items(quantity, labor_cost_per_unit), payments:fio_crew_payments(amount_paid)`)
          .eq("project_id", project.id),
        supabase.from("client_files")
          .select("id, file_type")
          .eq("client_id", client.id),
        supabase.from("project_receipts")
          .select("id, amount")
          .eq("project_id", project.id),
        supabase.from("estimates")
          .select("id, line_items:estimate_line_items(fio_qty)")
          .eq("client_id", client.id)
          .eq("status", "accepted")
          .maybeSingle(),
      ]);

      const payments = paymentsRes.data ?? [];
      const projectPaidInFull = payments.length > 0 && payments.every((p: any) => p.is_paid);

      const fios = fioRes.data ?? [];
      let crewPaidInFull = true;
      for (const fio of fios) {
        const totalLabor = (fio.items ?? []).reduce(
          (s: number, it: any) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0
        );
        const totalPaid = (fio.payments ?? []).reduce(
          (s: number, p: any) => s + (parseFloat(p.amount_paid) || 0), 0
        );
        if (totalLabor > 0 && totalPaid < totalLabor) { crewPaidInFull = false; break; }
      }

      const files = filesRes.data ?? [];
      const sitePhotos = files.filter((f: any) => f.file_type === "photo");
      const photoCount = sitePhotos.length;
      setSitePhotoCount(photoCount);

      setGates({
        projectPaidInFull,
        crewPaidInFull,
        sitePhotosUploaded:    photoCount >= SITE_PHOTO_MIN,
        certificateUploaded:   files.some((f: any) => f.file_type === "certificate"),
        subcontractorUploaded: files.some((f: any) => f.file_type === "subcontractor"),
      });

      // Amber warnings (informational only — do not block completion)
      const warnings: Array<{ id: string; label: string; detail: string }> = [];

      const proposalLaborFioQty = ((estimateRes.data as any)?.line_items ?? [])
        .reduce((s: number, i: any) => s + (parseFloat(i.fio_qty) || 0), 0);
      const fioAssignedQty = fios
        .flatMap((fio: any) => fio.items ?? [])
        .reduce((s: number, it: any) => s + (parseFloat(it.quantity) || 0), 0);

      if (proposalLaborFioQty > 0 && fioAssignedQty < proposalLaborFioQty - 0.01) {
        warnings.push({
          id: "labor-gap",
          label: "Labor not fully assigned to FIOs",
          detail: `${fioAssignedQty.toFixed(1)} of ${proposalLaborFioQty.toFixed(1)} labor units assigned to a foreman`,
        });
      }

      const receipts = receiptsRes.data ?? [];
      if (receipts.length > 0) {
        const total = receipts.reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0);
        warnings.push({
          id: "cost-attributions",
          label: `${receipts.length} cost attribution${receipts.length > 1 ? "s" : ""} on record`,
          detail: `Total: $${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — verify all costs are settled`,
        });
      }

      setAmberWarnings(warnings);
    } catch (err) {
      console.error("Gate check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (fileType: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading((u) => ({ ...u, [fileType]: true }));
    try {
      for (const file of Array.from(files)) {
        await filesAPI.upload(client.id, file, fileType);
      }
      toast.success(`${files.length > 1 ? `${files.length} files` : files[0].name} uploaded`);
      await checkGates();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading((u) => ({ ...u, [fileType]: false }));
    }
  };

  const allPassed = (Object.keys(gates) as Array<keyof GateStatus>).every(
    (k) => gates[k] === true || !!overrides[k]
  );

  const handleComplete = async () => {
    if (!allPassed) return;
    setSaving(true);
    try {
      const { data: { user: completedUser } } = await supabase.auth.getUser();
      const completedNow = new Date().toISOString();
      const { data: completedStage } = await supabase
        .from("pipeline_stages").select("id").ilike("name", "completed").maybeSingle();
      await supabase.from("clients").update({
        status: "completed",
        ...(completedStage?.id ? { pipeline_stage_id: completedStage.id } : {}),
      }).eq("id", client.id);
      if (project?.id) {
        await supabase.from("projects").update({
          status: "completed",
          completed_at: completedNow,
          completed_by: completedUser?.id ?? null,
        }).eq("id", project.id);
      }
      const overriddenGates = Object.entries(overrides).filter(([, v]) => v).map(([k]) => k);
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "status_changed",
        description: overriddenGates.length
          ? `Job marked as Completed (admin override on: ${overriddenGates.join(", ")})`
          : "Job marked as Completed — all completion gates satisfied",
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
      key:        "projectPaidInFull" as keyof GateStatus,
      icon:       <DollarSign className="h-4 w-4" />,
      label:      "Project paid in full",
      hint:       "All payment milestones must be marked as paid",
      uploadable: false,
    },
    {
      key:        "crewPaidInFull" as keyof GateStatus,
      icon:       <HardHat className="h-4 w-4" />,
      label:      "Crew paid in full",
      hint:       "All FIO crew payments must match total labor amount",
      uploadable: false,
    },
    {
      key:        "sitePhotosUploaded" as keyof GateStatus,
      icon:       <Camera className="h-4 w-4" />,
      label:      "Completed job site photos",
      hint:       `${sitePhotoCount} of ${SITE_PHOTO_MIN} photos uploaded`,
      uploadable: true,
      fileType:   "photo",
      accept:     "image/*",
      multiple:   true,
      inputRef:   photoInputRef,
      buttonLabel: uploading["photo"] ? "Uploading…" : `Upload Photos`,
    },
    {
      key:        "certificateUploaded" as keyof GateStatus,
      icon:       <ClipboardCheck className="h-4 w-4" />,
      label:      "Signed certificate of completion",
      hint:       'Upload the signed certificate (PDF or image)',
      uploadable: true,
      fileType:   "certificate",
      accept:     "application/pdf,image/*,.doc,.docx",
      multiple:   false,
      inputRef:   certInputRef,
      buttonLabel: uploading["certificate"] ? "Uploading…" : "Upload Certificate",
    },
    {
      key:        "subcontractorUploaded" as keyof GateStatus,
      icon:       <FileText className="h-4 w-4" />,
      label:      "Signed subcontractor agreement",
      hint:       'Upload the signed DocuSign PDF',
      uploadable: true,
      fileType:   "subcontractor",
      accept:     "application/pdf,image/*,.doc,.docx",
      multiple:   false,
      inputRef:   subInputRef,
      buttonLabel: uploading["subcontractor"] ? "Uploading…" : "Upload Agreement",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px] flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Mark Job as Completed</DialogTitle>
          <DialogDescription>
            All requirements must be satisfied before this job can be marked as completed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            GATE_ITEMS.map(({ key, icon, label, hint, uploadable, fileType, accept, multiple, inputRef, buttonLabel }) => {
              const passed = gates[key];
              const overridden = !!overrides[key];
              const effectivePassed = passed || overridden;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    effectivePassed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${effectivePassed ? "text-green-600" : "text-red-500"}`}>
                    {effectivePassed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={effectivePassed ? "text-green-700" : "text-red-600"}>{icon}</span>
                      <p className={`text-sm font-medium ${effectivePassed ? "text-green-800" : "text-red-800"}`}>
                        {label}
                      </p>
                      {overridden && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Admin Override</span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${effectivePassed ? "text-green-700" : "text-red-600"}`}>{hint}</p>

                    {!passed && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* Upload button */}
                        {uploadable && fileType && inputRef && !overridden && (
                          <>
                            <input
                              ref={inputRef}
                              type="file"
                              accept={accept}
                              multiple={multiple}
                              className="hidden"
                              onChange={(e) => handleUpload(fileType, e.target.files)}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100"
                              disabled={!!uploading[fileType]}
                              onClick={() => inputRef.current?.click()}
                            >
                              {uploading[fileType]
                                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading…</>
                                : <><Upload className="h-3 w-3 mr-1" /> {buttonLabel}</>
                              }
                            </Button>
                          </>
                        )}
                        {/* Admin override toggle */}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant={overridden ? "default" : "outline"}
                            className={`h-7 text-xs ${overridden ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
                            onClick={() => setOverrides(prev => ({ ...prev, [key]: !overridden }))}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {overridden ? "Override On" : "Override"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {!loading && onSendCertificate && client?.docusign_status === "completed" && !gates.certificateUploaded && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2 text-sm text-blue-900">
                <FileText className="h-4 w-4 shrink-0" />
                <span>Send the Certificate of Completion for signature?</span>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 bg-white"
                onClick={() => { onOpenChange(false); onSendCertificate(); }}>
                Send Certificate
              </Button>
            </div>
          )}

          {!loading && amberWarnings.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide px-1">Heads up</p>
              {amberWarnings.map((w) => (
                <div key={w.id} className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">{w.label}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{w.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !allPassed && (
            <p className="text-xs text-muted-foreground pt-1 text-center">
              Complete all requirements above to mark this job as finished.
            </p>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!allPassed || saving || loading}>
            <span className="flex items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark as Completed
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
