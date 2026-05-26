import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { CheckCircle2, XCircle, ClipboardCheck, ArrowLeft, DollarSign, Download, Loader2, Eye } from "lucide-react";
import type { PortalProposal } from "../api/portal";
import { portalAction } from "../api/portal";

interface Props {
  proposals: PortalProposal[];
  token: string;
  onActionComplete?: () => void;
}

export function PortalProposals({ proposals, token, onActionComplete }: Props) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [declineProposalId, setDeclineProposalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [signingProposalId, setSigningProposalId] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, "accepted" | "declined">>({});
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!viewingId) return;
    const proposal = proposals.find(p => p.id === viewingId);
    if (proposal?.status === "sent") {
      portalAction(token, "proposal_opened", viewingId).catch(() => {});
    }
  }, [viewingId]);

  const handleDownloadPdf = async (proposal: PortalProposal) => {
    if (!proposal.pdf_url) return;
    setDownloadingPdfId(proposal.id);
    try {
      const res = await fetch(proposal.pdf_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Proposal-${proposal.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(proposal.pdf_url, "_blank");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const handleAccept = async () => {
    if (!signingProposalId || !signatureName.trim()) return;
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "proposal_accept", signingProposalId, signatureName);
    setLoading(false);
    if (result.success) {
      setLocalStatuses(prev => ({ ...prev, [signingProposalId]: "accepted" }));
      setSigningProposalId(null);
      setSignatureName("");
      onActionComplete?.();
    } else {
      setError(result.error ?? "Failed to accept proposal. Please try again.");
    }
  };

  const handleDecline = async () => {
    if (!declineProposalId) return;
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "proposal_decline", declineProposalId, declineReason);
    setLoading(false);
    if (result.success) {
      setLocalStatuses(prev => ({ ...prev, [declineProposalId]: "declined" }));
      setDeclineProposalId(null);
      setDeclineReason("");
      setViewingId(null);
      onActionComplete?.();
    } else {
      setError(result.error ?? "Failed to submit response. Please try again.");
    }
  };

  const viewingProposal = viewingId ? proposals.find(p => p.id === viewingId) ?? null : null;

  if (proposals.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-gray-50 py-14 text-center">
        <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-semibold text-gray-700">No proposals yet</p>
        <p className="text-xs text-gray-500 mt-1">Your project proposal will appear here once it has been sent by your contractor.</p>
      </div>
    );
  }

  return (
    <>
      {/* Compact list */}
      <div className="space-y-4">
        {proposals.map(proposal => {
          const effectiveStatus = localStatuses[proposal.id] ?? proposal.status;
          const isPending = effectiveStatus === "sent" || effectiveStatus === "opened";
          const isAccepted = effectiveStatus === "accepted";
          const badgeClass = isAccepted
            ? "border-green-600 text-green-600"
            : effectiveStatus === "declined" ? "border-red-500 text-red-500"
            : "border-orange-600 text-orange-600";
          const badgeLabel = isAccepted ? "ACCEPTED"
            : effectiveStatus === "declined" ? "DECLINED"
            : "AWAITING ACCEPTANCE";

          return (
            <Card key={proposal.id}>
              <CardContent className="p-4 lg:p-6 space-y-2">
                {/* Row 1: badge left, date right (no prefix) */}
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`${badgeClass} text-xs font-bold`}>{badgeLabel}</Badge>
                  <span className="text-xs text-gray-400">
                    {fmtDate(isAccepted && proposal.accepted_at ? proposal.accepted_at : proposal.sent_at ?? null)}
                  </span>
                </div>
                {/* Row 2: title full width */}
                <div className="font-bold text-base break-words" style={{ fontFamily: "Lato, sans-serif" }}>{proposal.title}</div>
                {/* Row 3: accepted text */}
                {isAccepted && proposal.accepted_at && (
                  <p className="text-xs text-green-700">✓ Accepted on {fmtDate(proposal.accepted_at)}</p>
                )}
                {/* Row 4: price + button on right */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <div className={`text-lg font-black ${isAccepted ? "text-green-600" : "text-gray-900"}`} style={{ fontFamily: "Lato, sans-serif" }}>
                    {fmt(proposal.total)}
                  </div>
                  {isPending ? (
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap"
                      onClick={() => setViewingId(proposal.id)}
                    >
                      Review
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setViewingId(proposal.id)}>
                      View
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!viewingProposal} onOpenChange={open => { if (!open) setViewingId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col overflow-hidden">
          {viewingProposal && (() => {
            const effectiveStatus = localStatuses[viewingProposal.id] ?? viewingProposal.status;
            const isPending = effectiveStatus === "sent" || effectiveStatus === "opened";
            const isAccepted = effectiveStatus === "accepted";
            const badgeClass = isAccepted ? "border-green-600 text-green-600"
              : effectiveStatus === "declined" ? "border-red-500 text-red-500"
              : "border-orange-600 text-orange-600";
            const badgeLabel = isAccepted ? "ACCEPTED"
              : effectiveStatus === "declined" ? "DECLINED"
              : "AWAITING ACCEPTANCE";

            return (
              <>
                {/* Fixed Header */}
                <div className="border-b bg-white flex-shrink-0">
                  <div className="p-4 lg:p-6">
                    {/* Back button only (pr-12 avoids Sheet X overlap) */}
                    <div className="pr-12 mb-3">
                      <button onClick={() => setViewingId(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="text-sm font-semibold">Back to Proposals</span>
                      </button>
                    </div>
                    {/* Badge + date */}
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={`${badgeClass} font-bold`}>{badgeLabel}</Badge>
                      <span className="text-sm text-gray-500">
                        {fmtDate(isAccepted && viewingProposal.accepted_at ? viewingProposal.accepted_at : viewingProposal.sent_at ?? null)}
                      </span>
                    </div>
                    {/* Title full width */}
                    <h1 className="text-xl lg:text-2xl font-black break-words mb-3" style={{ fontFamily: "Lato, sans-serif" }}>{viewingProposal.title}</h1>
                    {/* PDF buttons below title — right-aligned */}
                    {viewingProposal.pdf_url && (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewId(viewingProposal.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1.5" />Preview
                        </Button>
                        <Button variant="outline" size="sm" disabled={downloadingPdfId === viewingProposal.id} onClick={() => handleDownloadPdf(viewingProposal)}>
                          {downloadingPdfId === viewingProposal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                          Download
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                  {/* Action required banner */}
                  {isPending && (
                    <Card className="border-orange-200 bg-orange-50">
                      <CardContent className="p-4 flex items-start gap-3">
                        <ClipboardCheck className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm text-orange-900 mb-1">Action Required</p>
                          <p className="text-sm text-orange-800">Please review this proposal and accept or decline to proceed.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Totals */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Subtotal
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-2xl font-bold">{fmt(viewingProposal.subtotal)}</div>
                      </CardContent>
                    </Card>
                    <Card className="border-2 border-black">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Total
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-2xl font-bold">{fmt(viewingProposal.total)}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Line items */}
                  {viewingProposal.line_items.length > 0 && (
                    <Card>
                      <CardHeader className="px-3 lg:px-4 pt-3 lg:pt-4 pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700" style={{ fontFamily: "Lato, sans-serif" }}>Scope of Work & Pricing</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="border-b bg-gray-50">
                              <tr>
                                <th className="text-left p-2 lg:p-4 text-xs font-bold text-gray-600">ITEM</th>
                                <th className="text-right p-2 lg:p-4 text-xs font-bold text-gray-600 whitespace-nowrap">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {viewingProposal.line_items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="p-2 lg:p-4">
                                    <div className="text-sm font-medium">{item.name}</div>
                                    {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                                  </td>
                                  <td className="p-2 lg:p-4 text-right text-sm font-semibold whitespace-nowrap">{fmt(item.quantity * item.client_price)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t bg-gray-50">
                              <tr>
                                <td className="p-2 lg:p-4 text-right text-sm text-gray-600 whitespace-nowrap">Subtotal</td>
                                <td className="p-2 lg:p-4 text-right text-sm font-semibold whitespace-nowrap">{fmt(viewingProposal.subtotal)}</td>
                              </tr>
                              {viewingProposal.tax_rate > 0 && (
                                <tr>
                                  <td className="p-2 lg:p-4 text-right text-sm text-gray-600 whitespace-nowrap">Sales Tax ({viewingProposal.tax_rate}%)</td>
                                  <td className="p-2 lg:p-4 text-right text-sm font-semibold whitespace-nowrap">{fmt(viewingProposal.tax_amount)}</td>
                                </tr>
                              )}
                              <tr>
                                <td className="p-2 lg:p-4 text-right font-bold whitespace-nowrap">TOTAL</td>
                                <td className="p-2 lg:p-4 text-right text-lg font-black whitespace-nowrap">{fmt(viewingProposal.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action buttons — pending only */}
                  {isPending && (
                    <Card className="border-2 border-black bg-gray-50">
                      <CardContent className="p-6">
                        <div className="text-center space-y-4">
                          <div>
                            <h3 className="text-xl font-black mb-2" style={{ fontFamily: "Lato, sans-serif" }}>Ready to Move Forward?</h3>
                            <p className="text-sm text-gray-600">Review the scope and pricing above, then accept to authorize Butler &amp; Associates to proceed.</p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button variant="outline" className="gap-2 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setDeclineProposalId(viewingProposal.id)}>
                              <XCircle className="h-4 w-4" /> Decline
                            </Button>
                            <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => setSigningProposalId(viewingProposal.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Accept Proposal
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Accepted state */}
                  {isAccepted && (
                    <Card className="border-2 border-green-600 bg-green-50">
                      <CardContent className="p-6 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="font-bold text-green-900">Proposal Accepted</p>
                        {viewingProposal.accepted_at && (
                          <p className="text-sm text-green-700 mt-1">Accepted on {fmtDate(viewingProposal.accepted_at)}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Declined state */}
                  {effectiveStatus === "declined" && (
                    <Card className="border-2 border-red-200 bg-red-50">
                      <CardContent className="p-6 text-center">
                        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="font-bold text-red-900">You declined this proposal</p>
                        {viewingProposal.declined_at && (
                          <p className="text-sm text-red-700 mt-1">Declined on {fmtDate(viewingProposal.declined_at)}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Accept modal — signature */}
      <Dialog open={!!signingProposalId} onOpenChange={open => { if (!open) { setSigningProposalId(null); setSignatureName(""); } }}>
        <DialogContent className="w-[95vw] max-w-lg p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>Accept Proposal</DialogTitle>
            <DialogDescription>Type your full name to electronically sign and accept this proposal.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Your Full Name</label>
              <Input
                placeholder="Your full name"
                value={signatureName}
                onChange={e => setSignatureName(e.target.value)}
                className="text-lg"
                style={{ fontFamily: "Brush Script MT, cursive" }}
              />
              <p className="text-xs text-gray-500 mt-2">
                By typing your name, you agree to the terms of this proposal and authorize Butler &amp; Associates to proceed with the described work.
              </p>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
          <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setSigningProposalId(null); setSignatureName(""); }} disabled={loading}>Cancel</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={!signatureName.trim() || loading} onClick={handleAccept}>
              {loading ? "Submitting..." : "Confirm & Accept"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview modal */}
      {(() => {
        const pp = previewId ? proposals.find(p => p.id === previewId) ?? null : null;
        return (
          <Dialog open={!!pp} onOpenChange={open => { if (!open) setPreviewId(null); }}>
            <DialogContent className="w-[96vw] max-w-4xl p-0 flex flex-col gap-0" style={{ height: "84vh" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 pr-14">
                <span className="font-bold text-sm truncate pr-4" style={{ fontFamily: "Lato, sans-serif" }}>{pp?.title}</span>
                {pp?.pdf_url && (
                  <Button variant="outline" size="sm" className="flex-shrink-0" disabled={downloadingPdfId === pp.id} onClick={() => pp && handleDownloadPdf(pp)}>
                    {downloadingPdfId === pp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 hidden sm:inline">Download</span>
                  </Button>
                )}
              </div>
              {/* Desktop: iframe */}
              <div className="flex-1 overflow-x-hidden overflow-y-auto thin-scroll">
                {pp?.pdf_url && <iframe src={`${pp.pdf_url}#toolbar=0&view=FitH`} className="w-full h-full border-0" title="PDF Preview" />}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Decline modal */}
      <Dialog open={!!declineProposalId} onOpenChange={open => { if (!open) { setDeclineProposalId(null); setDeclineReason(""); } }}>
        <DialogContent className="w-[95vw] max-w-lg p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>Decline Proposal</DialogTitle>
            <DialogDescription>Let us know your concerns and we'll follow up to discuss alternatives.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Reason (optional)</label>
              <Textarea
                placeholder="What concerns do you have? We'd love to address them."
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
          <div className="px-6 py-4 border-t flex-shrink-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setDeclineProposalId(null); setDeclineReason(""); }} disabled={loading}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={loading} onClick={handleDecline}>
              {loading ? "Submitting..." : "Decline Proposal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
