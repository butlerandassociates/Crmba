import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "../../components/ui/button";
import { createPaymentIntent } from "../api/portal";
import type { PortalPayment } from "../api/portal";

const CARD_STYLE = {
  style: {
    base: {
      fontSize: "16px",
      color: "#111827",
      fontFamily: "Inter, sans-serif",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#ef4444", iconColor: "#ef4444" },
  },
};

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  payment: PortalPayment;
  token: string;
  clientId: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

export function StripeCardForm({ payment, token, clientId, onSuccess, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const fee = Math.round((payment.amount * 0.023 + 0.30) * 100) / 100;
  const total = Math.round((payment.amount + fee) * 100) / 100;

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    setCardError(null);

    // Step 1: Create PaymentIntent on the server
    const result = await createPaymentIntent(token, payment.id, clientId, total);
    if ("error" in result) {
      setCardError(result.error);
      setLoading(false);
      return;
    }

    // Step 2: Confirm card payment with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      result.clientSecret,
      { payment_method: { card: cardElement } }
    );

    if (stripeError) {
      setCardError(stripeError.message ?? "Payment failed. Please try again.");
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }

    setLoading(false);
  };

  return (
    // pt-4 border-t removed — was separator above payment method picker (now commented out)
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Card Details</label>
        <div className="border border-gray-300 rounded-md px-3 py-3 bg-white focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
          <CardElement options={CARD_STYLE} onChange={() => setCardError(null)} />
        </div>
      </div>

      {cardError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {cardError}
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-2">
        <div className="flex justify-between text-xs sm:text-sm gap-2">
          <span className="text-gray-600">Payment Amount</span>
          <span className="font-bold text-right">{fmt$(payment.amount)}</span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm gap-2">
          <span className="text-gray-600 flex-1">
            Processing Fee
            <span className="text-[10px] sm:text-xs text-gray-500 ml-1">(2.3% + $0.30)</span>
          </span>
          <span className="font-bold text-orange-600 text-right">{fmt$(fee)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between gap-2">
          <span className="font-bold text-sm sm:text-base">Total</span>
          <span className="text-base sm:text-lg lg:text-xl font-black text-right" style={{ fontFamily: "Lato, sans-serif" }}>
            {fmt$(total)}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-11"
        >
          Cancel
        </Button>
        <Button
          className="flex-1 bg-black hover:bg-black/90 text-white h-11"
          onClick={handlePay}
          disabled={!stripe || !elements || loading}
        >
          {loading ? "Processing…" : `Pay ${fmt$(total)}`}
        </Button>
      </div>

      <p className="text-[10px] sm:text-xs text-center text-gray-500 leading-relaxed">
        🔒 Secure payment powered by Stripe • Your payment information is encrypted
      </p>
    </div>
  );
}
