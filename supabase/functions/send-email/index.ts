import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from_name, cc, attachments, reply_to, tracking_id, client_id } = await req.json();

    console.log(`[send-email] to=${to} subject="${subject}" has_cc=${Array.isArray(cc) && cc.length > 0} has_attachments=${Array.isArray(attachments) && attachments.length > 0}`);

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "to, subject, and html are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personalization: Record<string, unknown> = {
      to: [{ email: to }],
    };
    if (Array.isArray(cc) && cc.length > 0) {
      personalization.cc = cc.map((email: string) => ({ email }));
    }

    const body: Record<string, unknown> = {
      personalizations: [personalization],
      from: {
        email: "noreply@butlerconstruction.co",
        name: from_name ?? "Butler & Associates Construction",
      },
      subject,
      content: [{ type: "text/html", value: html }],
    };

    if (reply_to) {
      body.reply_to = { email: reply_to };
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      body.attachments = attachments;
    }

    body.tracking_settings = { click_tracking: { enable: false } };

    // Open tracking (Jonathan, Oct 19 2026): when the CRM supplies a tracking_id, turn on open tracking, tag the
    // message with it so SendGrid's "Opened" events come back with it, and create the email_tracking row first so
    // the row exists before any open can arrive. Never blocks the send.
    if (typeof tracking_id === "string" && UUID_RE.test(tracking_id)) {
      (body.tracking_settings as Record<string, unknown>).open_tracking = { enable: true };
      body.custom_args = { tracking_id };
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { error: trackErr } = await supabase.from("email_tracking").upsert({
          id: tracking_id,
          client_id: typeof client_id === "string" && UUID_RE.test(client_id) ? client_id : null,
          to_email: to,
          subject,
        }, { onConflict: "id", ignoreDuplicates: true });
        if (trackErr) console.warn(`[send-email] could not create email_tracking row: ${trackErr.message}`);
      } catch (trackEx) {
        console.warn(`[send-email] email_tracking setup failed: ${trackEx instanceof Error ? trackEx.message : trackEx}`);
      }
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[send-email] FAILED: SendGrid error sending to ${to} — ${error}`);
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-email] SUCCESS: email sent to ${to} subject="${subject}"`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[send-email] FAILED: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
