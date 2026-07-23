import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { email, first_name, last_name, role, permissions, redirect_to } = await req.json();

    console.log(`[invite-user] email=${email} role=${role} name=${[first_name, last_name].filter(Boolean).join(" ")}`);

    if (!email || !role) {
      return new Response(JSON.stringify({ error: "email and role are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate invite link without sending email (bypasses Supabase SMTP)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: redirect_to,
        data: {
          first_name: first_name ?? "",
          last_name:  last_name  ?? "",
          role,
          permissions: permissions ?? {},
        },
      },
    });

    if (error) throw error;

    const inviteLink = data.properties.action_link;
    const name = [first_name, last_name].filter(Boolean).join(" ") || email;

    // Send via SendGrid directly (same path as all other emails in the app)
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">You're invited to Butler &amp; Associates Construction</h1>
          <p style="color:#6b7280;margin:0 0 24px;font-size:15px;">Hi ${name}, you've been added as a <strong>${role.replace(/_/g, " ")}</strong>. Click the button below to set your password and get started.</p>
          <a href="${inviteLink}" style="display:inline-block;background:#111827;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Accept Invitation</a>
          <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">This link expires in 24 hours. If you didn't expect this invitation, you can ignore this email.</p>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Butler &amp; Associates Construction, Inc.</p>
      </div>
    `;

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "noreply@butlerconstruction.co", name: "Butler & Associates Construction" },
        subject: "You're invited to Butler & Associates Construction",
        content: [{ type: "text/html", value: html }],
        tracking_settings: { click_tracking: { enable: false } },
      }),
    });

    if (!sgRes.ok) {
      const sgErr = await sgRes.text();
      throw new Error(`Email delivery failed: ${sgErr}`);
    }

    console.log(`[invite-user] SUCCESS: invite sent to ${email} as ${role}`);
    return new Response(JSON.stringify({ success: true, user: data.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[invite-user] FAILED: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
