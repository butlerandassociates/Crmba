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
    const { code } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: "code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId     = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET")!;
    const redirectUri  = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      return new Response(
        JSON.stringify({ error: "No refresh token received. Revoke access at myaccount.google.com/permissions and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the first row id, then update only that row
    const { data: row } = await supabase
      .from("company_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.id) throw new Error("No company_settings row found");

    const { error } = await supabase
      .from("company_settings")
      .update({
        google_calendar_refresh_token: tokens.refresh_token,
        google_calendar_connected_at:  new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
