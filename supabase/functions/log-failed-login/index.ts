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
    const { email } = await req.json();

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "";

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
        // Geo lookup failed — log without location
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to match profile by email so we can associate name + role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, role")
      .eq("email", email ?? "")
      .maybeSingle();

    await supabaseAdmin.from("login_logs").insert({
      user_id: profile?.id ?? null,
      email: email || null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      role: profile?.role ?? null,
      user_agent: userAgent,
      ip_address: ip !== "unknown" ? ip : null,
      city,
      country,
      event_type: "failed",
    });

    console.log(`[log-failed-login] email=${email} ip=${ip} city=${city} country=${country}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-failed-login] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
