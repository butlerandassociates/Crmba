import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTAKE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSed6YY4dNn7yn_U7IakCfyTdQpNowwi48e1p3S9vgU7iKR7Rg/viewform?usp=header";

function replaceVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{${key}}`, val),
    template
  );
}

function buildHtml(body: string, intakeFormUrl: string, includeIntakeForm: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 5px 0;">Butler &amp; Associates Construction, Inc.</p>
            <p style="font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;font-weight:300;color:#fff;margin:0;line-height:1.3;">Crafted with intention. Built to last.</p>
          </td>
          <td style="vertical-align:middle;text-align:right;width:60px;">
            <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="48" style="height:48px;width:auto;display:block;margin-left:auto;" />
          </td>
        </tr>
      </table>
    </div>

    <!-- Gold rule -->
    <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>

    <!-- Body -->
    <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
      <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">
        Message from Butler &amp; Associates
      </p>
      <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;white-space:pre-line;margin:0 0 28px 0;">${body}</p>

      ${includeIntakeForm ? `
      <div style="border:1px solid #E8E4DC;border-radius:6px;padding:20px 24px;margin:0 0 28px 0;background:#FAFAF8;">
        <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 8px 0;">Before Your Appointment</p>
        <p style="font-family:Inter,sans-serif;font-size:13px;color:#3A3A38;line-height:1.6;margin:0 0 16px 0;">Please take a moment to complete our intake form — it helps us prepare and make the most of your time with us.</p>
        <div style="text-align:center;">
          <a href="${intakeFormUrl}" target="_blank" style="display:inline-block;background:#0A0A0A;color:#BB984D;font-family:Inter,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:4px;">Complete Intake Form →</a>
        </div>
      </div>` : ""}

      <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      appointment_type_id,
      client_id,
      client_name,
      client_email,
      client_address,
      date,
      time,
      meet_link,
    } = await req.json();

    if (!client_email) {
      return new Response(JSON.stringify({ error: "client_email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch appointment type template
    const { data: apptType } = await supabase
      .from("appointment_types")
      .select("name, email_subject, email_body")
      .eq("id", appointment_type_id)
      .single();

    const typeName = apptType?.name ?? "Appointment";

    // Check if this is the client's first appointment
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client_id);
    const isFirstAppointment = (count ?? 0) <= 1;

    const vars: Record<string, string> = {
      client_name:     client_name ?? "Valued Client",
      date:            date ?? "",
      time:            time ?? "",
      type:            typeName,
      address:         client_address ?? "",
      intake_form_url: INTAKE_FORM_URL,
      meet_link:       meet_link ?? "",
    };

    const rawBody =
      apptType?.email_body?.trim() ||
      `Your {type} has been confirmed.\n\nDate: {date}\nTime: {time}\nLocation: {address}\n\nWe look forward to meeting with you!`;

    const bodyText = replaceVars(rawBody, vars);
    const subject  = replaceVars(
      apptType?.email_subject?.trim() || "Your {type} is Confirmed — Butler & Associates",
      vars
    );
    const html = buildHtml(bodyText, INTAKE_FORM_URL, isFirstAppointment);

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: client_email, name: client_name }] }],
        from: {
          email: "noreply@butlerconstruction.co",
          name: "Butler & Associates Construction",
        },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
