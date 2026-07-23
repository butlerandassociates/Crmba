import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id, new_email } = await req.json();

    console.log(`[update-user-email] user_id=${user_id} new_email=${new_email}`);

    if (!user_id || !new_email) {
      return new Response(JSON.stringify({ error: "user_id and new_email are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update email in auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: new_email,
    });
    if (authError) throw authError;

    // Update email in profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: new_email })
      .eq("id", user_id);
    if (profileError) throw profileError;

    console.log(`[update-user-email] SUCCESS: email updated for user ${user_id} to ${new_email}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[update-user-email] FAILED: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
