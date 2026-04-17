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
      .select("id")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intakeData = {
      email:             email ?? "",
      name:              name ?? "",
      phone:             phone ?? "",
      address:           address ?? "",
      project_scope:     project_scope ?? "",
      project_goals:     Array.isArray(project_goals) ? project_goals : (project_goals ?? "").split(", ").filter(Boolean),
      timeline:          timeline ?? "",
      budget:            budget ?? "",
      referral_source:   referral_source ?? "",
      existing_features: existing_features ?? "",
      decision_factors:  Array.isArray(decision_factors) ? decision_factors : (decision_factors ?? "").split(", ").filter(Boolean),
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
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
