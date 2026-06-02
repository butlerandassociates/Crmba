import { useState, useEffect, useMemo, useRef } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { useAuth } from "../../contexts/auth-context";
import { Car, Clock, CheckCircle2, Search, Download, Info, Upload } from "lucide-react";
import { Input } from "../ui/input";
import { supabase } from "@/lib/supabase";
import { MileageUpload } from "./mileage-upload";
import { MileageAdmin } from "./mileage-admin";
import {
  mileageSettingsAPI,
  mileagePeriodsAPI,
  mileageSubmissionsAPI,
  mileageTripsAPI,
  type MileageSettings,
  type MileagePeriod,
  type MileageSubmission,
  type MileageTrip,
} from "../../api/mileage";
import { notificationsAPI } from "../../api/notifications";
import { toast } from "sonner";

// ─── Helpers (match admin styling tokens) ──────────────────────────────────────

const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
const fmtMiles = (n: number) => (Number(n) || 0).toFixed(1);
const fmt   = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtD  = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

function periodLabel(p: MileagePeriod) { return `${fmt(p.week_start)} – ${fmt(p.week_end)}`; }

type EmpTab = "mileage" | "upload" | "history";

// Project chip — same look as admin
function ProjectChip({ name, unmatched }: { name?: string; unmatched?: boolean }) {
  if (unmatched || !name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">
        Unmatched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 border border-blue-100 text-blue-700 max-w-[200px] truncate">
      {name}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "approved" ? "bg-green-50 border border-green-200 text-green-700"
    : status === "paid"     ? "bg-blue-50 border border-blue-200 text-blue-700"
    : status === "denied"   ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-amber-50 border border-amber-200 text-amber-700";
  const label = status === "submitted" ? "pending" : status;
  return <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md ${cls}`}>{label}</span>;
}

// Per-trip effective status: a trip individually approved/denied by admin shows that,
// even while the overall submission is still "submitted". Falls back to submission status.
function effectiveTripStatus(tripStatus?: string, subStatus?: string): string {
  if (tripStatus === "denied") return "denied";
  if (subStatus === "paid") return "paid";
  if (tripStatus === "approved" || subStatus === "approved") return "approved";
  return subStatus ?? "draft";
}
// Bucket the effective status into the My History filter tabs.
function historyBucket(eff: string): "pending" | "approved" | "denied" {
  if (eff === "denied") return "denied";
  if (eff === "approved" || eff === "paid") return "approved";
  return "pending";
}

// ─── Employee View ────────────────────────────────────────────────────────────

function EmployeeMileagePage() {
  const { user } = useAuth();
  const userId = user?.profile?.id ?? "";

  const [tab, setTab] = useState<EmpTab>("mileage");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MileageSettings | null>(null);
  const [period, setPeriod] = useState<MileagePeriod | null>(null);
  const [submission, setSubmission] = useState<MileageSubmission | null>(null);
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [allTrips, setAllTrips] = useState<any[]>([]); // for My History tab (every trip across periods)
  const [projects, setProjects] = useState<any[]>([]);
  const [existingTrips, setExistingTrips] = useState<{ trip_date: string; end_address: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MileageTrip | null>(null);
  const [removing, setRemoving] = useState(false);

  // My History tab filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const rate = settings?.rate_per_mile ?? 0.70;
  const isDeadlinePassed = period ? new Date() > new Date(period.submission_deadline) : false;

  const fetchAll = async (quiet = false) => {
    if (!userId) return;
    if (!quiet) setLoading(true);
    try {
      const [settingsData, projectsRes] = await Promise.all([
        mileageSettingsAPI.get(),
        supabase
          .from("projects")
          .select("id, name, client_id, client:clients(address, first_name, last_name)")
          .in("status", ["active", "sold", "selling"])
          .order("name"),
      ]);
      setSettings(settingsData);
      setProjects(projectsRes.data ?? []);

      const currentPeriod = await mileagePeriodsAPI.getCurrent();
      setPeriod(currentPeriod);

      const mySubs = await mileageSubmissionsAPI.getMySubmissions(userId);

      let currentSub: MileageSubmission | null = null;
      if (currentPeriod) {
        currentSub = await mileageSubmissionsAPI.getOrCreateDraft(currentPeriod.id, userId, settingsData.rate_per_mile);
        setSubmission(currentSub);
        const tripData = await mileageTripsAPI.getBySubmission(currentSub.id);
        setTrips(tripData);
        setExistingTrips(tripData.map((t) => ({ trip_date: t.trip_date, end_address: t.end_address })));
      } else {
        setSubmission(null);
        setTrips([]);
      }

      // Load every trip across all submissions for the My History tab
      const tripArrays = await Promise.all(
        mySubs.map((s) => mileageTripsAPI.getBySubmission(s.id).then((ts) => ts.map((t) => ({ ...t, _sub: s }))))
      );
      setAllTrips(tripArrays.flat().sort((a, b) => b.trip_date.localeCompare(a.trip_date)));
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load mileage data.");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [userId]);

  // Live-update when the employee's own trips/submissions change (no page refresh)
  const fetchRef = useRef(fetchAll);
  fetchRef.current = fetchAll;
  useRealtimeRefetch(() => fetchRef.current(true), ["mileage_trips", "mileage_submissions", "mileage_periods"]);
  // Polling fallback (realtime on RLS sub-query tables can be unreliable) — quiet refetch every 15s while visible
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) fetchRef.current(true); }, 15000);
    return () => clearInterval(id);
  }, []);

  // Warn on browser close/reload when trips are saved to the draft but not yet submitted
  const hasUnsubmitted = submission?.status === "draft" && trips.length > 0 && !isDeadlinePassed;
  useEffect(() => {
    if (!hasUnsubmitted) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsubmitted]);

  const handleSubmit = async () => {
    if (!submission) return;
    if (trips.length === 0) { toast.error("Add at least one trip before submitting."); return; }
    if (isDeadlinePassed) { toast.error("Submission deadline has passed for this week."); return; }
    setSubmitting(true);
    try {
      await mileageSubmissionsAPI.submit(submission.id, userId);
      // Notify admins that a new mileage submission needs review (broadcast: recipient_id omitted)
      const empName = `${user?.profile?.first_name ?? ""} ${user?.profile?.last_name ?? ""}`.trim() || "An employee";
      const weekLabel = period ? periodLabel(period) : "the current period";
      await notificationsAPI.create({
        type: "mileage_submitted",
        title: "Mileage submitted for review",
        message: `${empName} submitted ${trips.length} trip${trips.length === 1 ? "" : "s"} (${fmtMoney(periodPayout)}) for ${weekLabel}.`,
        link: "/mileage",
      }).catch(() => {}); // never block the submit on a notification failure
      toast.success("Mileage submitted for review!");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  // Employee reopens a denied submission to fix & resubmit the same week
  const handleReopen = async () => {
    if (!submission || submission.status !== "denied") return;
    if (isDeadlinePassed) { toast.error("The Thursday 2pm cutoff for this week has passed."); return; }
    try {
      await mileageSubmissionsAPI.reopen(submission.id, userId);
      toast.success("Reopened — edit your trips and resubmit before the cutoff.");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message ?? "Could not reopen submission.");
    }
  };

  // Employee deletes one of their own draft trips (confirmed via dialog)
  const handleRemoveTrip = async () => {
    if (!removeTarget || !submission) return;
    setRemoving(true);
    try {
      await mileageTripsAPI.remove(removeTarget.id, userId);
      await mileageSubmissionsAPI.recalcTotals(submission.id, userId);
      setRemoveTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message ?? "Could not remove trip.");
    } finally {
      setRemoving(false);
    }
  };

  // Employee marks/unmarks one of their own draft trips as Personal (excluded from payout)
  const toggleTripPersonal = async (tripId: string, next: boolean) => {
    if (!submission) return;
    try {
      await mileageTripsAPI.setPersonal(tripId, next, userId);
      await mileageSubmissionsAPI.recalcTotals(submission.id, userId);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update trip.");
    }
  };

  // ── KPI numbers for the hero ── (personal + denied trips are excluded from payout)
  const countedTrips = trips.filter((t) => !t.is_personal && t.status !== "denied");
  const periodMiles = countedTrips.reduce((s, t) => s + Number(t.miles), 0);
  const periodPayout = countedTrips.reduce((s, t) => s + Number(t.payout), 0);
  const pendingAmt = submission?.status === "submitted" || submission?.status === "draft" ? periodPayout : 0;
  const approvedAmt = submission?.status === "approved" || submission?.status === "paid" ? Number(submission.total_payout) : 0;
  const tripCount = trips.length;
  // Denied = all trips when the whole submission is denied, else individually-denied trips
  const deniedCount = submission?.status === "denied" ? trips.length : trips.filter((t) => t.status === "denied").length;

  // ── My History filtered trips ──
  const filteredHistory = useMemo(() => allTrips.filter((t) => {
    const status = t.is_personal ? "personal" : historyBucket(effectiveTripStatus(t.status, t._sub?.status));
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (search) {
      const hay = `${t.start_address} ${t.end_address} ${t.project?.name ?? ""} ${t.trip_date}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [allTrips, statusFilter, search]);

  const histMiles = filteredHistory.reduce((s, t) => s + Number(t.miles), 0);
  const histAmt = filteredHistory.reduce((s, t) => s + Number(t.payout), 0);

  const exportCSV = () => {
    if (filteredHistory.length === 0) { toast.info("No trips to export."); return; }
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const headers = ["Date", "From", "To", "Project", "Miles", "Amount", "Status"];
    const rows = filteredHistory.map((t) => {
      const eff = historyBucket(effectiveTripStatus(t.status, t._sub?.status));
      const status = eff === "approved" ? "Approved" : eff === "denied" ? "Denied" : "Pending";
      return [t.trip_date, t.start_address, t.end_address, t.project?.name ?? "Unmatched", Number(t.miles).toFixed(1), Number(t.payout).toFixed(2), status].map(esc).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `my-mileage-history.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredHistory.length} trip${filteredHistory.length !== 1 ? "s" : ""}.`);
  };

  if (loading) return (
    <div className="animate-pulse" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px 96px" }}>
      <div style={{ paddingTop: 32 }}>
        <div style={{ height: 26, width: 130, borderRadius: 6, background: "#e5e7eb", marginBottom: 10 }} />
        <div style={{ height: 12, width: 320, borderRadius: 4, background: "#eef0f2" }} />
        <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #e5e7eb", margin: "24px 0 0", paddingBottom: 14 }}>
          {[70, 60, 80].map((w, i) => <div key={i} style={{ height: 13, width: w, borderRadius: 4, background: i === 0 ? "#e5e7eb" : "#eef0f2" }} />)}
        </div>
      </div>
      <div style={{ height: 150, borderRadius: 16, background: "#e5e7eb", marginTop: 28 }} />
    </div>
  );

  // Employees can add/edit/remove trips while DRAFT or SUBMITTED, up until the Thursday cutoff
  // (Jonathan: "they can continue uploading until cutoff"). Approved/paid/denied are not editable here.
  const canEdit = (submission?.status === "draft" || submission?.status === "submitted") && !isDeadlinePassed;
  // Submit (draft → submitted) only happens from a draft with every trip matched.
  const canSubmit = submission?.status === "draft" && !isDeadlinePassed && trips.length > 0 && trips.every((t) => t.match_confidence !== "unmatched");

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px 96px", fontFamily: "inherit" }}>
      {/* Sticky header — title + tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", paddingTop: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", margin: "0 0 6px" }}>Mileage</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Upload your trips and track weekly earnings at ${rate}/mi</p>
        </div>
        <div style={{ display: "flex", gap: 28, borderBottom: "1px solid #e5e7eb", margin: "24px 0 0" }}>
          {([
            { key: "mileage", label: "My Mileage" },
            { key: "upload",  label: "Upload CSV" },
            { key: "history", label: "My History" },
          ] as { key: EmpTab; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: "transparent", border: 0, padding: "12px 2px 14px", fontSize: 14, fontWeight: tab === t.key ? 600 : 500, color: tab === t.key ? "#0a0a0a" : "#6b7280", borderBottom: `2px solid ${tab === t.key ? "#0a0a0a" : "transparent"}`, marginBottom: -1, cursor: "pointer", transition: "color .15s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MY MILEAGE TAB ── */}
      {tab === "mileage" && (
        <div style={{ marginTop: 28 }}>
          {/* Earnings hero */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Big dark earnings card */}
            <div style={{ gridRow: "span 2", background: "#0a0a0a", borderRadius: 16, padding: "24px 28px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10 }}>
                Weekly Earnings · Current Period
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{fmtMoney(periodPayout)}</div>
              <div style={{ color: "#9ca3af", fontSize: 12.5, marginTop: 10 }}>
                {fmtMiles(periodMiles)} business miles at ${rate}/mi{period ? ` · paid ${fmt(period.payment_date)}` : ""}
              </div>
              {period && (
                <div style={{ height: 6, background: "rgba(255,255,255,.12)", borderRadius: 999, marginTop: 16, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (periodMiles / 200) * 100)}%`, background: "#10b981", borderRadius: 999 }} />
                </div>
              )}
            </div>
            {/* Pending / Approved / Trips / Denied */}
            {[
              { label: "Pending",  value: fmtMoney(pendingAmt),  color: "#d97706" },
              { label: "Approved", value: fmtMoney(approvedAmt), color: "#059669" },
              { label: "Trips",    value: String(tripCount),     color: "#0a0a0a" },
              { label: "Denied",   value: String(deniedCount),   color: "#0a0a0a" },
            ].map((c) => (
              <div key={c.label} style={{ background: "#0a0a0a", borderRadius: 14, padding: "16px 18px", color: "#fff" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color === "#0a0a0a" ? "#fff" : c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Deadline banner */}
          {!isDeadlinePassed && period && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#1e40af" }}>
              <Clock style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span>Submit by <strong>Thursday 2:00 PM CST</strong> to be paid Friday. Deadline: {new Date(period.submission_deadline).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago", timeZoneName: "short" })}.</span>
            </div>
          )}

          {/* No period */}
          {!period && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Clock style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>No active period</p>
              <p style={{ margin: 0, fontSize: 13.5 }}>The admin hasn't opened this week's mileage period yet. Check back Monday.</p>
            </div>
          )}

          {/* Status banner for submitted / approved / denied */}
          {period && submission && submission.status !== "draft" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, marginBottom: 20,
              background: submission.status === "approved" ? "#f0fdf4" : submission.status === "denied" ? "#fef2f2" : "#eff6ff",
              border: `1px solid ${submission.status === "approved" ? "#bbf7d0" : submission.status === "denied" ? "#fecaca" : "#dbeafe"}` }}>
              {(submission.status === "approved" || submission.status === "paid") ? <CheckCircle2 style={{ width: 20, height: 20, color: submission.status === "paid" ? "#2563eb" : "#059669" }} /> : <Clock style={{ width: 20, height: 20, color: submission.status === "denied" ? "#dc2626" : "#2563eb" }} />}
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: submission.status === "approved" ? "#065f46" : submission.status === "paid" ? "#1e40af" : submission.status === "denied" ? "#991b1b" : "#1e40af" }}>
                  {submission.status === "approved" ? "Approved" : submission.status === "paid" ? "Paid" : submission.status === "denied" ? "Denied" : "Submitted — Awaiting Review"}
                </p>
                {submission.status === "denied" && submission.denial_reason
                  ? <p style={{ margin: "2px 0 0", fontSize: 13, color: "#991b1b" }}>Reason: {submission.denial_reason}</p>
                  : <p style={{ margin: "2px 0 0", fontSize: 13, color: "#374151" }}>{fmtMoney(Number(submission.total_payout))} · {fmtMiles(Number(submission.total_miles))} miles{submission.status === "submitted" && !isDeadlinePassed ? " · you can still add or edit trips until the Thursday 2pm cutoff" : ""}</p>}
              </div>
              {submission.status === "denied" && !isDeadlinePassed && (
                <button onClick={handleReopen}
                  style={{ marginLeft: "auto", border: 0, background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9, cursor: "pointer", flexShrink: 0 }}>
                  Fix &amp; Resubmit
                </button>
              )}
            </div>
          )}

          {/* Recent trips — RECENT TRIPS label (left) + Upload button (right) on one row, above the table */}
          {period && trips.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280" }}>Recent Trips</span>
                {canEdit && (
                  <button onClick={() => setTab("upload")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: 0, background: "#0a0a0a", color: "#fff", cursor: "pointer" }}>
                    <Upload style={{ width: 14, height: 14 }} />Upload mileage CSV
                  </button>
                )}
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 80px 90px 100px", gap: 16, padding: "10px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                <div>Date</div><div>Route</div><div>Project</div><div style={{ textAlign: "right" }}>Miles</div><div style={{ textAlign: "right" }}>Amount</div><div style={{ textAlign: "right" }}>Status</div>
              </div>
              {trips.map((t) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 80px 90px 100px", gap: 16, padding: "14px 22px", borderBottom: "1px solid #f1f3f5", fontSize: 13, alignItems: "center" }}>
                  <div><div style={{ fontWeight: 700 }}>{fmt(t.trip_date)}</div><div style={{ color: "#6b7280", fontSize: 11.5 }}>{fmtD(t.trip_date)}</div></div>
                  <div><div style={{ fontWeight: 500 }}>{t.end_address.split(",")[0]}</div><div style={{ color: "#6b7280", fontSize: 11.5 }}>from {t.start_address.split(",")[0]}</div></div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    {t.is_personal
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 4 }}>Personal</span>
                      : <ProjectChip name={t.project?.name} unmatched={t.match_confidence === "unmatched"} />}
                    {canEdit && (
                      <button onClick={() => toggleTripPersonal(t.id, !t.is_personal)}
                        style={{ border: 0, background: "transparent", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                        {t.is_personal ? "Mark as business" : "Mark personal"}
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", opacity: t.is_personal ? 0.4 : 1 }}>{fmtMiles(Number(t.miles))}</div>
                  <div style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", textDecoration: t.is_personal ? "line-through" : undefined, color: t.is_personal ? "#9ca3af" : undefined }}>{fmtMoney(Number(t.payout))}</div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <StatusPill status={effectiveTripStatus(t.status, submission?.status)} />
                    {canEdit && (
                      <button onClick={() => setRemoveTarget(t)}
                        style={{ border: 0, background: "transparent", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Remove-trip confirmation */}
          {removeTarget && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} onClick={() => !removing && setRemoveTarget(null)} />
              <div style={{ position: "relative", background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, margin: "0 16px", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px 16px" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>Remove this trip?</h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: "#6b7280", lineHeight: 1.5 }}>
                    {fmt(removeTarget.trip_date)} · {removeTarget.end_address.split(",")[0]} ({fmtMiles(Number(removeTarget.miles))} mi) will be removed from this week's submission.
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px 20px" }}>
                  <button onClick={() => setRemoveTarget(null)} disabled={removing}
                    style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13.5, fontWeight: 600, cursor: removing ? "default" : "pointer", opacity: removing ? 0.6 : 1 }}>
                    Cancel
                  </button>
                  <button onClick={handleRemoveTrip} disabled={removing}
                    style={{ padding: "9px 16px", borderRadius: 9, border: 0, background: "#dc2626", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: removing ? "default" : "pointer", opacity: removing ? 0.7 : 1 }}>
                    {removing ? "Removing…" : "Remove trip"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state — period open, no trips yet */}
          {period && canEdit && trips.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, textAlign: "center", padding: "56px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Car style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>No trips yet this week</p>
              <p style={{ margin: "0 0 16px", fontSize: 13.5 }}>Upload your Everlance CSV to log this week's mileage.</p>
              <button onClick={() => setTab("upload")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: 0, background: "#0a0a0a", color: "#fff", cursor: "pointer" }}>
                <Upload style={{ width: 14, height: 14 }} />Upload mileage CSV
              </button>
            </div>
          )}

          {/* Submit button */}
          {period && submission?.status === "draft" && trips.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                style={{ border: 0, background: "#0a0a0a", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 9, cursor: "pointer", opacity: (!canSubmit || submitting) ? 0.5 : 1 }}>
                {submitting ? "Submitting…" : "Submit for Approval"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD CSV TAB ── */}
      {tab === "upload" && (
        <div style={{ marginTop: 28 }}>
          {!period ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Clock style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>No active period</p>
              <p style={{ margin: 0, fontSize: 13.5 }}>This week's mileage period hasn't opened yet.</p>
            </div>
          ) : isDeadlinePassed ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#fef3c7", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "#d97706" }}><Clock style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>Deadline passed</p>
              <p style={{ margin: 0, fontSize: 13.5 }}>The Thursday 2pm CST cutoff for this period has passed.</p>
            </div>
          ) : (submission?.status === "approved" || submission?.status === "paid") ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f0fdf4", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "#059669" }}><CheckCircle2 style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>This week is {submission?.status}</p>
              <p style={{ margin: 0, fontSize: 13.5 }}>This week's mileage has been {submission?.status} and is locked. Check the My Mileage tab.</p>
            </div>
          ) : submission?.status === "denied" ? (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", textAlign: "center", padding: "64px 24px", color: "#9ca3af" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#fef2f2", display: "grid", placeItems: "center", margin: "0 auto 14px", color: "#dc2626" }}><Clock style={{ width: 24, height: 24 }} /></div>
              <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>This week was denied</p>
              <p style={{ margin: 0, fontSize: 13.5 }}>Use <strong>Fix &amp; Resubmit</strong> on the My Mileage tab to reopen it, then upload.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" }}>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "#fff", padding: 24 }}>
                {submission && (
                  <MileageUpload
                    submissionId={submission.id}
                    periodLabel={period ? periodLabel(period) : ""}
                    ratePerMile={rate}
                    userId={userId}
                    existingTrips={existingTrips}
                    projects={projects}
                    onSaved={fetchAll}
                  />
                )}
              </div>
              {/* How it works + reimbursement note (employee — no integrations panel) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingLeft: 4 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280", margin: "0 0 14px" }}>How It Works</p>
                  {[
                    ["Export your ", "trips", " from your Everlance app as CSV."],
                    ["Drop the ", "file", " here — we'll auto detect columns."],
                    ["We match each ", "destination address", " to projects you're assigned to."],
                    ["Submit by Thursday 2pm CST. Approved miles pay out that ", "Friday", "."],
                  ].map((parts, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a", flexShrink: 0, minWidth: 16 }}>{i + 1}.</span>
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{parts[0]}<strong style={{ color: "#0a0a0a", fontWeight: 600 }}>{parts[1]}</strong>{parts[2]}</p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 14px", background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Info style={{ width: 16, height: 16, color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 12.5, color: "#1e293b", lineHeight: 1.55 }}>
                    <strong style={{ fontWeight: 700 }}>Reimbursement rate:</strong> ${rate} per business mile. Personal trips and home-to-office commute are excluded automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY HISTORY TAB ── */}
      {tab === "history" && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by project, address, date..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <button onClick={exportCSV} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", background: "#fff", color: "#0a0a0a", cursor: "pointer" }}>
              <Download style={{ width: 14, height: 14 }} />Export CSV
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 20, marginTop: 12 }}>
            <div style={{ display: "inline-flex", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 4, gap: 2 }}>
              {["all", "pending", "approved", "denied", "personal"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ border: 0, padding: "6px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
                    background: statusFilter === s ? "#0a0a0a" : "transparent", color: statusFilter === s ? "#fff" : "#6b7280" }}>
                  {s}
                </button>
              ))}
            </div>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280", border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "8px 14px" }}>
              <strong style={{ color: "#0a0a0a" }}>{filteredHistory.length}</strong>&nbsp;trips &nbsp;·&nbsp; {fmtMiles(histMiles)} mi &nbsp;·&nbsp; <strong style={{ color: "#059669" }}>{fmtMoney(histAmt)}</strong>
            </span>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "130px 1.4fr 1fr 90px 90px 110px", gap: 18, padding: "11px 22px", background: "#f9fafb", color: "#6b7280", fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
              <div>Date</div><div>Route</div><div>Project</div><div>Miles</div><div>Amount</div><div>Status</div>
            </div>
            {filteredHistory.length === 0 && (
              <div style={{ padding: "64px 24px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f3f4f6", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Car style={{ width: 22, height: 22 }} /></div>
                <p style={{ color: "#0a0a0a", fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>No trips yet</p>
                <p style={{ margin: 0, fontSize: 13 }}>Your submitted trips will appear here.</p>
              </div>
            )}
            {filteredHistory.map((t) => {
              const status = effectiveTripStatus(t.status, t._sub?.status);
              const isPersonal = t.is_personal;
              return (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "130px 1.4fr 1fr 90px 90px 110px", gap: 18, padding: "14px 22px", borderBottom: "1px solid #f1f3f5", fontSize: 13, alignItems: "center" }}>
                  <div><div style={{ fontWeight: 700 }}>{fmt(t.trip_date)}</div><div style={{ color: "#6b7280", fontSize: 11.5 }}>{fmtD(t.trip_date)}</div></div>
                  <div style={{ color: "#6b7280", fontSize: 11.5 }}>{t.start_address.split(",")[0]} &nbsp;→&nbsp; {t.end_address.split(",")[0]}</div>
                  <div>{isPersonal
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>Personal</span>
                    : <ProjectChip name={t.project?.name} unmatched={t.match_confidence === "unmatched"} />}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtMiles(Number(t.miles))}</div>
                  <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, textDecoration: isPersonal ? "line-through" : undefined, color: isPersonal ? "#9ca3af" : undefined }}>{fmtMoney(Number(t.payout))}</div>
                  <div>{isPersonal
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb", textTransform: "uppercase" }}>Personal</span>
                    : <StatusPill status={status} />}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin view — delegates to MileageAdmin ─────────────────────────────────────

function AdminMileagePage() {
  return <MileageAdmin />;
}

// ─── Route wrapper — renders admin or employee view based on role ─────────────

export function MileagePage() {
  const { role } = usePermissions();

  if (role === "admin") return <AdminMileagePage />;
  if (role === "project_manager" || role === "sales_rep") return <EmployeeMileagePage />;

  return (
    <div className="p-6 flex items-center justify-center min-h-[40vh]">
      <p className="text-muted-foreground">You don't have access to this page.</p>
    </div>
  );
}
