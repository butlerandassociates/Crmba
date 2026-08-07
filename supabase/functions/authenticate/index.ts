import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://crm.butlerconstruction.co",
  "https://controller.butlerconstruction.co",
  "https://client.butlerconstruction.co",
  "http://localhost:5173",
];

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function isPrivate(ip: string): boolean {
  return (
    ip === "unknown" || ip === "127.0.0.1" || ip === "::1" ||
    ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")
  );
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  // Parse body
  let email: string, password: string;
  try {
    const body = await req.json();
    email = (body.email ?? "").trim();
    password = body.password ?? "";
    if (!email || !password) throw new Error("missing");
  } catch {
    return new Response(JSON.stringify({ error: "Missing email or password" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Real client IP — Cloudflare first, then standard proxy headers
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const userAgent = req.headers.get("user-agent") || "";

  // Admin client — bypasses RLS, can sign in as any user
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Attempt authentication
  const { data, error: authError } = await admin.auth.signInWithPassword({ email, password });

  // Best-effort geo lookup — never blocks the login
  let city: string | null = null;
  let country: string | null = null;
  if (!isPrivate(ip)) {
    try {
      const geo = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { "User-Agent": "butler-crm/1.0" },
        signal: AbortSignal.timeout(3000),
      }).then((r) => r.json());
      city = geo.city ?? null;
      country = geo.country_name ?? null;
    } catch { /* continue without geo */ }
  }

  const logBase = {
    user_agent: userAgent,
    ip_address: isPrivate(ip) ? null : ip,
    city,
    country,
  };

  // ── Failed login ────────────────────────────────────────────
  if (authError || !data?.user || !data?.session) {
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, last_name, role")
      .eq("email", email)
      .maybeSingle();

    await admin.from("login_logs").insert({
      ...logBase,
      email,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      role: profile?.role ?? null,
      event_type: "failed",
    });

    return new Response(
      JSON.stringify({ error: authError?.message || "Invalid email or password" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // ── Successful login ─────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", data.user.id)
    .single();

  const { error: logErr } = await admin.from("login_logs").insert({
    ...logBase,
    user_id: data.user.id,
    email: data.user.email,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    role: profile?.role ?? null,
    event_type: "success",
  });
  if (logErr) {
    console.error("[authenticate] login_logs insert FAILED:", JSON.stringify(logErr));
  }

  console.log(`[authenticate] ✅ user=${data.user.id} ip=${ip} ${city ? `${city}, ${country}` : "no-geo"}`);

  return new Response(
    JSON.stringify({ session: data.session, user: data.user }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
