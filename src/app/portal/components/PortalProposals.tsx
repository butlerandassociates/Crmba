import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import { CheckCircle2, XCircle, ClipboardCheck, Download } from "lucide-react";
import type { PortalProposal } from "../api/portal";
import { portalAction } from "../api/portal";

interface Props {
  proposals: PortalProposal[];
  token: string;
}

export function PortalProposals({ proposals, token }: Props) {
  const [declineProposalId, setDeclineProposalId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [signingProposalId, setSigningProposalId] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, "accepted" | "declined">>({});

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

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
    } else {
      setError(result.error ?? "Failed to submit response. Please try again.");
    }
  };

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-700">No proposals yet</p>
        <p className="text-sm">Your project proposal will appear here once sent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {proposals.map(proposal => {
        const effectiveStatus = localStatuses[proposal.id] ?? proposal.status;
        const isPending = effectiveStatus === "sent";

        return (
          <div key={proposal.id} className="space-y-4">
            {/* Proposal header card */}
            <Card className={`border-2 ${
              effectiveStatus === "accepted" ? "border-green-600"
              : effectiveStatus === "declined" ? "border-red-300"
              : "border-gray-200"
            }`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={
                          effectiveStatus === "accepted" ? "border-green-600 text-green-600 font-bold"
                          : effectiveStatus === "declined" ? "border-red-500 text-red-500 font-bold"
                          : "border-orange-600 text-orange-600 font-bold"
                        }
                      >
                        {effectiveStatus === "accepted" ? "ACCEPTED"
                          : effectiveStatus === "declined" ? "DECLINED"
                          : "AWAITING ACCEPTANCE"}
                      </Badge>
                      {proposal.sent_at && <span className="text-xs text-gray-400">Sent {fmtDate(proposal.sent_at)}</span>}
                    </div>
                    <h2 className="text-xl lg:text-2xl font-black mb-1 break-words" style={{ fontFamily: "Lato, sans-serif" }}>
                      {proposal.title}
                    </h2>
                    {effectiveStatus === "accepted" && proposal.accepted_at && (
                      <p className="text-sm text-green-700 font-medium">✓ Accepted on {fmtDate(proposal.accepted_at)}</p>
                    )}
                    {effectiveStatus === "declined" && proposal.declined_at && (
                      <p className="text-sm text-red-600 font-medium">Declined on {fmtDate(proposal.declined_at)}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>{fmt(proposal.total)}</div>
                    <div className="text-xs text-gray-500">Total Investment</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            {proposal.line_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg" style={{ fontFamily: "Lato, sans-serif" }}>Scope of Work & Pricing</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="text-left p-3 lg:p-4 text-xs font-bold text-gray-600">ITEM</th>
                          <th className="text-center p-3 lg:p-4 text-xs font-bold text-gray-600">QTY</th>
                          <th className="text-right p-3 lg:p-4 text-xs font-bold text-gray-600">PRICE</th>
                          <th className="text-right p-3 lg:p-4 text-xs font-bold text-gray-600">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {proposal.line_items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 lg:p-4">
                              <div className="text-sm font-medium">{item.name}</div>
                              {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                            </td>
                            <td className="p-3 lg:p-4 text-center text-sm">{item.quantity} {item.unit}</td>
                            <td className="p-3 lg:p-4 text-right text-sm">{fmt(item.client_price)}</td>
                            <td className="p-3 lg:p-4 text-right text-sm font-semibold">{fmt(item.quantity * item.client_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t bg-gray-50">
                        <tr>
                          <td colSpan={3} className="p-3 lg:p-4 text-right text-sm text-gray-600">Subtotal</td>
                          <td className="p-3 lg:p-4 text-right text-sm font-semibold">{fmt(proposal.subtotal)}</td>
                        </tr>
                        {proposal.tax_rate > 0 && (
                          <tr>
                            <td colSpan={3} className="p-3 lg:p-4 text-right text-sm text-gray-600">Sales Tax ({proposal.tax_rate}%)</td>
                            <td className="p-3 lg:p-4 text-right text-sm font-semibold">{fmt(proposal.tax_amount)}</td>
                          </tr>
                        )}
                        <tr className="border-t-2">
                          <td colSpan={3} className="p-3 lg:p-4 text-right font-bold">TOTAL INVESTMENT</td>
                          <td className="p-3 lg:p-4 text-right text-lg font-black">{fmt(proposal.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accept / Decline buttons for pending proposals */}
            {isPending && (
              <Card className="border-2 border-black bg-gray-50">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div>
                      <h3 className="text-xl font-black mb-2" style={{ fontFamily: "Lato, sans-serif" }}>Ready to Move Forward?</h3>
                      <p className="text-sm text-gray-600">
                        Review the scope and pricing above, then accept to authorize Butler & Associates to proceed with your project.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        variant="outline"
                        className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setDeclineProposalId(proposal.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </Button>
                      <Button
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setSigningProposalId(proposal.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accept Proposal
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accepted state */}
            {effectiveStatus === "accepted" && (
              <Card className="border-2 border-green-600 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-green-900">Proposal Accepted</p>
                        {proposal.accepted_at && (
                          <p className="text-sm text-green-700">Accepted on {fmtDate(proposal.accepted_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      {/* Accept modal — signature */}
      <Dialog open={!!signingProposalId} onOpenChange={open => { if (!open) { setSigningProposalId(null); setSignatureName(""); } }}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>Accept Proposal</DialogTitle>
            <DialogDescription>Type your full name to electronically sign and accept this proposal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                By typing your name, you agree to the terms of this proposal and authorize Butler & Associates to proceed with the described work.
              </p>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setSigningProposalId(null); setSignatureName(""); }} disabled={loading}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={!signatureName.trim() || loading}
                onClick={handleAccept}
              >
                {loading ? "Submitting..." : "Confirm & Accept"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline modal */}
      <Dialog open={!!declineProposalId} onOpenChange={open => { if (!open) { setDeclineProposalId(null); setDeclineReason(""); } }}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black" style={{ fontFamily: "Lato, sans-serif" }}>Decline Proposal</DialogTitle>
            <DialogDescription>Let us know your concerns and we'll follow up to discuss alternatives.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Reason (optional)</label>
              <Textarea
                placeholder="What concerns do you have? We'd love to address them."
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setDeclineProposalId(null); setDeclineReason(""); }} disabled={loading}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={loading}
                onClick={handleDecline}
              >
                {loading ? "Submitting..." : "Decline Proposal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
