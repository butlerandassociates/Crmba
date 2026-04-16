import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Normalize a phone number to E.164 (+1XXXXXXXXXX for US numbers). */
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      client_phone,
      client_first_name,
      date,
      time,
    } = await req.json();

    if (!client_phone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNumber = toE164(client_phone);
    if (!toNumber) {
      return new Response(JSON.stringify({ error: `Invalid phone number: ${client_phone}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Twilio Lookup: validate line status before sending ──────────────────
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(toNumber)}?Fields=line_status`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { "Authorization": `Basic ${credentials}` },
    });
    if (lookupRes.ok) {
      const lookupData = await lookupRes.json();
      const lineStatus = lookupData?.line_status?.status;
      // Block only definitively bad statuses — skip if unknown/null so we still attempt send
      if (lineStatus === "inactive" || lineStatus === "disconnected") {
        return new Response(
          JSON.stringify({ error: `Phone number appears to be ${lineStatus} — SMS not sent.`, line_status: lineStatus }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // If Lookup itself fails (network, quota, etc.) we fall through and attempt the send anyway

    const firstName = (client_first_name ?? "").trim() || "there";
    const body = `Hi ${firstName}, we're looking forward to meeting with you on ${date} at ${time}. Please let us know if your availability changes! — Butler & Associates Construction, Inc.`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const params = new URLSearchParams();
    params.set("From", TWILIO_FROM_NUMBER);
    params.set("To", toNumber);
    params.set("Body", body);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result.message ?? "Twilio error", code: result.code }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
