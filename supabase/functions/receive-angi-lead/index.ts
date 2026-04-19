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

    // Angi webhook payload — normalize various field name formats
    const customer = body.customer ?? body;

    const firstName: string =
      customer.firstName ?? customer.first_name ?? (customer.name ?? "").split(" ")[0] ?? "";
    const lastName: string =
      customer.lastName ?? customer.last_name ?? (customer.name ?? "").split(" ").slice(1).join(" ") ?? "";
    const phone: string =
      customer.phone ?? customer.phoneNumber ?? customer.phone_number ?? "";
    const email: string =
      customer.email ?? customer.emailAddress ?? "";

    const addr = customer.address ?? {};
    const address: string = addr.street ?? addr.address ?? customer.address_street ?? "";
    const city: string    = addr.city    ?? customer.city    ?? "";
    const state: string   = addr.state   ?? customer.state   ?? "";
    const zip: string     = addr.zip     ?? addr.postalCode  ?? customer.zip ?? "";

    const serviceRequested: string =
      body.serviceType ?? body.service_type ?? body.category ?? body.jobType ?? "";
    const notes: string =
      body.jobDescription ?? body.job_description ?? body.message ?? body.notes ?? "";

    const leadId: string = body.leadId ?? body.lead_id ?? body.id ?? "";

    if (!firstName && !phone && !email) {
      return new Response(
        JSON.stringify({ error: "No identifiable lead data in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve Angi lead source ID
    const { data: leadSource } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", "Angi")
      .single();

    if (!leadSource) {
      return new Response(
        JSON.stringify({ error: "Angi lead source not found in DB" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always Prospect stage — fallback to first stage if Prospect not found
    let { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("name", "Prospect")
      .maybeSingle();
    if (!stage) {
      const { data: fallback } = await supabase
        .from("pipeline_stages")
        .select("id")
        .order("order_index", { ascending: true })
        .limit(1)
        .single();
      stage = fallback;
    }

    // Prevent duplicate leads — check by Angi lead ID in metadata or by phone+email
    if (leadId) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("angi_lead_id", leadId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, duplicate: true, client_id: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the prospect client
    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        first_name:       firstName || "Unknown",
        last_name:        lastName || "",
        email:            email    || null,
        phone:            phone    || null,
        address:          address  || null,
        city:             city     || null,
        state:            state    || null,
        zip:              zip      || null,
        lead_source_id:   leadSource.id,
        pipeline_stage_id: stage?.id ?? null,
        status:           "prospect",
        scope_of_work:    serviceRequested ? [serviceRequested] : [],
        angi_lead_id:     leadId || null,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = newClient.id;
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || phone || email;

    // Add activity log entry
    await supabase.from("activity_log").insert({
      client_id:   clientId,
      action_type: "lead_received",
      description: `Lead received from Angi${serviceRequested ? ` — ${serviceRequested}` : ""}`,
    });

    // Add note with raw details if provided
    if (notes) {
      await supabase.from("client_notes").insert({
        client_id:            clientId,
        content:              `Angi lead note: ${notes}`,
        is_system_generated:  true,
        action_type:          "lead_received",
      });
    }

    // Create bell notification for the team
    await supabase.from("notifications").insert({
      type:     "new_lead",
      title:    "New Angi Lead",
      message:  `${displayName}${serviceRequested ? ` — ${serviceRequested}` : ""}`,
      link:     `/clients/${clientId}`,
      metadata: { source: "angi", client_id: clientId, lead_id: leadId },
    });

    return new Response(
      JSON.stringify({ ok: true, client_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
