import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY  = Deno.env.get("SENDGRID_API_KEY")!;
const TWILIO_SID        = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN      = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM       = Deno.env.get("TWILIO_PHONE_NUMBER")!;
const PORTAL_BASE       = "https://client.butlerconstruction.co/portal";
const NOTIFY_EMAIL      = "info@butlerconstruction.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;">
      <tr>
        <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
          <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="" style="max-height:56px;width:auto;display:block;margin:0 auto 14px auto;"/>
          <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
        </td>
      </tr>
    </table>
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
      <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Message from Butler &amp; Associates</p>
      ${body}
      <p style="font-size:12px;color:#3A3A38;opacity:0.65;margin:24px 0 0;line-height:1.6;text-align:center;">
        Questions? Reach us at <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
      </p>
    </div>
    <div style="text-align:center;padding:20px 0 0;">
      <p style="font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
      <p style="font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</p>
    </div>
  </div>
</body></html>`;
}

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
  if (!res.ok) console.error("[payment-reminders] SendGrid error:", await res.text());
}

async function sendSms(to: string, body: string) {
  const e164 = toE164(to);
  if (!e164) { console.warn("[payment-reminders] invalid phone:", to); return; }
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const params = new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) console.error("[payment-reminders] Twilio error:", await res.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[send-payment-reminders] starting cron run`);

    // Today in UTC — compare against due_date (date type, no time)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const day1 = new Date(today); day1.setUTCDate(today.getUTCDate() + 1);
    const day3 = new Date(today); day3.setUTCDate(today.getUTCDate() + 3);

    const toISO = (d: Date) => d.toISOString().split("T")[0];

    // Fetch all unpaid payments due in 1 or 3 days, with client info
    const { data: payments, error } = await supabase
      .from("project_payments")
      .select(`
        id, label, amount, due_date,
        client:clients!project_payments_client_id_fkey(
          id, first_name, last_name, email, phone,
          payment_reminders_enabled, sms_opt_out
        ),
        project:projects!project_payments_project_id_fkey(
          id, name, project_manager_id
        )
      `)
      .eq("is_paid", false)
      .in("due_date", [toISO(day1), toISO(day3)]);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;

    for (const payment of payments ?? []) {
      const client = payment.client as any;
      const project = payment.project as any;

      // Skip if reminders disabled for this client
      if (!client?.payment_reminders_enabled) { skipped++; continue; }
      // Skip if no client data
      if (!client?.email && !client?.phone) { skipped++; continue; }

      const firstName = client.first_name ?? "there";
      const amount = parseFloat(payment.amount) || 0;
      const daysUntil = payment.due_date === toISO(day1) ? 1 : 3;
      const dueDateFmt = new Date(payment.due_date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });

      // Get portal token for deep link
      const { data: tokenRow } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .maybeSingle();

      const portalUrl = tokenRow
        ? `${PORTAL_BASE}/${tokenRow.token}?tab=payments`
        : PORTAL_BASE;

      // CC: Jonathan + PM
      const ccEmails: string[] = [NOTIFY_EMAIL];
      if (project?.project_manager_id) {
        try {
          const { data: pmUser } = await supabase.auth.admin.getUserById(project.project_manager_id);
          if (pmUser?.user?.email && pmUser.user.email !== NOTIFY_EMAIL) {
            ccEmails.push(pmUser.user.email);
          }
        } catch { /* non-fatal */ }
      }

      const dayLabel = daysUntil === 1 ? "tomorrow" : "in 3 days";
      const subject = `Payment reminder — ${fmt(amount)} due ${dayLabel} — Butler & Associates`;

      // Email
      if (client.email) {
        const html = emailWrapper(`
          <p style="font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 4px 0;">Hi ${firstName},</p>
          <p style="font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">
            This is a friendly reminder that your payment is due <strong>${dayLabel}</strong>.
          </p>
          <p style="font-size:15px;font-weight:600;color:#0A0A0A;margin:0 0 4px 0;">${payment.label ?? "Payment"}</p>
          <p style="font-size:14px;color:#BB984D;font-weight:600;margin:0 0 4px 0;">${fmt(amount)}</p>
          <p style="font-size:13px;color:#3A3A38;opacity:0.7;margin:0 0 20px 0;">Due: ${dueDateFmt}</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${portalUrl}" target="_blank" style="display:inline-block;background:#0A0A0A;color:#BB984D;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:4px;">View Your Portal →</a>
          </div>
          <p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
            If you have already arranged payment, please disregard this message.
          </p>
        `);
        await sendEmail(client.email, subject, html, ccEmails);
      }

      // SMS — only if client has phone AND has not opted out
      if (client.phone && !client.sms_opt_out && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
        const smsBody = `Hi ${firstName}, a friendly reminder: your payment of ${fmt(amount)} is due ${dayLabel} (${dueDateFmt}). View your portal: ${portalUrl} — Butler & Associates Construction`;
        await sendSms(client.phone, smsBody);
      }

      console.log(`[send-payment-reminders] reminder sent to client ${client.id} (${client.email}) payment=${payment.id} due_in=${daysUntil}d amount=${fmt(amount)}`);

      // Activity log stamp
      await supabase.from("activity_log").insert({
        client_id: client.id,
        action_type: "payment_reminder_sent",
        description: `Automated payment reminder sent — ${payment.label ?? "Payment"} of ${fmt(amount)} due ${dayLabel} (${dueDateFmt})`,
        performed_by: null,
      }).catch(() => {});

      sent++;
    }

    console.log(`[send-payment-reminders] SUCCESS: sent=${sent} skipped=${skipped} total=${(payments ?? []).length}`);
    return new Response(
      JSON.stringify({ success: true, sent, skipped, total: (payments ?? []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[payment-reminders] error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
