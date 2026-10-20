import { useEffect, useMemo, useState } from "react";
import { Globe, Loader2, Smartphone, Monitor } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { computePortalStats, relativeDays, type PortalLoad } from "../utils/portal-visits";

// "Client Portal" card on a client's profile — how often the client really opens their portal
// (Jonathan, Oct 19 2026: "Visit frequency is good!"). Visits are sessions built from the portal's own
// access log; opens from the CRM's "View Portal" button (?preview=1) are never recorded.

const fmtDateTime = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const fmtVisit = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " +
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

export function ClientPortalActivity({ clientId }: { clientId: string }) {
  const [loads, setLoads] = useState<PortalLoad[] | null>(null); // null = loading; [] = no link / no visits
  const [hasLink, setHasLink] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const load = async () => {
    // Never select the token itself — only the access log.
    const { data, error } = await supabase
      .from("client_portal_tokens")
      .select("ip_log, last_accessed_at, created_at")
      .eq("client_id", clientId);
    if (error) { setLoads([]); setHasLink(false); return; }
    const rows = data ?? [];
    setHasLink(rows.length > 0);
    const all: PortalLoad[] = [];
    for (const r of rows as any[]) {
      for (const e of Array.isArray(r.ip_log) ? r.ip_log : []) {
        if (e?.ts) all.push({ ts: String(e.ts), ua: e.ua ?? null });
      }
    }
    setLoads(all);
  };

  useEffect(() => { load(); }, [clientId]);
  useRealtimeRefetch(load, ["client_portal_tokens"], `portal-card-${clientId}`);

  const stats = useMemo(() => computePortalStats(loads ?? []), [loads]);

  // Clients without a portal link don't need the card at all.
  if (loads !== null && !hasLink) return null;

  const statusChip =
    stats.status === "active"
      ? { cls: "bg-green-100 text-green-700", text: `Active · last seen ${relativeDays(stats.daysSinceLast)}` }
      : stats.status === "inactive"
        ? { cls: "bg-amber-100 text-amber-700", text: `Not opened in ${stats.daysSinceLast} days` }
        : { cls: "bg-gray-100 text-gray-600", text: "Never opened" };

  const maxWeek = Math.max(1, ...stats.weekly);
  const shown = showAll ? stats.visits.slice(0, 50) : stats.visits.slice(0, 5);
  const weekLabel = (i: number) => (i === 7 ? "This week" : `${7 - i} week${7 - i === 1 ? "" : "s"} ago`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Client Portal
          {loads !== null && (
            <span className={`ml-auto text-xs font-normal px-2.5 py-1 rounded-md ${statusChip.cls}`}>{statusChip.text}</span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">How often this client opens their portal</p>
      </CardHeader>
      <CardContent>
        {loads === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Visits</p>
                <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Last 30 days</p>
                <p className="text-2xl font-semibold tabular-nums">{stats.last30Days}</p>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground">First visit</p>
                <p className="text-sm font-medium pt-1.5">{stats.first ? fmtDateTime(stats.first) : "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Last visit</p>
                <p className="text-sm font-medium pt-1.5">{stats.last ? fmtDateTime(stats.last) : "—"}</p>
              </div>
            </div>

            {stats.total > 0 && (
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className="text-xs text-muted-foreground">Visits per week, last 8 weeks</p>
                  {/* tap/click a bar to see its week: hover tooltips don't exist on phones */}
                  <p className="text-xs font-medium tabular-nums" aria-live="polite">
                    {selectedWeek === null
                      ? <span className="font-normal text-muted-foreground">Tap a bar for details</span>
                      : `${weekLabel(selectedWeek)}: ${stats.weekly[selectedWeek]} visit${stats.weekly[selectedWeek] === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-end gap-1.5 h-11">
                  {stats.weekly.map((n, i) => (
                    <button
                      key={i}
                      type="button"
                      title={`${weekLabel(i)}: ${n} visit${n === 1 ? "" : "s"}`}
                      aria-label={`${weekLabel(i)}: ${n} visit${n === 1 ? "" : "s"}`}
                      onClick={() => setSelectedWeek((s) => (s === i ? null : i))}
                      className="flex-1 h-full flex items-end group focus:outline-none"
                    >
                      <span
                        className={`block w-full rounded-sm transition-colors ${n > 0 ? "bg-blue-500 group-hover:bg-blue-600" : "bg-gray-200 group-hover:bg-gray-300"} ${selectedWeek === i ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
                        style={{ height: n > 0 ? Math.max(8, Math.round((n / maxWeek) * 44)) : 4 }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stats.total > 0 ? (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-1">Recent visits</p>
                {shown.map((v, i) => {
                  const mobile = /iPhone|iPad|Android/.test(v.device);
                  return (
                    <div key={i} className="flex items-center justify-between py-2 text-sm border-b last:border-b-0">
                      <span>{fmtVisit(v.start)}</span>
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        {mobile ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                        {v.device}
                      </span>
                    </div>
                  );
                })}
                {stats.visits.length > 5 && (
                  <button onClick={() => setShowAll((s) => !s)} className="mt-1 text-xs text-blue-600 hover:underline">
                    {showAll ? "Show fewer" : `Show all ${stats.visits.length} visits`}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">The client hasn't opened their portal yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
