import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://crm.butlerconstruction.co",
  "https://controller.butlerconstruction.co",
  "https://client.butlerconstruction.co",
  "http://localhost:5173",
];

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated CRM user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract real client IP — Cloudflare first, then standard proxy headers
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "";

    // Geo lookup — skip private/loopback IPs (local dev)
    let city: string | null = null;
    let country: string | null = null;
    const isPrivateIp =
      ip === "unknown" ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.");

    if (!isPrivateIp) {
      try {
        const geo = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { "User-Agent": "butler-crm/1.0" },
          signal: AbortSignal.timeout(3000),
        }).then((r) => r.json());
        city = geo.city ?? null;
        country = geo.country_name ?? null;
      } catch {
        // Geo lookup failed — log without location rather than failing the login
      }
    }

    // Use service role to read profile and insert log — bypasses RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, role, email")
      .eq("id", user.id)
      .single();

    await supabaseAdmin.from("login_logs").insert({
      user_id: user.id,
      email: user.email || profile?.email || null,
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      role: profile?.role ?? "",
      user_agent: userAgent,
      ip_address: ip !== "unknown" ? ip : null,
      city,
      country,
      event_type: "success",
    });

    console.log(`[log-login] logged user=${user.id} ip=${ip} city=${city} country=${country}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-login] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
