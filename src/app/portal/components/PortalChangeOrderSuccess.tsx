import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { CheckCircle2, MessageSquare, Download, ArrowLeft } from "lucide-react";
import type { PortalChangeOrder } from "../api/portal";

interface Props {
  type: "approved" | "denied";
  changeOrder: PortalChangeOrder;
  revisedTotal: number;
  onBack: () => void;
}

export function PortalChangeOrderSuccess({ type, changeOrder, revisedTotal, onBack }: Props) {
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

  if (type === "approved") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white overflow-x-hidden">
        <div className="p-4 lg:p-8 w-full">
          <div className="max-w-3xl mx-auto space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-semibold">Back to Change Orders</span>
            </button>

            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h1 className="text-3xl lg:text-5xl font-black mb-3" style={{ fontFamily: "Lato, sans-serif" }}>
                Change Order Approved!
              </h1>
              <p className="text-lg text-gray-600">{changeOrder.title}</p>
            </div>

            <Card className="border-2 border-green-600 bg-white">
              <CardContent className="p-6 lg:p-8">
                <div className="space-y-6">
                  <div>
                    <div className="text-sm font-bold text-green-700 mb-2">✓ APPROVAL RECEIVED</div>
                    <p className="text-sm text-gray-600">
                      Your approval has been recorded and all parties have been notified. You'll receive a confirmation shortly.
                    </p>
                  </div>
                  <div className="border-t pt-6">
                    <h3 className="font-bold text-lg mb-4" style={{ fontFamily: "Lato, sans-serif" }}>What Happens Next</h3>
                    <div className="space-y-4">
                      {[
                        { label: "Contract Updated", desc: `Your contract value has been updated to ${fmt(revisedTotal)}` },
                        { label: "Work Scheduled", desc: "This work will be integrated into the project timeline" },
                        { label: "Materials Ordered", desc: "Your project manager will coordinate material delivery and crew scheduling" },
                        { label: "Stay Updated", desc: "You'll receive field updates as work progresses" },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">{i + 1}</div>
                          <div>
                            <div className="font-semibold text-sm mb-1">{item.label}</div>
                            <div className="text-sm text-gray-600">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm text-green-900 mb-1">Payment Schedule Updated</div>
                        <p className="text-sm text-green-800">
                          The additional {fmt((changeOrder.original_total !== null && changeOrder.original_total !== undefined && changeOrder.new_total !== null && changeOrder.new_total !== undefined) ? changeOrder.new_total - changeOrder.original_total : changeOrder.cost_impact)} will be distributed across your remaining progress payments. No immediate payment required.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button onClick={onBack} size="lg" className="bg-black hover:bg-black/90">Return to Portal</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white overflow-x-hidden">
      <div className="p-4 lg:p-8 w-full">
        <div className="max-w-3xl mx-auto space-y-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Back to Change Orders</span>
          </button>

          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
              <MessageSquare className="h-12 w-12 text-orange-600" />
            </div>
            <h1 className="text-3xl lg:text-5xl font-black mb-3" style={{ fontFamily: "Lato, sans-serif" }}>Feedback Submitted</h1>
            <p className="text-lg text-gray-600">{changeOrder.title}</p>
          </div>

          <Card className="border-2 border-orange-600 bg-white">
            <CardContent className="p-6 lg:p-8">
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-bold text-orange-700 mb-2">✓ RESPONSE RECEIVED</div>
                  <p className="text-sm text-gray-600">
                    Your feedback has been sent to your project manager. They'll review your comments and follow up shortly to discuss alternatives or modifications.
                  </p>
                </div>
                <div className="border-t pt-6">
                  <h3 className="font-bold text-lg mb-4" style={{ fontFamily: "Lato, sans-serif" }}>What Happens Next</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Project Manager Review", desc: "Your project manager will review your feedback and concerns" },
                      { label: "Discussion", desc: "Expect a call or message within 24 hours to discuss next steps" },
                      { label: "Revised Proposal (if needed)", desc: "We'll work with you to find a solution that meets your needs and budget" },
                    ].map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm">{i + 1}</div>
                        <div>
                          <div className="font-semibold text-sm mb-1">{item.label}</div>
                          <div className="text-sm text-gray-600">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm text-orange-900 mb-1">No Impact on Current Work</div>
                      <p className="text-sm text-orange-800">Your current project timeline and contract remain unchanged. This change order is on hold pending further discussion.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button onClick={onBack} size="lg" className="bg-black hover:bg-black/90">Return to Portal</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
