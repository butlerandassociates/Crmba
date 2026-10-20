// Client portal visit statistics for the CRM's "Client Portal" card.
//
// Jonathan, Oct 16-19 2026: "whenever a client enters the client portal... time stamps within their
// profile on the CRM so that we can track how often they're actually utilizing this" — visit frequency.
//
// The portal already appends {ip, ua, ts} to client_portal_tokens.ip_log on EVERY portal load (a page
// refresh, or the portal refetching after a payment/approval, is another load), so raw loads over-count.
// A "visit" here is a session: loads less than SESSION_GAP_MS apart belong to the same visit.

export const SESSION_GAP_MS = 30 * 60 * 1000;
export const ACTIVE_WINDOW_DAYS = 14;

export type PortalLoad = { ts: string; ua?: string | null };
export type PortalVisit = { start: Date; device: string };
export type PortalStats = {
  visits: PortalVisit[];          // newest first
  total: number;
  last30Days: number;
  first: Date | null;
  last: Date | null;
  weekly: number[];               // visits per week, oldest -> current week (8 entries)
  status: "never" | "active" | "inactive";
  daysSinceLast: number | null;
};

export function parseDevice(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const u = ua;
  const os = /iPhone/i.test(u) ? "iPhone"
    : /iPad/i.test(u) ? "iPad"
    : /Android/i.test(u) ? "Android"
    : /CrOS/i.test(u) ? "Chromebook"
    : /Windows/i.test(u) ? "Windows"
    : /Macintosh|Mac OS X/i.test(u) ? "Mac"
    : /Linux/i.test(u) ? "Linux"
    : "Unknown device";
  const browser = /Edg\//i.test(u) ? "Edge"
    : /OPR\/|Opera/i.test(u) ? "Opera"
    : /Firefox|FxiOS/i.test(u) ? "Firefox"
    : /Chrome|CriOS/i.test(u) ? "Chrome"
    : /Safari/i.test(u) ? "Safari"
    : "";
  return browser ? `${os} · ${browser}` : os;
}

// Monday 00:00 (local) of the week containing d
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function computePortalStats(loads: PortalLoad[], now: Date = new Date()): PortalStats {
  const times = (loads ?? [])
    .map((l) => ({ t: new Date(l.ts), ua: l.ua ?? null }))
    .filter((l) => !isNaN(l.t.getTime()))
    .sort((a, b) => a.t.getTime() - b.t.getTime());

  const visits: PortalVisit[] = [];
  let prev = -Infinity;
  for (const l of times) {
    if (l.t.getTime() - prev > SESSION_GAP_MS) visits.push({ start: l.t, device: parseDevice(l.ua) });
    prev = l.t.getTime();
  }

  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const weekStart = startOfWeek(now);
  const weekly = new Array(8).fill(0);
  for (const v of visits) {
    // DST can shift a week start by an hour, so round the week difference instead of flooring milliseconds
    const idx = Math.round((weekStart.getTime() - startOfWeek(v.start).getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < 8) weekly[7 - idx] += 1;
  }

  const last = times.length ? times[times.length - 1].t : null;
  const daysSinceLast = last ? Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000)) : null;
  return {
    visits: [...visits].reverse(),
    total: visits.length,
    last30Days: visits.filter((v) => v.start.getTime() >= thirtyDaysAgo).length,
    first: times.length ? times[0].t : null,
    last,
    weekly,
    status: !last ? "never" : (daysSinceLast ?? 0) <= ACTIVE_WINDOW_DAYS ? "active" : "inactive",
    daysSinceLast,
  };
}

export function relativeDays(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
