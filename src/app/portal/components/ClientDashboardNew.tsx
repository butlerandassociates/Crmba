import { useState } from "react";
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
import {
  FileText,
  ChevronRight,
  Check,
  Clock,
  CreditCard,
  Home,
  Image as ImageIcon,
  Download,
  X,
  ArrowLeft,
  Building2,
  Smartphone,
  Menu,
  AlertCircle,
  ClipboardCheck,
} from "lucide-react";
import type { PortalData } from "../api/portal";
import { PortalChangeOrderReview } from "./PortalChangeOrderReview";
import { PortalProposals } from "./PortalProposals";

interface Props {
  data: PortalData;
  token: string;
}

export function ClientDashboardNew({ data, token }: Props) {
  const { client, project, phases, payments, updates, files, change_orders, proposals } = data;

  const [activeTab, setActiveTab] = useState("overview");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach" | "apple" | null>(null);
  const [showAllFieldUpdates, setShowAllFieldUpdates] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewingChangeOrderId, setViewingChangeOrderId] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const progressPct = project?.progress_pct ?? 0;
  const completionDate = project?.target_date ? formatDate(project.target_date) : "TBD";

  const getPaymentStatus = (p: typeof payments[0]) => {
    if (p.is_paid) return "PAID";
    if (p.due_date) {
      const due = new Date(p.due_date);
      const today = new Date();
      if (due < today) return "OVERDUE";
      const daysUntil = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntil <= 7) return "DUE";
    }
    return "SCHEDULED";
  };

  const nextDuePayment = payments.find(p => !p.is_paid);

  const pendingCOs = change_orders.filter(co => co.status === "pending_client");

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
            <div className="text-xs font-bold text-gray-500 mb-2 tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>
              {new Date(update.posted_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
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

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Phase Timeline */}
      <div>
        <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "Lato, sans-serif" }}>Project Timeline</h3>
        {phases.length > 0 ? (
          <div className="flex items-center gap-2 lg:gap-4 mb-6 overflow-x-auto pb-2">
            {phases.map((phase, index) => (
              <div key={phase.id} className="flex items-center gap-4">
                <div className="text-center min-w-[100px] lg:min-w-[120px]">
                  <div
                    className={`text-xs lg:text-sm font-semibold mb-2 ${
                      phase.status === "in-progress" ? "text-orange-600"
                      : phase.status === "complete" ? "text-green-600"
                      : "text-gray-400"
                    }`}
                    style={{ fontFamily: "Lato, sans-serif" }}
                  >
                    {phase.label}
                  </div>
                  <div className={`h-2 rounded-full ${
                    phase.status === "in-progress" ? "bg-orange-600"
                    : phase.status === "complete" ? "bg-green-600"
                    : "bg-gray-200"
                  }`} />
                </div>
                {index < phases.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-6">Project phases are being set up.</div>
        )}

        {/* Next Payment Due */}
        {nextDuePayment && (
          <Card className="bg-gray-50 border-2">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-gray-600 mb-1" style={{ fontFamily: "Lato, sans-serif" }}>
                    {nextDuePayment.due_date ? `NEXT DUE ${new Date(nextDuePayment.due_date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}` : "NEXT PAYMENT"}
                  </div>
                  <div className="text-3xl font-black mb-1" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(nextDuePayment.amount)}</div>
                  <div className="text-sm text-gray-600">{nextDuePayment.label}</div>
                </div>
                <Button
                  className="w-full bg-black hover:bg-black/90 text-white h-11 lg:h-12 text-sm lg:text-base font-bold"
                  onClick={() => { setSelectedPayment(nextDuePayment); setShowPaymentModal(true); }}
                >
                  Pay {formatCurrency(nextDuePayment.amount)}
                </Button>
                <div className="flex items-center justify-center gap-2 lg:gap-3 text-xs text-gray-500">
                  <span>CASH</span><span>•</span><span>ACH</span><span>•</span><span>APPLE PAY</span><span>•</span><span>WIRE</span>
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
                      <p className="text-xs text-orange-700">Change order awaiting your review — {formatCurrency(co.cost_impact)}</p>
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

  const renderDocuments = () => (
    <div className="space-y-3 lg:space-y-4">
      {files.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700">No documents yet</p>
          <p className="text-sm">Your project documents will appear here once uploaded.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {files.map(doc => (
            <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 lg:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3 lg:gap-4 flex-1 min-w-0">
                <div className="text-xs font-bold text-gray-400 w-20 lg:w-24 flex-shrink-0 uppercase" style={{ fontFamily: "Lato, sans-serif" }}>
                  {doc.category}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-1">{doc.file_name}</div>
                  <div className="text-xs text-gray-500">{formatDate(doc.created_at)}</div>
                </div>
              </div>
              {doc.file_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noreferrer" download>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPayments = () => (
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
                    onClick={() => { setSelectedPayment(payment); setPaymentMethod(null); setShowPaymentModal(true); }}
                  >
                    Pay {formatCurrency(payment.amount)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderFieldUpdates = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 mb-6">From jobsites, shared from the field.</p>
      {updates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700">No updates yet</p>
          <p className="text-sm">Field updates will appear here as work progresses.</p>
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
          <div className="text-center py-12 text-gray-500">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">No change orders</p>
            <p className="text-sm">Change orders will appear here when issued.</p>
          </div>
        ) : (
          change_orders.map(co => {
            const badgeClass = co.status === "approved" ? "border-green-600 text-green-600"
              : co.status === "rejected" ? "border-red-500 text-red-500"
              : "border-orange-600 text-orange-600";
            const badgeLabel = co.status === "approved" ? "APPROVED" : co.status === "rejected" ? "DECLINED" : "AWAITING REVIEW";
            return (
              <Card key={co.id}>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <Badge variant="outline" className={`${badgeClass} text-xs font-bold`}>{badgeLabel}</Badge>
                        <span className="text-xs text-gray-400">{formatDate(co.created_at)}</span>
                      </div>
                      <div className="font-bold text-base mb-1" style={{ fontFamily: "Lato, sans-serif" }}>{co.title}</div>
                      {co.reason && <div className="text-sm text-gray-600 line-clamp-2">{co.reason}</div>}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className={`text-lg font-black ${co.cost_impact >= 0 ? "text-orange-600" : "text-green-600"}`} style={{ fontFamily: "Lato, sans-serif" }}>
                          {co.cost_impact >= 0 ? "+" : ""}{formatCurrency(co.cost_impact)}
                        </div>
                      </div>
                      {co.status === "pending_client" && (
                        <Button
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => setViewingChangeOrderId(co.id)}
                        >
                          Review
                        </Button>
                      )}
                      {co.status !== "pending_client" && (
                        <Button variant="outline" onClick={() => setViewingChangeOrderId(co.id)}>
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    );
  };

  const calculateProcessingFee = () => {
    if (!selectedPayment || paymentMethod !== "card") return 0;
    return selectedPayment.amount * 0.023 + 0.30;
  };
  const calculateTotal = () => (selectedPayment?.amount ?? 0) + calculateProcessingFee();

  // ─── Full-screen views ────────────────────────────────────────────────────

  if (viewingChangeOrderId) {
    const co = change_orders.find(c => c.id === viewingChangeOrderId);
    if (co) {
      return (
        <PortalChangeOrderReview
          changeOrder={co}
          projectTotal={totalValue}
          token={token}
          onBack={() => setViewingChangeOrderId(null)}
        />
      );
    }
  }

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
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-x-hidden">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:sticky top-0 left-0 h-full w-[85vw] max-w-[320px] lg:w-64
        bg-gray-50 p-6 space-y-6 lg:space-y-8
        flex-shrink-0 lg:h-screen overflow-y-auto
        z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        border-r
      `}>
        <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-200 rounded-lg">
          <X className="h-5 w-5" />
        </button>

        <div>
          <div className="font-bold text-sm mb-1" style={{ fontFamily: "Lato, sans-serif" }}>Butler & Associates</div>
          <div className="text-xs text-gray-600">Construction, Inc.</div>
        </div>

        <div>
          <div className="text-xs font-bold text-gray-400 mb-4" style={{ fontFamily: "Lato, sans-serif" }}>SECTIONS</div>
          <div className="space-y-1">
            {[
              { id: "overview", label: "Overview", icon: <Home className="h-5 w-5 flex-shrink-0" /> },
              { id: "documents", label: "Documents", icon: <FileText className="h-5 w-5 flex-shrink-0" /> },
              { id: "payments", label: "Progress Payments", icon: <CreditCard className="h-5 w-5 flex-shrink-0" /> },
              { id: "field-updates", label: "Field Updates", icon: <ImageIcon className="h-5 w-5 flex-shrink-0" /> },
              { id: "change-orders", label: "Change Orders", icon: <AlertCircle className="h-5 w-5 flex-shrink-0" />, badge: pendingCOs.length },
              { id: "proposals", label: "Proposals", icon: <ClipboardCheck className="h-5 w-5 flex-shrink-0" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id ? "bg-white font-semibold" : "text-gray-600 hover:bg-white/50"
                }`}
              >
                {tab.icon}
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.badge ? <Badge className="bg-orange-600 text-white text-xs px-2">{tab.badge}</Badge> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t space-y-4">
          <div>
            <div className="text-xs text-gray-400 mb-1" style={{ fontFamily: "Lato, sans-serif" }}>SITE</div>
            <div className="text-xs text-gray-700">{jobAddress || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1" style={{ fontFamily: "Lato, sans-serif" }}>CLIENT</div>
            <div className="text-xs font-semibold">{clientName}</div>
            {client.phone && <div className="text-xs text-gray-600">{client.phone}</div>}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1" style={{ fontFamily: "Lato, sans-serif" }}>PROJECT MANAGER</div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                {pmName.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="text-xs font-semibold">{pmName}</div>
                {pmPhone && <div className="text-xs text-gray-600">{pmPhone}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto lg:overflow-visible w-full">
        {/* Header */}
        <div className="border-b bg-white sticky top-0 z-10 w-full">
          <div className="p-4 lg:p-8 w-full max-w-7xl mx-auto">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden mb-4 p-2 hover:bg-gray-100 rounded-lg inline-flex items-center justify-center"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="w-full">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
                {/* Stats — first on mobile, last on desktop */}
                <div className="flex items-center justify-between lg:justify-end gap-4 lg:gap-8 text-left lg:text-right flex-shrink-0 order-first lg:order-last w-full lg:w-auto">
                  <div>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-black mb-1" style={{ fontFamily: "Lato, sans-serif" }}>{formatCurrency(totalPaid)}</div>
                    <div className="text-xs text-gray-500">of {formatCurrency(totalValue)}</div>
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-bold mb-1" style={{ fontFamily: "Lato, sans-serif" }}>{completionDate}</div>
                    <div className="text-xs text-gray-500">Est. completion</div>
                  </div>
                </div>

                {/* Project info — last on mobile, first on desktop */}
                <div className="flex-1 order-last lg:order-first w-full lg:w-auto">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 mb-3">
                    <Badge variant="outline" className="text-xs font-semibold border-gray-300 w-fit">ACTIVE</Badge>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-black leading-tight break-words" style={{ fontFamily: "Lato, sans-serif" }}>
                      {clientName}.
                    </h1>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 break-words">{jobAddress}</p>
                  <div className="w-full lg:max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600" style={{ fontFamily: "Lato, sans-serif" }}>PROJECT PROGRESS</span>
                      <span className="text-sm font-bold" style={{ fontFamily: "Lato, sans-serif" }}>{Math.round(progressPct)}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 lg:p-8 w-full">
          <div className="w-full max-w-7xl mx-auto">
            {activeTab !== "change-orders" && (
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "Lato, sans-serif" }}>
                  {activeTab === "overview" && "Project Timeline"}
                  {activeTab === "documents" && "Documents"}
                  {activeTab === "payments" && "Payment Schedule."}
                  {activeTab === "field-updates" && "Field Updates."}
                  {activeTab === "proposals" && "Proposals."}
                </h2>
              </div>
            )}

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
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-black leading-tight" style={{ fontFamily: "Lato, sans-serif" }}>
              Pay {selectedPayment && formatCurrency(selectedPayment.amount)}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{selectedPayment?.label}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6 py-4">
            <div>
              <label className="text-xs sm:text-sm font-bold text-gray-700 mb-3 block tracking-wide" style={{ fontFamily: "Lato, sans-serif" }}>
                SELECT PAYMENT METHOD
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { id: "card" as const, label: "Credit Card", sub: "+2.3% fee", icon: <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" /> },
                  { id: "ach" as const, label: "ACH / Bank", sub: "No fee", icon: <Building2 className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" /> },
                  { id: "apple" as const, label: "Apple Pay", sub: "No fee", icon: <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" /> },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-2 sm:p-3 lg:p-4 border-2 rounded-lg flex flex-col items-center gap-1 sm:gap-2 transition-all ${
                      paymentMethod === m.id ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {m.icon}
                    <span className="font-semibold text-xs sm:text-sm text-center leading-tight">{m.label}</span>
                    <span className="text-[10px] sm:text-xs text-gray-500">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "card" && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Card Number</label>
                  <Input placeholder="1234 5678 9012 3456" className="text-base" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Expiry</label>
                    <Input placeholder="MM / YY" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">CVC</label>
                    <Input placeholder="123" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Cardholder Name</label>
                  <Input placeholder="Name on card" />
                </div>
              </div>
            )}

            {paymentMethod === "ach" && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Account Holder Name</label>
                  <Input placeholder="Full name" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Routing Number</label>
                  <Input placeholder="9 digits" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Account Number</label>
                  <Input placeholder="Account number" />
                </div>
              </div>
            )}

            {paymentMethod === "apple" && (
              <div className="pt-4 border-t">
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 text-center">
                  <Smartphone className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-4">You'll be redirected to complete payment with Apple Pay</p>
                  <Button className="bg-black hover:bg-black/90 text-white w-full">Continue with Apple Pay</Button>
                </div>
              </div>
            )}

            {selectedPayment && (
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm gap-2">
                  <span className="text-gray-600">Payment Amount</span>
                  <span className="font-bold text-right">{formatCurrency(selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm gap-2">
                  <span className="text-gray-600 flex-1">
                    Processing Fee
                    {paymentMethod === "card" && <span className="text-[10px] sm:text-xs text-gray-500 ml-1">(2.3% + $0.30)</span>}
                  </span>
                  <span className={`font-bold ${calculateProcessingFee() > 0 ? "text-orange-600" : ""} text-right`}>
                    {formatCurrency(calculateProcessingFee())}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between gap-2">
                  <span className="font-bold text-sm sm:text-base">Total</span>
                  <span className="text-base sm:text-lg lg:text-xl font-black text-right" style={{ fontFamily: "Lato, sans-serif" }}>
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowPaymentModal(false); setPaymentMethod(null); }} className="flex-1 h-11">
                Cancel
              </Button>
              <Button className="flex-1 bg-black hover:bg-black/90 text-white h-11" disabled={!paymentMethod}>
                <span className="truncate">Pay {selectedPayment && formatCurrency(calculateTotal())}</span>
              </Button>
            </div>

            <p className="text-[10px] sm:text-xs text-center text-gray-500 pt-2 leading-relaxed">
              🔒 Secure payment powered by Stripe • Your payment information is encrypted
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
