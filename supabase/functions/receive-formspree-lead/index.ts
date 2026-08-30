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

// Every raw field key the curated logic below already consumes — used so we can
// capture "everything else" generically without duplicating these in the note.
const HANDLED_KEYS = new Set([
  "name","full_name","clientname","first_name","firstname","last_name","lastname",
  "phone","phone_number","email","zip","zip_code","city","address",
  "full name","submitted by","referral name","referral phone",
  "services","services[]","interest","service","service_interest","service_type",
  "project_interest","primary_service","other_service","calc_type","project_type","calc_project_type",
  "budget","budget_range","estimated_budget","estimate_range","estimated_range_primary",
  "details","message","notes","notes (public)","project_details","description",
  "timeline","ideal_start_date","desired_start_date",
  "referral","referral_source","referrer","source","referralname","referralphone",
  "square_footage","estimated_sqft","calc_sqft","primary_use","turf_tier","selected_tier",
  "selected_rate","estimate_total","calc_estimate","calc_est_range","calc_finish",
  "calc_thickness_in","selections","verdict","options_summary",
  "sms_consent","smsconsent","sms consent","source_form","form_name","page_title","page",
]);

// snake_case / kebab-case field key → "Title Case" for readable note labels
const prettyLabel = (key: string): string =>
  key.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim()
     .replace(/\b\w/g, (c) => c.toUpperCase());

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
      f.service ?? f.service_interest ?? f.service_type ?? f.project_interest ??
      f.primary_service ?? f.other_service ?? f.calc_type ?? "";
    const singleRaw: string = f.project_type ?? f.calc_project_type ?? "";
    let services: string[] = multiRaw
      ? (Array.isArray(multiRaw)
          ? multiRaw.filter(Boolean)
          : multiRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
        ).map(normalizeService)
      : singleRaw ? [normalizeService(singleRaw)] : [];

    // Fallback: infer service from form name or email subject if no field matched
    if (services.length === 0) {
      const inferFrom = `${sourceForm} ${f._subject ?? ""}`.toLowerCase();
      for (const [keyword, label] of Object.entries(SERVICE_MAP)) {
        if (inferFrom.includes(keyword)) { services = [label]; break; }
      }
      // Extra keywords not in SERVICE_MAP
      if (services.length === 0) {
        if (inferFrom.includes("paver"))    services = ["Pavers"];
        if (inferFrom.includes("sod"))      services = ["Sod"];
        if (inferFrom.includes("consult"))  services = [];  // generic — don't infer
      }
    }

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

    // Deduplication: skip if an identical lead was created in the last 10 minutes
    // (Formspree sometimes retries or fires multiple webhooks per submission)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let dupQuery = supabase
      .from("clients")
      .select("id")
      .gte("created_at", tenMinutesAgo)
      .limit(1);

    if (email) dupQuery = dupQuery.eq("email", email);
    else if (phone) dupQuery = dupQuery.eq("phone", phone);

    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      console.log(`[formspree] Duplicate detected — client ${existing.id} already created within 10 min. Skipping.`);
      return new Response(
        JSON.stringify({ ok: true, skipped: "duplicate", existing_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Build structured form data object for lead_form_data column
    const smsConsent: string = f.sms_consent ?? f.smsConsent ?? f["SMS Consent"] ?? "";

    // ── Capture EVERYTHING else ────────────────────────────────────────────
    // Any field the curated logic above didn't explicitly handle (e.g. a new
    // form's "vision" / "style" / "investment") is captured generically, so no
    // form data is ever silently dropped again — whatever fields a form sends.
    const extraParts: string[] = [];
    const extraFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(f)) {
      if (key.startsWith("_")) continue;                     // Formspree meta / spam honeypot
      if (HANDLED_KEYS.has(key.toLowerCase())) continue;     // already captured above
      if (val === null || val === undefined) continue;
      const display = Array.isArray(val) ? val.filter(Boolean).join(", ") : String(val).trim();
      if (!display) continue;
      extraParts.push(`${prettyLabel(key)}: ${display}`);
      extraFields[key] = val;
    }

    const leadFormData: Record<string, any> = {};
    if (sourceForm)     leadFormData.source_form  = sourceForm;
    if (services.length) leadFormData.services     = services;
    if (budget)         leadFormData.budget        = budget;
    if (timeline)       leadFormData.timeline      = timeline;
    if (referralLabel)  leadFormData.referral      = referralLabel;
    if (projectDetails) leadFormData.details       = projectDetails;
    if (smsConsent)     leadFormData.sms_consent   = smsConsent;
    Object.assign(leadFormData, extraFields);   // preserve any unmapped fields in the JSON backstop too

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
      lead_form_data:    Object.keys(leadFormData).length > 0 ? leadFormData : null,
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
    if (smsConsent)      noteParts.push(`SMS consent: ${smsConsent}`);
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

    // Everything else the form sent (captured generically — never silently dropped)
    if (extraParts.length) noteParts.push(...extraParts);

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

    // Auto-reply to the lead confirming we received their submission.
    // Applies to all Formspree forms, including Referral — confirmed by Jonathan Aug 27 2026.
    if (email) {
      const phoneLine = phone
        ? `A member of our team will contact you shortly at ${phone} to schedule your free in-person consultation.`
        : `A member of our team will contact you shortly to schedule your free in-person consultation.`;

      const autoReplyHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
      <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="56" style="height:56px;width:auto;display:block;margin:0 auto 12px auto;" />
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
    </div>
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">Hi ${firstName || "there"},</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">Thank you for your interest in Butler &amp; Associates Construction. We've received your inquiry about your Outdoor Living Space Project!</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">${phoneLine}</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 28px 0;">If you'd like to reach us sooner, call us at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a> or reply to this email.</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0;">We look forward to speaking with you.</p>
      <p style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:16px 0 0 0;">— The Butler &amp; Associates Team</p>
    </div>
  </div>
</body>
</html>`;

      try {
        const autoReplyRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({
            to: email,
            subject: "We received your request — Butler & Associates Construction",
            html: autoReplyHtml,
            from_name: "Butler & Associates Construction",
            reply_to: "info@butlerconstruction.co",
          }),
        });
        if (!autoReplyRes.ok) {
          console.error("[formspree] Auto-reply email FAILED:", await autoReplyRes.text());
        } else {
          console.log(`[formspree] Auto-reply sent to ${email}`);
          const { error: stampErr } = await supabase
            .from("clients")
            .update({ auto_reply_sent_at: new Date().toISOString() })
            .eq("id", clientId);
          if (stampErr) console.error("[formspree] Failed to record auto_reply_sent_at:", stampErr.message);
        }
      } catch (autoReplyErr: any) {
        console.error("[formspree] Auto-reply email error:", autoReplyErr.message);
      }
    } else {
      console.log("[formspree] Skipped auto-reply — no email address on this lead");
    }

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
