import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router";
import { supabase, guessContentType } from "@/lib/supabase";
import { useAuth } from "../../contexts/auth-context";
import { fioAPI } from "../../api/field-installation-orders";
import { activityLogAPI } from "../../utils/api";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import {
  Loader2, ArrowLeft, MapPin, HardHat, Wrench, DollarSign, Calendar,
  CheckCircle2, AlertTriangle, Upload, FileText, Download, Image, Trash2, X, Eye,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent } from "../ui/dialog";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d: string) =>
  new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const FILE_CATEGORIES = [
  { value: "subcontractor", label: "Subcontractor Agreement" },
  { value: "certificate",   label: "Certificate of Completion" },
  { value: "photo",         label: "Site Photo" },
  { value: "other",         label: "Other Document" },
] as const;

export function ForemanJobDetail() {
  const { fioId } = useParams<{ fioId: string }>();
  const { user } = useAuth();
  const [fio, setFio] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [clientFiles, setClientFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // F3 — scope acknowledgment
  const [acknowledging, setAcknowledging] = useState(false);

  // F1/F2 — file upload
  const [uploadCategory, setUploadCategory] = useState<string>("photo");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File preview (use blob URL so same-origin img always loads)
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; blobUrl?: string } | null>(null);

  const handleViewImage = async (fileUrl: string, fileName: string) => {
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewFile({ url: fileUrl, name: fileName, blobUrl });
    } catch {
      window.open(fileUrl, "_blank");
    }
  };

  const closePreview = () => {
    if (previewFile?.blobUrl) URL.revokeObjectURL(previewFile.blobUrl);
    setPreviewFile(null);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  useEffect(() => {
    if (!fioId) return;
    loadData();
  }, [fioId]);

  useRealtimeRefetch(
    () => { if (fioId) loadData(); },
    ["projects", "fio_crew_payments", "field_installation_orders", "project_payments"],
    "foreman-job-detail-realtime"
  );

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("field_installation_orders")
        .select(`
          id,
          status,
          work_date,
          notes,
          created_at,
          scope_acknowledged_at,
          scope_acknowledged_by,
          items:field_installation_order_items(*),
          project:projects(
            id,
            name,
            status,
            client:clients(id, first_name, last_name, address, city, state)
          )
        `)
        .eq("id", fioId!)
        .single();

      if (error) throw error;
      setFio(data);

      const pays = await fioAPI.getCrewPayments(fioId!);
      setPayments(pays);

      // Load files for this client
      const clientId = (data as any)?.project?.client?.id;
      if (clientId) loadClientFiles(clientId);
    } catch {
      setFio(null);
    } finally {
      setLoading(false);
    }
  };

  const loadClientFiles = async (clientId: string) => {
    const foremanUserId = user?.profile?.id;
    const { data } = await supabase
      .from("client_files")
      .select("id, file_name, file_url, file_type, created_at, user_id, uploader:profiles!client_files_user_id_fkey(first_name, last_name, role)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    const allowed = new Set(["photo", "subcontractor", "certificate"]);
    setClientFiles(
      (data ?? []).filter((f) => allowed.has(f.file_type) || (foremanUserId && f.user_id === foremanUserId))
    );
  };

  // F3 — Acknowledge scope
  const handleAcknowledgeScope = async () => {
    if (!fio?.id || !user?.profile?.id) return;
    setAcknowledging(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("field_installation_orders")
        .update({ scope_acknowledged_at: now, scope_acknowledged_by: user.profile.id, ...(fio.status === "draft" ? { status: "acknowledged" } : {}) })
        .eq("id", fio.id);
      if (error) throw error;
      setFio((prev: any) => ({ ...prev, scope_acknowledged_at: now, scope_acknowledged_by: user.profile!.id, ...(prev.status === "draft" ? { status: "acknowledged" } : {}) }));
      const clientId = fio.project?.client?.id;
      if (clientId) {
        activityLogAPI.create({ client_id: clientId, action_type: "scope_acknowledged", description: "Scope acknowledged by Foreman" }).catch(() => {});
      }
      toast.success("Scope acknowledged — you're all set to start.");
    } catch {
      toast.error("Failed to acknowledge scope — please try again.");
    } finally {
      setAcknowledging(false);
    }
  };

  // F1/F2 — Upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fio?.project?.client?.id) return;

    const clientId = fio.project.client.id;
    const ext = file.name.split(".").pop();
    const path = `${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(path, bytes, { upsert: true, contentType: guessContentType(file) });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("client-files").getPublicUrl(path);

      const { error: dbError } = await supabase.from("client_files").insert({
        client_id: clientId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: uploadCategory,
        user_id: user?.profile?.id ?? null,
      });
      if (dbError) throw dbError;

      toast.success("File uploaded successfully.");
      await loadClientFiles(clientId);
    } catch {
      toast.error("Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!fio) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center text-muted-foreground">
        Job not found.
      </div>
    );
  }

  const client = fio.project?.client;
  const clientName = client
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : "—";
  const address = client?.address
    ? `${client.address}${client.city ? `, ${client.city}` : ""}${client.state ? ` ${client.state}` : ""}`
    : null;

  const items: any[] = fio.items ?? [];
  const totalLabor = items.reduce(
    (s: number, it: any) =>
      s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0),
    0
  );

  const paymentsByWeek = payments.reduce((acc: Record<string, any[]>, p) => {
    const week = p.week_ending_date ?? "Unknown";
    if (!acc[week]) acc[week] = [];
    acc[week].push(p);
    return acc;
  }, {});

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount_paid) || 0), 0);
  const isAcknowledged = !!fio.scope_acknowledged_at;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        to="/foreman"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Jobs
      </Link>

      {/* Header */}
      <div className="border rounded-xl p-5 bg-card space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{fio.project?.name ?? clientName}</h1>
            <p className="text-muted-foreground text-sm">{clientName}</p>
          </div>
          <Badge className={`shrink-0 text-xs border ${{
            active:    "bg-green-100 text-green-700 border-green-200",
            sold:      "bg-blue-100 text-blue-700 border-blue-200",
            completed: "bg-gray-100 text-gray-600 border-gray-200",
            scheduled: "bg-purple-100 text-purple-700 border-purple-200",
          }[fio.project?.status as string] ?? "bg-muted text-muted-foreground border-border"}`}>
            {(fio.project?.status ?? "active").charAt(0).toUpperCase() +
              (fio.project?.status ?? "active").slice(1)}
          </Badge>
        </div>
        {address && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{address}</span>
          </div>
        )}
        {fio.work_date && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Work date: {fmtDate(fio.work_date)}</span>
          </div>
        )}
        {fio.notes && (
          <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">{fio.notes}</p>
        )}
      </div>

      {/* F3 — Scope Acknowledgment */}
      {!isAcknowledged ? (
        <div className="border border-amber-300 bg-amber-50 rounded-xl px-5 py-4 flex items-start gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Acknowledge Scope Before Starting</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Review the scope of work below, then tap the button to confirm you have read and understood it.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={acknowledging}
            onClick={handleAcknowledgeScope}
          >
            {acknowledging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Acknowledge Scope"}
          </Button>
        </div>
      ) : (
        <div className="border border-green-300 bg-green-50 rounded-xl px-5 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">Scope acknowledged</span>
            {fio.scope_acknowledged_at && (
              <> · {new Date(fio.scope_acknowledged_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
            )}
          </p>
        </div>
      )}

      {/* Scope of Work */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Scope of Work</h2>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <HardHat className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No items assigned</p>
            <p className="text-xs text-muted-foreground">Your PM will add work items here.</p>
          </div>
        ) : (
          <>
            <div className="divide-y">
              {items.map((item: any) => {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.labor_cost_per_unit) || 0;
                const total = qty * rate;
                return (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {qty.toLocaleString()} {item.unit} × {rate > 0 ? fmt(rate) : "—"}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0">{total > 0 ? fmt(total) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t bg-muted/20 flex justify-between items-center">
              <span className="text-sm font-semibold">Total Labor</span>
              <span className="text-sm font-bold">{fmt(totalLabor)}</span>
            </div>
          </>
        )}
      </div>

      {/* Payment History */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Payments Received</h2>
          </div>
          {totalPaid > 0 && (
            <span className="text-sm font-semibold text-green-700">{fmt(totalPaid)} total</span>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No payments recorded yet</p>
            <p className="text-xs text-muted-foreground">Payments will appear here once recorded by your PM.</p>
          </div>
        ) : (
          <div className="divide-y">
            {(Object.entries(paymentsByWeek) as [string, any[]][])
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([week, entries]) => {
                const weekTotal = entries.reduce(
                  (s, p) => s + (parseFloat(p.amount_paid) || 0),
                  0
                );
                return (
                  <div key={week} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Week ending {week !== "Unknown" ? fmtDate(week) : "—"}
                      </p>
                      <span className="text-xs font-semibold text-green-700">{fmt(weekTotal)}</span>
                    </div>
                    <div className="space-y-1">
                      {entries.map((p: any) => {
                        const itemName = p.fio_item_id ? items.find((i: any) => i.id === p.fio_item_id)?.product_name : null;
                        return (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {itemName ?? "Payment"}
                              {p.completion_pct != null ? ` · ${p.completion_pct}% complete` : ""}
                            </span>
                            <span className="font-medium">{fmt(parseFloat(p.amount_paid) || 0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* F1/F2 — Upload Files */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Upload Files</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* Upload form */}
          <div className="flex items-center gap-3">
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-sm">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {uploading ? "Uploading…" : "Choose File"}
            </Button>
          </div>

          {/* File list */}
          {clientFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No files uploaded yet</p>
              <p className="text-xs mt-0.5">Upload site photos, agreements, or certificates above.</p>
            </div>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {clientFiles.map((f: any) => {
                const cat = FILE_CATEGORIES.find((c) => c.value === f.file_type);
                const isHeic = /\.heic$/i.test(f.file_name ?? "");
                const isImage = !isHeic && (/\.(jpg|jpeg|png|gif|webp)$/i.test(f.file_name ?? "") || (f.mime_type?.startsWith("image/") && !isHeic));
                const isPdf = /\.pdf$/i.test(f.file_name ?? "") || f.mime_type === "application/pdf";
                const canPreview = isImage || isPdf;
                return (
                  <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isImage
                        ? <Image className="h-4 w-4 text-blue-500 shrink-0" />
                        : isPdf
                        ? <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.file_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded capitalize">{cat?.label ?? f.file_type}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          {f.uploader ? (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-medium text-foreground">{f.uploader.first_name} {f.uploader.last_name}</span>
                              {f.uploader.role && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${{ admin: "bg-green-100 text-green-700", project_manager: "bg-blue-100 text-blue-700", sales_rep: "bg-purple-100 text-purple-700", foreman: "bg-orange-100 text-orange-700" }[f.uploader.role as string] ?? "bg-gray-100 text-gray-600"}`}>
                                  {({ admin: "Admin", project_manager: "PM", sales_rep: "Sales Rep", foreman: "Foreman" } as Record<string, string>)[f.uploader.role] ?? f.uploader.role}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-medium text-foreground">System</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Auto</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canPreview && (
                        <button
                          className="flex items-center gap-1 text-xs text-primary hover:opacity-80 font-medium"
                          onClick={() => isImage
                            ? handleViewImage(f.file_url, f.file_name)
                            : window.open(f.file_url, "_blank")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      )}
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:opacity-80 font-medium"
                        onClick={() => handleDownload(f.file_url, f.file_name)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image preview modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden border-none [&>button]:hidden"
          style={{ backgroundColor: "black" }}
        >
          <div className="relative">
            <button
              className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
              onClick={closePreview}
            >
              <X className="h-4 w-4" />
            </button>
            {previewFile && (
              <img
                src={previewFile.blobUrl ?? previewFile.url}
                alt={previewFile.name}
                className="w-full max-h-[80vh] object-contain"
                onError={() => {
                  window.open(previewFile.url, "_blank");
                  closePreview();
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
