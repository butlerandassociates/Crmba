import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientId   = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID")!;
  const redirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI")!;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.events",
    access_type:   "offline",
    prompt:        "consent",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Response(JSON.stringify({ url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
