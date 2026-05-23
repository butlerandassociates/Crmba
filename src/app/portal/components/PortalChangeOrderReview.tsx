import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import {
  ArrowLeft, Download, DollarSign, CheckCircle2, AlertCircle, Clock, MessageSquare, ExternalLink, Loader2, Eye,
} from "lucide-react";
import type { PortalChangeOrder } from "../api/portal";
import { portalAction } from "../api/portal";
import { PortalChangeOrderSuccess } from "./PortalChangeOrderSuccess";

interface Props {
  changeOrder: PortalChangeOrder;
  projectTotal: number;
  token: string;
  onBack: () => void;
  onActionComplete?: () => void;
}

export function PortalChangeOrderReview({ changeOrder, projectTotal, token, onBack, onActionComplete }: Props) {
  const [signatureInput, setSignatureInput] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [submissionType, setSubmissionType] = useState<"approved" | "denied" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const handleDownloadPdf = async () => {
    if (!changeOrder.pdf_url) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(changeOrder.pdf_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Change-Order-${changeOrder.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(changeOrder.pdf_url, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadFile = useCallback(async (url: string, name: string) => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloading(false);
    }
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
  const originalContractTotal = changeOrder.original_total ?? projectTotal;
  const revisedTotal = changeOrder.new_total ?? (projectTotal + changeOrder.cost_impact);
  // True net impact = new_total - original_total (accounts for modifications to existing items)
  // Falls back to cost_impact if snapshots not stored (old COs)
  const netImpact = (changeOrder.original_total !== null && changeOrder.new_total !== null)
    ? changeOrder.new_total - changeOrder.original_total
    : changeOrder.cost_impact;

  const handleApprove = () => setShowSignature(true);

  const handleSign = async () => {
    if (!signatureInput.trim()) return;
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "co_approve", changeOrder.id, signatureInput);
    setLoading(false);
    if (result.success) {
      setSubmissionType("approved");
      onActionComplete?.();
    } else {
      setError(result.error ?? "Failed to submit approval. Please try again.");
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "co_reject", changeOrder.id, declineReason);
    setLoading(false);
    if (result.success) {
      setShowDeclineForm(false);
      setSubmissionType("denied");
      onActionComplete?.();
    } else {
      setError(result.error ?? "Failed to submit response. Please try again.");
    }
  };

  if (submissionType) {
    return (
      <PortalChangeOrderSuccess
        type={submissionType}
        changeOrder={changeOrder}
        revisedTotal={revisedTotal}
        onBack={onBack}
      />
    );
  }

  const isApproved = changeOrder.status === "approved" || changeOrder.status === "merged";
  const statusLabel = changeOrder.status === "merged" ? "APPLIED TO CONTRACT"
    : changeOrder.status === "approved" ? "APPROVED"
    : changeOrder.status === "rejected" ? "DECLINED"
    : "AWAITING REVIEW";
  const statusClass = changeOrder.status === "merged" ? "border-purple-600 text-purple-600"
    : isApproved ? "border-green-600 text-green-600"
    : changeOrder.status === "rejected" ? "border-red-500 text-red-500"
    : "border-orange-600 text-orange-600";

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="p-4 lg:p-8 w-full max-w-6xl mx-auto">
          {/* Back button */}
          <div className="pr-12 mb-4">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-semibold">Back to Change Orders</span>
            </button>
          </div>
          {/* Badge + date */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className={`${statusClass} font-bold`}>{statusLabel}</Badge>
            <span className="text-sm text-gray-500">
              Issued {new Date(changeOrder.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          {/* Title */}
          <h1 className="text-2xl lg:text-4xl font-black mb-2 break-words" style={{ fontFamily: "Lato, sans-serif" }}>
            {changeOrder.title}
          </h1>
          {changeOrder.reason && <p className="text-sm text-gray-600 mb-2">{changeOrder.reason}</p>}
          {/* PDF buttons below title — right-aligned */}
          {changeOrder.pdf_url && (
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(true)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />Preview
              </Button>
              <Button variant="outline" size="sm" disabled={downloadingPdf} onClick={handleDownloadPdf}>
                {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Download
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 lg:p-8 w-full">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Alert — only show when pending */}
          {changeOrder.status === "pending_client" && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-orange-900 mb-1">Action Required</p>
                  <p className="text-sm text-orange-800">Please review this change order and provide approval or feedback. Work cannot proceed until approved.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Original Contract
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{fmt(originalContractTotal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Change Order
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className={`text-2xl font-bold ${isApproved ? "text-green-600" : "text-orange-600"}`}>
                  {netImpact >= 0 ? "+" : ""}{fmt(netImpact)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-black">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Revised Contract
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{fmt(revisedTotal)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Line items */}
          {(changeOrder.items.length > 0 || changeOrder.modifications_display?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: "Lato, sans-serif" }}>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="text-left p-3 lg:p-4 text-xs font-bold text-gray-600">DESCRIPTION</th>
                        <th className="text-right p-3 lg:p-4 text-xs font-bold text-gray-600">UNIT PRICE</th>
                        <th className="text-right p-3 lg:p-4 text-xs font-bold text-gray-600">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {changeOrder.items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-3 lg:p-4">
                            <div className="text-sm font-medium">{item.description}</div>
                            {item.category && <div className="text-xs text-gray-400">{item.category}</div>}
                          </td>
                          <td className="p-3 lg:p-4 text-right text-sm whitespace-nowrap">{fmt(item.unit_price)}</td>
                          <td className="p-3 lg:p-4 text-right text-sm font-semibold whitespace-nowrap">{fmt(item.total)}</td>
                        </tr>
                      ))}
                      {(changeOrder.modifications_display ?? []).map((mod, idx) => (
                        <tr key={`mod-${idx}`} className="hover:bg-gray-50">
                          <td className="p-3 lg:p-4">
                            <div className="text-sm font-medium">{mod.name}</div>
                            <div className="text-xs text-gray-400">{[mod.category, mod.action === "delete" ? "Removed" : "Modified"].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td className="p-3 lg:p-4 text-right text-sm whitespace-nowrap">{fmt(mod.unit_price)}</td>
                          <td className={`p-3 lg:p-4 text-right text-sm font-semibold whitespace-nowrap ${mod.delta >= 0 ? "text-orange-600" : "text-green-700"}`}>
                            {mod.delta >= 0 ? "+" : ""}{fmt(mod.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-gray-50">
                      <tr>
                        <td colSpan={2} className="p-3 lg:p-4 text-right font-bold">CHANGE ORDER TOTAL</td>
                        <td className="p-3 lg:p-4 text-right text-lg font-black whitespace-nowrap">{netImpact >= 0 ? "+" : ""}{fmt(netImpact)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline & notes */}
          {(changeOrder.timeline_impact) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {changeOrder.timeline_impact && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-bold text-gray-600">TIMELINE IMPACT</span>
                    </div>
                    <p className="text-sm pl-6">{changeOrder.timeline_impact}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
          )}

          {/* Actions — only when pending */}
          {changeOrder.status === "pending_client" && (
            <>
              {/* Signature / approve */}
              {!showSignature ? (
                <Card className="border-2 border-black bg-gray-50">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div>
                        <h3 className="text-xl font-black mb-2" style={{ fontFamily: "Lato, sans-serif" }}>Ready to Approve?</h3>
                        <p className="text-sm text-gray-600">
                          By approving, you authorize the contractor to proceed with this change order and agree to the revised contract amount of {fmt(revisedTotal)}.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button variant="outline" className="gap-2" onClick={() => setShowDeclineForm(true)} disabled={loading}>
                          <MessageSquare className="h-4 w-4" />
                          Decline & Send Feedback
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={handleApprove} disabled={loading}>
                          <CheckCircle2 className="h-4 w-4" />
                          Approve & Sign
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-2 border-green-600 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-900">
                      <CheckCircle2 className="h-5 w-5" /> Electronic Signature Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Type Your Full Name to Sign</label>
                      <Input
                        placeholder="Your full name"
                        value={signatureInput}
                        onChange={e => setSignatureInput(e.target.value)}
                        className="text-lg"
                        style={{ fontFamily: "Brush Script MT, cursive" }}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        By typing your name above, you agree to the terms of this change order and authorize work to proceed.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button variant="outline" onClick={() => setShowSignature(false)} className="flex-1" disabled={loading}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={!signatureInput.trim() || loading}
                        onClick={handleSign}
                      >
                        {loading ? "Submitting..." : "Submit Signature"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Inline decline form — shown when Decline button clicked */}
              {showDeclineForm && (
                <Card className="border-2 border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-red-900">
                      <MessageSquare className="h-4 w-4" /> Reason for Declining <span className="text-sm font-normal text-red-600">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="e.g. The cost is higher than expected, I'd like to discuss alternatives..."
                      value={declineReason}
                      onChange={e => setDeclineReason(e.target.value)}
                      className="min-h-[100px] bg-white"
                      disabled={loading}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShowDeclineForm(false)} disabled={loading}>
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                        onClick={handleDeny}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                        {loading ? "Submitting..." : "Confirm Decline"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* View-only state for already approved/rejected */}
          {changeOrder.status !== "pending_client" && (
            <Card className={`border-2 ${isApproved ? "border-green-600 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <CardContent className="p-6 text-center space-y-4">
                <p className="font-semibold text-lg" style={{ fontFamily: "Lato, sans-serif" }}>
                  {isApproved ? "✓ This change order has been approved" : "✗ You declined this change order"}
                </p>
                {isApproved && changeOrder.approval_file_url && (() => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(
                    changeOrder.approval_file_url!.split("?")[0]
                  );
                  return (
                    <div className="space-y-3">
                      {isImg && (
                        <img
                          src={changeOrder.approval_file_url}
                          alt={changeOrder.approval_file_name ?? "Approval document"}
                          className="max-h-72 mx-auto rounded-lg border object-contain shadow-sm"
                        />
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        {!isImg && (
                          <a
                            href={changeOrder.approval_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 border border-green-700 rounded-lg text-green-800 hover:bg-green-100 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View Document
                          </a>
                        )}
                        <button
                          disabled={downloading}
                          onClick={() => downloadFile(changeOrder.approval_file_url!, changeOrder.approval_file_name ?? "approval-document")}
                          className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 border border-green-700 rounded-lg text-green-800 hover:bg-green-100 transition-colors disabled:opacity-60"
                        >
                          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          {downloading ? "Downloading..." : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* PDF Preview modal */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="w-[96vw] max-w-4xl p-0 flex flex-col gap-0" style={{ height: "84vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 pr-14">
            <span className="font-bold text-sm truncate pr-4" style={{ fontFamily: "Lato, sans-serif" }}>{changeOrder.title}</span>
            <Button variant="outline" size="sm" className="flex-shrink-0" disabled={downloadingPdf} onClick={handleDownloadPdf}>
              {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="ml-1.5 hidden sm:inline">Download</span>
            </Button>
          </div>
          {/* Desktop: iframe */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto thin-scroll">
            {changeOrder.pdf_url && <iframe src={`${changeOrder.pdf_url}#toolbar=0&view=FitH`} className="w-full h-full border-0" title="PDF Preview" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
