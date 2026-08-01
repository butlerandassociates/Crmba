import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

// Map LSA service type strings → CRM scope_of_work labels
const SERVICE_MAP: Record<string, string> = {
  "pavers":             "Pavers",
  "paver":              "Pavers",
  "concrete":           "Concrete (Driveway, Walkway, Patio)",
  "driveway":           "Concrete (Driveway, Walkway, Patio)",
  "walkway":            "Concrete (Driveway, Walkway, Patio)",
  "patio":              "Concrete (Driveway, Walkway, Patio)",
  "outdoor kitchen":    "Outdoor Kitchen",
  "fire pit":           "Fire Pit/Fireplace",
  "fireplace":          "Fire Pit/Fireplace",
  "fire feature":       "Fire Pit/Fireplace",
  "retaining wall":     "Retaining Wall",
  "pergola":            "Pergola/Pavilion",
  "pavilion":           "Pergola/Pavilion",
  "landscaping":        "Landscaping",
  "drainage":           "Drainage",
  "lighting":           "Outdoor Lighting",
  "outdoor lighting":   "Outdoor Lighting",
  "artificial grass":   "Artificial Grass",
  "turf":               "Artificial Grass",
  "sod":                "Sod",
  "design":             "Design Services",
};

const normalizeService = (s: string): string => {
  const lower = s.toLowerCase().trim();
  for (const [key, label] of Object.entries(SERVICE_MAP)) {
    if (lower.includes(key)) return label;
  }
  return s.trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const incomingSecret = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (parseErr: any) {
    console.error("[lsa] Failed to parse request body:", parseErr.message);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[lsa] Raw payload received:", JSON.stringify(body));

  try {
    // ── Field extraction ──────────────────────────────────────────────
    // Zapier sends: message = full Gmail Body Plain text
    // We parse Name / Location / Service type / Message from the LSA email body.
    // LSA email format:
    //   Name                    Location
    //   Potential Customer      Guntersville
    //   Service type
    //   driveway landscaping
    //   Message
    //   I would like to know...

    const bodyText: string = (body.message ?? body.body ?? body.details ?? "").trim();
    const phone: string    = (body.phone ?? body.phone_number ?? "").trim();
    const email: string    = (body.email ?? "").trim();

    // Parse Name — line after "Name" label (before Location on same line or next line)
    const nameMatch    = bodyText.match(/\bName\b[\s\S]*?\n([^\n]+)/i);
    const rawNameLine  = nameMatch?.[1]?.trim() ?? "";
    // LSA sometimes puts Name and Location on same line separated by whitespace
    // e.g. "Potential Customer      Guntersville"
    // Split on 2+ spaces to separate them
    const nameParts2   = rawNameLine.split(/\s{2,}/);
    const rawName      = nameParts2[0]?.trim() ?? (body.name ?? "");
    const nameParts    = rawName.split(/\s+/);
    const firstName    = nameParts[0]?.trim() || "Potential Customer";
    const lastName     = nameParts.slice(1).join(" ").trim();

    // Parse Location — on same line as name (after 2+ spaces) or line after "Location" label
    let location = nameParts2[1]?.trim() ?? "";
    if (!location) {
      const locMatch = bodyText.match(/\bLocation\b[\s\S]*?\n([^\n]+)/i);
      location = locMatch?.[1]?.trim() ?? (body.location ?? "");
    }

    // Parse Service type — line after "Service type" label
    const serviceMatch = bodyText.match(/Service\s+type[\s\S]*?\n([^\n]+)/i);
    const serviceRaw   = serviceMatch?.[1]?.trim() ?? (body.service_type ?? body.service ?? "");

    // Parse Message — everything after "Message" label until end or next section
    const msgMatch   = bodyText.match(/\bMessage\b\s*\n([\s\S]+?)(?:\n\s*\n|\nTo connect|$)/i);
    const customerMessage = msgMatch?.[1]?.trim() ?? "";

    // Normalize service → scope_of_work array
    const services: string[] = serviceRaw
      ? [normalizeService(serviceRaw)]
      : [];

    console.log(`[lsa] Parsed — name: "${firstName} ${lastName}", location: "${location}", service: "${serviceRaw}" → ${JSON.stringify(services)}, message: "${customerMessage.slice(0, 80)}"`);

    // Skip if no identifiable data
    if (!firstName && !email && !phone) {
      console.warn("[lsa] Skipped — no identifiable lead data");
      return new Response(
        JSON.stringify({ ok: true, skipped: "no identifiable lead data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Deduplication (10-minute window) — only if we have a contact identifier ──
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    if (email || phone) {
      let dupQuery = supabase
        .from("clients")
        .select("id")
        .gte("created_at", tenMinutesAgo)
        .limit(1);

      if (email) dupQuery = dupQuery.eq("email", email);
      else       dupQuery = dupQuery.eq("phone", phone);

      const { data: existing } = await dupQuery.maybeSingle();
      if (existing) {
        console.log(`[lsa] Duplicate detected — client ${existing.id} already created within 10 min. Skipping.`);
        return new Response(
          JSON.stringify({ ok: true, skipped: "duplicate", existing_id: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Lead source: "Google LSA" ─────────────────────────────────────
    const { data: leadSource, error: leadSourceErr } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", "Google LSA")
      .maybeSingle();

    if (leadSourceErr) console.error("[lsa] Lead source lookup error:", leadSourceErr.message);

    if (!leadSource) {
      console.error("[lsa] 'Google LSA' lead source not found in DB");
      return new Response(
        JSON.stringify({ error: "'Google LSA' lead source not found in DB" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Pipeline stage: "Prospect" ────────────────────────────────────
    let { data: stage } = await supabase
      .from("pipeline_stages").select("id").eq("name", "Prospect").maybeSingle();
    if (!stage) {
      const { data: fallback } = await supabase
        .from("pipeline_stages").select("id").order("order_index", { ascending: true }).limit(1).single();
      stage = fallback;
    }

    // ── Insert client ─────────────────────────────────────────────────
    const insertPayload: Record<string, any> = {
      first_name:        firstName || "Unknown",
      last_name:         lastName  || "",
      email:             email     || null,
      phone:             phone     || null,
      city:              location  || null,
      lead_source_id:    leadSource.id,
      pipeline_stage_id: stage?.id ?? null,
      status:            "prospect",
      scope_of_work:     services.length > 0 ? services : null,
      lead_form_data:    {
        source_form:  "Google LSA",
        ...(services.length && { services }),
        ...(location   && { location }),
        ...(customerMessage && { details: customerMessage }),
      },
    };

    console.log("[lsa] Inserting client:", JSON.stringify(insertPayload));

    const { data: newClient, error: insertError } = await supabase
      .from("clients").insert(insertPayload).select("id").single();

    if (insertError) {
      console.error("[lsa] Client insert error:", insertError.message, insertError.details);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId   = newClient.id;
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || email || phone;
    console.log(`[lsa] Client created: ${clientId} (${displayName})`);

    // ── Client note ───────────────────────────────────────────────────
    const noteParts: string[] = [];
    if (customerMessage) noteParts.push(`Message: ${customerMessage}`);
    if (serviceRaw) noteParts.push(`Service requested: ${serviceRaw}`);
    if (location)   noteParts.push(`Location: ${location}`);

    if (noteParts.length) {
      const { error: noteError } = await supabase.from("client_notes").insert({
        client_id:           clientId,
        content:             noteParts.join("\n"),
        is_system_generated: true,
        action_type:         "lead_received",
      });
      if (noteError) console.error("[lsa] Note insert error:", noteError.message);
    }

    // ── Activity log ──────────────────────────────────────────────────
    const { error: activityErr } = await supabase.from("activity_log").insert({
      client_id:   clientId,
      action_type: "lead_received",
      description: `Lead received from Google LSA${services.length ? ` — ${services.join(", ")}` : ""}`,
    });
    if (activityErr) console.error("[lsa] Activity log error:", activityErr.message);

    // ── Bell notification ─────────────────────────────────────────────
    const { error: notifErr } = await supabase.from("notifications").insert({
      type:     "new_lead",
      title:    "New Google LSA Lead",
      message:  `${displayName}${services.length ? ` — ${services[0]}` : ""}`,
      link:     `/clients/${clientId}`,
      metadata: { source: "google_lsa", client_id: clientId },
    });
    if (notifErr) console.error("[lsa] Notification insert error:", notifErr.message);

    console.log(`[lsa] ✓ Done — client ${clientId} created from Google LSA`);

    return new Response(
      JSON.stringify({ ok: true, client_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[lsa] Unhandled exception:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
