import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://crm.butlerconstruction.co","https://client.butlerconstruction.co","http://localhost:5173","https://controller.butlerconstruction.co"];

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors(req), "Content-Type": "application/json" } });
    }
    const callerClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser(authHeader.slice(7));
    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors(req), "Content-Type": "application/json" } });
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", callerUser.id).single();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...cors(req), "Content-Type": "application/json" } });
    }

    const { email, first_name, last_name, role, permissions, redirect_to } = await req.json();

    console.log(`[invite-user] email=${email} role=${role} name=${[first_name, last_name].filter(Boolean).join(" ")}`);

    if (!email || !role) {
      return new Response(JSON.stringify({ error: "email and role are required." }), {
        status: 400,
        headers: { ...cors(req), "Content-Type": "application/json" },
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
      headers: { ...cors(req), "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[invite-user] FAILED: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  }
});
