/**
 * Mileage Admin — matches the design from Mileage Tracker.html exactly.
 * 4 tabs: Pending Review / All Trips / Upload CSV / Payment History
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import {
  Car, ChevronLeft, ChevronRight, Upload, Search, Download,
  MapPin, AlertTriangle, CheckCircle2, XCircle, Calendar,
  DollarSign, TrendingUp, ArrowUpDown, Clock, Eye,
  X, Check, Info, ChevronDown,
} from "lucide-react";
import { formatCurrency } from "@/app/utils/format";
import { useAuth } from "../../contexts/auth-context";
import {
  mileagePeriodsAPI, mileageSubmissionsAPI, mileageSettingsAPI,
  mileageTripsAPI,
  type MileagePeriod, type MileageSubmission, type MileageTrip, type MileageSettings,
} from "../../api/mileage";
import { notificationsAPI } from "../../api/notifications";
import { supabase } from "@/lib/supabase";
import { MileageUpload } from "./mileage-upload";
import jsPDF from "jspdf";
import baLogoUrl from "@/assets/ba-logo.png";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Load the bundled B&A logo once as a PNG dataURL for jsPDF (same-origin → no canvas taint)
let _baLogo: { dataUrl: string; ratio: number } | null | undefined;
async function loadBaLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  if (_baLogo !== undefined) return _baLogo;
  try {
    const img = new Image();
    img.src = baLogoUrl;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("logo")); });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    _baLogo = { dataUrl: c.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch { _baLogo = null; }
  return _baLogo;
}

const fmt  = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtY = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const fmtMiles = (n: number) => n.toFixed(1);

function periodLabel(p: MileagePeriod) { return `${fmt(p.week_start)} – ${fmt(p.week_end)}`; }
function periodLabelFull(p: MileagePeriod) { return `${fmt(p.week_start)} – ${fmt(p.week_end)}, ${new Date(p.week_start + "T00:00:00").getFullYear()}`; }

function daysRemaining(p: MileagePeriod) {
  const end = new Date(p.week_end + "T23:59:59");
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const COLORS = ["bg-blue-500","bg-purple-500","bg-green-600","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-red-500"];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

type AdminTab = "pending" | "all" | "upload" | "history";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center text-gray-700 font-bold text-xs shrink-0 bg-gray-100 border border-gray-200"
      style={{ width: size, height: size, fontSize: size * 0.33 }}>
      {initials(name)}
    </div>
  );
}

// Role badge colors — keep avatars neutral; distinguish PM / Sales Rep / Crew by role pill
function roleStyle(role?: string): { bg: string; color: string; label: string } {
  if (role === "project_manager") return { bg: "#eff6ff", color: "#2563eb", label: "Project Manager" };
  if (role === "sales_rep")       return { bg: "#f5f3ff", color: "#7c3aed", label: "Sales Rep" };
  if (role === "foreman" || role === "crew") return { bg: "#f0fdfa", color: "#0d9488", label: "Crew" };
  return { bg: "#f3f4f6", color: "#6b7280", label: role ?? "—" };
}

// ─── Project chip ─────────────────────────────────────────────────────────────

function ProjectChip({ name, unmatched }: { name?: string; unmatched?: boolean }) {
  if (unmatched || !name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
        <AlertTriangle className="h-2.5 w-2.5" />Unmatched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 border border-blue-100 text-blue-700 max-w-[200px] truncate">
      <MapPin className="h-2.5 w-2.5 shrink-0" />{name}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = status === "approved" ? "bg-green-50 border border-green-200 text-green-700"
    : status === "paid"     ? "bg-blue-50 border border-blue-200 text-blue-700"
    : status === "denied"   ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-amber-50 border border-amber-200 text-amber-700";
  const label = status === "submitted" ? "pending" : status;
  return <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md ${cls}`}>{label}</span>;
}

// Bulk "Mark as Paid" from trip selection is OFF pending Jonathan's decision
// (pay the whole approved week vs. pay only selected trips). Set true to re-enable.
const BULK_PAY_FROM_TRIPS = false;

// Per-trip effective status: a trip individually approved/denied shows that, even
// while the overall submission has a different status. Falls back to submission status.
function effectiveTripStatus(tripStatus?: string, subStatus?: string): string {
  if (tripStatus === "denied") return "denied";
  if (subStatus === "paid") return "paid";
  if (tripStatus === "approved" || subStatus === "approved") return "approved";
  return subStatus ?? "pending";
}

// ─── Deny modal ───────────────────────────────────────────────────────────────

function DenyModal({ name, onConfirm, onCancel }: { name: string; onConfirm: (r: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div>
          <h3 className="font-bold text-base">Deny Submission</h3>
          <p className="text-sm text-gray-500 mt-1">Denying <strong>{name}</strong>'s mileage. They'll be notified with your reason.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reason <span className="text-red-500">*</span></label>
          <textarea className="w-full border rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/20" rows={3}
            placeholder="e.g. Missing project on 2 trips — please resubmit."
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            disabled={saving || !reason.trim()}
            onClick={async () => { setSaving(true); try { await onConfirm(reason); } finally { setSaving(false); } }}>
            {saving ? "Denying…" : "Deny Submission"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trip Drawer ──────────────────────────────────────────────────────────────

function TripDrawer({ trip, employeeName, employeeRole, status, projects, onClose, onReassign, onApprove, onDeny, onTogglePersonal }: {
  trip: (MileageTrip & { _sub?: any }) | null;
  employeeName?: string;
  employeeRole?: string;
  status?: string;
  projects: { id: string; name: string; client_id: string; clientName?: string; clientAddress?: string }[];
  onClose: () => void;
  onReassign?: (tripId: string, projectId: string) => void;
  onApprove?: (tripId: string) => void;
  onDeny?: (tripId: string) => void;
  onTogglePersonal?: (tripId: string, next: boolean) => void;
}) {
  const tripStatus = trip?.status && trip.status !== "pending" ? trip.status : (status ?? "pending");
  const matchLabel = trip?.match_confidence === "auto" ? "Auto-matched" : trip?.match_confidence === "manual" ? "Manually assigned" : "Unmatched";
  const [reassignOpen, setReassignOpen] = useState(false);
  const selectedProj = projects.find((p) => p.id === trip?.project?.id);
  const selectedClientLabel = selectedProj ? `${selectedProj.clientName || "Client"}${selectedProj.clientAddress ? ` — ${selectedProj.clientAddress}` : ""}` : undefined;
  const tripClientName = trip?.client ? `${trip.client.first_name ?? ""} ${trip.client.last_name ?? ""}`.trim() : "";
  return (
    <>
      {/* Scrim */}
      <div className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity ${trip ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      {/* Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 w-[480px] max-w-[92vw] bg-white border-l z-[60] flex flex-col shadow-2xl transition-transform duration-200 ${trip ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-[15px]">Trip Detail</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {trip && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Employee header + status */}
            {employeeName && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={employeeName} size={36} />
                  <div>
                    <div className="font-bold text-sm">{employeeName}</div>
                    {(() => { const r = roleStyle(employeeRole); return (
                      <span className="inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: r.bg, color: r.color }}>{r.label}</span>
                    ); })()}
                  </div>
                </div>
                <StatusBadge status={tripStatus} />
              </div>
            )}

            {/* Map — real Everlance route image when available, else placeholder */}
            {trip.map_image_url ? (
              <a href={trip.map_image_url} target="_blank" rel="noopener noreferrer" className="block h-44 rounded-xl border overflow-hidden">
                <img src={trip.map_image_url} alt="Route map" className="w-full h-full object-cover" />
              </a>
            ) : (
              <div className="h-44 rounded-xl border bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-gray-400 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, #000 0 1px, transparent 0 18px)" }} />
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <MapPin className="h-7 w-7" />
                  <span className="text-xs font-medium">No route map</span>
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Distance</p>
                <p className="text-base font-bold mt-1">{fmtMiles(Number(trip.miles))} mi</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Rate</p>
                <p className="text-base font-bold mt-1">${(Number(trip.miles) > 0 ? Number(trip.payout) / Number(trip.miles) : 0).toFixed(2)}/mi</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Amount</p>
                <p className="text-base font-bold text-green-700 mt-1">{fmtMoney(Number(trip.payout))}</p>
              </div>
            </div>

            {/* Route */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Route</p>
              <div className="border rounded-xl divide-y">
                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-xs text-gray-400 font-medium pt-0.5">Date</span>
                  <span className="text-sm font-semibold">{new Date(trip.trip_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-xs text-gray-400 font-medium pt-0.5">From</span>
                  <span className="text-sm">{trip.start_address}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-xs text-gray-400 font-medium pt-0.5">To</span>
                  <span className="text-sm font-medium">{trip.end_address}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-3 p-3">
                  <span className="text-xs text-gray-400 font-medium pt-0.5">Source</span>
                  <span className="text-xs font-semibold text-gray-600">{trip.match_confidence === "auto" ? "Everlance" : "Manual"}</span>
                </div>
              </div>
            </div>

            {/* Project attribution + reassign */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Client Attribution</p>
              {trip.is_personal && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mb-3">
                  <div className="text-[11px] font-semibold text-gray-600 mb-0.5">Personal trip</div>
                  <div className="text-xs text-gray-500">Logged for the record but excluded from the payout total and report.</div>
                </div>
              )}
              <div className={`rounded-xl border p-3 mb-3 ${trip.match_confidence === "unmatched" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"}`}>
                <div className={`text-[11px] font-semibold mb-1 ${trip.match_confidence === "unmatched" ? "text-amber-700" : "text-blue-700"}`}>
                  {matchLabel}{trip.match_confidence === "auto" ? " · matched on destination" : ""}
                </div>
                <div className="text-sm font-semibold">{tripClientName || "No client assigned"}</div>
                {trip.end_address && <div className="text-xs text-gray-500 mt-0.5">{trip.end_address}</div>}
              </div>
              {onReassign && (
                <div className="grid grid-cols-[90px_1fr] gap-3 items-center">
                  <span className="text-xs text-gray-400 font-medium">Reassign to</span>
                  <div className="relative">
                    <button onClick={() => setReassignOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm bg-white text-left">
                      <span className="truncate">{selectedClientLabel ?? "Select a client…"}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </button>
                    {reassignOpen && (
                      <>
                        <div className="fixed inset-0 z-[70]" onClick={() => setReassignOpen(false)} />
                        <div className="absolute z-[71] left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-1 overflow-y-auto" style={{ maxHeight: 240 }}>
                          {projects.map((p) => (
                            <button key={p.id}
                              onClick={() => { onReassign(trip.id, p.id); setReassignOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${trip.project?.id === p.id ? "bg-gray-100" : ""}`}>
                              <div className="font-medium truncate">{p.clientName || "Client"}</div>
                              {p.clientAddress && <div className="text-xs text-gray-500 truncate">{p.clientAddress}</div>}
                            </button>
                          ))}
                          {projects.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No clients available.</p>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {trip && (
          <div className="p-4 border-t flex gap-2 items-center bg-white">
            {onTogglePersonal && (
              <button className="px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-700"
                onClick={() => { onTogglePersonal(trip.id, !trip.is_personal); }}>
                {trip.is_personal ? "Mark Business" : "Mark Personal"}
              </button>
            )}
            <span className="ml-auto" />
            <button className="px-4 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg" onClick={onClose}>Close</button>
            {onDeny && (
              <button className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
                onClick={() => { onDeny(trip.id); onClose(); }}>
                <X className="h-3.5 w-3.5" />Deny
              </button>
            )}
            {onApprove && (
              <button className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
                onClick={() => { onApprove(trip.id); onClose(); }}>
                <Check className="h-3.5 w-3.5" />Approve
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Pending Review Tab ───────────────────────────────────────────────────────

function PendingReviewTab({ period, adminId, settings, onRefresh, onDirtyChange }: {
  period: MileagePeriod; adminId: string; settings: MileageSettings; onRefresh: () => void; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [subs, setSubs] = useState<MileageSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "project_manager" | "sales_rep">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount" | "trips" | "name">("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tripMap, setTripMap] = useState<Record<string, MileageTrip[]>>({});
  const [loadingTrips, setLoadingTrips] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDenyOpen, setBulkDenyOpen] = useState(false);
  const [drawerTrip, setDrawerTrip] = useState<(MileageTrip & { _subId?: string }) | null>(null);
  const [denyTarget, setDenyTarget] = useState<MileageSubmission | null>(null);
  const [denyTripTarget, setDenyTripTarget] = useState<MileageTrip | null>(null);
  const [payTarget, setPayTarget] = useState<MileageSubmission | null>(null);
  const [paying, setPaying] = useState(false);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; client_id: string; clientName?: string; clientAddress?: string }[]>([]);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    const data = await mileageSubmissionsAPI.getByPeriod(period.id).catch(() => [] as MileageSubmission[]);
    setSubs(data);
    if (!quiet) setLoading(false);
  };

  useEffect(() => { load(); }, [period.id]);

  // Live-update review cards + any expanded trip lists on any change (no page refresh)
  const realtimeRefresh = () => {
    load(true);
    [...expanded].forEach((id) => reloadTripsFor(id));
  };
  const realtimeRef = useRef(realtimeRefresh);
  realtimeRef.current = realtimeRefresh;
  useRealtimeRefetch(() => realtimeRef.current(), ["mileage_submissions", "mileage_trips", "mileage_periods"]);
  // Polling fallback every 15s (realtime on RLS sub-query tables can be unreliable)
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) realtimeRef.current(); }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    supabase.from("projects").select("id, name, client_id, client:clients(first_name, last_name, address)")
      .in("status", ["active", "sold", "selling"]).order("name")
      .then(({ data }) => setProjects((data ?? []).map((p: any) => ({
        id: p.id, name: p.name, client_id: p.client_id,
        clientName: p.client ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() : "",
        clientAddress: p.client?.address ?? "",
      }))));
  }, []);

  // Prune the selection bar: drop any selected trip whose submission is no longer
  // actionable (paid/voided/left the period) so the bar disappears once everything's processed.
  useEffect(() => {
    if (selected.size === 0) return;
    const valid = new Set<string>();
    for (const s of subs) {
      if (s.status === "submitted" || s.status === "denied" || s.status === "approved") {
        for (const t of (tripMap[s.id] ?? [])) valid.add(t.id);
      }
    }
    const pruned = [...selected].filter(id => valid.has(id));
    if (pruned.length !== selected.size) setSelected(new Set(pruned));
  }, [subs, tripMap, selected]);

  // Reassign a trip's project from the detail drawer
  const reassignTrip = async (tripId: string, projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    try {
      await mileageTripsAPI.assignProject(tripId, projectId, proj.client_id, adminId);
      // refresh the owning submission's trips + the open drawer
      const subId = drawerTrip?._subId;
      if (subId) {
        const fresh = await mileageTripsAPI.getBySubmission(subId).catch(() => []);
        setTripMap((p) => ({ ...p, [subId]: fresh }));
        const updated = fresh.find((t) => t.id === tripId);
        if (updated) setDrawerTrip({ ...updated, _subId: subId });
      }
      toast.success(`Trip reassigned to ${proj.name}.`);
    } catch (e: any) { toast.error(e.message ?? "Failed to reassign."); }
  };

  // Admin toggles a trip Personal from the drawer (excluded from payout); recalcs + refreshes
  const toggleTripPersonal = async (tripId: string, next: boolean) => {
    const subId = drawerTrip?._subId;
    try {
      await mileageTripsAPI.setPersonal(tripId, next, adminId);
      if (subId) {
        await mileageSubmissionsAPI.recalcTotals(subId, adminId);
        const fresh = await mileageTripsAPI.getBySubmission(subId).catch(() => []);
        setTripMap((p) => ({ ...p, [subId]: fresh }));
        const updated = fresh.find((t) => t.id === tripId);
        if (updated) setDrawerTrip({ ...updated, _subId: subId, _subUser: (drawerTrip as any)?._subUser, _subStatus: (drawerTrip as any)?._subStatus } as any);
      }
      toast.success(next ? "Trip marked personal — excluded from payout." : "Trip marked business.");
      load(); onRefresh();
    } catch (e: any) { toast.error(e.message ?? "Failed to update trip."); }
  };

  // Report an in-progress bulk selection as "dirty" so tab-switching warns
  useEffect(() => {
    onDirtyChange?.(selected.size > 0);
    return () => onDirtyChange?.(false);
  }, [selected.size]);

  const toggle = async (sub: MileageSubmission) => {
    const id = sub.id;
    if (expanded.has(id)) { setExpanded(p => { const n = new Set(p); n.delete(id); return n; }); return; }
    setExpanded(p => new Set([...p, id]));
    if (!tripMap[id]) {
      setLoadingTrips(id);
      const trips = await mileageTripsAPI.getBySubmission(id).catch(() => []);
      setTripMap(p => ({ ...p, [id]: trips }));
      setLoadingTrips(null);
    }
  };

  const handleApprove = async (sub: MileageSubmission) => {
    await mileageSubmissionsAPI.approve(sub.id, adminId);
    const name = sub.user ? `${sub.user.first_name} ${sub.user.last_name}` : "Employee";
    if (sub.user_id) await notificationsAPI.create({
      type: "mileage_approved", title: "Mileage Approved",
      message: `Your mileage for ${periodLabel(period)} was approved. ${fmtMoney(Number(sub.total_payout))} will be paid ${fmt(period.payment_date)}.`,
      link: "/mileage", recipient_id: sub.user_id,
    });
    toast.success(`${name}'s submission approved.`);
    load(); onRefresh();
  };

  const handleDeny = async (reason: string) => {
    if (!denyTarget) return;
    await mileageSubmissionsAPI.deny(denyTarget.id, adminId, reason);
    const name = denyTarget.user ? `${denyTarget.user.first_name} ${denyTarget.user.last_name}` : "Employee";
    if (denyTarget.user_id) await notificationsAPI.create({
      type: "mileage_denied", title: "Mileage Denied",
      message: `Your mileage for ${periodLabel(period)} was denied. Reason: ${reason}`,
      link: "/mileage", recipient_id: denyTarget.user_id,
    });
    toast.success(`${name}'s submission denied.`);
    setDenyTarget(null); load(); onRefresh();
  };

  // Admin manually marks an approved submission as Paid (Jonathan: manual pay step)
  const handleMarkPaid = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await mileageSubmissionsAPI.markPaid(payTarget.id, adminId);
      const name = payTarget.user ? `${payTarget.user.first_name} ${payTarget.user.last_name}` : "Employee";
      if (payTarget.user_id) await notificationsAPI.create({
        type: "mileage_paid", title: "Mileage Paid",
        message: `Your mileage for ${periodLabel(period)} (${fmtMoney(Number(payTarget.total_payout))}) has been paid.`,
        link: "/mileage", recipient_id: payTarget.user_id,
      }).catch(() => {});
      toast.success(`${name}'s mileage marked as paid.`);
      setPayTarget(null); load(); onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to mark as paid.");
    } finally {
      setPaying(false);
    }
  };

  const toggleSelectTrip = (id: string) => {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Approved submissions owning the currently-selected trips (only these can be paid)
  const payableSubIds = (): string[] =>
    submissionsForTrips([...selected]).filter(id => subs.find(s => s.id === id)?.status === "approved");

  // Bulk mark the approved submissions of the selected trips as Paid
  const handleBulkMarkPaid = async () => {
    const ids = payableSubIds();
    if (ids.length === 0) { setBulkPayOpen(false); toast.info("Select trips from an approved submission to mark it paid."); return; }
    setBulkPaying(true);
    try {
      for (const id of ids) {
        const s = subs.find(x => x.id === id);
        await mileageSubmissionsAPI.markPaid(id, adminId);
        if (s?.user_id) await notificationsAPI.create({
          type: "mileage_paid", title: "Mileage Paid",
          message: `Your mileage for ${periodLabel(period)} (${fmtMoney(Number(s.total_payout))}) has been paid.`,
          link: "/mileage", recipient_id: s.user_id,
        }).catch(() => {});
      }
      toast.success(`Marked ${ids.length} submission${ids.length !== 1 ? "s" : ""} as paid.`);
      setBulkPayOpen(false); setSelected(new Set()); load(); onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk mark-as-paid failed.");
    } finally {
      setBulkPaying(false);
    }
  };

  // Which submissions own the given trip ids — so we recalc their totals after a status change
  const submissionsForTrips = (tripIds: string[]): string[] => {
    const subIds = new Set<string>();
    for (const [subId, trips] of Object.entries(tripMap)) {
      if (trips.some(t => tripIds.includes(t.id))) subIds.add(subId);
    }
    return [...subIds];
  };

  const reloadTripsFor = async (subId: string) => {
    const trips = await mileageTripsAPI.getBySubmission(subId).catch(() => []);
    setTripMap(p => ({ ...p, [subId]: trips }));
  };

  // Notify the employee who owns a submission about a trip-level decision
  const notifyTripDecision = async (subId: string, verb: "approved" | "denied", tripCount: number, reason?: string) => {
    const sub = subs.find((s) => s.id === subId);
    if (!sub?.user_id) return;
    await notificationsAPI.create({
      type: verb === "approved" ? "mileage_approved" : "mileage_denied",
      title: verb === "approved" ? "Mileage Trip Approved" : "Mileage Trip Denied",
      message: `${tripCount} trip${tripCount !== 1 ? "s" : ""} on your ${periodLabel(period)} mileage ${tripCount !== 1 ? "were" : "was"} ${verb}.${reason ? ` Reason: ${reason}` : ""}`,
      link: "/mileage", recipient_id: sub.user_id,
    }).catch(() => {});
  };

  // Single trip approve/deny
  const setTripStatus = async (trip: MileageTrip, status: "approved" | "denied", reason?: string) => {
    try {
      await mileageTripsAPI.setStatus(trip.id, status, adminId, reason);
      await mileageSubmissionsAPI.recalcTotals(trip.submission_id, adminId);
      await reloadTripsFor(trip.submission_id);
      await notifyTripDecision(trip.submission_id, status, 1, reason);
      load(); onRefresh();
    } catch (e: any) { toast.error(e.message ?? "Failed to update trip."); }
  };

  // Bulk approve/deny selected trips
  const bulkApprove = async () => {
    const ids = [...selected];
    if (ids.length === 0) { toast.info("Select trips to approve."); return; }
    try {
      await mileageTripsAPI.bulkSetStatus(ids, "approved", adminId);
      const subIds = submissionsForTrips(ids);
      for (const subId of subIds) {
        await mileageSubmissionsAPI.recalcTotals(subId, adminId);
        await reloadTripsFor(subId);
        const cnt = (tripMap[subId] ?? []).filter((t) => ids.includes(t.id)).length;
        await notifyTripDecision(subId, "approved", cnt || ids.length);
      }
      toast.success(`Approved ${ids.length} trip${ids.length !== 1 ? "s" : ""}.`);
      setSelected(new Set()); load(); onRefresh();
    } catch (e: any) { toast.error(e.message ?? "Bulk approve failed."); }
  };

  const handleBulkDeny = async (reason: string) => {
    const ids = [...selected];
    if (ids.length === 0) { setBulkDenyOpen(false); return; }
    try {
      for (const id of ids) await mileageTripsAPI.setStatus(id, "denied", adminId, reason);
      const subIds = submissionsForTrips(ids);
      for (const subId of subIds) {
        await mileageSubmissionsAPI.recalcTotals(subId, adminId);
        await reloadTripsFor(subId);
        const cnt = (tripMap[subId] ?? []).filter((t) => ids.includes(t.id)).length;
        await notifyTripDecision(subId, "denied", cnt || ids.length, reason);
      }
      toast.success(`Denied ${ids.length} trip${ids.length !== 1 ? "s" : ""}.`);
      setBulkDenyOpen(false); setSelected(new Set()); load(); onRefresh();
    } catch (e: any) { toast.error(e.message ?? "Bulk deny failed."); }
  };

  const filtered = subs.filter(s => {
    const name = s.user ? `${s.user.first_name} ${s.user.last_name}`.toLowerCase() : "";
    if (search && !name.includes(search.toLowerCase())) return false;
    if (roleFilter !== "all" && s.user?.role !== roleFilter) return false;
    // Show submitted (to review), approved (ready to pay), and denied (resubmit context).
    // Paid submissions drop out — they live in Payment History.
    return s.status === "submitted" || s.status === "denied" || s.status === "approved";
  }).sort((a, b) => {
    const nameA = a.user ? `${a.user.first_name} ${a.user.last_name}` : "";
    const nameB = b.user ? `${b.user.first_name} ${b.user.last_name}` : "";
    switch (sortBy) {
      case "oldest": return new Date(a.submitted_at ?? a.created_at).getTime() - new Date(b.submitted_at ?? b.created_at).getTime();
      case "amount": return Number(b.total_payout) - Number(a.total_payout);
      case "trips":  return (tripMap[b.id]?.length ?? 0) - (tripMap[a.id]?.length ?? 0);
      case "name":   return nameA.localeCompare(nameB);
      case "newest":
      default:       return new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime();
    }
  });

  const SORT_LABELS: Record<typeof sortBy, string> = {
    newest: "Newest first", oldest: "Oldest first", amount: "Highest amount", trips: "Most trips", name: "Name A–Z",
  };

  if (loading) return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 12, padding: "20px 24px", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center" }}>
          {/* Person */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: "#e5e7eb", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, width: "55%", borderRadius: 4, background: "#e5e7eb", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ height: 16, width: 80, borderRadius: 999, background: "#eef0f2" }} />
                <div style={{ height: 16, width: 60, borderRadius: 999, background: "#eef0f2" }} />
              </div>
            </div>
          </div>
          {/* Pending Miles / Amount / Period Total */}
          {[0, 1, 2].map(k => (
            <div key={k}>
              <div style={{ height: 9, width: 60, borderRadius: 4, background: "#eef0f2", marginBottom: 7 }} />
              <div style={{ height: 14, width: 70, borderRadius: 4, background: "#e5e7eb" }} />
            </div>
          ))}
          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <div style={{ height: 30, width: 84, borderRadius: 8, background: "#eef0f2" }} />
            <div style={{ height: 30, width: 70, borderRadius: 8, background: "#eef0f2" }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {denyTarget && <DenyModal name={denyTarget.user ? `${denyTarget.user.first_name} ${denyTarget.user.last_name}` : "Employee"} onConfirm={handleDeny} onCancel={() => setDenyTarget(null)} />}
      {denyTripTarget && <DenyModal name="this trip" onConfirm={async (reason) => { await setTripStatus(denyTripTarget, "denied", reason); setDenyTripTarget(null); }} onCancel={() => setDenyTripTarget(null)} />}
      <TripDrawer
        trip={drawerTrip}
        employeeName={(drawerTrip as any)?._subUser ? `${(drawerTrip as any)._subUser.first_name ?? ""} ${(drawerTrip as any)._subUser.last_name ?? ""}`.trim() : undefined}
        employeeRole={(drawerTrip as any)?._subUser?.role}
        status={(drawerTrip as any)?._subStatus}
        projects={projects}
        onClose={() => setDrawerTrip(null)}
        onReassign={reassignTrip}
        onApprove={(drawerTrip as any)?._subStatus === "submitted" ? (id) => { const t = drawerTrip!; setTripStatus(t, "approved"); } : undefined}
        onDeny={(drawerTrip as any)?._subStatus === "submitted" ? () => { const t = drawerTrip!; setDrawerTrip(null); setDenyTripTarget(t); } : undefined}
        onTogglePersonal={(drawerTrip as any)?._subStatus === "submitted" ? toggleTripPersonal : undefined}
      />

      {/* Search */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Filter strip */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        {/* Segmented */}
        <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 4, gap: 2 }}>
          {([["all", "All Employees"], ["project_manager", "Project Managers"], ["sales_rep", "Sales Reps"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setRoleFilter(v)}
              style={{ border: 0, padding: "6px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: roleFilter === v ? "#0a0a0a" : "transparent",
                color: roleFilter === v ? "#fff" : "#6b7280" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setSortOpen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}>
            <ArrowUpDown style={{ width: 13, height: 13, color: "#9ca3af" }} />Sort: {SORT_LABELS[sortBy]}
            <ChevronDown style={{ width: 13, height: 13, color: "#9ca3af" }} />
          </button>
          {sortOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setSortOpen(false)} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 31, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px -8px rgba(15,23,42,.2)", padding: 4, minWidth: 170 }}>
                {(Object.keys(SORT_LABELS) as (typeof sortBy)[]).map(k => (
                  <button key={k} onClick={() => { setSortBy(k); setSortOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", border: 0, background: sortBy === k ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "#0a0a0a", cursor: "pointer", textAlign: "left" }}>
                    {SORT_LABELS[k]}
                    {sortBy === k && <Check style={{ width: 13, height: 13, color: "#059669" }} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Employee cards */}
      {filtered.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <CheckCircle2 style={{ width: 24, height: 24 }} />
          </div>
          <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>All caught up</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280" }}>No pending mileage to review for the current filters.</p>
        </div>
      ) : filtered.map(sub => {
        const name = sub.user ? `${sub.user.first_name} ${sub.user.last_name}` : "Unknown";
        const trips = tripMap[sub.id] ?? [];
        const unmatched = trips.filter(t => t.match_confidence === "unmatched").length;
        const isExp = expanded.has(sub.id);
        const isLoading = loadingTrips === sub.id;
        const pendingMiles = Number(sub.total_miles);
        const pendingAmt = Number(sub.total_payout);

        return (
          <div key={sub.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 12, overflow: "hidden", boxShadow: isExp ? "0 8px 24px -8px rgba(15,23,42,.12)" : undefined, borderColor: isExp ? "#d1d5db" : "#e5e7eb" }}>
            {/* Card head */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr auto", gap: 16, padding: "20px 24px", alignItems: "center", cursor: "pointer" }}
              onClick={() => toggle(sub)}>
              {/* Person */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={name} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                    {(() => { const r = roleStyle(sub.user?.role); return (
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: r.bg, color: r.color }}>
                        {r.label}
                      </span>
                    ); })()}
                    {(() => {
                      const pillStyle = sub.status === "approved"
                        ? { background: "#d1fae5", color: "#059669" }
                        : sub.status === "paid"
                        ? { background: "#dbeafe", color: "#2563eb" }
                        : sub.status === "denied"
                        ? { background: "#fee2e2", color: "#dc2626" }
                        : { background: "#fef3c7", color: "#d97706" };
                      const label = sub.status === "submitted" ? `${trips.length || "?"} pending` : sub.status;
                      return (
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize", ...pillStyle }}>
                          {label}
                        </span>
                      );
                    })()}
                    {unmatched > 0 && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "#fee2e2", color: "#dc2626", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle style={{ width: 10, height: 10 }} />{unmatched} unmatched
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pending Miles */}
              <div>
                <div style={{ color: "#9ca3af", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Pending Miles</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0a0a0a" }}>{fmtMiles(pendingMiles)} mi</div>
              </div>

              {/* Pending Amount */}
              <div>
                <div style={{ color: "#9ca3af", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Pending Amount</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#d97706" }}>{fmtMoney(pendingAmt)}</div>
              </div>

              {/* Period Total */}
              <div>
                <div style={{ color: "#9ca3af", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Period Total</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0a0a0a" }}>{fmtMoney(pendingAmt)}</div>
              </div>

              {/* View trips + actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sub.status === "submitted" && (
                  <>
                    <button title="Approve the entire submission" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#059669", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); handleApprove(sub); }}>
                      <Check style={{ width: 13, height: 13 }} />Approve all
                    </button>
                    <button title="Deny the entire submission" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); setDenyTarget(sub); }}>
                      <X style={{ width: 13, height: 13 }} />Deny all
                    </button>
                  </>
                )}
                {sub.status === "approved" && (
                  <button title="Mark this approved submission as paid" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#2563eb", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); setPayTarget(sub); }}>
                    <DollarSign style={{ width: 13, height: 13 }} />Mark as Paid
                  </button>
                )}
                <button style={{ color: "#0a0a0a", fontWeight: 600, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "transparent", cursor: "pointer" }}
                  onClick={e => { e.stopPropagation(); toggle(sub); }}>
                  {isExp ? "Hide trips" : "View trips"}
                  <ChevronRight style={{ width: 14, height: 14, transform: isExp ? "rotate(90deg)" : undefined, transition: "transform .2s" }} />
                </button>
              </div>
            </div>

            {/* Expanded trips */}
            {isExp && (
              <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
                {isLoading ? (
                  <p style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>Loading trips…</p>
                ) : trips.length === 0 ? (
                  <p style={{ padding: 20, color: "#9ca3af", fontSize: 13 }}>No trips recorded.</p>
                ) : (
                  <div style={{ padding: "16px 16px 16px" }}>
                    {trips.map(trip => {
                      const sel = selected.has(trip.id);
                      const isApproved = trip.status === "approved";
                      const isDenied = trip.status === "denied";
                      return (
                        <div key={trip.id}
                          style={{ display: "grid", gridTemplateColumns: "26px 100px 1fr 80px 80px 84px", gap: 14, padding: "14px 20px", background: "#fff", borderBottom: "1px solid #e5e7eb", cursor: "pointer", alignItems: "center", opacity: isDenied ? 0.6 : 1 }}
                          onClick={() => setDrawerTrip({ ...trip, _subId: sub.id, _subUser: sub.user, _subStatus: sub.status } as any)}>
                          {/* Checkbox */}
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid #d1d5db", background: sel ? "#0a0a0a" : "#fff", display: "inline-grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); toggleSelectTrip(trip.id); }}>
                            {sel && <Check style={{ width: 11, height: 11, color: "#fff" }} />}
                          </div>

                          {/* Date */}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0a0a0a" }}>{fmt(trip.trip_date)}</div>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>{fmtD(trip.trip_date)}</div>
                          </div>

                          {/* Route */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "grid", placeItems: "center", color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>
                              <Car style={{ width: 12, height: 12 }} />
                            </span>
                            <div>
                              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>{trip.start_address}</div>
                              <div style={{ fontSize: 13, color: "#0a0a0a", fontWeight: 500, marginBottom: 6 }}>{trip.end_address}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {trip.is_personal
                                  ? <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>Personal</span>
                                  : <ProjectChip name={(trip.client?.address || (trip.client ? `${trip.client.first_name ?? ""} ${trip.client.last_name ?? ""}`.trim() : "")) || undefined} unmatched={trip.match_confidence === "unmatched"} />}
                                {isApproved && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" }}>Approved</span>}
                                {isDenied && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>Denied</span>}
                              </div>
                              {!trip.is_personal && trip.match_confidence !== "unmatched" && trip.client?.address && trip.client && (
                                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{`${trip.client.first_name ?? ""} ${trip.client.last_name ?? ""}`.trim()}</div>
                              )}
                              {isDenied && trip.denial_reason && (
                                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>Reason: {trip.denial_reason}</div>
                              )}
                            </div>
                          </div>

                          {/* Miles */}
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a", fontVariantNumeric: "tabular-nums" }}>{fmtMiles(Number(trip.miles))} mi</div>

                          {/* Amount */}
                          <div style={{ fontSize: 13, fontWeight: 700, color: (isDenied || trip.is_personal) ? "#9ca3af" : "#059669", fontVariantNumeric: "tabular-nums", textDecoration: (isDenied || trip.is_personal) ? "line-through" : undefined }}>{fmtMoney(Number(trip.payout))}</div>

                          {/* ✓ × buttons */}
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setTripStatus(trip, "approved")} title="Approve trip"
                              style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${isApproved ? "#bbf7d0" : "#e5e7eb"}`, background: isApproved ? "#f0fdf4" : "#fff", display: "grid", placeItems: "center", color: isApproved ? "#059669" : "#6b7280", cursor: "pointer" }}
                              className="hover:bg-green-50 hover:border-green-200 hover:text-green-700">
                              <Check style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={() => setDenyTripTarget(trip)} title="Deny trip"
                              style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${isDenied ? "#fecaca" : "#e5e7eb"}`, background: isDenied ? "#fef2f2" : "#fff", display: "grid", placeItems: "center", color: isDenied ? "#dc2626" : "#6b7280", cursor: "pointer" }}
                              className="hover:bg-red-50 hover:border-red-200 hover:text-red-600">
                              <X style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ position: "sticky", bottom: 16, background: "#0a0a0a", color: "#fff", borderRadius: 14, padding: "12px 14px 12px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 20px 40px -12px rgba(15,23,42,.4)", zIndex: 5 }}>
          {/* Clear selection */}
          <button onClick={() => setSelected(new Set())} title="Clear selection"
            style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
            <X style={{ width: 13, height: 13 }} />
          </button>
          <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 8, padding: "4px 10px", fontSize: 12.5, fontWeight: 600 }}>{selected.size} trip{selected.size !== 1 ? "s" : ""} selected</span>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={() => setBulkDenyOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <X style={{ width: 13, height: 13 }} />Deny selected
          </button>
          <button onClick={bulkApprove} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, border: "1px solid #059669", background: "#059669", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <Check style={{ width: 13, height: 13 }} />Approve selected
          </button>
          {/* Bulk "Mark as Paid" from trip selection — DISABLED pending Jonathan's decision
              (pay whole approved week vs. pay only selected trips). Flip BULK_PAY_FROM_TRIPS
              to true to re-enable. The per-card Mark-as-Paid (whole submission) stays active. */}
          {BULK_PAY_FROM_TRIPS && payableSubIds().length > 0 && (
            <button onClick={() => setBulkPayOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              <DollarSign style={{ width: 13, height: 13 }} />Mark as Paid
            </button>
          )}
        </div>
      )}

      {bulkDenyOpen && (
        <DenyModal
          name={`${selected.size} trip${selected.size !== 1 ? "s" : ""}`}
          onConfirm={handleBulkDeny}
          onCancel={() => setBulkDenyOpen(false)}
        />
      )}

      {/* Bulk Mark as Paid confirmation */}
      {bulkPayOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !bulkPaying && setBulkPayOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div style={{ padding: "20px 24px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dbeafe", color: "#2563eb", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <DollarSign style={{ width: 20, height: 20 }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Mark {payableSubIds().length} submission{payableSubIds().length !== 1 ? "s" : ""} as paid?</h3>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#6b7280", lineHeight: 1.5 }}>
                Marking as paid pays the employee's <strong>entire approved submission</strong> for this week (not just the trips you selected). The full amount below moves to Payment History.
              </p>
              {/* Per-employee breakdown so the amount is clear */}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                {payableSubIds().map((id) => {
                  const s = subs.find(x => x.id === id);
                  const nm = s?.user ? `${s.user.first_name} ${s.user.last_name}` : "Employee";
                  return (
                    <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid #f1f3f5", fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{nm}</span>
                      <span style={{ fontWeight: 700, color: "#2563eb", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(Number(s?.total_payout ?? 0))}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#f9fafb", fontSize: 13, fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: "#2563eb", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(payableSubIds().reduce((s, id) => s + Number(subs.find(x => x.id === id)?.total_payout ?? 0), 0))}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5 }}>
                Only the {payableSubIds().length === 1 ? "employee" : "employees"} listed above {payableSubIds().length === 1 ? "is" : "are"} notified. This can't be undone from here.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px 20px" }}>
              <button onClick={() => setBulkPayOpen(false)} disabled={bulkPaying}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13.5, fontWeight: 600, cursor: bulkPaying ? "default" : "pointer", opacity: bulkPaying ? 0.6 : 1 }}>
                Cancel
              </button>
              <button onClick={handleBulkMarkPaid} disabled={bulkPaying}
                style={{ padding: "9px 16px", borderRadius: 9, border: 0, background: "#2563eb", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: bulkPaying ? "default" : "pointer", opacity: bulkPaying ? 0.7 : 1 }}>
                {bulkPaying ? "Marking…" : `Mark ${payableSubIds().length} as Paid`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Paid confirmation */}
      {payTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !paying && setPayTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div style={{ padding: "20px 24px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dbeafe", color: "#2563eb", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <DollarSign style={{ width: 20, height: 20 }} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Mark as paid?</h3>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280", lineHeight: 1.5 }}>
                This records <strong>{payTarget.user ? `${payTarget.user.first_name} ${payTarget.user.last_name}` : "the employee"}</strong>'s
                {" "}{fmtMoney(Number(payTarget.total_payout))} mileage for {periodLabel(period)} as paid and moves it to Payment History.
                The employee is notified. This can't be undone from here.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px 20px" }}>
              <button onClick={() => setPayTarget(null)} disabled={paying}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13.5, fontWeight: 600, cursor: paying ? "default" : "pointer", opacity: paying ? 0.6 : 1 }}>
                Cancel
              </button>
              <button onClick={handleMarkPaid} disabled={paying}
                style={{ padding: "9px 16px", borderRadius: 9, border: 0, background: "#2563eb", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: paying ? "default" : "pointer", opacity: paying ? 0.7 : 1 }}>
                {paying ? "Marking…" : "Mark as Paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── All Trips Tab ────────────────────────────────────────────────────────────

function AllTripsTab() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [allEmployees, setAllEmployees] = useState<{ id: string; name: string }[]>([]);
  const [empOpen, setEmpOpen] = useState(false);
  const [range, setRange] = useState<"week" | "lastweek" | "month" | "all" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    supabase.from("profiles")
      .select("id, first_name, last_name, role")
      .in("role", ["project_manager", "sales_rep"])
      .eq("is_active", true)
      .order("first_name")
      .then(({ data }) => setAllEmployees((data ?? []).map((p: any) => ({ id: p.id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() }))));
  }, []);

  const loadTrips = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const all = await mileageTripsAPI.getAll();
      setTrips(all);
    } catch (e) { console.error(e); }
    finally { if (!quiet) setLoading(false); }
  };

  useEffect(() => { loadTrips(); }, []);

  // Selected date range [from, to] inclusive (YYYY-MM-DD); null = open-ended
  const dateRange = useMemo<{ from: string | null; to: string | null }>(() => {
    const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().split("T")[0]; };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (range === "all") return { from: null, to: null };
    if (range === "custom") return { from: customFrom || null, to: customTo || null };
    if (range === "month") {
      const f = new Date(today.getFullYear(), today.getMonth(), 1);
      const t = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: iso(f), to: iso(t) };
    }
    // Friday–Thursday week (matches the pay week)
    const start = new Date(today); start.setDate(today.getDate() - ((today.getDay() - 5 + 7) % 7));
    if (range === "lastweek") start.setDate(start.getDate() - 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: iso(start), to: iso(end) };
  }, [range, customFrom, customTo]);

  // Live-update the All Trips list on any change (no page refresh)
  const allTripsRef = useRef(loadTrips);
  allTripsRef.current = loadTrips;
  useRealtimeRefetch(() => allTripsRef.current(true), ["mileage_submissions", "mileage_trips"]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) allTripsRef.current(true); }, 15000);
    return () => clearInterval(id);
  }, []);

  // Trip count per employee in this period
  const tripCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of trips) { const id = t._sub?.user?.id; if (id) map[id] = (map[id] ?? 0) + 1; }
    return map;
  }, [trips]);

  // All PMs + Sales Reps, each with their trip count (merge fetched list with anyone who has trips but isn't active)
  const employeeOptions = useMemo(() => {
    const byId: Record<string, { id: string; name: string; count: number }> = {};
    for (const e of allEmployees) byId[e.id] = { id: e.id, name: e.name, count: tripCountByUser[e.id] ?? 0 };
    for (const t of trips) {
      const u = t._sub?.user; if (!u?.id || byId[u.id]) continue;
      byId[u.id] = { id: u.id, name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown", count: tripCountByUser[u.id] ?? 0 };
    }
    return Object.values(byId).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allEmployees, trips, tripCountByUser]);

  const selectedEmpName = employeeFilter === "all" ? "All employees" : (employeeOptions.find(e => e.id === employeeFilter)?.name ?? "All employees");

  const filtered = trips.filter(t => {
    if (dateRange.from && t.trip_date < dateRange.from) return false;
    if (dateRange.to && t.trip_date > dateRange.to) return false;
    const name = t._sub?.user ? `${t._sub.user.first_name} ${t._sub.user.last_name}`.toLowerCase() : "";
    const cn = t.client ? `${t.client.first_name ?? ""} ${t.client.last_name ?? ""} ${t.client.address ?? ""}` : "";
    const addr = `${t.start_address} ${t.end_address} ${cn}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !addr.includes(search.toLowerCase())) return false;
    const bucket = t.is_personal ? "personal"
      : (() => { const e = effectiveTripStatus(t.status, t._sub?.status); return e === "denied" ? "denied" : (e === "approved" || e === "paid") ? "approved" : "pending"; })();
    if (statusFilter !== "all" && bucket !== statusFilter) return false;
    if (employeeFilter !== "all" && t._sub?.user?.id !== employeeFilter) return false;
    return true;
  });

  const totalMiles = filtered.reduce((s, t) => s + Number(t.miles), 0);
  const totalAmt = filtered.reduce((s, t) => s + Number(t.payout), 0);

  const exportCSV = () => {
    if (filtered.length === 0) { toast.info("No trips to export."); return; }
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["Date", "Employee", "Role", "From", "To", "Client", "Miles", "Amount", "Source", "Status"];
    const rows = filtered.map(t => {
      const u = t._sub?.user;
      const status = t.is_personal ? "Personal" : (() => { const e = effectiveTripStatus(t.status, t._sub?.status); return e === "denied" ? "Denied" : (e === "approved" || e === "paid") ? "Approved" : "Pending"; })();
      return [
        t.trip_date,
        u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : "",
        u?.role === "project_manager" ? "Project Manager" : u?.role === "sales_rep" ? "Sales Rep" : "",
        t.start_address,
        t.end_address,
        t.is_personal ? "Personal" : (t.client ? `${t.client.first_name ?? ""} ${t.client.last_name ?? ""}`.trim() : "Unmatched"),
        Number(t.miles).toFixed(1),
        Number(t.payout).toFixed(2),
        t.match_confidence === "auto" ? "Everlance" : "Manual",
        status,
      ].map(esc).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-trips${dateRange.from ? `-${dateRange.from}-to-${dateRange.to ?? dateRange.from}` : "-all"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} trip${filtered.length !== 1 ? "s" : ""}.`);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by employee, address, client..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {/* Date range dropdown (right side of search row) */}
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="lastweek">Last week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {range === "custom" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
          </div>
        )}
        <button onClick={exportCSV} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", background: "#fff", color: "#0a0a0a", cursor: "pointer" }}>
          <Download style={{ width: 14, height: 14 }} />Export CSV
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20, marginTop: 12 }}>
        <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 4, gap: 2 }}>
          {["all","pending","approved","denied","personal"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ border: 0, padding: "6px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
                background: statusFilter === s ? "#0a0a0a" : "transparent", color: statusFilter === s ? "#fff" : "#6b7280" }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setEmpOpen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", padding: "8px 12px", fontSize: 12.5, fontWeight: 500, color: "#0a0a0a", cursor: "pointer", minWidth: 160, justifyContent: "space-between" }}>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{selectedEmpName}</span>
            <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af", flexShrink: 0 }} />
          </button>
          {empOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setEmpOpen(false)} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 31, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px -8px rgba(15,23,42,.2)", padding: 4, minWidth: 240, maxHeight: 320, overflowY: "auto" }}>
                <button onClick={() => { setEmployeeFilter("all"); setEmpOpen(false); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", border: 0, background: employeeFilter === "all" ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "#0a0a0a", cursor: "pointer", textAlign: "left" }}>
                  All employees
                  {employeeFilter === "all" && <Check style={{ width: 13, height: 13, color: "#059669" }} />}
                </button>
                {employeeOptions.map(e => (
                  <button key={e.id} onClick={() => { setEmployeeFilter(e.id); setEmpOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", border: 0, background: employeeFilter === e.id ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "#0a0a0a", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</span>
                    {e.count > 0 && (
                      <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: "#0a0a0a", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px", flexShrink: 0 }}>{e.count}</span>
                    )}
                  </button>
                ))}
                {employeeOptions.length === 0 && (
                  <p style={{ margin: 0, padding: "10px", fontSize: 12.5, color: "#9ca3af" }}>No employees found.</p>
                )}
              </div>
            </>
          )}
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280", border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "8px 14px" }}>
          <strong style={{ color: "#0a0a0a" }}>{filtered.length}</strong>&nbsp;trips &nbsp;·&nbsp; {fmtMiles(totalMiles)} mi &nbsp;·&nbsp;
          <strong style={{ color: "#059669" }}>{fmtMoney(totalAmt)}</strong>
        </span>
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {/* Header (real) */}
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.2fr 1fr 90px 90px 100px 110px", gap: 18, padding: "11px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
            <div>Date</div><div>Employee &amp; Route</div><div>Project</div><div>Miles</div><div>Amount</div><div>Source</div><div>Status</div>
          </div>
          {/* Shimmer rows matching the real table layout */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ display: "grid", gridTemplateColumns: "130px 1.2fr 1fr 90px 90px 100px 110px", gap: 18, padding: "16px 22px", borderBottom: "1px solid #f1f3f5", alignItems: "center" }}>
              <div style={{ height: 12, width: "70%", borderRadius: 4, background: "#e5e7eb" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: "#e5e7eb", flexShrink: 0 }} />
                <div style={{ height: 12, width: "60%", borderRadius: 4, background: "#e5e7eb" }} />
              </div>
              <div style={{ height: 20, width: "80%", borderRadius: 6, background: "#eef0f2" }} />
              <div style={{ height: 12, width: 36, borderRadius: 4, background: "#e5e7eb" }} />
              <div style={{ height: 12, width: 48, borderRadius: 4, background: "#e5e7eb" }} />
              <div style={{ height: 18, width: 60, borderRadius: 999, background: "#eef0f2" }} />
              <div style={{ height: 18, width: 64, borderRadius: 999, background: "#eef0f2" }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "130px 1.2fr 1fr 90px 90px 100px 110px", gap: 18, padding: "11px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
            <div>Date</div><div>Employee &amp; Route</div><div>Project</div><div>Miles</div><div>Amount</div><div>Source</div><div>Status</div>
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                <Search style={{ width: 22, height: 22 }} />
              </div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>No trips match</p>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Try clearing filters or broadening your search.</p>
            </div>
          )}
          {filtered.map(t => {
            const userName = t._sub?.user ? `${t._sub.user.first_name} ${t._sub.user.last_name}` : "—";
            const status = effectiveTripStatus(t.status, t._sub?.status);
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "130px 1.2fr 1fr 90px 90px 100px 110px", gap: 18, padding: "14px 22px", borderBottom: "1px solid #f1f3f5", fontSize: 13, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{fmt(t.trip_date)}</div>
                  <div style={{ color: "#6b7280", fontSize: 11.5 }}>{fmtD(t.trip_date)}</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 4 }}>
                    <Avatar name={userName} size={26} />{userName}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
                    {t.start_address.split(",")[0]} &nbsp;→&nbsp; {t.end_address.split(",")[0]}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>{(() => {
                  if (t.is_personal) return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>Personal</span>;
                  const cn = t.client ? `${t.client.first_name ?? ""} ${t.client.last_name ?? ""}`.trim() : "";
                  const addr = t.client?.address || "";
                  const matched = t.match_confidence !== "unmatched";
                  return (
                    <>
                      <ProjectChip name={(addr || cn) || undefined} unmatched={!matched} />
                      {matched && addr && cn && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={cn}>{cn}</div>}
                    </>
                  );
                })()}</div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtMiles(Number(t.miles))}</div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: t.is_personal ? "#9ca3af" : "#0a0a0a", textDecoration: t.is_personal ? "line-through" : undefined }}>{fmtMoney(Number(t.payout))}</div>
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280" }}>
                    {t.match_confidence === "auto" ? "Everlance" : "Manual"}
                  </span>
                </div>
                <div>{t.is_personal
                  ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", textTransform: "uppercase" }}>Personal</span>
                  : <StatusBadge status={status} />}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Upload CSV Tab ───────────────────────────────────────────────────────────

function UploadCSVTab({ period, settings, adminId, onUploaded, onDirtyChange }: {
  period: MileagePeriod | null;
  settings: MileageSettings | null;
  adminId: string;
  onUploaded: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [empOpen, setEmpOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [draft, setDraft] = useState<MileageSubmission | null>(null);
  const [existingTrips, setExistingTrips] = useState<{ trip_date: string; end_address: string }[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadParsed, setUploadParsed] = useState(false); // MileageUpload has parsed-but-unsaved trips

  const rate = settings?.rate_per_mile ?? 0.725;

  // Dirty when: CSV parsed but not saved, OR trips saved to a draft but not yet submitted.
  useEffect(() => {
    onDirtyChange?.(uploadParsed || savedCount > 0);
    return () => onDirtyChange?.(false);
  }, [uploadParsed, savedCount]);

  useEffect(() => {
    supabase.from("profiles").select("id, first_name, last_name, role")
      .in("role", ["project_manager", "sales_rep"]).eq("is_active", true).order("first_name")
      .then(({ data }) => setEmployees((data ?? []).map((p: any) => ({ id: p.id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), role: p.role }))));
    supabase.from("projects").select("id, name, client_id, client:clients(address, first_name, last_name)")
      .in("status", ["active", "sold", "selling"]).order("name")
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  const selectEmployee = async (empId: string) => {
    setSelectedEmp(empId); setEmpOpen(false); setSavedCount(0); setDraft(null);
    if (!period) return;
    setPreparing(true);
    try {
      const d = await mileageSubmissionsAPI.getOrCreateDraft(period.id, empId, rate);
      setDraft(d);
      const trips = await mileageTripsAPI.getBySubmission(d.id);
      setExistingTrips(trips.map(t => ({ trip_date: t.trip_date, end_address: t.end_address })));
      setSavedCount(trips.length);
    } catch (e: any) { toast.error(e.message ?? "Failed to prepare submission."); }
    finally { setPreparing(false); }
  };

  const refreshDraft = async () => {
    if (!draft) return;
    const trips = await mileageTripsAPI.getBySubmission(draft.id);
    setExistingTrips(trips.map(t => ({ trip_date: t.trip_date, end_address: t.end_address })));
    setSavedCount(trips.length);
    onUploaded();
  };

  const handleSubmit = async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      await mileageSubmissionsAPI.submit(draft.id, adminId);
      const emp = employees.find(e => e.id === selectedEmp);
      if (selectedEmp) await notificationsAPI.create({
        type: "mileage_submitted", title: "Mileage Submitted",
        message: `Admin submitted your mileage for ${period ? periodLabel(period) : "this period"} on your behalf — it's now pending approval.`,
        link: "/mileage", recipient_id: selectedEmp,
      }).catch(() => {});
      toast.success(`Submitted ${emp?.name ?? "employee"}'s mileage for review.`);
      setDraft(null); setSelectedEmp(""); setSavedCount(0);
      onUploaded();
    } catch (e: any) { toast.error(e.message ?? "Failed to submit."); }
    finally { setSubmitting(false); }
  };

  const selName = selectedEmp ? (employees.find(e => e.id === selectedEmp)?.name ?? "") : "";

  const INTEGRATIONS = [
    { key: "ev", label: "Everlance",            sub: "CSV export · auto-mapping ready", gradient: "linear-gradient(135deg,#7c2d12,#ea580c)", active: true },
    { key: "mi", label: "MileIQ",               sub: "CSV export · coming soon",        gradient: "linear-gradient(135deg,#1e40af,#2563eb)", active: false },
    { key: "tr", label: "TripLog",              sub: "CSV export · coming soon",        gradient: "linear-gradient(135deg,#166534,#16a34a)", active: false },
    { key: "go", label: "Google Maps Timeline", sub: "KML/JSON · coming soon",          gradient: "linear-gradient(135deg,#0f172a,#475569)", active: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" }}>
      {/* Left: employee picker + upload */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 24 }}>
        {/* Employee picker */}
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Upload on behalf of</label>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <button onClick={() => setEmpOpen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", maxWidth: 320, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", padding: "9px 12px", fontSize: 13, fontWeight: 500, color: selName ? "#0a0a0a" : "#9ca3af", cursor: "pointer" }}>
            {selName || "Select an employee…"}
            <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af", flexShrink: 0 }} />
          </button>
          {empOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setEmpOpen(false)} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 31, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px -8px rgba(15,23,42,.2)", padding: 4, minWidth: 280, maxHeight: 300, overflowY: "auto" }}>
                {employees.length === 0 && <p style={{ margin: 0, padding: 10, fontSize: 12.5, color: "#9ca3af" }}>No PMs or Sales Reps found.</p>}
                {employees.map(e => (
                  <button key={e.id} onClick={() => selectEmployee(e.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", border: 0, background: selectedEmp === e.id ? "#f3f4f6" : "transparent", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontWeight: 500, color: "#0a0a0a", cursor: "pointer", textAlign: "left" }}>
                    <span>{e.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "#6b7280" }}>{e.role === "project_manager" ? "PM" : "Sales Rep"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Body */}
        {!period ? (
          <div style={{ border: "2px dashed #e5e7eb", borderRadius: 12, minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", color: "#9ca3af" }}>
            <Clock style={{ width: 26, height: 26, marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 600, color: "#0a0a0a" }}>No active period</p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>This week's mileage period hasn't opened yet.</p>
          </div>
        ) : !selectedEmp ? (
          <div style={{ border: "2px dashed #e5e7eb", borderRadius: 12, minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", color: "#9ca3af" }}>
            <Upload style={{ width: 26, height: 26, marginBottom: 10 }} />
            <p style={{ margin: 0, fontWeight: 600, color: "#0a0a0a" }}>Select an employee first</p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>Choose who you're uploading the Everlance CSV for.</p>
          </div>
        ) : preparing ? (
          <p style={{ color: "#9ca3af", fontSize: 13, padding: 20 }}>Preparing {selName}'s submission…</p>
        ) : draft ? (
          <>
            <MileageUpload
              submissionId={draft.id}
              periodLabel={`${fmt(period.week_start)} – ${fmt(period.week_end)}`}
              ratePerMile={rate}
              userId={adminId}
              existingTrips={existingTrips}
              projects={projects}
              onSaved={refreshDraft}
              onDirtyChange={setUploadParsed}
            />
            {savedCount > 0 && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>{savedCount} trip{savedCount !== 1 ? "s" : ""} saved to {selName}'s draft</span>
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ border: 0, background: "#0a0a0a", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "Submitting…" : "Submit for Review"}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* How it works — NO outer border, just content (design has no border on right panel) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingLeft: 4 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", margin: "0 0 14px" }}>How It Works</p>
          {[
            ["Export your ", "trips", " from your tracker app as CSV."],
            ["Drop the ", "file", " here — we'll auto detect columns."],
            ["We match each ", "destination address", " to projects you're assigned to."],
            ["Submit by Thursday 2pm CST. Approved miles pay out that ", "Friday", "."],
          ].map((parts, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              {/* Plain numbered style matching design — no black circle */}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a", flexShrink: 0, minWidth: 16 }}>{i + 1}.</span>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {parts[0]}<strong style={{ color: "#0a0a0a", fontWeight: 600 }}>{parts[1]}</strong>{parts[2]}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", margin: "0 0 12px" }}>Supported Integrations</p>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            {INTEGRATIONS.map((intg, idx) => (
              <div key={intg.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderTop: idx === 0 ? "none" : "1px solid #f1f3f5", gap: 16, opacity: intg.active ? 1 : 0.55 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: intg.active ? intg.gradient : "#9ca3af", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                    {intg.key === "go" ? "GO" : intg.key.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{intg.label}</div>
                    <div style={{ color: "#6b7280", fontSize: 11.5 }}>{intg.sub}</div>
                  </div>
                </div>
                {intg.active ? (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#059669", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 999, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                    <CheckCircle2 style={{ width: 12, height: 12 }} />Ready
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 14px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Info style={{ width: 16, height: 16, color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: "#1e293b", lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 700 }}>Reimbursement rate:</strong> ${settings?.rate_per_mile ?? 0.725} per business mile. Personal trips and home-to-office commute are excluded automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Payment History Tab ──────────────────────────────────────────────────────

function PaymentHistoryTab() {
  const [periods, setPeriods] = useState<MileagePeriod[]>([]);
  const [stats, setStats] = useState<Record<string, { miles: number; payout: number; employees: number; trips: number; paidOn?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [previewTitle, setPreviewTitle] = useState("");
  const [range, setRange] = useState<"all" | "year" | "month" | "lastmonth" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  type ReportData = { period: MileagePeriod; groups: { sub: MileageSubmission; trips: MileageTrip[] }[]; paidLabel: string; totalMiles: number; totalAmt: number };
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const loadHistory = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const all = await mileagePeriodsAPI.getAll();
      const map: typeof stats = {};
      const withPaid: MileagePeriod[] = [];
      await Promise.all(all.map(async p => {
        const subs = await mileageSubmissionsAPI.getByPeriod(p.id).catch(() => []);
        const paid = subs.filter(s => s.status === "paid");
        if (paid.length === 0) return;
        withPaid.push(p);
        const paidTimes = paid.map(s => s.paid_at).filter(Boolean).map(d => new Date(d as string).getTime());
        // Count reimbursed trips (approved, non-personal) across the period's paid submissions
        let tripCount = 0;
        for (const sub of paid) {
          const trips = (await mileageTripsAPI.getBySubmission(sub.id).catch(() => []))
            .filter(t => t.status !== "denied" && !t.is_personal);
          tripCount += trips.length;
        }
        map[p.id] = {
          employees: paid.length,
          trips: tripCount,
          miles: paid.reduce((s, sub) => s + Number(sub.total_miles), 0),
          payout: paid.reduce((s, sub) => s + Number(sub.total_payout), 0),
          paidOn: paidTimes.length ? new Date(Math.max(...paidTimes)).toISOString() : undefined,
        };
      }));
      // Most recent period first
      withPaid.sort((a, b) => (a.week_start < b.week_start ? 1 : -1));
      setPeriods(withPaid);
      setStats(map);
    } catch (e) { console.error(e); }
    finally { if (!quiet) setLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  // Live-update Payment History when a submission is marked paid (no page refresh)
  const historyRef = useRef(loadHistory);
  historyRef.current = loadHistory;
  useRealtimeRefetch(() => historyRef.current(true), ["mileage_submissions", "mileage_periods"]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) historyRef.current(true); }, 20000);
    return () => clearInterval(id);
  }, []);

  // Date range — filters paid periods by their paid date
  const dateRange = useMemo<{ from: string | null; to: string | null }>(() => {
    const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().split("T")[0]; };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (range === "all") return { from: null, to: null };
    if (range === "custom") return { from: customFrom || null, to: customTo || null };
    if (range === "year") return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(new Date(today.getFullYear(), 11, 31)) };
    if (range === "lastmonth") return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
    return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
  }, [range, customFrom, customTo]);

  const visiblePeriods = useMemo(() => periods.filter(p => {
    const paid = stats[p.id]?.paidOn ? stats[p.id]!.paidOn!.split("T")[0] : p.payment_date;
    if (dateRange.from && paid < dateRange.from) return false;
    if (dateRange.to && paid > dateRange.to) return false;
    return true;
  }), [periods, stats, dateRange]);

  const rangeLabel = range === "all" ? "all time" : range === "year" ? "this year" : range === "month" ? "this month" : range === "lastmonth" ? "last month" : "selected range";
  const totalPaid   = visiblePeriods.reduce((s, p) => s + (stats[p.id]?.payout ?? 0), 0);
  const totalMiles  = visiblePeriods.reduce((s, p) => s + (stats[p.id]?.miles ?? 0), 0);
  const totalEmps   = visiblePeriods.reduce((s, p) => s + (stats[p.id]?.employees ?? 0), 0);
  const totalTrips  = visiblePeriods.reduce((s, p) => s + (stats[p.id]?.trips ?? 0), 0);

  // Gather report data once — shared by the HTML preview and the PDF download
  const gatherReportData = async (p: MileagePeriod) => {
    const subs = await mileageSubmissionsAPI.getByPeriod(p.id).catch(() => [] as MileageSubmission[]);
    const paidSubs = subs.filter(s => s.status === "paid");
    if (paidSubs.length === 0) return null;
    const groups: { sub: MileageSubmission; trips: MileageTrip[] }[] = [];
    for (const s of paidSubs) {
      const trips = (await mileageTripsAPI.getBySubmission(s.id).catch(() => []))
        .filter(t => t.status !== "denied" && !t.is_personal);
      groups.push({ sub: s, trips });
    }
    const paidTimes = paidSubs.map(s => s.paid_at).filter(Boolean).map(d => new Date(d as string).getTime());
    const paidLabel = paidTimes.length
      ? new Date(Math.max(...paidTimes)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })
      : fmtY(p.payment_date);
    const totalMiles = groups.reduce((m, g) => m + g.trips.reduce((x, t) => x + Number(t.miles), 0), 0);
    const totalAmt = groups.reduce((m, g) => m + g.trips.reduce((x, t) => x + Number(t.payout), 0), 0);
    return { period: p, groups, paidLabel, totalMiles, totalAmt };
  };

  const buildReportDoc = async (p: MileagePeriod): Promise<jsPDF | null> => {
    const data = await gatherReportData(p);
    if (!data) { toast.info("No paid mileage in this period."); return null; }
    const { groups, paidLabel } = data;
    const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    const doc = new jsPDF();
    const GOLD = [187, 152, 77] as const;
    const logo = await loadBaLogo();

    // Branded header — matches the proposal (logo + company + contact, title on the right)
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, 210, 34, "F");
    let textX = 14;
    if (logo) {
      const h = 15, w = h * logo.ratio;
      doc.addImage(logo.dataUrl, "PNG", 14, 9.5, w, h);
      textX = 14 + w + 5;
    }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("Butler & Associates Construction, Inc.", textX, 14.5);
    doc.setTextColor(190, 190, 190); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("6275 University Drive NW, Suite 37-314, Huntsville, AL 35806", textX, 20.5);
    doc.text("(256) 617-4691  ·  info@butlerconstruction.co", textX, 25.5);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("MILEAGE REPORT", 196, 14.5, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`Period: ${periodLabelFull(p)}`, 14, 46);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(`Paid on: ${paidLabel}`, 14, 53);
    doc.text(`Status: Paid`, 14, 59);

    const C = { date: 14, from: 30, to: 80, client: 128, miles: 170, amount: 196 };
    let y = 72;
    const drawHead = () => {
      doc.setTextColor(150, 150, 150); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("DATE", C.date, y); doc.text("FROM", C.from, y); doc.text("TO", C.to, y); doc.text("CLIENT", C.client, y);
      doc.text("MILES", C.miles, y, { align: "right" }); doc.text("AMOUNT", C.amount, y, { align: "right" });
      doc.setDrawColor(220, 220, 220); doc.line(14, y + 2.5, 196, y + 2.5);
      y += 8;
    };
    drawHead();

    let gMiles = 0, gAmt = 0;
    for (const g of groups) {
      const name = g.sub.user ? `${g.sub.user.first_name ?? ""} ${g.sub.user.last_name ?? ""}`.trim() : "—";
      const role = g.sub.user?.role === "project_manager" ? "Project Manager" : "Sales Rep";
      if (y > 268) { doc.addPage(); y = 20; drawHead(); }
      // Employee sub-header
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
      doc.text(`${name}  ·  ${role}`, 14, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      let sMiles = 0, sAmt = 0;
      doc.setFontSize(8.5);
      for (const t of g.trips) {
        if (y > 280) { doc.addPage(); y = 20; drawHead(); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40); }
        const from = (t.start_address || "—").split(",")[0];
        const to = (t.end_address || "—").split(",")[0];
        const client = t.client ? `${t.client.first_name ?? ""} ${t.client.last_name ?? ""}`.trim() : "—";
        doc.text(fmt(t.trip_date), C.date, y);
        doc.text(trunc(from, 28), C.from, y);
        doc.text(trunc(to, 28), C.to, y);
        doc.text(trunc(client || "—", 16), C.client, y);
        doc.text(fmtMiles(Number(t.miles)), C.miles, y, { align: "right" });
        doc.text(fmtMoney(Number(t.payout)), C.amount, y, { align: "right" });
        y += 6; sMiles += Number(t.miles); sAmt += Number(t.payout);
      }
      // Employee subtotal
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      doc.text("Subtotal", C.client, y);
      doc.text(fmtMiles(sMiles), C.miles, y, { align: "right" });
      doc.text(fmtMoney(sAmt), C.amount, y, { align: "right" });
      y += 10; gMiles += sMiles; gAmt += sAmt;
    }

    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(180, 180, 180); doc.line(14, y - 1, 196, y - 1); y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text("Total", 14, y);
    doc.text(fmtMiles(gMiles), C.miles, y, { align: "right" });
    doc.setTextColor(5, 150, 105);
    doc.text(fmtMoney(gAmt), C.amount, y, { align: "right" });

    doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Thank you for choosing Butler & Associates Construction, Inc.", 105, 288, { align: "center" });

    return doc;
  };

  const downloadReport = async (p: MileagePeriod) => {
    const doc = await buildReportDoc(p);
    if (!doc) return;
    doc.save(`mileage-report-${p.week_start}.pdf`);
    toast.success("Report downloaded.");
  };

  const previewReport = async (p: MileagePeriod) => {
    const data = await gatherReportData(p);
    if (!data) { toast.info("No paid mileage in this period."); return; }
    setReportData(data);
    setPreviewTitle(`Mileage Report — ${periodLabelFull(p)}`);
  };

  return (
    <div>
      {/* 3 KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Paid",              value: fmtMoney(totalPaid),                      sub: `${visiblePeriods.length} period${visiblePeriods.length !== 1 ? "s" : ""} · ${rangeLabel}`, valueColor: "#059669", iconBg: "#d1fae5", iconColor: "#059669", icon: <DollarSign style={{ width: 18, height: 18 }} /> },
          { label: "Total Miles",       value: Math.round(totalMiles).toLocaleString(),  sub: "across all employees",             valueColor: "#2563eb", iconBg: "#dbeafe", iconColor: "#2563eb", icon: <Car style={{ width: 18, height: 18 }} /> },
          { label: "Trips Reimbursed",  value: totalTrips > 0 ? totalTrips.toString() : "—", sub: `${totalEmps} employee${totalEmps !== 1 ? "s" : ""}`, valueColor: "#0a0a0a", iconBg: "#f3f4f6", iconColor: "#9ca3af", icon: <CheckCircle2 style={{ width: 18, height: 18 }} /> },
        ].map(c => (
          <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: c.valueColor }}>{c.value}</div>
              <div style={{ color: "#9ca3af", fontSize: 11.5, fontWeight: 500, marginTop: 4 }}>{c.sub}</div>
            </div>
            <div style={{ color: c.iconColor, display: "grid", placeItems: "center", flexShrink: 0 }}>{c.icon}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", margin: 0 }}>Paid periods</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="lastmonth">Last month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
              <span style={{ color: "#9ca3af", fontSize: 13 }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {/* Header (real) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.7fr 0.8fr 1fr 150px", gap: 18, padding: "11px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
            <div>Period</div><div>Paid On</div><div style={{ textAlign: "right" }}>Trips</div><div style={{ textAlign: "right" }}>Miles</div><div style={{ textAlign: "right" }}>Total Paid</div><div></div>
          </div>
          {/* Shimmer rows matching the paid-periods table */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.7fr 0.8fr 1fr 150px", gap: 18, padding: "16px 22px", borderBottom: "1px solid #f1f3f5", alignItems: "center" }}>
              <div>
                <div style={{ height: 12, width: "70%", borderRadius: 4, background: "#e5e7eb", marginBottom: 6 }} />
                <div style={{ height: 10, width: "40%", borderRadius: 4, background: "#eef0f2" }} />
              </div>
              <div style={{ height: 12, width: "60%", borderRadius: 4, background: "#e5e7eb" }} />
              <div style={{ height: 12, width: 28, borderRadius: 4, background: "#e5e7eb", marginLeft: "auto" }} />
              <div style={{ height: 12, width: 44, borderRadius: 4, background: "#e5e7eb", marginLeft: "auto" }} />
              <div style={{ height: 12, width: 64, borderRadius: 4, background: "#e5e7eb", marginLeft: "auto" }} />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <div style={{ height: 28, width: 72, borderRadius: 7, background: "#eef0f2" }} />
                <div style={{ height: 28, width: 30, borderRadius: 7, background: "#eef0f2" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.7fr 0.8fr 1fr 150px", gap: 18, padding: "11px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
            <div>Period</div><div>Paid On</div><div style={{ textAlign: "right" }}>Trips</div><div style={{ textAlign: "right" }}>Miles</div><div style={{ textAlign: "right" }}>Total Paid</div><div></div>
          </div>
          {visiblePeriods.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                <Clock style={{ width: 22, height: 22 }} />
              </div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>{periods.length === 0 ? "No paid periods yet" : "No paid periods in this range"}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{periods.length === 0 ? "Approved mileage periods will appear here after payout." : "Try a different date range."}</p>
            </div>
          )}
          {visiblePeriods.map(p => {
            const s = stats[p.id] ?? { miles: 0, payout: 0, employees: 0, trips: 0 };
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.7fr 0.8fr 1fr 150px", gap: 18, padding: "14px 22px", borderBottom: "1px solid #f1f3f5", fontSize: 13, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{periodLabelFull(p)}</div>
                  <div style={{ color: "#6b7280", fontSize: 11.5, marginTop: 2 }}>{s.employees} employee{s.employees !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 13 }}>
                  <CheckCircle2 style={{ width: 13, height: 13 }} />{s.paidOn ? new Date(s.paidOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : fmtY(p.payment_date)}
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.trips ? s.trips.toLocaleString() : "—"}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{Math.round(s.miles).toLocaleString()}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 14, color: "#059669" }}>{fmtMoney(s.payout)}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => downloadReport(p)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#0a0a0a" }}>
                    <Download style={{ width: 12, height: 12 }} />Report
                  </button>
                  <button onClick={() => previewReport(p)} title="Preview report" style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", display: "grid", placeItems: "center", color: "#6b7280", cursor: "pointer" }}>
                    <Eye style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report preview modal — styled HTML (thin scrollbar), PDF via Download */}
      {reportData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setReportData(null)} />
          <div className="relative bg-white rounded-lg border shadow-lg overflow-hidden flex flex-col" style={{ width: 760, maxWidth: "95vw", height: "88vh" }}>
            <div className="shrink-0 px-5 py-3 border-b flex items-center justify-between gap-3">
              <p className="font-semibold text-sm truncate">{previewTitle}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => downloadReport(reportData.period)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: 0, background: "#0a0a0a", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  <Download style={{ width: 13, height: 13 }} />Download
                </button>
                <button onClick={() => setReportData(null)} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none px-1">✕</button>
              </div>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto bg-gray-100" style={{ padding: 24 }}>
              {/* A4-ish white sheet */}
              <div style={{ background: "#fff", maxWidth: 680, minHeight: 940, margin: "0 auto", boxShadow: "0 1px 6px rgba(0,0,0,.12)", display: "flex", flexDirection: "column" }}>
                {/* Branded header — matches proposal */}
                <div style={{ background: "#0a0a0a", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <img src={baLogoUrl} alt="B&A" style={{ height: 46, width: "auto", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 15.5 }}>Butler &amp; Associates Construction, Inc.</div>
                      <div style={{ color: "rgba(255,255,255,.65)", fontSize: 10.5, marginTop: 3 }}>6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</div>
                      <div style={{ color: "rgba(255,255,255,.65)", fontSize: 10.5 }}>(256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co</div>
                    </div>
                  </div>
                  <div style={{ color: "#bb984d", fontSize: 9, fontWeight: 600, letterSpacing: ".18em", flexShrink: 0 }}>MILEAGE REPORT</div>
                </div>
                <div style={{ padding: "20px 28px 24px", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Period: {periodLabelFull(reportData.period)}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>Paid on: {reportData.paidLabel}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>Status: Paid</div>

                  {/* Column header */}
                  <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 1.3fr 1fr 54px 72px", gap: 10, padding: "10px 0 6px", borderBottom: "1px solid #e5e7eb", marginTop: 18, color: "#9ca3af", fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em" }}>
                    <div>DATE</div><div>FROM</div><div>TO</div><div>CLIENT</div><div style={{ textAlign: "right" }}>MILES</div><div style={{ textAlign: "right" }}>AMOUNT</div>
                  </div>

                  {reportData.groups.map((g) => {
                    const name = g.sub.user ? `${g.sub.user.first_name ?? ""} ${g.sub.user.last_name ?? ""}`.trim() : "—";
                    const role = g.sub.user?.role === "project_manager" ? "Project Manager" : "Sales Rep";
                    const sMiles = g.trips.reduce((s, t) => s + Number(t.miles), 0);
                    const sAmt = g.trips.reduce((s, t) => s + Number(t.payout), 0);
                    return (
                      <div key={g.sub.id}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 14, marginBottom: 4 }}>{name} &nbsp;·&nbsp; <span style={{ fontWeight: 500, color: "#6b7280" }}>{role}</span></div>
                        {g.trips.map((t) => (
                          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 1.3fr 1fr 54px 72px", gap: 10, padding: "5px 0", fontSize: 12, borderBottom: "1px solid #f3f4f6", color: "#374151" }}>
                            <div>{fmt(t.trip_date)}</div>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.start_address}>{(t.start_address || "—").split(",")[0]}</div>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.end_address}>{(t.end_address || "—").split(",")[0]}</div>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.client ? `${t.client.first_name ?? ""} ${t.client.last_name ?? ""}`.trim() || "—" : "—"}</div>
                            <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMiles(Number(t.miles))}</div>
                            <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(Number(t.payout))}</div>
                          </div>
                        ))}
                        <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 1.3fr 1fr 54px 72px", gap: 10, padding: "6px 0", fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
                          <div></div><div></div><div></div><div style={{ textAlign: "right" }}>Subtotal</div>
                          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMiles(sMiles)}</div>
                          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(sAmt)}</div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand total */}
                  <div style={{ display: "grid", gridTemplateColumns: "56px 1.3fr 1.3fr 1fr 54px 72px", gap: 10, padding: "10px 0 0", marginTop: 8, borderTop: "2px solid #d1d5db", fontSize: 13, fontWeight: 800 }}>
                    <div>Total</div><div></div><div></div><div></div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMiles(reportData.totalMiles)}</div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#059669" }}>{fmtMoney(reportData.totalAmt)}</div>
                  </div>

                </div>
                {/* Thank-you footer — like the proposal */}
                <div style={{ borderTop: "1px solid #e5e7eb", padding: "14px 28px 22px", textAlign: "center" }}>
                  <div style={{ color: "#9ca3af", fontSize: 10.5 }}>Thank you for choosing Butler &amp; Associates Construction, Inc.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Component ─────────────────────────────────────────────────────

export function MileageAdmin() {
  const { user } = useAuth();
  const adminId = user?.profile?.id ?? "";

  const [tab, setTab] = useState<AdminTab>("pending");
  const [uploadDirty, setUploadDirty] = useState(false);
  const [pendingDirty, setPendingDirty] = useState(false);
  const [navConfirm, setNavConfirm] = useState<{ next: AdminTab; kind: "upload" | "pending" } | null>(null);
  const [settings, setSettings] = useState<MileageSettings | null>(null);
  const [periods, setPeriods] = useState<MileagePeriod[]>([]);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [kpi, setKpi] = useState({ pendingAmt: 0, approvedAmt: 0, totalMiles: 0, pendingTrips: 0, approvedTrips: 0, pendingEmps: 0 });

  const currentPeriod = periods[periodIdx] ?? null;

  const loadPeriods = async () => {
    const all = await mileagePeriodsAPI.getAll();
    setPeriods(all);
    return all;
  };

  useEffect(() => {
    const init = async () => {
      const s = await mileageSettingsAPI.get();
      setSettings(s);
      await loadPeriods();
      // Auto-create current period silently
      await mileagePeriodsAPI.ensureCurrentPeriod(adminId, s).then(async period => {
        const fresh = period.created_at && (Date.now() - new Date(period.created_at).getTime()) < 10000;
        if (fresh) {
          const { data: emps } = await supabase.from("profiles").select("id").in("role", ["project_manager","sales_rep"]).eq("is_active", true);
          if (emps?.length) {
            const lbl = `${fmt(period.week_start)} – ${fmt(period.week_end)}`;
            await Promise.all(emps.map(emp => notificationsAPI.create({
              type: "mileage_period_open", title: "Mileage Submission Open",
              message: `Submit your mileage CSV for ${lbl}. Deadline: Thursday 2:00 PM CST.`,
              link: "/mileage", recipient_id: emp.id,
            })));
          }
        }
      }).catch(() => {});
      await loadPeriods();
    };
    init().catch(console.error).finally(() => setLoading(false));
  }, []);

  // Load KPIs for the current period
  const loadKpis = async () => {
    if (!currentPeriod) return;
    const subs = await mileageSubmissionsAPI.getByPeriod(currentPeriod.id).catch(() => [] as MileageSubmission[]);
    const submitted = subs.filter(s => s.status === "submitted");
    const approved  = subs.filter(s => s.status === "approved");
    // Reimbursable miles = submitted + approved + paid (exclude denied + draft; personal already excluded at trip level)
    const reimbursable = subs.filter(s => s.status === "submitted" || s.status === "approved" || s.status === "paid");
    setPendingCount(submitted.length);
    setKpi({
      pendingAmt:   submitted.reduce((s, sub) => s + Number(sub.total_payout), 0),
      approvedAmt:  approved.reduce((s, sub) => s + Number(sub.total_payout), 0),
      totalMiles:   reimbursable.reduce((s, sub) => s + Number(sub.total_miles), 0),
      pendingTrips: submitted.length,
      approvedTrips: approved.length,
      pendingEmps:  submitted.length,
    });
  };
  useEffect(() => { loadKpis(); }, [currentPeriod?.id]);

  // Live-update header KPIs + period list on any change (no page refresh)
  const adminRefreshRef = useRef(() => {});
  adminRefreshRef.current = () => { loadKpis(); loadPeriods(); };
  useRealtimeRefetch(() => adminRefreshRef.current(), ["mileage_submissions", "mileage_trips", "mileage_periods"]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) adminRefreshRef.current(); }, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="animate-pulse" style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 32px 96px" }}>
      {/* Header: title + Upload button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ height: 26, width: 130, borderRadius: 6, background: "#e5e7eb", marginBottom: 10 }} />
          <div style={{ height: 12, width: 320, borderRadius: 4, background: "#eef0f2" }} />
        </div>
        <div style={{ height: 36, width: 120, borderRadius: 9, background: "#e5e7eb" }} />
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #e5e7eb", margin: "24px 0 0", paddingBottom: 14 }}>
        {[70, 60, 80, 110].map((w, i) => (
          <div key={i} style={{ height: 13, width: w, borderRadius: 4, background: i === 0 ? "#e5e7eb" : "#eef0f2" }} />
        ))}
      </div>
      {/* 4 KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 28 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 11, width: "60%", borderRadius: 4, background: "#eef0f2", marginBottom: 12 }} />
              <div style={{ height: 24, width: "50%", borderRadius: 5, background: "#e5e7eb", marginBottom: 8 }} />
              <div style={{ height: 9, width: "70%", borderRadius: 4, background: "#eef0f2" }} />
            </div>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#eef0f2", flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );

  const freqLabel = "Weekly";
  const remaining = currentPeriod ? daysRemaining(currentPeriod) : 0;

  // Guard tab switches with unsaved/in-progress work — uses a styled modal
  const switchTab = (next: AdminTab) => {
    if (next === tab) return;
    if (tab === "upload" && uploadDirty) { setNavConfirm({ next, kind: "upload" }); return; }
    if (tab === "pending" && pendingDirty) { setNavConfirm({ next, kind: "pending" }); return; }
    setTab(next);
  };

  const confirmLeave = () => {
    if (!navConfirm) return;
    if (navConfirm.kind === "upload") setUploadDirty(false);
    if (navConfirm.kind === "pending") setPendingDirty(false);
    setTab(navConfirm.next);
    setNavConfirm(null);
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px 96px", fontFamily: "inherit" }}>
      {/* Sticky header — title + tabs stay fixed while content scrolls */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", paddingTop: 32 }}>
      {/* Page head */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 6px" }}>Mileage</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Review, approve, and pay out employee mileage reimbursements</p>
        </div>
        <button onClick={() => switchTab("upload")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: 0, background: "#0a0a0a", color: "#fff", cursor: "pointer" }}>
          <Upload style={{ width: 14, height: 14 }} />Upload CSV
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #e5e7eb", margin: "24px 0 0" }}>
        {([
          { key: "pending", label: "Pending Review", count: pendingCount },
          { key: "all",     label: "All Trips" },
          { key: "upload",  label: "Upload CSV" },
          { key: "history", label: "Payment History" },
        ] as { key: AdminTab; label: string; count?: number }[]).map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            style={{ background: "transparent", border: 0, padding: "12px 2px 14px", fontSize: 14, fontWeight: tab === t.key ? 600 : 500, color: tab === t.key ? "#0a0a0a" : "#6b7280", borderBottom: `2px solid ${tab === t.key ? "#0a0a0a" : "transparent"}`, marginBottom: -1, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", transition: "color .15s" }}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span style={{ background: tab === t.key ? "#0a0a0a" : "#f3f4f6", color: tab === t.key ? "#fff" : "#6b7280", fontSize: 11.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      </div>{/* end sticky header */}

      {/* KPI cards — Pending Review only (they reflect the current week, not the All Trips range) */}
      {tab === "pending" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 28 }}>
          {[
            { label: "Pending Approval",        value: fmtMoney(kpi.pendingAmt),  sub: `${kpi.pendingTrips} trips · ${kpi.pendingEmps} employees`, valueColor: "#d97706", iconBg: "#fef3c7", iconColor: "#d97706", icon: <Clock style={{ width: 18, height: 18 }} /> },
            { label: "Approved This Period",     value: fmtMoney(kpi.approvedAmt), sub: `${kpi.approvedTrips} trips approved`,                       valueColor: "#059669", iconBg: "#d1fae5", iconColor: "#059669", icon: <TrendingUp style={{ width: 18, height: 18 }} /> },
            { label: "Total Reimbursable Miles", value: Math.round(kpi.totalMiles).toLocaleString(), sub: `@ $${settings?.rate_per_mile ?? 0.725}/mile`, valueColor: "#2563eb", iconBg: "#dbeafe", iconColor: "#2563eb", icon: <Car style={{ width: 18, height: 18 }} /> },
            { label: `${freqLabel} Estimated Payout`, value: fmtMoney(kpi.pendingAmt + kpi.approvedAmt), sub: currentPeriod ? `paid ${fmt(currentPeriod.payment_date)}` : "—", valueColor: "#0a0a0a", iconBg: "#f3f4f6", iconColor: "#6b7280", icon: <DollarSign style={{ width: 18, height: 18 }} /> },
          ].map(c => (
            <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: c.valueColor }}>{c.value}</div>
                <div style={{ color: "#9ca3af", fontSize: 11.5, fontWeight: 500, marginTop: 4 }}>{c.sub}</div>
              </div>
              <div style={{ color: c.iconColor, display: "grid", placeItems: "center", flexShrink: 0 }}>{c.icon}</div>
            </div>
          ))}
        </div>
      )}

      {/* Period bar — Pending Review ONLY (not All Trips per design) */}
      {tab === "pending" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, margin: "24px 0 0", fontSize: 13 }}>
          <button onClick={() => setPeriodIdx(i => Math.min(i + 1, periods.length - 1))} disabled={periodIdx >= periods.length - 1}
            style={{ width: 28, height: 28, borderRadius: 7, border: 0, background: "transparent", color: "#6b7280", display: "grid", placeItems: "center", cursor: "pointer", opacity: periodIdx >= periods.length - 1 ? 0.4 : 1 }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <Calendar style={{ width: 14, height: 14, color: "#9ca3af" }} />
          <span style={{ fontWeight: 600 }}>{currentPeriod ? periodLabelFull(currentPeriod) : "No periods"}</span>
          <button onClick={() => setPeriodIdx(i => Math.max(i - 1, 0))} disabled={periodIdx <= 0}
            style={{ width: 28, height: 28, borderRadius: 7, border: 0, background: "transparent", color: "#6b7280", display: "grid", placeItems: "center", cursor: "pointer", opacity: periodIdx <= 0 ? 0.4 : 1 }}>
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
          {currentPeriod?.status === "open" && remaining > 0 && (
            <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 12.5 }}>
              Current {freqLabel.toLowerCase()} · {remaining} day{remaining !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      )}

      {/* Tab content */}
      <div style={{ marginTop: 24 }}>
        {tab === "pending" && currentPeriod && settings && (
          <PendingReviewTab period={currentPeriod} adminId={adminId} settings={settings}
            onDirtyChange={setPendingDirty}
            onRefresh={() => mileageSubmissionsAPI.getByPeriod(currentPeriod.id).then(s => setPendingCount(s.filter(x => x.status === "submitted").length)).catch(() => {})} />
        )}
        {tab === "pending" && !currentPeriod && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "#9ca3af" }}>
              <Calendar style={{ width: 24, height: 24 }} />
            </div>
            <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Setting up this period…</p>
            <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280" }}>The current mileage period is being created. Refresh in a moment.</p>
          </div>
        )}
        {tab === "all" && <AllTripsTab />}
        {tab === "upload" && (
          <UploadCSVTab
            period={currentPeriod}
            settings={settings}
            adminId={adminId}
            onDirtyChange={setUploadDirty}
            onUploaded={() => mileageSubmissionsAPI.getByPeriod(currentPeriod?.id ?? "").then(s => setPendingCount(s.filter(x => x.status === "submitted").length)).catch(() => {})}
          />
        )}
        {tab === "history" && <PaymentHistoryTab />}
      </div>

      {/* Unsaved-changes guard modal */}
      {navConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setNavConfirm(null)} />
          <div className="relative bg-white rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div>
              <h3 className="font-bold text-base">Leave this tab?</h3>
              <p className="text-sm text-gray-500 mt-1">
                {navConfirm.kind === "upload"
                  ? "You have parsed trips that haven't been saved yet. If you leave, they'll be lost."
                  : "You have trips selected for a bulk action. If you leave, the selection will be cleared."}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50" onClick={() => setNavConfirm(null)}>Stay</button>
              <button className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700" onClick={confirmLeave}>Leave anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
