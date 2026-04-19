import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize website form service checkboxes → DB scope_of_work names
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
};

const normalizeService = (s: string): string =>
  SERVICE_MAP[s.toLowerCase().trim()] ?? s.trim();

// Map "How did you hear about us" form values → display label for note
// Jonathan confirmed: Formspree leads are always attributed to "Website" in CRM.
// We store the referral answer in a note for marketing context only.
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

  try {
    const body = await req.json();


    // Formspree wraps fields in body.data — fall back to body itself for simple webhooks
    const f = body.submission ?? body.data ?? body;

    // Field names confirmed from actual export: name, phone, email, service, services[],
    // budget, timeline, referral, referral_source, details, zip, first_name, last_name, interest

    // Name — use separate first/last if sent, otherwise split full name
    const rawName: string =
      f.name ?? f.full_name ?? f.clientName ?? f["Full Name"] ?? "";
    const nameParts = rawName.trim().split(/\s+/);
    const firstName: string = f.first_name ?? nameParts[0] ?? "";
    const lastName: string  = f.last_name  ?? nameParts.slice(1).join(" ") ?? "";

    const email: string =
      f.email ?? f._replyto ?? "";

    const phone: string =
      f.phone ?? f.phone_number ?? "";

    const zip: string =
      f.zip ?? f.zip_code ?? "";

    // Services — actual field names: "service" (single), "services[]" (checkboxes), "interest"
    const rawServices: string | string[] =
      body["services[]"] ?? f.services ?? f.interest ??
      f.service ?? f.primary_service ?? f.other_service ?? "";
    const services: string[] = (Array.isArray(rawServices)
      ? rawServices.filter(Boolean)
      : rawServices ? rawServices.split(",").map((s: string) => s.trim()).filter(Boolean) : []
    ).map(normalizeService);

    const budget: string =
      f.budget ?? f.budget_range ?? f.estimated_budget ?? "";

    // Project details — actual field name is "details" (confirmed from export)
    const projectDetails: string =
      f.details ?? f.message ?? f.notes ??
      f.project_details ?? f.description ?? "";

    // Timeline — "ASAP", "1-3 months" etc — save in note
    const timeline: string =
      f.timeline ?? f.desired_start_date ?? "";

    const referralRaw: string =
      f.referral ?? f.referral_source ?? f.referrer ?? f.source ?? "";
    const referralLabel = REFERRAL_LABEL_MAP[referralRaw.toLowerCase().trim()] ?? referralRaw;

    // Require at minimum a name or contact info
    if (!firstName && !email && !phone) {
      return new Response(
        JSON.stringify({ error: "No identifiable lead data in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Always "Website" per Jonathan — all Formspree forms are website leads
    const { data: leadSource } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", "Website")
      .single();

    if (!leadSource) {
      return new Response(
        JSON.stringify({ error: "Website lead source not found in DB" }),
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


    // Deduplicate — same email submitted twice
    if (email) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", email)
        .eq("lead_source_id", leadSource.id)
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
        first_name:        firstName || "Unknown",
        last_name:         lastName  || "",
        email:             email     || null,
        phone:             phone     || null,
        zip:               zip       || null,
        lead_source_id:    leadSource.id,
        pipeline_stage_id: stage?.id ?? null,
        status:            "prospect",
        scope_of_work:     services,
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
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || phone;

    // Build a note with all context from the form
    const noteParts: string[] = [];
    if (projectDetails)  noteParts.push(`Project details: ${projectDetails}`);
    if (budget)          noteParts.push(`Budget: ${budget}`);
    if (timeline)        noteParts.push(`Timeline: ${timeline}`);
    if (referralLabel)   noteParts.push(`Heard about us via: ${referralLabel}`);
    if (services.length) noteParts.push(`Services: ${services.join(", ")}`);

    if (noteParts.length) {
      const { error: noteError } = await supabase.from("client_notes").insert({
        client_id:           clientId,
        content:             noteParts.join("\n"),
        is_system_generated: true,
        action_type:         "lead_received",
      });
      if (noteError) console.error("NOTE INSERT ERROR:", noteError.message);
    }

    // Activity log
    await supabase.from("activity_log").insert({
      client_id:   clientId,
      action_type: "lead_received",
      description: `Lead received from website form${services.length ? ` — ${services.join(", ")}` : ""}`,
    });

    // Bell notification
    await supabase.from("notifications").insert({
      type:     "new_lead",
      title:    "New Website Lead",
      message:  `${displayName}${services.length ? ` — ${services[0]}` : ""}`,
      link:     `/clients/${clientId}`,
      metadata: { source: "formspree", client_id: clientId },
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
