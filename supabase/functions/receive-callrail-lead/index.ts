import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tracking number (digits only) → CRM lead source name
const TRACKING_NUMBER_MAP: Record<string, string> = {
  "2569738416": "Facebook",
  "9388676601": "Google Ads",
  "2566175497": "Google",
  "2568046283": "Instagram",
  "2564641523": "Website",
  "2563842964": "Yelp",
};

// Strip all non-digit characters, then remove leading US country code 1 from 11-digit numbers
const digitsOnly = (s: string): string => {
  const d = s.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (parseErr: any) {
    console.error("[callrail] Failed to parse request body:", parseErr.message);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[callrail] Raw payload received:", JSON.stringify(body));

  try {
    // CallRail wraps call data at top level
    const trackingRaw: string = body.tracking_phone_number ?? body.tracking_number ?? "";
    const trackingDigits = digitsOnly(trackingRaw);

    console.log(`[callrail] Tracking number: "${trackingRaw}" → digits: "${trackingDigits}"`);

    const leadSourceName = TRACKING_NUMBER_MAP[trackingDigits];
    if (!leadSourceName) {
      console.warn(`[callrail] Unknown tracking number "${trackingDigits}" — not in map. Skipping.`);
      return new Response(
        JSON.stringify({ ok: true, skipped: `unknown tracking number: ${trackingRaw}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[callrail] Mapped to lead source: "${leadSourceName}"`);

    // Caller info — CallRail uses customer_* in JSON body, caller* as legacy aliases
    const callerPhone: string = body.customer_phone_number ?? body.callernum ?? body.caller_phone_number ?? body.caller_number ?? "";
    const callerName: string  = body.customer_name ?? body.callername ?? body.caller_name ?? "";
    const callerCity: string  = body.customer_city ?? body.callercity ?? body.caller_city ?? "";
    const callerState: string = body.customer_state ?? body.callerstate ?? body.caller_state ?? "";
    const callerZip: string   = body.zip_code ?? body.caller_zip ?? "";

    // Call details
    const callId: string        = body.id ?? body.resource_id ?? body.call_id ?? "";
    const answered: boolean     = body.answered === true || body.answered === "true";
    const isVoicemail: boolean  = body.voicemail === true || body.voicemail === "true";
    const duration: number      = parseInt(body.duration ?? "0", 10);
    const recordingUrl: string  = body.recording ?? body.recording_url ?? "";
    const startTime: string     = body.start_time ?? body.created_at ?? new Date().toISOString();
    const isFirstCall: boolean  = body.first_call === true || body.first_call === "true";

    const callType = isVoicemail ? "voicemail" : answered ? "answered" : "missed";
    console.log(`[callrail] Call type: ${callType}, duration: ${duration}s, first call: ${isFirstCall}`);
    console.log(`[callrail] Caller: phone="${callerPhone}", name="${callerName}", city="${callerCity}", state="${callerState}"`);

    if (!callerPhone) {
      console.error("[callrail] No caller phone number in payload — cannot create lead");
      return new Response(
        JSON.stringify({ error: "No caller phone number in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lead source lookup
    const { data: leadSource, error: leadSourceErr } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("name", leadSourceName)
      .maybeSingle();

    if (leadSourceErr) console.error("[callrail] Lead source lookup error:", leadSourceErr.message);

    if (!leadSource) {
      console.error(`[callrail] Lead source "${leadSourceName}" not found in DB`);
      return new Response(
        JSON.stringify({ error: `Lead source "${leadSourceName}" not found in DB` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prospect stage
    let { data: stage } = await supabase
      .from("pipeline_stages").select("id").eq("name", "Prospect").maybeSingle();
    if (!stage) {
      console.warn("[callrail] 'Prospect' stage not found — using first stage");
      const { data: fallback } = await supabase
        .from("pipeline_stages").select("id").order("order_index", { ascending: true }).limit(1).single();
      stage = fallback;
    }

    // Always create new client record per call (Jonathan confirmed Apr 20 2026)
    const nameParts = callerName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Unknown";
    const lastName  = nameParts.slice(1).join(" ") || "";

    const insertPayload: Record<string, any> = {
      first_name:        firstName,
      last_name:         lastName,
      phone:             callerPhone,
      city:              callerCity  || null,
      state:             callerState || null,
      zip:               callerZip   || null,
      lead_source_id:    leadSource.id,
      pipeline_stage_id: stage?.id ?? null,
      status:            "prospect",
    };

    console.log("[callrail] Inserting new client:", JSON.stringify(insertPayload));

    const { data: newClient, error: insertError } = await supabase
      .from("clients").insert(insertPayload).select("id").single();

    if (insertError) {
      console.error("[callrail] Client insert error:", insertError.message, insertError.details, insertError.hint);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = newClient.id;
    const isNewClient = true;
    console.log(`[callrail] New client created: ${clientId}`);

    // Build call note
    const durationLabel = duration > 0
      ? `${Math.floor(duration / 60)}m ${duration % 60}s`
      : "unknown duration";

    const noteParts: string[] = [
      `Call type: ${callType}`,
      `Duration: ${durationLabel}`,
      `Tracking number: ${trackingRaw} (${leadSourceName})`,
      `Call ID: ${callId}`,
    ];
    if (callerCity || callerState) noteParts.push(`Caller location: ${[callerCity, callerState].filter(Boolean).join(", ")}`);
    if (recordingUrl) noteParts.push(`Recording: ${recordingUrl}`);

    const { error: noteError } = await supabase.from("client_notes").insert({
      client_id:           clientId,
      content:             noteParts.join("\n"),
      is_system_generated: true,
      action_type:         "lead_received",
    });
    if (noteError) console.error("[callrail] Note insert error:", noteError.message, noteError.details);

    // Activity log
    const activityDesc = `New ${leadSourceName} call — ${callType} (${durationLabel})`;

    const { error: activityErr } = await supabase.from("activity_log").insert({
      client_id:   clientId,
      action_type: "lead_received",
      description: activityDesc,
    });
    if (activityErr) console.error("[callrail] Activity log error:", activityErr.message);

    // Bell notification — only for new clients or missed/voicemail
    if (isNewClient || !answered) {
      const displayName = callerName.trim() || callerPhone;
      const { error: notifErr } = await supabase.from("notifications").insert({
        type:    "new_lead",
        title:   isNewClient ? `New ${leadSourceName} Call` : `${callType === "missed" ? "Missed Call" : "Voicemail"} — ${leadSourceName}`,
        message: `${displayName} · ${callType} · ${durationLabel}`,
        link:    `/clients/${clientId}`,
        metadata: { source: "callrail", call_id: callId, call_type: callType, client_id: clientId },
      });
      if (notifErr) console.error("[callrail] Notification insert error:", notifErr.message);
    }

    console.log(`[callrail] ✓ Done — client ${clientId} (${isNewClient ? "new" : "existing"}), call type: ${callType}`);

    return new Response(
      JSON.stringify({ ok: true, client_id: clientId, new_client: isNewClient, call_type: callType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[callrail] Unhandled exception:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
