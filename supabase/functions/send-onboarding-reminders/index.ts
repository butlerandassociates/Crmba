import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const JONATHAN_EMAIL   = "jonathan@butlerconstruction.co";
const THOMAS_EMAIL     = "info@butlerconstruction.co";
const CRM_URL          = Deno.env.get("CRM_BASE_URL") ?? "https://crm.butlerconstruction.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        cc: [{ email: JONATHAN_EMAIL }, { email: THOMAS_EMAIL }].filter(e => e.email !== to),
      }],
      from: { email: "noreply@butlerconstruction.co", name: "Butler & Associates Construction" },
      subject,
      content: [{ type: "text/html", value: html }],
      tracking_settings: { click_tracking: { enable: false } },
    }),
  });
  if (!res.ok) console.error("[onboarding-reminders] SendGrid error:", await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optional: if called with { user_id } in the body it's a manual nudge —
    // send to that one person immediately, bypass the 3-day cooldown check.
    let nudgeUserId: string | null = null;
    try {
      const body = await req.json();
      nudgeUserId = body?.user_id ?? null;
    } catch { /* no body or not JSON — normal cron run */ }

    // ── 1. Get all active programs ──────────────────────────────────────────
    const { data: programs } = await supabase
      .from("onboarding_programs")
      .select("id, name")
      .eq("is_active", true);

    let totalSent = 0;
    let totalSkipped = 0;

    for (const program of programs ?? []) {
      // ── 2. Get module + doc counts for this program ─────────────────────
      const [modsRes, docsRes] = await Promise.all([
        supabase.from("onboarding_modules").select("id").eq("program_id", program.id).eq("is_active", true).eq("is_published", true),
        supabase.from("onboarding_documents").select("id").eq("program_id", program.id).eq("is_active", true),
      ]);
      const moduleIds = (modsRes.data ?? []).map((m: { id: string }) => m.id);
      const docIds    = (docsRes.data ?? []).map((d: { id: string }) => d.id);
      const totalMods = moduleIds.length;
      const totalDocs = docIds.length;
      if (totalMods === 0) continue;

      const GHOST = "00000000-0000-0000-0000-000000000000";

      // ── 3. Get all active sales_rep + PM profiles with email ────────────
      // Build query — supabase-js v2 returns new objects so chain in one expression
      const profilesQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role")
        .in("role", ["sales_rep", "project_manager"])
        .eq("is_active", true);
      const { data: profiles } = nudgeUserId
        ? await profilesQuery.eq("id", nudgeUserId)
        : await profilesQuery;

      // ── 4. Bulk-load progress data for all users ─────────────────────────
      const userIds = (profiles ?? []).map((p: { id: string }) => p.id);
      if (userIds.length === 0) continue;

      const [progressRes, acksRes, attemptsRes, logsRes] = await Promise.all([
        supabase.from("onboarding_module_progress").select("user_id, module_id, status").in("module_id", moduleIds.length > 0 ? moduleIds : [GHOST]),
        supabase.from("onboarding_document_acknowledgments").select("user_id, document_id").in("document_id", docIds.length > 0 ? docIds : [GHOST]),
        supabase.from("onboarding_quiz_attempts").select("user_id, pct").eq("program_id", program.id),
        supabase.from("onboarding_reminder_logs").select("user_id, sent_at").eq("program_id", program.id).in("user_id", userIds).order("sent_at", { ascending: false }),
      ]);

      const progress = progressRes.data ?? [];
      const acks     = acksRes.data ?? [];
      const attempts = attemptsRes.data ?? [];
      const logs     = logsRes.data ?? [];

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      for (const profile of profiles ?? []) {
        if (!profile.email) { totalSkipped++; continue; }

        // Calculate overall %
        const completedMods = progress.filter((p: any) => p.user_id === profile.id && p.status === "completed").length;
        const ackedDocs     = acks.filter((a: any) => a.user_id === profile.id).length;
        const userAttempts  = attempts.filter((a: any) => a.user_id === profile.id);
        const bestPct       = userAttempts.length > 0 ? Math.max(...userAttempts.map((a: any) => Number(a.pct))) : 0;
        const quizPassed    = bestPct >= 90;
        const overallPct    = Math.round(
          (completedMods / Math.max(totalMods, 1)) * 50 +
          (ackedDocs     / Math.max(totalDocs, 1)) * 30 +
          (quizPassed ? 20 : 0)
        );

        // Already done — skip
        if (overallPct >= 100) { totalSkipped++; continue; }

        // Check last reminder date (bypassed for manual nudge)
        if (!nudgeUserId) {
          const lastLog = logs.find((l: any) => l.user_id === profile.id);
          if (lastLog && new Date(lastLog.sent_at) > threeDaysAgo) { totalSkipped++; continue; }
        }

        // Build progress summary lines
        const modLine  = `${completedMods} of ${totalMods} training modules completed`;
        const docLine  = `${ackedDocs} of ${totalDocs} documents reviewed`;
        const quizLine = userAttempts.length === 0 ? "Quiz: not started yet" : quizPassed ? `Quiz: passed (${bestPct.toFixed(0)}%)` : `Quiz: ${bestPct.toFixed(0)}% — 90% needed to pass`;

        const firstName = profile.first_name ?? "there";
        const subject   = `Reminder: Complete your Butler & Associates onboarding (${overallPct}% done)`;

        const html = emailWrapper(`
          <p style="font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">Hi ${firstName},</p>
          <p style="font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 16px 0;">
            Just a quick reminder that your onboarding training is still in progress.
            Completing it sets you up with everything you need to hit the ground running and begin generating business.
          </p>

          <!-- Progress bar -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
            <tr>
              <td style="font-size:13px;font-weight:600;color:#0A0A0A;padding-bottom:6px;">${overallPct}% complete</td>
            </tr>
            <tr>
              <td style="background:#E8E4DC;border-radius:4px;height:8px;">
                <div style="width:${overallPct}%;background:#BB984D;height:8px;border-radius:4px;"></div>
              </td>
            </tr>
          </table>

          <!-- Progress details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #E8E4DC;border-radius:6px;overflow:hidden;">
            <tr style="background:#F5F3EF;">
              <td style="padding:10px 16px;font-size:13px;color:#3A3A38;border-bottom:1px solid #E8E4DC;">📘 ${modLine}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-size:13px;color:#3A3A38;border-bottom:1px solid #E8E4DC;">📄 ${docLine}</td>
            </tr>
            <tr style="background:#F5F3EF;">
              <td style="padding:10px 16px;font-size:13px;color:#3A3A38;">✏️ ${quizLine}</td>
            </tr>
          </table>

          <div style="text-align:center;margin:28px 0;">
            <a href="${CRM_URL}/onboarding" target="_blank"
               style="display:inline-block;background:#0A0A0A;color:#BB984D;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 28px;border-radius:4px;">
              Continue Your Training →
            </a>
          </div>

          <p style="font-size:13px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
            If you have any questions, reach out to Jonathan or your manager directly.
          </p>
        `);

        const ok = await sendEmail(profile.email, subject, html);
        if (ok) {
          try {
            await supabase.from("onboarding_reminder_logs").insert({
              user_id: profile.id, program_id: program.id, email_to: profile.email, overall_pct: overallPct,
            });
          } catch { /* non-critical — don't block on log failure */ }
          totalSent++;
        } else {
          totalSkipped++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, skipped: totalSkipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[onboarding-reminders] error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
