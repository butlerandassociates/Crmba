// Text Jonathan 1 week before the end of each month to file that month's sales tax.
// Called daily by pg_cron (migration 138). Sends only on the day that is exactly 7 days before the month's last day
// (Central time), and only once per month (sales_tax_filing_reminders.sms_sent_at). Skips if already marked as filed.
//
// Body (all optional, for testing):  { "dry_run": true, "date": "2026-11-23" }
//   dry_run  -> returns what it WOULD send, sends nothing, writes nothing
//   date     -> pretend today is this date (only honoured together with dry_run)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_SID   = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM  = Deno.env.get("TWILIO_PHONE_NUMBER")!;
// Jonathan's number (his request, Nov 18 2026). Override with a function secret if it ever changes.
const REMIND_PHONE = Deno.env.get("SALES_TAX_REMINDER_PHONE") ?? "+18588051551";
const CRM_URL      = "https://client.butlerconstruction.co/admin";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_BEFORE_MONTH_END = 7; // keep in step with src/app/utils/sales-tax-reminder.ts

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function todayCentral(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function windowStart(year: number, month0: number): string {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month0, lastDay - DAYS_BEFORE_MONTH_END));
  return d.toISOString().slice(0, 10);
}

async function sendSms(to: string, body: string): Promise<void> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio error: ${await res.text()}`);
}

Deno.serve(async (req) => {
  try {
    const input = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = input?.dry_run === true;
    const today: string = dryRun && /^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? "") ? input.date : todayCentral();
    const [y, m] = today.split("-").map(Number);
    const month0 = m - 1;

    if (today !== windowStart(y, month0)) {
      return json({ sent: false, reason: "not the reminder day", today, reminderDay: windowStart(y, month0) });
    }

    const period = `${y}-${String(m).padStart(2, "0")}`;
    const label = `${MONTHS[month0]} ${y}`;
    const message =
      `Butler & Associates: reminder - ${label} sales tax is due to be filed (Alabama My Taxes). ` +
      `Totals are in the Sales Tax Tracker: ${CRM_URL} (Admin Portal > Reports). ` +
      `Mark it as filed in the CRM banner once done.`;

    if (dryRun) return json({ sent: false, dryRun: true, today, period, to: REMIND_PHONE, message });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error } = await supabase
      .from("sales_tax_filing_reminders").select("sms_sent_at, dismissed_at").eq("period", period).maybeSingle();
    if (error) throw error;
    if (row?.sms_sent_at) return json({ sent: false, reason: "already sent", period });
    if (row?.dismissed_at) return json({ sent: false, reason: "already marked as filed", period });

    await sendSms(REMIND_PHONE, message);
    const { error: upErr } = await supabase
      .from("sales_tax_filing_reminders")
      .upsert({ period, sms_sent_at: new Date().toISOString() }, { onConflict: "period" });
    if (upErr) console.error("[sales-tax-reminder] SMS sent but logging failed:", upErr.message);
    return json({ sent: true, period });
  } catch (err) {
    console.error("[sales-tax-reminder]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
