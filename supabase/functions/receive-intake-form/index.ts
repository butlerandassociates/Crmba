import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      client_id,
      email,
      name,
      phone,
      address,
      project_scope,
      project_goals,
      timeline,
      budget,
      referral_source,
      existing_features,
      decision_factors,
    } = body;

    console.log(`[receive-intake-form] client_id=${client_id} email=${email} name=${name}`);

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preserve EVERY field the intake form sends — not just the known ones — so a
    // new question added to the form is never silently dropped. Known array fields
    // are normalized; client_id is stripped (it's the row key, not form data).
    const { client_id: _omitClientId, ...restFields } = body;
    const intakeData = {
      ...restFields,
      project_goals:    Array.isArray(project_goals) ? project_goals : (project_goals ?? "").split(", ").filter(Boolean),
      decision_factors: Array.isArray(decision_factors) ? decision_factors : (decision_factors ?? "").split(", ").filter(Boolean),
    };

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        intake_form_completed:    true,
        intake_form_completed_at: new Date().toISOString(),
        intake_form_data:         intakeData,
      })
      .eq("id", client_id);

    if (updateError) {
      console.error(`[receive-intake-form] FAILED: update error — ${updateError.message}`);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
    await supabase.from("notifications").insert({
      type: "intake_form_submitted",
      title: "Intake Form Submitted",
      message: `${clientName} completed their intake form`,
      link: `/clients/${client_id}`,
      metadata: { client_id },
    });

    console.log(`[receive-intake-form] SUCCESS: intake form saved for client ${client_id}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[receive-intake-form] FAILED: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
