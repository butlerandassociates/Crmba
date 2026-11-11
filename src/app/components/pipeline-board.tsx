import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ExternalLink, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/app/utils/format";
import { pickJobEstimate } from "@/app/utils/financials";
import { clientRecipientEmails } from "@/app/utils/client-emails";

// Pipeline board (Jonathan, Nov 2026): every stage lists its clients as cards — name, proposal name, amount, lead
// source, status, days in stage — and a click opens a quick view with an "Open client page" button and shortcuts to
// the client's proposals. Used by the Dashboard's "Pipeline by Stage" section (and the /pipeline page).

// the same soft tile colors the Dashboard's "Pipeline by Stage" always used
const STAGES = [
  { label: "Prospect",  status: "prospect",  tile: "bg-gray-100 text-gray-700"       },
  { label: "Scheduled", status: "scheduled", tile: "bg-blue-100 text-blue-700"       },
  { label: "Selling",   status: "selling",   tile: "bg-orange-100 text-orange-700"   },
  { label: "Sold",      status: "sold",      tile: "bg-green-100 text-green-700"     },
  { label: "Active",    status: "active",    tile: "bg-emerald-100 text-emerald-700" },
  { label: "Completed", status: "completed", tile: "bg-purple-100 text-purple-700"   },
];

const clientDisplayName = (c: any) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "—";
const money0 = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const dateOnly = (d: string) => new Date(d.includes("T") ? d : `${d}T00:00:00`);
const shortDate = (d?: string | null) => (d ? dateOnly(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD");
const daysLabel = (d: number | null) => (d === null ? "" : d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`);

const TAG_GRAY  = "bg-gray-100 text-gray-700 border-gray-200";
const TAG_BLUE  = "bg-blue-100 text-blue-700 border-blue-200";
const TAG_AMBER = "bg-amber-100 text-amber-800 border-amber-200";
const TAG_GREEN = "bg-green-100 text-green-700 border-green-200";

type Props = {
  /** Non-discarded clients as returned by clientsAPI.getAll() */
  clients: any[];
  /** Amount shown on a card and summed in the stage header. Default: proposal total before the contract, job total after. */
  clientValue?: (stage: string, client: any) => number;
};

const defaultClientValue = (stage: string, c: any) =>
  ["Sold", "Active", "Completed"].includes(stage) ? (c.project_total ?? 0) : (c.proposal_forecast ?? 0);

export function PipelineBoard({ clients, clientValue = defaultClientValue }: Props) {
  const [estimates, setEstimates] = useState<any[]>([]);
  // when each client entered its current stage
  const [stageSince, setStageSince] = useState<Record<string, string>>({});
  const [quickView, setQuickView] = useState<any | null>(null);
  // the stage whose clients are listed under the tiles (click a tile again to close it)
  const [selected, setSelected] = useState<string | null>(null);

  const loadExtras = async () => {
    try {
      const { data } = await supabase.from("estimates").select("id, client_id, title, status, total, sent_at, created_at").order("created_at", { ascending: false });
      setEstimates(data ?? []);
    } catch { /* cards just lose the proposal name */ }
    // Best source first: clients.status_changed_at (migration 137, set by a trigger on every status change); older rows
    // fall back to their latest 'status_changed' activity entry, then created_at.
    try {
      const since: Record<string, string> = {};
      const { data: logged } = await supabase.from("activity_log").select("client_id, created_at").eq("action_type", "status_changed").order("created_at", { ascending: false }).limit(5000);
      for (const r of logged ?? []) if (r.client_id && !since[r.client_id]) since[r.client_id] = r.created_at;
      const { data: exact, error: exactErr } = await supabase.from("clients").select("id, status_changed_at").not("status_changed_at", "is", null);
      if (!exactErr) for (const r of exact ?? []) since[r.id] = r.status_changed_at;
      setStageSince(since);
    } catch { /* optional: cards fall back to created_at */ }
  };

  useEffect(() => { loadExtras(); }, []);
  useRealtimeRefetch(loadExtras, ["estimates", "clients"], "pipeline-board");

  const daysInStage = (c: any): number | null => {
    const iso = stageSince[c.id] ?? c.created_at;
    if (!iso) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  };
  const clientEstimates = (clientId: string) => estimates.filter((e) => e.client_id === clientId && e.status !== "voided");

  // The one-line status on a card: what is happening with this lead right now
  const statusTag = (stage: string, c: any): { label: string; cls: string } => {
    if (stage === "Prospect") return { label: "Not scheduled", cls: TAG_GRAY };
    if (stage === "Scheduled") {
      if (!c.appointment_date) return { label: "Appointment set", cls: TAG_BLUE };
      // appointments are timestamptz; show them in the business's time zone so the tag reads the same on any laptop
      const d = dateOnly(c.appointment_date);
      const tz = "America/Chicago";
      const hasTime = c.appointment_date.includes("T");
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(hasTime ? { timeZone: tz } : {}) });
      const time = hasTime ? ` · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}` : "";
      return { label: `${label}${time}`, cls: TAG_BLUE };
    }
    if (stage === "Selling") {
      const est: any = pickJobEstimate(clientEstimates(c.id));
      if (!est) return { label: "No proposal yet", cls: TAG_GRAY };
      if (est.status === "accepted") return { label: "Proposal accepted", cls: TAG_GREEN };
      if (est.status === "opened") return { label: "Proposal viewed", cls: TAG_AMBER };
      if (est.status === "sent") return { label: "Proposal sent", cls: TAG_AMBER };
      return { label: "Proposal draft", cls: TAG_GRAY };
    }
    if (stage === "Sold") {
      if (c.docusign_status === "completed") return { label: "DocuSigned", cls: TAG_GREEN };
      if (c.docusign_status === "sent_to_client") return { label: "Contract sent", cls: TAG_AMBER };
      if (c.docusign_status === "preparing") return { label: "Contract preparing", cls: TAG_AMBER };
      return { label: "Contract pending", cls: TAG_GRAY };
    }
    if (stage === "Active") {
      return c.project_start_date
        ? { label: `Started ${dateOnly(c.project_start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, cls: TAG_GREEN }
        : { label: "In progress", cls: TAG_GREEN };
    }
    return { label: "Completed", cls: TAG_GRAY };
  };
  // Proposal name from the builder (e.g. "Outdoor Living Space Project") — not the scope of work
  const cardSubtitle = (c: any) => {
    const est: any = pickJobEstimate(clientEstimates(c.id));
    return est?.title || c.company || [c.city, c.state].filter(Boolean).join(", ") || "";
  };

  const quickStage = quickView ? (quickView.status ?? "").charAt(0).toUpperCase() + (quickView.status ?? "").slice(1) : "";

  const selectedStage = STAGES.find((st) => st.label === selected) ?? null;
  const selectedList = selectedStage ? clients.filter((c) => (c.status ?? "").toLowerCase() === selectedStage.status) : [];

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {STAGES.map(({ label, status, tile }) => {
          const list = clients.filter((c) => (c.status ?? "").toLowerCase() === status);
          const total = list.reduce((sum, c) => sum + (clientValue(label, c) || 0), 0);
          const isSelected = selected === label;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : label)}
              className={`rounded-lg p-3 text-center transition-opacity hover:opacity-80 cursor-pointer ${tile} ${isSelected ? "ring-2 ring-current ring-offset-2 ring-offset-background" : ""}`}
            >
              <div className="text-2xl font-bold">{list.length}</div>
              <div className="text-xs font-medium mt-0.5">{label}</div>
              {list.length > 0 && <div className="text-[10px] mt-1 opacity-75">{formatCurrency(total)}</div>}
            </button>
          );
        })}
      </div>
      {!selectedStage && <p className="mt-2 text-xs text-muted-foreground">Click a stage to see its clients.</p>}

      {selectedStage && (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{selectedStage.label} <span className="font-normal text-muted-foreground">· {selectedList.length} client{selectedList.length === 1 ? "" : "s"}</span></p>
            <div className="flex items-center gap-3">
              <Link to={`/clients?stage=${selectedStage.status}`} className="text-xs text-primary hover:underline">View all</Link>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {selectedList.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No clients here yet</p>
          ) : (
            <div className="grid max-h-[26rem] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {selectedList.map((c) => {
                const tag = statusTag(selectedStage.label, c);
                const amount = clientValue(selectedStage.label, c) || 0;
                const days = daysLabel(daysInStage(c));
                const subtitle = cardSubtitle(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQuickView(c)}
                    className="w-full min-w-0 text-left rounded-lg border bg-card p-3 hover:border-primary/40 hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium leading-snug">{clientDisplayName(c)}</span>
                      {amount > 0 && <span className="shrink-0 text-sm font-semibold">{money0(amount)}</span>}
                    </div>
                    {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap gap-1">
                        {c.lead_source?.name && (
                          <Badge variant="outline" className="max-w-full truncate bg-muted/50 text-muted-foreground">{c.lead_source.name}</Badge>
                        )}
                        <Badge variant="outline" className={`max-w-full truncate ${tag.cls}`}>{tag.label}</Badge>
                      </div>
                      {days && <span className="shrink-0 text-xs text-muted-foreground">{days}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick view — open the full client page, or jump straight to a proposal */}
      <Dialog open={!!quickView} onOpenChange={(open) => { if (!open) setQuickView(null); }}>
        <DialogContent className="sm:max-w-xl">
          {quickView && (() => {
            const recipients = clientRecipientEmails(quickView);
            const proposals = clientEstimates(quickView.id);
            const days = daysLabel(daysInStage(quickView));
            const address = [quickView.address, [quickView.city, quickView.state].filter(Boolean).join(", "), quickView.zip].filter(Boolean).join(" · ");
            return (
              <>
                <DialogHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <div className="min-w-0">
                      <DialogTitle className="break-words">{clientDisplayName(quickView)}</DialogTitle>
                      <DialogDescription className="mt-1">
                        {[quickStage, days && `${days} in stage`, quickView.lead_source?.name && `Lead source: ${quickView.lead_source.name}`].filter(Boolean).join(" · ")}
                      </DialogDescription>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link to={`/clients/${quickView.id}`} onClick={() => setQuickView(null)}>
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Open client page
                      </Link>
                    </Button>
                  </div>
                </DialogHeader>
                <DialogBody className="space-y-5">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Phone</dt>
                      <dd className="break-words">{quickView.phone || "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="break-all">{recipients.length ? recipients.join(", ") : "—"}</dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Address</dt>
                      <dd className="break-words">{address || "—"}</dd>
                    </div>
                  </dl>

                  {/* Project overview (Jonathan, Nov 7 2026): projected GP, assigned foreman, start - end date. Only once a project exists. */}
                  {(quickView.projects?.length ?? 0) > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Project</p>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Projected GP</dt>
                          <dd className="break-words">
                            {quickView.project_gross_profit != null ? money0(quickView.project_gross_profit) : "—"}
                            {quickView.project_gross_profit != null && quickView.project_profit_margin != null && (
                              <span className="text-muted-foreground"> ({Number(quickView.project_profit_margin).toFixed(1)}%)</span>
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Crew foreman</dt>
                          <dd className="break-words">{quickView.foremanName || "Not assigned"}</dd>
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">Start – end date</dt>
                          <dd className="break-words">
                            {quickView.project_start_date || quickView.project_end_date
                              ? `${shortDate(quickView.project_start_date)} – ${shortDate(quickView.project_end_date)}`
                              : "Not scheduled"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Proposals</p>
                    {proposals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No proposals yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {proposals.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">{p.title || "Proposal"}</p>
                              <p className="text-xs text-muted-foreground">
                                {money0(p.total ?? 0)} · {String(p.status ?? "").charAt(0).toUpperCase() + String(p.status ?? "").slice(1)}
                                {p.sent_at ? ` · ${new Date(p.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {["sent", "opened", "accepted", "declined"].includes(p.status) && (
                                <Button asChild variant="outline" size="sm">
                                  <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">View</a>
                                </Button>
                              )}
                              <Button asChild variant="outline" size="sm">
                                <Link to={`/proposals/${p.id}`} onClick={() => setQuickView(null)}>Edit proposal</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/clients/${quickView.id}/create-proposal`} onClick={() => setQuickView(null)}>New proposal</Link>
                      </Button>
                      {(quickView.projects?.length ?? 0) > 0 && (
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/clients/${quickView.id}#site-photos`} onClick={() => setQuickView(null)}>Job site photos</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogBody>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
