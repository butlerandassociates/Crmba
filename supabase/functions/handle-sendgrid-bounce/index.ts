import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SendGrid Event Webhook — Bounce Handler
 *
 * SendGrid calls this endpoint when an email bounces or is dropped.
 * We log the failure to the client's activity log so the team knows
 * which client emails are invalid.
 *
 * Setup in SendGrid:
 *   Mail Settings → Event Webhook → HTTP POST URL:
 *   https://yohhdvwifjgarnaxrbev.supabase.co/functions/v1/handle-sendgrid-bounce
 *   Enable: Bounces, Blocks, Dropped, Deferred (optional)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Event types from SendGrid that indicate delivery failure
const FAILURE_EVENTS = new Set(["bounce", "blocked", "dropped", "deferred"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SendGrid sends POST with JSON array of events
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const events = await req.json() as Array<{
      event:  string;
      email:  string;
      reason?: string;
      type?:  string;  // bounce type: "bounce" | "blocked"
      timestamp?: number;
    }>;

    if (!Array.isArray(events)) {
      return new Response(JSON.stringify({ error: "Expected array of events" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const failures = events.filter((e) => FAILURE_EVENTS.has(e.event));
    if (failures.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_failure_events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ email: string; logged: boolean; clientId?: string }> = [];

    for (const evt of failures) {
      const email = evt.email?.toLowerCase().trim();
      if (!email) continue;

      // Find client(s) with this email
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .ilike("email", email);

      if (!clients || clients.length === 0) {
        results.push({ email, logged: false });
        continue;
      }

      const reason    = evt.reason ?? "No reason provided by mail server";
      const eventType = evt.event; // bounce / blocked / dropped / deferred

      const label: Record<string, string> = {
        bounce:   "Email hard bounced",
        blocked:  "Email blocked by recipient server",
        dropped:  "Email dropped",
        deferred: "Email delivery deferred (temporary issue)",
      };
      const description = `${label[eventType] ?? "Email delivery failed"} for address ${email}: ${reason}`;

      for (const client of clients) {
        await supabase.from("activity_log").insert({
          client_id:   client.id,
          action_type: "email_bounced",
          description,
          created_at:  new Date().toISOString(),
        });
        results.push({ email, logged: true, clientId: client.id });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("handle-sendgrid-bounce error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
