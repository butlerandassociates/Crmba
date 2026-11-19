// Monthly sales-tax filing reminder (Jonathan, Nov 20 2026): remind him 1 week before the END of each month to
// report/file that month's sales tax, as a red banner in the CRM (dismissable once filed) and as a text message.
//
// A "period" is the month being filed, written "YYYY-MM". Its reminder window opens 7 days before the month's last
// day (Nov 2026 ends on the 30th, so the window opens Nov 23) and stays open until it is dismissed as filed.
// The text message (supabase/functions/send-sales-tax-reminder) uses the same rule, so keep the two in step.

export const REMINDER_DAYS_BEFORE_MONTH_END = 7;
export const BUSINESS_TIME_ZONE = "America/Chicago";
// Reminders start with November 2026 (Jonathan's request, Nov 18-20 2026). Without this, the banner would immediately
// nag about October, whose window opened Oct 24, before the feature existed.
export const FIRST_REMINDER_PERIOD = "2026-11";

export interface ReminderPeriod {
  period: string; // "2026-11"
  label: string; // "November 2026"
  windowStart: string; // "2026-11-23" (first day the reminder shows)
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's calendar date (YYYY-MM-DD) in the business time zone. */
export function todayInBusinessZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Period info for a given year + 0-based month. */
export function reminderPeriodFor(year: number, month0: number): ReminderPeriod {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month0, lastDay - REMINDER_DAYS_BEFORE_MONTH_END));
  return {
    period: `${year}-${pad(month0 + 1)}`,
    label: `${MONTHS[month0]} ${year}`,
    windowStart: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
  };
}

/**
 * The reminder that should be showing right now, or null. Looks at this month and last month; a reminder shows once its
 * window has opened and until it is dismissed. If both are undismissed the older one (more urgent) shows first.
 */
export function activeReminder(todayYmd: string, dismissedPeriods: ReadonlySet<string>): ReminderPeriod | null {
  const [y, m] = todayYmd.split("-").map(Number);
  const prev = reminderPeriodFor(m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2);
  const current = reminderPeriodFor(y, m - 1);
  for (const p of [prev, current]) {
    if (p.period >= FIRST_REMINDER_PERIOD && todayYmd >= p.windowStart && !dismissedPeriods.has(p.period)) return p;
  }
  return null;
}
