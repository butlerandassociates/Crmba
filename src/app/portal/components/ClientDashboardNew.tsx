import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripeCardForm } from "./StripeCardForm";
import { toast } from "sonner";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import {
  FileText,
  ChevronRight,
  Check,
  Clock,
  CreditCard,
  Home,
  Image as ImageIcon,
  Download,
  Loader2,
  X,
  ArrowLeft,
  Building2,
  // Smartphone,
  Menu,
  AlertCircle,
  ClipboardCheck,
  Layers,
  Wallet,
  Camera,
  Eye,
} from "lucide-react";
import { validatePortalToken, type PortalData } from "../api/portal";
import { PortalChangeOrderReview } from "./PortalChangeOrderReview";
import { PortalProposals } from "./PortalProposals";
import { PortalPaymentReceiptExport } from "./PortalPaymentReceiptExport";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

interface Props {
  data: PortalData;
  token: string;
  initialTab?: string;
  initialCoId?: string | null;
}

export function ClientDashboardNew({ data, token, initialTab = "overview", initialCoId = null }: Props) {
  const [portalData, setPortalData] = useState<PortalData>(data);
  const { client, project, phases, payments, updates, files, change_orders, proposals } = portalData;
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await validatePortalToken(token);
      if (fresh) setPortalData(fresh);
    }, 90_000);
    return () => clearInterval(interval);
  }, [token]);

  const [activeTab, setActiveTabState] = useState(initialTab);
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach" | "apple" | null>(null);
  const [showAllFieldUpdates, setShowAllFieldUpdates] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewingChangeOrderId, setViewingChangeOrderId] = useState<string | null>(initialCoId);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; isImage: boolean } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [previewingReceiptId, setPreviewingReceiptId] = useState<string | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<typeof payments[0] | null>(null);

  const handleDownloadPdf = async (url: string, filename: string, id: string) => {
    setDownloadingPdfId(id);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const downloadFile = async (url: string, name: string, id?: string) => {
    if (id) setDownloadingId(id);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    } finally {
      if (id) setDownloadingId(null);
    }
  };

  const buildReceiptDoc = async (payment: typeof payments[0]) => {
    setReceiptPayment(payment);
    // Give React one tick to render the hidden component before html2canvas captures it
    await new Promise(resolve => setTimeout(resolve, 150));

    const el = document.getElementById("portal-receipt-export");
    if (!el) throw new Error("Receipt element not found in DOM");

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    await document.fonts.ready;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: "#ffffff" });

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const imgH = canvas.height * (pageW / canvas.width);
    const imgData = canvas.toDataURL("image/jpeg", 0.97);
    doc.addImage(imgData, "JPEG", 0, 0, pageW, imgH);

    setReceiptPayment(null);
    return doc;
  };

  const downloadReceipt = async (payment: typeof payments[0]) => {
    setDownloadingReceiptId(payment.id);
    try {
      const doc = await buildReceiptDoc(payment);
      const filename = `Receipt_${payment.label.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Receipt generation failed", err);
      toast.error("Could not generate receipt");
      setReceiptPayment(null);
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const previewReceipt = async (payment: typeof payments[0]) => {
    setPreviewingReceiptId(payment.id);
    try {
      const doc = await buildReceiptDoc(payment);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfPreview({ url, title: `Receipt — ${payment.label}` });
    } catch (err) {
      console.error("Receipt preview failed", err);
      toast.error("Could not preview receipt");
      setReceiptPayment(null);
    } finally {
      setPreviewingReceiptId(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    // DATE-only strings (no T) need T00:00:00 appended to avoid UTC-shift; timestamps already have it
    const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // ─── Computed values from real data ───────────────────────────────────────
  const clientName = `${client.first_name} ${client.last_name}`;
  const jobAddress = [client.address, client.city, client.state].filter(Boolean).join(", ");
  const pmName = project?.project_manager
    ? `${project.project_manager.first_name} ${project.project_manager.last_name}`
    : "Your Project Manager";
  const pmPhone = project?.project_manager?.phone ?? "";

  const totalPaid = payments.filter(p => p.is_paid).reduce((sum, p) => sum + p.amount, 0);
  const totalValue = project?.total_value ?? 0;
  const progressPct = phases.length > 0
    ? phases.reduce((sum, p) => sum + Number(p.progress_pct), 0) / phases.length
    : 0;
  const completionDate = project?.target_date ? formatDate(project.target_date) : "TBD";

  const getPaymentStatus = (p: typeof payments[0]) => {
    if (p.is_paid) return "PAID";
    if (p.due_date) {
      const due = new Date(p.due_date + "T00:00:00");
      const today = new Date();
      if (due < today) return "OVERDUE";
      const daysUntil = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntil <= 7) return "DUE";
    }
    return "SCHEDULED";
  };

  const nextDuePayment = payments.find(p => !p.is_paid);

  const pendingCOs = change_orders.filter(co => co.status === "pending_client");
  const pendingProposals = proposals.filter(p => p.status === "sent").length;
  const duePayments = payments.filter(p => {
    const s = getPaymentStatus(p);
    return s === "DUE" || s === "OVERDUE";
  }).length;

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderFieldUpdateCard = (update: typeof updates[0]) => (
    <Card key={update.id}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {update.photos.length > 0
              ? update.photos.slice(0, 3).map(photo => (
                  <div key={photo.id} className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img src={photo.public_url ?? ""} alt={photo.label ?? ""} className="w-full h-full object-cover" />
                  </div>
                ))
              : [1, 2, 3].map(i => (
                  <div key={i} className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                ))}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold text-gray-500 tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>
                {new Date(update.posted_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
              </span>
              {update.phase_label && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Layers className="h-2.5 w-2.5" />
                  {update.phase_label}
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold mb-2" style={{ fontFamily: "Lato, sans-serif" }}>{update.title}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{update.body}</p>
          </div>
          {(update.completed_items.length > 0 || update.upcoming_items.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 pt-4 border-t">
              {update.completed_items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs font-bold text-green-700 tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>COMPLETED</span>
                  </div>
                  <div className="space-y-2.5 pl-6">
                    {update.completed_items.map((item, i) => (
                      <div key={i} className="text-sm text-gray-700 leading-relaxed">{item}</div>
                    ))}
                  </div>
                </div>
              )}
              {update.upcoming_items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <span className="text-xs font-bold text-orange-700 tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>COMING UP</span>
                  </div>
                  <div className="space-y-2.5 pl-6">
                    {update.upcoming_items.map((item, i) => (
                      <div key={i} className="text-sm text-gray-700 leading-relaxed">{item}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderOverview = () => {
    const fmtDate = (d: string | null) => d ? new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
    return (
    <div className="space-y-8">
      {/* Phase Timeline */}
      <div>
        {phases.length > 0 ? (
          <div className="space-y-6">
            {/* ── Quick-glance strip: scrolls on mobile, stretches on desktop ── */}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex items-start gap-1 min-w-max lg:min-w-0 lg:w-full">
              {phases.map((phase, index) => (
                <div key={phase.id} className="flex items-start gap-1 min-w-[80px] lg:flex-1 lg:min-w-0">
                  <div className="text-center w-full">
                    <div
                      className={`text-[11px] font-semibold mb-1.5 leading-tight ${
                        phase.status === "in-progress" ? "text-orange-600"
                        : phase.status === "complete" ? "text-green-600"
                        : "text-gray-400"
                      }`}
                      style={{ fontFamily: "Lato, sans-serif" }}
                    >
                      {phase.label}
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          phase.status === "complete" ? "bg-green-500"
                          : phase.status === "in-progress" ? "bg-orange-500"
                          : "bg-gray-300"
                        }`}
                        style={{ width: `${phase.status === "complete" ? 100 : Number(phase.progress_pct)}%` }}
                      />
                    </div>
                    {phase.status === "in-progress" && Number(phase.progress_pct) > 0 && (
                      <div className="text-[9px] font-bold text-orange-500 mt-0.5">{Number(phase.progress_pct)}%</div>
                    )}
                  </div>
                  {index < phases.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0 mt-1" />}
                </div>
              ))}
              </div>
            </div>

            {/* ── Detailed vertical list ── */}
            <div className="space-y-3">
              {phases.map((phase, index) => {
                const isActive = phase.status === "in-progress";
                const isDone = phase.status === "complete";
                return (
                  <div
                    key={phase.id}
                    className={`rounded-xl border p-4 ${
                      isActive ? "border-orange-200 bg-orange-50"
                      : isDone ? "border-green-100 bg-green-50/50"
                      : "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${
                        isActive ? "text-orange-600" : isDone ? "text-green-600" : "text-gray-400"
                      }`}>
                        {isDone ? "✓ Complete" : isActive ? "● In Progress" : `○ Upcoming`}
                      </span>
                      <span className="text-[10px] text-gray-300 shrink-0">#{index + 1}</span>
                      <p className={`text-sm font-bold leading-tight ${
                        isActive ? "text-gray-900" : isDone ? "text-gray-700" : "text-gray-500"
                      }`} style={{ fontFamily: "Lato, sans-serif" }}>
                        {phase.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${
                        isActive ? "bg-orange-200" : isDone ? "bg-green-200" : "bg-gray-200"
                      }`}>
                        <div
                          className={`h-full rounded-full transition-all ${
                            isDone ? "bg-green-500" : isActive ? "bg-orange-500" : "bg-gray-300"
                          }`}
                          style={{ width: `${isDone ? 100 : Number(phase.progress_pct)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold shrink-0 w-9 text-right ${
                        isActive ? "text-orange-600" : isDone ? "text-green-600" : "text-gray-400"
                      }`}>
                        {isDone ? "100%" : `${Number(phase.progress_pct)}%`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px]">
                      {phase.expected_date && !isDone && (
                        <span className="text-gray-500">Expected: <span className="font-semibold text-gray-700">{fmtDate(phase.expected_date)}</span></span>
                      )}
                      {phase.completed_date && (
                        <span className="text-gray-500">Completed: <span className="font-semibold text-green-700">{fmtDate(phase.completed_date)}</span></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-gray-50 py-10 text-center mb-6">
            <Layers className="h-8 w-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">Timeline coming soon</p>
            <p className="text-xs text-gray-500 mt-1">Project phases are being set up by your team.</p>
          </div>
        )}

        {/* Next Payment Due */}
        {nextDuePayment && (
          <Card className="bg-gray-50 border-2 mt-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1" style={{ fontFamily: "Lato, sans-serif" }}>
                    {nextDuePayment.due_date ? `NEXT DUE ${new Date(nextDuePayment.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}` : "NEXT PAYMENT"}
                  </div>
                  <div className="text-3xl font-black mb-1" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(nextDuePayment.amount)}</div>
                  <div className="text-sm text-gray-600">{nextDuePayment.label}</div>
                </div>
                <Button
                  className="w-full bg-black hover:bg-black/90 text-white h-11 lg:h-12 text-sm lg:text-base font-bold"
                  onClick={() => { setSelectedPayment(nextDuePayment); setPaymentMethod("card"); setShowPaymentModal(true); }}
                >
                  Pay {formatCurrency(nextDuePayment.amount)}
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Secure credit card payment</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending CO alert */}
      {pendingCOs.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "Lato, sans-serif" }}>Action Required</h3>
          <div className="space-y-3">
            {pendingCOs.map(co => (
              <Card key={co.id} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-orange-900">{co.title}</p>
                      <p className="text-xs text-orange-700">Change order awaiting your review — {formatCurrency((co.original_total !== null && co.original_total !== undefined && co.new_total !== null && co.new_total !== undefined) ? co.new_total - co.original_total : co.cost_impact)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap"
                    onClick={() => { setViewingChangeOrderId(co.id); setActiveTab("change-orders"); }}
                  >
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Latest Field Update */}
      {updates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold" style={{ fontFamily: "Lato, sans-serif" }}>Field Updates</h3>
            <button className="text-xs text-gray-500 hover:text-gray-700 font-semibold" onClick={() => setShowAllFieldUpdates(true)}>
              VIEW ALL →
            </button>
          </div>
          {renderFieldUpdateCard(updates[0])}
        </div>
      )}
    </div>
    );
  };

  const renderDocuments = () => {
    const coApprovalDocs = change_orders.filter(
      co => (co.status === "approved" || co.status === "merged") && co.approval_file_url
    );
    const hasAny = files.length > 0 || coApprovalDocs.length > 0 || proposals.length > 0 || change_orders.length > 0;

    if (!hasAny) {
      return (
        <div className="rounded-lg border border-dashed bg-gray-50 py-14 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">No documents yet</p>
          <p className="text-xs text-gray-500 mt-1">Your signed contract and project files will appear here once shared.</p>
        </div>
      );
    }

    const grouped = files.reduce<Record<string, typeof files>>((acc, f) => {
      const key = f.file_type || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});

    const typeOrder = ["contract", "photo", "subcontractor", "certificate", "other"];
    const sortedTypes = [
      ...typeOrder.filter(t => grouped[t]),
      ...Object.keys(grouped).filter(t => !typeOrder.includes(t)),
    ];

    const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
    const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp|heic|bmp|svg)$/i.test(name);
    const isPdfFile = (name: string) => /\.pdf$/i.test(name);

    return (
      <div className="space-y-8">
        {sortedTypes.map(type => (
          <div key={type}>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3" style={{ fontFamily: "Lato, sans-serif" }}>
              {typeLabel(type)}
            </h3>
            <div className="space-y-2">
              {grouped[type].map(doc => {
                const isImage = isImageFile(doc.file_name);
                const isPdf = isPdfFile(doc.file_name);
                const canPreview = (isImage || isPdf) && !!doc.file_url;
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 lg:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isImage && doc.file_url ? (
                        <img
                          src={doc.file_url}
                          alt={doc.file_name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0 border cursor-pointer"
                          onClick={() => setPreviewFile({ url: doc.file_url!, name: doc.file_name, isImage: true })}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm mb-0.5 truncate">{doc.file_name}</div>
                        <div className="text-xs text-gray-500">{formatDate(doc.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canPreview && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isImage) {
                              setPreviewFile({ url: doc.file_url!, name: doc.file_name, isImage: true });
                            } else {
                              setPdfPreview({ url: doc.file_url!, title: doc.file_name });
                            }
                          }}
                        >
                          View
                        </Button>
                      )}
                      {doc.file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === doc.id}
                          onClick={() => downloadFile(doc.file_url!, doc.file_name, doc.id)}
                        >
                          {downloadingId === doc.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Download className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* CO approval documents */}
        {coApprovalDocs.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3" style={{ fontFamily: "Lato, sans-serif" }}>
              Change Order Approvals
            </h3>
            <div className="space-y-2">
              {coApprovalDocs.map(co => {
                const fileName = co.approval_file_name ?? "approval-document";
                const isImg = /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(co.approval_file_url!.split("?")[0]);
                return (
                  <div key={co.id} className="flex items-center gap-3 p-3 lg:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isImg ? (
                        <img
                          src={co.approval_file_url!}
                          alt={fileName}
                          className="w-12 h-12 rounded object-cover flex-shrink-0 border cursor-pointer"
                          onClick={() => setPreviewFile({ url: co.approval_file_url!, name: fileName, isImage: true })}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded border bg-green-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-green-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm mb-0.5 truncate">{co.title}</div>
                        <div className="text-xs text-gray-500">{fileName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isImg) {
                            setPreviewFile({ url: co.approval_file_url!, name: fileName, isImage: true });
                          } else {
                            setPdfPreview({ url: co.approval_file_url!, title: fileName });
                          }
                        }}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === co.id}
                        onClick={() => downloadFile(co.approval_file_url!, fileName, co.id)}
                      >
                        {downloadingId === co.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Download className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proposals PDFs */}
        {proposals.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3" style={{ fontFamily: "Lato, sans-serif" }}>
              Proposals
            </h3>
            <div className="space-y-2">
              {proposals.map(proposal => {
                const statusBadge = proposal.status === "accepted" ? "border-green-600 text-green-600"
                  : proposal.status === "declined" ? "border-red-500 text-red-500"
                  : "border-orange-600 text-orange-600";
                const statusLabel = proposal.status === "accepted" ? "ACCEPTED"
                  : proposal.status === "declined" ? "DECLINED" : "PENDING";
                return (
                  <div key={proposal.id} className="p-3 lg:p-4 border rounded-lg hover:bg-gray-50 transition-colors space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded border bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm mb-0.5 truncate">{proposal.title}</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${statusBadge}`}>{statusLabel}</span>
                          {proposal.sent_at && <span className="text-xs text-gray-400">{formatDate(proposal.sent_at)}</span>}
                        </div>
                      </div>
                    </div>
                    {proposal.pdf_url && (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPdfPreview({ url: proposal.pdf_url!, title: proposal.title })}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" disabled={downloadingPdfId === `proposal-${proposal.id}`} onClick={() => handleDownloadPdf(proposal.pdf_url!, `Proposal-${proposal.title.replace(/[^a-z0-9]/gi, "-")}.pdf`, `proposal-${proposal.id}`)}>
                          {downloadingPdfId === `proposal-${proposal.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Change Orders PDFs */}
        {change_orders.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3" style={{ fontFamily: "Lato, sans-serif" }}>
              Change Orders
            </h3>
            <div className="space-y-2">
              {change_orders.map(co => {
                const isApproved = co.status === "approved" || co.status === "merged";
                const statusBadge = isApproved ? "border-green-600 text-green-600"
                  : co.status === "rejected" ? "border-red-500 text-red-500"
                  : "border-orange-600 text-orange-600";
                const statusLabel = isApproved ? "APPROVED" : co.status === "rejected" ? "DECLINED" : "PENDING";
                return (
                  <div key={co.id} className="p-3 lg:p-4 border rounded-lg hover:bg-gray-50 transition-colors space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded border bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm mb-0.5 truncate">{co.title}</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${statusBadge}`}>{statusLabel}</span>
                          <span className="text-xs text-gray-400">{formatDate(co.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {co.pdf_url && (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPdfPreview({ url: co.pdf_url!, title: co.title })}>
                          View
                        </Button>
                        <Button variant="outline" size="sm" disabled={downloadingPdfId === `co-${co.id}`} onClick={() => handleDownloadPdf(co.pdf_url!, `Change-Order-${co.title.replace(/[^a-z0-9]/gi, "-")}.pdf`, `co-${co.id}`)}>
                          {downloadingPdfId === `co-${co.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPayments = () => {
    if (payments.length === 0) {
      return (
        <div className="rounded-lg border border-dashed bg-gray-50 py-14 text-center">
          <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">No payment schedule yet</p>
          <p className="text-xs text-gray-500 mt-1">Your payment milestones will appear here once your contract is finalized.</p>
        </div>
      );
    }
    return (
    <div className="space-y-6">
      {/* Summary bars */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8">
          {["PAID", "DUE", "SCHEDULED"].map(status => {
            const matching = payments.filter(p => getPaymentStatus(p) === status || (status === "DUE" && getPaymentStatus(p) === "OVERDUE"));
            const total = matching.reduce((s, p) => s + p.amount, 0);
            const color = status === "PAID" ? "bg-green-600" : status === "DUE" ? "bg-orange-600" : "bg-gray-300";
            const pct = totalValue > 0 ? (total / totalValue) * 100 : 0;
            return (
              <div key={status}>
                <div className="text-xs font-bold text-gray-600 mb-2" style={{ fontFamily: "Lato, sans-serif" }}>{status}</div>
                <div className="text-2xl font-black mb-2" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(total)}</div>
                <div className="text-xs text-gray-500 mb-2">{Math.round(pct)}% OF CONTRACT</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment cards */}
      <div className="space-y-4">
        {payments.map(payment => {
          const status = getPaymentStatus(payment);
          const badgeClass = status === "PAID" ? "bg-green-600" : status === "DUE" || status === "OVERDUE" ? "bg-orange-600" : "bg-gray-400";
          return (
            <Card key={payment.id}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Badge className={`${badgeClass} text-white`}>{status}</Badge>
                    <div>
                      <div className="font-bold text-base" style={{ fontFamily: "Lato, sans-serif" }}>{payment.label}</div>
                      {payment.due_date && !payment.is_paid && (
                        <div className="text-xs text-gray-500">Due {formatDate(payment.due_date)}</div>
                      )}
                      {payment.is_paid && payment.paid_date && (
                        <div className="text-xs text-gray-500">Paid {formatDate(payment.paid_date)}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(payment.amount)}</div>
                  </div>
                </div>

                {payment.breakdown && payment.breakdown.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="text-xs font-bold text-gray-600 mb-3" style={{ fontFamily: "Lato, sans-serif" }}>BREAKDOWN</div>
                    {payment.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-gray-400 rounded-full" />
                          <span className="text-gray-700">{item.label}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {status !== "PAID" && (
                  <Button
                    className="w-full bg-black hover:bg-black/90 text-white mt-4"
                    onClick={() => { setSelectedPayment(payment); setPaymentMethod("card"); setShowPaymentModal(true); }}
                  >
                    Pay {formatCurrency(payment.amount)}
                  </Button>
                )}
                {status === "PAID" && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={previewingReceiptId === payment.id}
                      onClick={() => previewReceipt(payment)}
                    >
                      {previewingReceiptId === payment.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Eye className="h-4 w-4" />}
                      Preview Receipt
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={downloadingReceiptId === payment.id}
                      onClick={() => downloadReceipt(payment)}
                    >
                      {downloadingReceiptId === payment.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                      Download
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
    );
  };

  const renderFieldUpdates = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 mb-6">From jobsites, shared from the field.</p>
      {updates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50 py-14 text-center">
          <Camera className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">No field updates yet</p>
          <p className="text-xs text-gray-500 mt-1">Your team will post photos and progress notes here as work gets underway.</p>
        </div>
      ) : (
        updates.map(update => renderFieldUpdateCard(update))
      )}
    </div>
  );

  const renderChangeOrders = () => {
    return (
      <div className="space-y-4">
        {change_orders.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-gray-50 py-14 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">No change orders</p>
            <p className="text-xs text-gray-500 mt-1">Change orders will appear here if your project scope or cost changes.</p>
          </div>
        ) : (
          change_orders.map(co => {
            const isApproved = co.status === "approved" || co.status === "merged";
            const badgeClass = isApproved ? "border-green-600 text-green-600"
              : co.status === "rejected" ? "border-red-500 text-red-500"
              : "border-orange-600 text-orange-600";
            const badgeLabel = isApproved ? "APPROVED" : co.status === "rejected" ? "DECLINED" : "AWAITING REVIEW";
            return (
              <Card key={co.id}>
                <CardContent className="p-4 lg:p-6 space-y-2">
                  {/* Row 1: badge left, date right */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`${badgeClass} text-xs font-bold`}>{badgeLabel}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(co.created_at)}</span>
                  </div>
                  {/* Row 2: title full width */}
                  <div className="font-bold text-base break-words" style={{ fontFamily: "Lato, sans-serif" }}>{co.title}</div>
                  {/* Row 3: reason */}
                  {co.reason && <div className="text-sm text-gray-600 line-clamp-2">{co.reason}</div>}
                  {/* Row 4: price + button on right */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    {(() => {
                      const netImpact = (co.original_total !== null && co.original_total !== undefined && co.new_total !== null && co.new_total !== undefined)
                        ? co.new_total - co.original_total
                        : co.cost_impact;
                      return (
                        <div className={`text-lg font-black ${isApproved ? "text-green-600" : netImpact >= 0 ? "text-orange-600" : "text-green-600"}`} style={{ fontFamily: "Lato, sans-serif" }}>
                          {netImpact >= 0 ? "+" : ""}{formatCurrency(netImpact)}
                        </div>
                      );
                    })()}
                    {co.status === "pending_client" ? (
                      <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setViewingChangeOrderId(co.id)}>
                        Review
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setViewingChangeOrderId(co.id)}>
                        View
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  // const calculateProcessingFee = () => {
  //   if (!selectedPayment || paymentMethod !== "card") return 0;
  //   return selectedPayment.amount * 0.023 + 0.30;
  // };
  // const calculateTotal = () => (selectedPayment?.amount ?? 0) + calculateProcessingFee();

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setShowPaymentModal(false);
    setPaymentMethod(null);
    setSelectedPayment(null);
    toast.success("Payment received! Your account will update shortly.");
    // Refresh portal data — give webhook ~2s to process
    setTimeout(async () => {
      const fresh = await validatePortalToken(token);
      if (fresh) setPortalData(fresh);
    }, 2500);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentMethod(null);
    setSelectedPayment(null);
  };

  // ─── Full-screen views ────────────────────────────────────────────────────

  const viewingCO = viewingChangeOrderId ? change_orders.find(c => c.id === viewingChangeOrderId) ?? null : null;

  if (showAllFieldUpdates) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden">
        <div className="border-b bg-white sticky top-0 z-10">
          <div className="p-4 lg:p-8 w-full max-w-7xl mx-auto">
            <button onClick={() => setShowAllFieldUpdates(false)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-semibold">Back to Overview</span>
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-4xl font-black mb-2" style={{ fontFamily: "Lato, sans-serif" }}>Field Updates.</h1>
            <p className="text-sm text-gray-600">All updates from the jobsite</p>
          </div>
        </div>
        <div className="p-4 lg:p-8 w-full">
          <div className="max-w-5xl mx-auto space-y-6">
            {updates.map(update => renderFieldUpdateCard(update))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative top-0 left-0 h-full w-[85vw] max-w-[320px] lg:w-56
        bg-gray-50 px-4 py-6
        flex flex-col flex-shrink-0
        overflow-y-auto
        z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        border-r
      `}>
        {/* Mobile: close + logo */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: "Lato, sans-serif" }}>Butler & Associates</div>
            <div className="text-xs text-gray-500">Construction, Inc.</div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-200 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop: company name */}
        <div className="hidden lg:block mb-6">
          <div className="font-bold text-sm" style={{ fontFamily: "Lato, sans-serif" }}>Butler & Associates</div>
          <div className="text-xs text-gray-500">Construction, Inc.</div>
        </div>

        {/* Nav */}
        <div>
          <div className="text-xs font-bold text-gray-400 mb-3 tracking-wider" style={{ fontFamily: "Lato, sans-serif" }}>SECTIONS</div>
          <div className="space-y-0.5">
            {[
              { id: "overview", label: "Overview", icon: <Home className="h-4 w-4 flex-shrink-0" /> },
              { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4 flex-shrink-0" /> },
              { id: "payments", label: "Progress Payments", icon: <CreditCard className="h-4 w-4 flex-shrink-0" />, badge: duePayments },
              { id: "field-updates", label: "Field Updates", icon: <ImageIcon className="h-4 w-4 flex-shrink-0" /> },
              { id: "change-orders", label: "Change Orders", icon: <AlertCircle className="h-4 w-4 flex-shrink-0" />, badge: pendingCOs.length },
              { id: "proposals", label: "Proposals", icon: <ClipboardCheck className="h-4 w-4 flex-shrink-0" />, badge: pendingProposals },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id ? "bg-white font-semibold shadow-sm" : "text-gray-600 hover:bg-white/60"
                }`}
              >
                {tab.icon}
                <span className="flex-1 text-left leading-tight">{tab.label}</span>
                {tab.badge ? <Badge className="bg-orange-600 text-white text-xs px-1.5 py-0">{tab.badge}</Badge> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom info pinned */}
        <div className="mt-auto pt-5 border-t space-y-3">
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-0.5 tracking-wider" style={{ fontFamily: "Lato, sans-serif" }}>SITE</div>
            <div className="text-xs text-gray-700 leading-snug">{jobAddress || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-0.5 tracking-wider" style={{ fontFamily: "Lato, sans-serif" }}>CLIENT</div>
            <div className="text-xs font-semibold">{clientName}</div>
            {client.phone && <div className="text-xs text-gray-500">{client.phone}</div>}
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 mb-1 tracking-wider" style={{ fontFamily: "Lato, sans-serif" }}>PROJECT MANAGER</div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {pmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="text-xs font-semibold leading-tight">{pmName}</div>
                {pmPhone && <div className="text-xs text-gray-500">{pmPhone}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — scrolls independently of sidebar */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Sticky header */}
        <div className="border-b bg-white sticky top-0 z-10">
          <div className="px-4 lg:px-8 py-4 lg:py-5">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden mb-3 p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Two-column: left = name+address+progress | right = stats */}
            <div className="flex items-center gap-6">
              {/* LEFT — client info + progress bar contained within */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-semibold border-gray-300 flex-shrink-0">ACTIVE</Badge>
                  <h1 className="text-2xl lg:text-4xl font-black leading-tight truncate" style={{ fontFamily: "Lato, sans-serif" }}>
                    {clientName}.
                  </h1>
                </div>
                {jobAddress && (
                  <p className="text-sm text-gray-500 mb-3 break-words">{jobAddress}</p>
                )}
                {/* Progress bar — max-w-sm so it doesn't stretch to stats */}
                <div className="flex items-center gap-3 max-w-sm">
                  <span className="text-xs font-semibold text-gray-600 flex-shrink-0" style={{ fontFamily: "Lato, sans-serif" }}>PROJECT PROGRESS</span>
                  <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">{Math.round(progressPct)}%</span>
                </div>
              </div>

              {/* RIGHT — two side-by-side stats */}
              <div className="flex items-start gap-6 lg:gap-8 flex-shrink-0">
                <div className="text-right">
                  <div className="text-2xl lg:text-3xl font-black leading-tight" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(totalPaid)}</div>
                  <div className="text-xs text-gray-500">of {formatCurrency(totalValue)}</div>
                </div>
                <div className="hidden sm:block text-right mt-3">
                  <div className="text-base lg:text-lg font-bold leading-tight" style={{ fontFamily: "Lato, sans-serif" }}>{completionDate}</div>
                  <div className="text-xs text-gray-500">Est. completion</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 lg:p-8 w-full">
          <div className="w-full max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "Lato, sans-serif" }}>
                {activeTab === "overview" && "Project Timeline"}
                {activeTab === "documents" && "Documents"}
                {activeTab === "payments" && "Payment Schedule."}
                {activeTab === "field-updates" && "Field Updates."}
                {activeTab === "proposals" && "Proposals."}
                {activeTab === "change-orders" && "Change Orders."}
              </h2>
            </div>

            {activeTab === "overview" && renderOverview()}
            {activeTab === "documents" && renderDocuments()}
            {activeTab === "payments" && renderPayments()}
            {activeTab === "field-updates" && renderFieldUpdates()}
            {activeTab === "change-orders" && renderChangeOrders()}
            {activeTab === "proposals" && <PortalProposals proposals={proposals} token={token} />}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="w-[92vw] max-w-md p-0 gap-0 flex flex-col max-h-[88vh]">

          {/* Fixed Header */}
          <div className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="text-2xl font-black leading-tight" style={{ fontFamily: "Lato, sans-serif" }}>
              Pay {selectedPayment && formatCurrency(selectedPayment.amount)}
            </DialogTitle>
            <DialogDescription className="text-sm mt-0.5">{selectedPayment?.label}</DialogDescription>
          </div>

          {/* Scrollable Body — card form always shown (credit card only) */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Payment method picker — commented out (credit card only for now)
            <div>
              <label className="text-xs font-bold text-gray-700 mb-3 block tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>
                SELECT PAYMENT METHOD
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "card" as const, label: "Credit Card", sub: "+2.3% fee", icon: <CreditCard className="h-5 w-5" /> },
                  // { id: "ach" as const, label: "ACH / Bank Transfer", sub: "No fee", icon: <Building2 className="h-5 w-5" /> },
                  // { id: "apple" as const, label: "Apple Pay", sub: "No fee", icon: <Smartphone className="h-5 w-5" /> },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === m.id ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {m.icon}
                    <span className="font-semibold text-sm">{m.label}</span>
                    <span className="text-xs text-gray-500">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            */}

            {selectedPayment && (
              <Elements stripe={stripePromise}>
                <StripeCardForm
                  payment={selectedPayment}
                  token={token}
                  clientId={client.id}
                  onSuccess={handlePaymentSuccess}
                  onCancel={closePaymentModal}
                />
              </Elements>
            )}
          </div>

          {/* Fixed footer (method selector state) — commented out (credit card only for now)
          {paymentMethod !== "card" && (
            <div className="px-6 pt-4 pb-5 border-t shrink-0 space-y-3">
              {selectedPayment && (
                <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-gray-600">Payment Amount</span>
                    <span className="font-semibold">{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-gray-600">Processing Fee</span>
                    <span className="font-semibold">{formatCurrency(0)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between gap-2">
                    <span className="font-bold">Total</span>
                    <span className="text-lg font-black" style={{ fontFamily: "Lato, sans-serif" }}>
                      {formatCurrency(selectedPayment.amount)}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={closePaymentModal} className="flex-1 h-11">Cancel</Button>
                <Button className="flex-1 bg-black hover:bg-black/90 text-white h-11" disabled>
                  Select a payment method
                </Button>
              </div>
              <p className="text-[10px] text-center text-gray-500 leading-relaxed">
                🔒 Secure payment powered by Stripe • Your payment information is encrypted
              </p>
            </div>
          )}
          */}
        </DialogContent>
      </Dialog>

      {/* File Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col"
            style={{ maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0 rounded-t-xl">
              <span className="font-semibold text-sm truncate pr-4">{previewFile.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => downloadFile(previewFile.url, previewFile.name)}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content — images auto-size, no gap below */}
            <div className="overflow-auto p-3 bg-gray-50 rounded-b-xl">
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full object-contain mx-auto block rounded"
                style={{ maxHeight: "calc(90vh - 60px)" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal (Documents tab) */}
      <Dialog open={!!pdfPreview} onOpenChange={open => { if (!open) setPdfPreview(null); }}>
        <DialogContent className="w-[96vw] max-w-4xl p-0 flex flex-col gap-0" style={{ height: "84vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 pr-14">
            <span className="font-bold text-sm truncate pr-4" style={{ fontFamily: "Lato, sans-serif" }}>{pdfPreview?.title}</span>
            {pdfPreview && (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                onClick={() => handleDownloadPdf(pdfPreview.url, `${pdfPreview.title.replace(/[^a-z0-9]/gi, "-")}.pdf`, "preview")}
                disabled={downloadingPdfId === "preview"}
              >
                {downloadingPdfId === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="ml-1.5 hidden sm:inline">Download</span>
              </Button>
            )}
          </div>
          {/* Desktop: iframe */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto thin-scroll">
            {pdfPreview && <iframe src={`${pdfPreview.url}#toolbar=0&view=FitH`} className="w-full h-full border-0" title="PDF Preview" />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Order detail — slide-in sheet */}
      <Sheet open={!!viewingCO} onOpenChange={(open) => { if (!open) setViewingChangeOrderId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-y-auto">
          {viewingCO && (
            <PortalChangeOrderReview
              changeOrder={viewingCO}
              projectTotal={totalValue}
              token={token}
              onBack={() => setViewingChangeOrderId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Hidden receipt export — rendered off-screen for html2canvas capture */}
      {receiptPayment && (
        <div style={{ position: "absolute", left: -9999, top: 0, pointerEvents: "none", opacity: 0, zIndex: -1 }}>
          <PortalPaymentReceiptExport
            payment={receiptPayment}
            clientName={clientName}
            clientAddress={jobAddress}
          />
        </div>
      )}
    </div>
  );
}
