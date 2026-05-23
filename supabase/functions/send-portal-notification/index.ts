import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const PORTAL_BASE = "https://client.butlerconstruction.co/portal";
const NOTIFY_EMAIL = "info@butlerconstruction.co";

async function sendEmail(to: string, subject: string, html: string, cc: string[]) {
  const personalization: Record<string, unknown> = { to: [{ email: to }] };
  if (cc.length > 0) personalization.cc = cc.map((e) => ({ email: e }));

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [personalization],
      from: { email: "noreply@butlerconstruction.co", name: "Butler & Associates Construction" },
      subject,
      content: [{ type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false } },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[send-portal-notification] SendGrid error:", err);
  }
}

function portalButton(url: string, label: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" target="_blank" style="display:inline-block;background:#0A0A0A;color:#BB984D;font-family:Inter,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:4px;">${label} →</a>
  </div>`;
}

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <style>:root { color-scheme: light only; }</style>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;color-scheme:light;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;">
      <tr>
        <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
          <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="" style="max-height:56px;width:auto;display:block;margin:0 auto 14px auto;border:0;outline:none;" />
          <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
        </td>
      </tr>
    </table>

    <!-- Gold rule -->
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>

    <!-- Body -->
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">
        Message from Butler &amp; Associates
      </p>
      ${body}
      <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:24px 0 0 0;line-height:1.6;text-align:center;">
        Questions? Reply to this email or reach us at
        <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0 0 0;">
      <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">
        Butler &amp; Associates Construction, Inc.
      </p>
      <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">
        6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildHtml(type: string, firstName: string, portalUrl: string, payload: { title?: string; amount?: number }) {
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

  if (type === "portal_access") {
    return emailWrapper(`
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Hi ${firstName},</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 20px 0;">Your project portal is ready. You can now view your project timeline, payment schedule, documents, and field updates — all in one place.</p>
      ${portalButton(portalUrl, "Open Your Project Portal")}
      <p style="font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;opacity:0.65;margin:0;">You can return to this link at any time. Bookmark it for easy access.</p>
    `);
  }

  if (type === "proposal_ready") {
    return emailWrapper(`
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Hi ${firstName},</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">Your proposal from Butler &amp; Associates Construction is ready to review.</p>
      ${payload.title ? `<p style="font-family:Inter,sans-serif;font-size:15px;font-weight:600;color:#0A0A0A;margin:0 0 4px 0;">${payload.title}</p>` : ""}
      ${payload.amount != null ? `<p style="font-family:Inter,sans-serif;font-size:14px;color:#BB984D;font-weight:600;margin:0 0 20px 0;">Total: ${fmt(payload.amount)}</p>` : ""}
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Open your portal to review the full scope and accept or decline.</p>
      ${portalButton(portalUrl, "Review Your Proposal")}
    `);
  }

  if (type === "co_pending") {
    const amountStr = payload.amount != null ? `${payload.amount >= 0 ? "+" : ""}${fmt(payload.amount)}` : "";
    return emailWrapper(`
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Hi ${firstName},</p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">A change order on your project requires your approval before work can continue.</p>
      ${payload.title ? `<p style="font-family:Inter,sans-serif;font-size:15px;font-weight:600;color:#0A0A0A;margin:0 0 4px 0;">${payload.title}</p>` : ""}
      ${amountStr ? `<p style="font-family:Inter,sans-serif;font-size:14px;color:#BB984D;font-weight:600;margin:0 0 20px 0;">Cost Impact: ${amountStr}</p>` : ""}
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Open your portal to review the details and approve or decline.</p>
      ${portalButton(portalUrl, "Review Change Order")}
    `);
  }

  return emailWrapper(`<p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 20px 0;">You have a new update from Butler &amp; Associates Construction.</p>${portalButton(portalUrl, "Open Your Portal")}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client_id, type, title, amount, entity_id } = await req.json();

    if (!client_id || !type) {
      return new Response(JSON.stringify({ success: false, error: "client_id and type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up client email + name
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("email, first_name, last_name")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !client) {
      console.error("[send-portal-notification] client lookup failed:", clientErr?.message);
      return new Response(JSON.stringify({ success: false, error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!client.email) {
      return new Response(JSON.stringify({ success: false, error: "Client has no email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up active portal token
    const { data: tokenRow } = await supabase
      .from("client_portal_tokens")
      .select("token")
      .eq("client_id", client_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ success: false, error: "No active portal token for this client" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tabMap: Record<string, string> = {
      portal_access: "overview",
      proposal_ready: "proposals",
      co_pending: "change-orders",
    };
    const tab = tabMap[type] ?? "overview";
    const deepLink = type === "co_pending" && entity_id
      ? `${PORTAL_BASE}/${tokenRow.token}?tab=${tab}&co=${entity_id}`
      : `${PORTAL_BASE}/${tokenRow.token}?tab=${tab}`;
    const portalUrl = deepLink;

    // Look up PM email via active project (fire and forget if not found)
    const ccEmails: string[] = [NOTIFY_EMAIL];
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("project_manager_id")
        .eq("client_id", client_id)
        .eq("portal_enabled", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (project?.project_manager_id) {
        const { data: pmUser } = await supabase.auth.admin.getUserById(project.project_manager_id);
        if (pmUser?.user?.email && pmUser.user.email !== NOTIFY_EMAIL) {
          ccEmails.push(pmUser.user.email);
        }
      }
    } catch {
      // PM lookup is non-fatal
    }

    // Check if this CO was already pending_client (resend) to prefix subject with "Updated:"
    let isResend = false;
    if (type === "co_pending" && entity_id) {
      const { data: coRow } = await supabase
        .from("change_orders")
        .select("status")
        .eq("id", entity_id)
        .maybeSingle();
      isResend = coRow?.status === "pending_client";
    }

    // Build subject
    const subjects: Record<string, string> = {
      portal_access: "Your project portal is ready — Butler & Associates",
      proposal_ready: `Proposal ready to review${title ? `: ${title}` : ""} — Butler & Associates`,
      co_pending: `${isResend ? "Updated: " : ""}Change order requires your approval${title ? `: ${title}` : ""} — Butler & Associates`,
    };
    const subject = subjects[type] ?? "Update from Butler & Associates Construction";

    const html = buildHtml(type, client.first_name, portalUrl, { title, amount });
    await sendEmail(client.email, subject, html, ccEmails);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-portal-notification] unhandled:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
