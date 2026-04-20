import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_MAP: Record<string, string> = {
  "pavers":             "Pavers",
  "concrete":           "Concrete (Driveway, Walkway, Patio)",
  "outdoor kitchen":    "Outdoor Kitchen",
  "fire feature":       "Fire Pit/Fireplace",
  "retaining wall":     "Retaining Wall",
  "pergola / pavilion": "Pergola/Pavilion",
  "pergola/pavilion":   "Pergola/Pavilion",
  "landscaping":        "Landscaping",
  "drainage":           "Drainage",
  "lighting":           "Outdoor Lighting",
  "artificial grass":   "Artificial Grass",
  "turf":               "Artificial Grass",
  "design":             "Design Services",
};

const normalizeService = (s: string): string =>
  SERVICE_MAP[s.toLowerCase().trim()] ?? s.trim();

const REFERRAL_LABEL_MAP: Record<string, string> = {
  "google":              "Google",
  "yelp":                "Yelp",
  "facebook":            "Facebook",
  "instagram":           "Instagram",
  "facebook / instagram":"Facebook / Instagram",
  "facebook/instagram":  "Facebook / Instagram",
  "angi":                "Angi",
  "angi / homeadvisor":  "Angi",
  "angi/homeadvisor":    "Angi",
  "homeadvisor":         "Angi",
  "referral":            "Referral",
  "ai":                  "AI",
  "other":               "Other",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (parseErr: any) {
    console.error("[formspree] Failed to parse request body:", parseErr.message);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[formspree] Raw payload received:", JSON.stringify(body));

  try {
    const f = body.submission ?? body.data ?? body;

    const sourceForm: string = f.source_form ?? f.form_name ?? f.page_title ?? f.page ?? f._subject ?? "Unknown Form";
    console.log(`[formspree] Processing form: "${sourceForm}"`);
    console.log("[formspree] Parsed fields (f):", JSON.stringify(f));

    // Detect referral program form
    const isReferral = !!(f.referralName ?? f["Referral Name"]);
    console.log(`[formspree] isReferral: ${isReferral}`);

    // For referral forms: new lead = referralName/referralPhone, submitter = clientName/Submitted By
    let firstName: string, lastName: string, phone: string;
    if (isReferral) {
      const refName = (f.referralName ?? f["Referral Name"] ?? "").trim();
      const parts = refName.split(/\s+/);
      firstName = parts[0] ?? "Unknown";
      lastName  = parts.slice(1).join(" ") ?? "";
      phone     = f.referralPhone ?? f["Referral Phone"] ?? "";
    } else {
      const rawName: string = f.name ?? f.full_name ?? f.clientName ?? f["Full Name"] ?? f["Submitted By"] ?? "";
      const nameParts = rawName.trim().split(/\s+/);
      firstName = f.first_name ?? f.firstName ?? nameParts[0] ?? "";
      lastName  = f.last_name  ?? f.lastName  ?? nameParts.slice(1).join(" ") ?? "";
      phone     = f.phone ?? f.phone_number ?? "";
    }

    const email: string  = f.email ?? f._replyto ?? "";
    const zip: string    = f.zip ?? f.zip_code ?? "";
    const city: string   = f.city ?? "";
    const address: string = f.address ?? "";

    console.log(`[formspree] Extracted — name: "${firstName} ${lastName}", email: "${email}", phone: "${phone}", city: "${city}"`);

    const multiRaw: string | string[] =
      body["services[]"] ?? f.services ?? f.interest ??
      f.service ?? f.primary_service ?? f.other_service ?? f.calc_type ?? "";
    const singleRaw: string = f.project_type ?? f.calc_project_type ?? "";
    const services: string[] = multiRaw
      ? (Array.isArray(multiRaw)
          ? multiRaw.filter(Boolean)
          : multiRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
        ).map(normalizeService)
      : singleRaw ? [normalizeService(singleRaw)] : [];

    console.log(`[formspree] Services: ${JSON.stringify(services)}`);

    const budget: string = f.budget ?? f.budget_range ?? f.estimated_budget ?? f.estimate_range ?? f.estimated_range_primary ?? "";
    const projectDetails: string = f.details ?? f.message ?? f.notes ?? f["Notes (Public)"] ?? f.project_details ?? f.description ?? "";
    const timeline: string = f.timeline ?? f.ideal_start_date ?? f.desired_start_date ?? "";

    const referralRaw: string = f.referral ?? f.referral_source ?? f.referrer ?? f.source ?? "";
    const referralLabel = REFERRAL_LABEL_MAP[referralRaw.toLowerCase().trim()] ?? referralRaw;

    // Referral program specific fields
    const referrerName: string  = f.referralName ?? f["Referral Name"] ?? "";
    const referrerPhone: string = f.referralPhone ?? f["Referral Phone"] ?? "";
    const submittedBy: string   = f["Submitted By"] ?? "";

    // Extra calculator / form-specific fields for note
    const squareFootage: string  = f.square_footage ?? f.estimated_sqft ?? f.calc_sqft ?? "";
    const primaryUse: string     = f.primary_use ?? "";
    const turfTier: string       = f.turf_tier ?? f.selected_tier ?? "";
    const selectedRate: string   = f.selected_rate ?? "";
    const estimateTotal: string  = f.estimate_total ?? f.calc_estimate ?? f.calc_est_range ?? f.estimated_range_primary ?? "";
    const estimateRange: string  = f.estimate_range ?? f.budget_range ?? "";
    const projectType: string    = f.project_type ?? f.calc_type ?? f.calc_project_type ?? "";
    const calcFinish: string     = f.calc_finish ?? "";
    const calcThickness: string  = f.calc_thickness_in ?? "";
    const selections: string     = f.selections ?? "";
    const verdict: string        = f.verdict ?? "";
    const optionsSummary: string = f.options_summary ?? "";

    if (!firstName && !email && !phone) {
      console.warn("[formspree] Skipped — no identifiable lead data (likely a test dispatch). Fields received:", Object.keys(f));
      return new Response(
        JSON.stringify({ ok: true, skipped: "no identifiable lead data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lead source — "Referral" for referral forms, "Website" for everything else
    const leadSourceName = isReferral ? "Referral" : "Website";
    console.log(`[formspree] Looking up lead source: "${leadSourceName}"`);
    const { data: leadSource, error: leadSourceErr } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", leadSourceName)
      .maybeSingle();

    if (leadSourceErr) console.error("[formspree] Lead source lookup error:", leadSourceErr.message);

    // Fallback to Website if Referral not found
    let resolvedLeadSource = leadSource;
    if (!resolvedLeadSource && isReferral) {
      console.warn("[formspree] 'Referral' lead source not found — falling back to Website");
      const { data: fallbackSource } = await supabase.from("lead_sources").select("id").eq("name", "Website").maybeSingle();
      resolvedLeadSource = fallbackSource;
    }

    if (!resolvedLeadSource) {
      console.error("[formspree] No lead source found in DB for:", leadSourceName);
      return new Response(
        JSON.stringify({ error: `Lead source "${leadSourceName}" not found in DB` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prospect stage
    let { data: stage } = await supabase
      .from("pipeline_stages").select("id").eq("name", "Prospect").maybeSingle();
    if (!stage) {
      console.warn("[formspree] 'Prospect' stage not found — using first stage");
      const { data: fallback } = await supabase
        .from("pipeline_stages").select("id").order("order_index", { ascending: true }).limit(1).single();
      stage = fallback;
    }

    // Insert client
    const insertPayload: Record<string, any> = {
      first_name:        firstName || "Unknown",
      last_name:         lastName  || "",
      email:             email     || null,
      phone:             phone     || null,
      zip:               zip       || null,
      city:              city      || null,
      address:           address   || null,
      lead_source_id:    resolvedLeadSource.id,
      pipeline_stage_id: stage?.id ?? null,
      status:            "prospect",
      scope_of_work:     services,
    };

    console.log("[formspree] Inserting client:", JSON.stringify(insertPayload));

    const { data: newClient, error: insertError } = await supabase
      .from("clients").insert(insertPayload).select("id").single();

    if (insertError) {
      console.error("[formspree] Client insert error:", insertError.message, insertError.details, insertError.hint);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = newClient.id;
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || phone;
    console.log(`[formspree] Client created: ${clientId} (${displayName})`);

    // Build note
    const noteParts: string[] = [];
    if (projectDetails)  noteParts.push(`Project details: ${projectDetails}`);
    if (budget)          noteParts.push(`Budget: ${budget}`);
    if (timeline)        noteParts.push(`Timeline: ${timeline}`);
    if (referralLabel)   noteParts.push(`Heard about us via: ${referralLabel}`);
    if (services.length) noteParts.push(`Services: ${services.join(", ")}`);
    if (squareFootage)   noteParts.push(`Square footage: ${squareFootage}`);
    if (primaryUse)      noteParts.push(`Primary use: ${primaryUse}`);
    if (turfTier)        noteParts.push(`Tier selected: ${turfTier}`);
    if (selectedRate)    noteParts.push(`Rate per sqft: ${selectedRate}`);
    if (estimateTotal)   noteParts.push(`Estimate total: ${estimateTotal}`);
    if (estimateRange)   noteParts.push(`Estimate range: ${estimateRange}`);
    if (projectType)     noteParts.push(`Project type: ${projectType}`);
    if (calcFinish)      noteParts.push(`Concrete finish: ${calcFinish}`);
    if (calcThickness)   noteParts.push(`Thickness: ${calcThickness}"`);
    if (selections)      noteParts.push(`Selections: ${selections}`);
    if (verdict)         noteParts.push(`Recommendation: ${verdict}`);
    if (optionsSummary)  noteParts.push(`Options summary: ${optionsSummary}`);
    // Referral program specific
    if (isReferral) {
      if (referrerName)  noteParts.push(`Referred by: ${referrerName}`);
      if (referrerPhone) noteParts.push(`Referrer phone: ${referrerPhone}`);
      if (submittedBy)   noteParts.push(`Form submitted by: ${submittedBy}`);
    }

    if (noteParts.length) {
      console.log("[formspree] Inserting note with parts:", noteParts.length);
      const { error: noteError } = await supabase.from("client_notes").insert({
        client_id:           clientId,
        content:             noteParts.join("\n"),
        is_system_generated: true,
        action_type:         "lead_received",
      });
      if (noteError) console.error("[formspree] Note insert error:", noteError.message, noteError.details);
    }

    // Activity log
    const { error: activityErr } = await supabase.from("activity_log").insert({
      client_id:   clientId,
      action_type: "lead_received",
      description: `Lead received from ${sourceForm}${services.length ? ` — ${services.join(", ")}` : ""}`,
    });
    if (activityErr) console.error("[formspree] Activity log error:", activityErr.message);

    // Bell notification
    const { error: notifErr } = await supabase.from("notifications").insert({
      type:     "new_lead",
      title:    isReferral ? "New Referral Lead" : "New Website Lead",
      message:  `${displayName}${services.length ? ` — ${services[0]}` : ""}`,
      link:     `/clients/${clientId}`,
      metadata: { source: "formspree", form: sourceForm, client_id: clientId },
    });
    if (notifErr) console.error("[formspree] Notification insert error:", notifErr.message);

    console.log(`[formspree] ✓ Done — client ${clientId} created from "${sourceForm}"`);

    return new Response(
      JSON.stringify({ ok: true, client_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[formspree] Unhandled exception:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
