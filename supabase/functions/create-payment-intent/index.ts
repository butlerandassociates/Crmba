import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, payment_id, client_id, amount } = await req.json();

    if (!token || !payment_id || !client_id || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate portal token belongs to this client
    const { data: tokenRow } = await supabase
      .from("client_portal_tokens")
      .select("client_id, is_active")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!tokenRow || tokenRow.client_id !== client_id) {
      return new Response(JSON.stringify({ error: "Invalid or expired portal token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm the payment belongs to this client
    const { data: paymentRow } = await supabase
      .from("project_payments")
      .select("id, client_id, is_paid")
      .eq("id", payment_id)
      .eq("client_id", client_id)
      .maybeSingle();

    if (!paymentRow) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paymentRow.is_paid) {
      return new Response(JSON.stringify({ error: "Payment already completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const amountCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        payment_id,
        client_id,
      },
    });

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-payment-intent]", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
