import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  ArrowLeft, Download, DollarSign, CheckCircle2, AlertCircle, Clock, MessageSquare,
} from "lucide-react";
import type { PortalChangeOrder } from "../api/portal";
import { portalAction } from "../api/portal";
import { PortalChangeOrderSuccess } from "./PortalChangeOrderSuccess";

interface Props {
  changeOrder: PortalChangeOrder;
  projectTotal: number;
  token: string;
  onBack: () => void;
}

export function PortalChangeOrderReview({ changeOrder, projectTotal, token, onBack }: Props) {
  const [signatureInput, setSignatureInput] = useState("");
  const [comments, setComments] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [submissionType, setSubmissionType] = useState<"approved" | "denied" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);
  const revisedTotal = projectTotal + changeOrder.cost_impact;

  const handleApprove = () => setShowSignature(true);

  const handleSign = async () => {
    if (!signatureInput.trim()) return;
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "co_approve", changeOrder.id, signatureInput);
    setLoading(false);
    if (result.success) {
      setSubmissionType("approved");
    } else {
      setError(result.error ?? "Failed to submit approval. Please try again.");
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    setError(null);
    const result = await portalAction(token, "co_reject", changeOrder.id, comments);
    setLoading(false);
    if (result.success) {
      setSubmissionType("denied");
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

  const statusLabel = changeOrder.status === "approved" ? "APPROVED"
    : changeOrder.status === "rejected" ? "DECLINED"
    : "AWAITING REVIEW";
  const statusClass = changeOrder.status === "approved" ? "border-green-600 text-green-600"
    : changeOrder.status === "rejected" ? "border-red-500 text-red-500"
    : "border-orange-600 text-orange-600";

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="p-4 lg:p-8 w-full max-w-6xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Back to Change Orders</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className={`${statusClass} font-bold`}>{statusLabel}</Badge>
                <span className="text-sm text-gray-500">
                  Issued {new Date(changeOrder.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <h1 className="text-2xl lg:text-4xl font-black mb-2 break-words" style={{ fontFamily: "Lato, sans-serif" }}>
                {changeOrder.title}
              </h1>
              {changeOrder.reason && <p className="text-sm text-gray-600">{changeOrder.reason}</p>}
            </div>
          </div>
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
                <div className="text-2xl font-bold">{fmt(projectTotal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Change Order
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-orange-600">
                  {changeOrder.cost_impact >= 0 ? "+" : ""}{fmt(changeOrder.cost_impact)}
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
          {changeOrder.items.length > 0 && (
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
                        <th className="text-center p-3 lg:p-4 text-xs font-bold text-gray-600">QTY</th>
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
                          <td className="p-3 lg:p-4 text-center text-sm">{item.quantity} {item.unit}</td>
                          <td className="p-3 lg:p-4 text-right text-sm">{fmt(item.unit_price)}</td>
                          <td className="p-3 lg:p-4 text-right text-sm font-semibold">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-gray-50">
                      <tr>
                        <td colSpan={3} className="p-3 lg:p-4 text-right font-bold">CHANGE ORDER TOTAL</td>
                        <td className="p-3 lg:p-4 text-right text-lg font-black">{fmt(changeOrder.cost_impact)}</td>
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
              {/* Comments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Questions or Comments?</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add any questions or feedback about this change order..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    className="min-h-[100px] mb-3"
                  />
                </CardContent>
              </Card>

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
                        <Button variant="outline" className="gap-2" onClick={handleDeny} disabled={loading}>
                          <MessageSquare className="h-4 w-4" />
                          {loading ? "Submitting..." : "Decline & Send Feedback"}
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
            </>
          )}

          {/* View-only state for already approved/rejected */}
          {changeOrder.status !== "pending_client" && (
            <Card className={`border-2 ${changeOrder.status === "approved" ? "border-green-600 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <CardContent className="p-6 text-center">
                <p className="font-semibold text-lg" style={{ fontFamily: "Lato, sans-serif" }}>
                  {changeOrder.status === "approved" ? "✓ You approved this change order" : "✗ You declined this change order"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
