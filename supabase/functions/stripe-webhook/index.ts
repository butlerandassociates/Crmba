import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentId = pi.metadata.payment_id;
    const clientId = pi.metadata.client_id;
    const amountDollars = (pi.amount / 100).toFixed(2);
    const feeAmount = parseFloat(pi.metadata.fee_amount ?? "0") || 0;

    if (!paymentId || !clientId) {
      console.error("[stripe-webhook] Missing metadata on PaymentIntent", pi.id);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // Mark payment as paid
    const { error: updateErr } = await supabase
      .from("project_payments")
      .update({
        is_paid: true,
        paid_date: new Date().toISOString().split("T")[0],
        payment_method: "Credit Card",
        confirmation_code: pi.id,
        stripe_fee_amount: feeAmount > 0 ? feeAmount : null,
      })
      .eq("id", paymentId)
      .eq("client_id", clientId);

    if (updateErr) {
      console.error("[stripe-webhook] Failed to update payment:", updateErr.message);
    } else {
      console.log(`[stripe-webhook] Payment ${paymentId} marked as paid — $${amountDollars}`);
    }

    // Activity log
    await supabase.from("activity_log").insert({
      client_id: clientId,
      action_type: "payment_received",
      description: `Progress payment of $${amountDollars} received via Credit Card (${pi.id})`,
    });

    // Notify admin
    await supabase.from("notifications").insert({
      type: "payment_received",
      title: "Payment Received",
      message: `A progress payment of $${amountDollars} was received via credit card.`,
      metadata: { client_id: clientId },
      link: `/clients/${clientId}`,
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const clientId = pi.metadata.client_id;
    const amountDollars = (pi.amount / 100).toFixed(2);

    console.warn(`[stripe-webhook] Payment failed for client ${clientId} — $${amountDollars}`);

    if (clientId) {
      await supabase.from("activity_log").insert({
        client_id: clientId,
        action_type: "payment_failed",
        description: `Credit card payment of $${amountDollars} failed — ${pi.last_payment_error?.message ?? "unknown reason"}`,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
