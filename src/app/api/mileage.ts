/**
 * Mileage Tracker API
 * CRUD for mileage_settings, mileage_periods, mileage_submissions, mileage_trips
 */

import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MileageSettings {
  id: string;
  rate_per_mile: number;
  submission_deadline_day: number;
  submission_deadline_hour: number;
  payment_day: number;
  updated_at: string;
  updated_by: string | null;
}

export interface MileagePeriod {
  id: string;
  week_start: string;
  week_end: string;
  submission_deadline: string;
  payment_date: string;
  status: "open" | "closed";
  is_active: boolean;
  created_at: string;
}

export interface MileageSubmission {
  id: string;
  period_id: string;
  user_id: string;
  status: "draft" | "submitted" | "approved" | "denied" | "paid";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  denial_reason: string | null;
  total_miles: number;
  total_payout: number;
  rate_per_mile: number;
  is_active: boolean;
  discarded_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  // joined
  user?: { id: string; first_name: string; last_name: string; role: string };
  period?: MileagePeriod;
  trips?: MileageTrip[];
}

export interface MileageTrip {
  id: string;
  submission_id: string;
  trip_date: string;
  start_address: string;
  end_address: string;
  miles: number;
  project_id: string | null;
  client_id: string | null;
  is_duplicate: boolean;
  match_confidence: "auto" | "manual" | "unmatched";
  payout: number;
  status: "pending" | "approved" | "denied";
  denial_reason: string | null;
  map_image_url: string | null;
  is_personal: boolean;
  is_active: boolean;
  discarded_at: string | null;
  created_at: string;
  // joined
  project?: { id: string; name: string };
  client?: { id: string; first_name: string; last_name: string; address?: string | null };
}

// ─── Parsed CSV trip (pre-save) ──────────────────────────────────────────────

export interface ParsedTrip {
  trip_date: string;
  start_address: string;
  end_address: string;
  miles: number;
  project_id: string | null;
  client_id: string | null;
  match_confidence: "auto" | "manual" | "unmatched";
  is_duplicate: boolean;
  payout: number;
  map_image_url: string | null;
  // UI only
  _id: string; // temp client-side key
}

// ─── Settings ────────────────────────────────────────────────────────────────

export const mileageSettingsAPI = {
  get: async (): Promise<MileageSettings> => {
    const { data, error } = await supabase
      .from("mileage_settings")
      .select("*")
      .limit(1)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (fields: Partial<MileageSettings>, updatedBy: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_settings")
      .update({ ...fields, updated_by: updatedBy })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // update the single row
    if (error) throw new Error(error.message);
  },
};

// ─── Periods ─────────────────────────────────────────────────────────────────

export const mileagePeriodsAPI = {
  getAll: async (): Promise<MileagePeriod[]> => {
    const { data, error } = await supabase
      .from("mileage_periods")
      .select("*")
      .eq("is_active", true)
      .order("week_start", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  getCurrent: async (): Promise<MileagePeriod | null> => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("mileage_periods")
      .select("*")
      .eq("is_active", true)
      .lte("week_start", today)
      .gte("week_end", today)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Generate the current weekly period if it doesn't exist yet (Friday–Thursday). */
  ensureCurrentPeriod: async (createdBy: string, settings: MileageSettings): Promise<MileagePeriod> => {
    const existing = await mileagePeriodsAPI.getCurrent();
    if (existing) return existing;

    const toDate = (d: Date) => d.toISOString().split("T")[0];
    const now = new Date();

    // Pay week runs Friday → Thursday (Jonathan confirmed Jun 2 2026).
    // Start on the most recent Friday (today if today is Friday).
    const day = now.getDay();                 // 0=Sun..6=Sat; Friday = 5
    const diffToFriday = (day - 5 + 7) % 7;
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() - diffToFriday);
    periodStart.setHours(0, 0, 0, 0);

    // Weekly period: Friday + 6 days = Thursday
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);

    // Submission deadline: the Thursday (week_end) at deadline_hour CST (UTC+5)
    const deadline = new Date(periodEnd);
    deadline.setHours(settings.submission_deadline_hour + 5, 0, 0, 0);

    // Payment date: the Friday right after the cutoff = week_end + 1
    const payDay = new Date(periodEnd);
    payDay.setDate(periodEnd.getDate() + 1);

    const { data, error } = await supabase
      .from("mileage_periods")
      .insert({
        week_start:           toDate(periodStart),
        week_end:             toDate(periodEnd),
        submission_deadline:  deadline.toISOString(),
        payment_date:         toDate(payDay),
        status:               "open",
        is_active:            true,
        created_by:           createdBy,
        updated_by:           createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

// ─── Submissions ─────────────────────────────────────────────────────────────

export const mileageSubmissionsAPI = {
  /** Admin: get all submissions for a period */
  getByPeriod: async (periodId: string): Promise<MileageSubmission[]> => {
    const { data, error } = await supabase
      .from("mileage_submissions")
      .select(`
        *,
        user:profiles!mileage_submissions_user_id_fkey(id, first_name, last_name, role),
        period:mileage_periods(id, week_start, week_end, payment_date)
      `)
      .eq("period_id", periodId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Employee: get own submissions */
  getMySubmissions: async (userId: string): Promise<MileageSubmission[]> => {
    const { data, error } = await supabase
      .from("mileage_submissions")
      .select(`
        *,
        period:mileage_periods(id, week_start, week_end, submission_deadline, payment_date, status)
      `)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Get or create draft for current period */
  getOrCreateDraft: async (periodId: string, userId: string, ratePerMile: number): Promise<MileageSubmission> => {
    const { data: existing } = await supabase
      .from("mileage_submissions")
      .select("*")
      .eq("period_id", periodId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from("mileage_submissions")
      .insert({
        period_id: periodId,
        user_id: userId,
        status: "draft",
        rate_per_mile: ratePerMile,
        total_miles: 0,
        total_payout: 0,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Employee reopens a denied submission to fix it (denied → draft), clearing the denial */
  reopen: async (submissionId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        status: "draft",
        denial_reason: null,
        submitted_at: null,
        updated_by: userId,
      })
      .eq("id", submissionId)
      .eq("status", "denied");
    if (error) throw new Error(error.message);
  },

  /** Employee submits for review */
  submit: async (submissionId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", submissionId);
    if (error) throw new Error(error.message);
  },

  /** Admin: approve */
  approve: async (submissionId: string, adminId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        updated_by: adminId,
      })
      .eq("id", submissionId);
    if (error) throw new Error(error.message);
  },

  /** Admin: deny with required reason */
  deny: async (submissionId: string, adminId: string, reason: string): Promise<void> => {
    if (!reason.trim()) throw new Error("Denial reason is required");
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        status: "denied",
        denial_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        updated_by: adminId,
      })
      .eq("id", submissionId);
    if (error) throw new Error(error.message);
  },

  /** Admin: manually mark an approved submission as Paid (Jonathan: manual step, no auto-pay) */
  markPaid: async (submissionId: string, adminId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: adminId,
        updated_by: adminId,
      })
      .eq("id", submissionId)
      .eq("status", "approved"); // only approved submissions can be paid
    if (error) throw new Error(error.message);
  },

  /** Admin: void a submission */
  void: async (submissionId: string, adminId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_submissions")
      .update({
        is_active: false,
        discarded_at: new Date().toISOString(),
        discarded_by: adminId,
        updated_by: adminId,
      })
      .eq("id", submissionId);
    if (error) throw new Error(error.message);
  },

  /** Recalculate totals from active, non-denied, non-personal trips (both are excluded from payout) */
  recalcTotals: async (submissionId: string, userId: string): Promise<void> => {
    const { data: trips } = await supabase
      .from("mileage_trips")
      .select("miles, payout, status, is_personal")
      .eq("submission_id", submissionId)
      .eq("is_active", true);

    const counted = (trips ?? []).filter((t: any) => t.status !== "denied" && !t.is_personal);
    const totalMiles = counted.reduce((s, t) => s + Number(t.miles), 0);
    const totalPayout = counted.reduce((s, t) => s + Number(t.payout), 0);

    await supabase
      .from("mileage_submissions")
      .update({ total_miles: totalMiles, total_payout: totalPayout, updated_by: userId })
      .eq("id", submissionId);
  },
};

// ─── Trips ───────────────────────────────────────────────────────────────────

export const mileageTripsAPI = {
  getBySubmission: async (submissionId: string): Promise<MileageTrip[]> => {
    const { data, error } = await supabase
      .from("mileage_trips")
      .select(`
        *,
        project:projects(id, name),
        client:clients(id, first_name, last_name, address)
      `)
      .eq("submission_id", submissionId)
      .eq("is_active", true)
      .order("trip_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** All trips across every period (admin All Trips view) with project, client + employee/submission joins */
  getAll: async (): Promise<(MileageTrip & { _sub?: any })[]> => {
    const { data, error } = await supabase
      .from("mileage_trips")
      .select(`
        *,
        project:projects(id, name),
        client:clients(id, first_name, last_name, address),
        _sub:mileage_submissions!inner(id, status, period_id, user:profiles!mileage_submissions_user_id_fkey(id, first_name, last_name, role))
      `)
      .eq("is_active", true)
      .order("trip_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Trips attributed to a project that count toward its GP cost:
   *  approved/paid submission, not denied, not personal. Joined with employee for display. */
  getProjectCostTrips: async (projectId: string): Promise<(MileageTrip & { _sub?: any })[]> => {
    const { data, error } = await supabase
      .from("mileage_trips")
      .select(`*, _sub:mileage_submissions!inner(id, status, is_active, user:profiles!mileage_submissions_user_id_fkey(first_name, last_name))`)
      .eq("project_id", projectId)
      .eq("is_active", true)
      .eq("is_personal", false)
      .neq("status", "denied")
      .order("trip_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).filter((t: any) => t._sub?.is_active && (t._sub?.status === "approved" || t._sub?.status === "paid"));
  },

  /** Bulk insert parsed trips from CSV (status/denial_reason use DB defaults) */
  bulkInsert: async (trips: Omit<MileageTrip, "id" | "created_at" | "updated_at" | "status" | "denial_reason" | "is_personal">[]): Promise<MileageTrip[]> => {
    const { data, error } = await supabase
      .from("mileage_trips")
      .insert(trips)
      .select();
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Update project match (manual assignment) */
  assignProject: async (tripId: string, projectId: string, clientId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_trips")
      .update({
        project_id: projectId,
        client_id: clientId,
        match_confidence: "manual",
        updated_by: userId,
      })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },

  /** Mark a trip Personal (or back to business) — logged but excluded from payout.
   *  Employee can do this on their own draft trips; admin can do it anytime. */
  setPersonal: async (tripId: string, isPersonal: boolean, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_trips")
      .update({ is_personal: isPersonal, updated_by: userId })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },

  /** Admin: approve/deny a single trip */
  setStatus: async (tripId: string, status: "pending" | "approved" | "denied", adminId: string, reason?: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_trips")
      .update({ status, denial_reason: status === "denied" ? (reason ?? null) : null, updated_by: adminId })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },

  /** Admin: approve/deny multiple trips at once */
  bulkSetStatus: async (tripIds: string[], status: "pending" | "approved" | "denied", adminId: string): Promise<void> => {
    if (tripIds.length === 0) return;
    const { error } = await supabase
      .from("mileage_trips")
      .update({ status, denial_reason: null, updated_by: adminId })
      .in("id", tripIds);
    if (error) throw new Error(error.message);
  },

  /** Soft-remove a trip from submission */
  remove: async (tripId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from("mileage_trips")
      .update({
        is_active: false,
        discarded_at: new Date().toISOString(),
        discarded_by: userId,
        updated_by: userId,
      })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },
};

// ─── CSV Parser ──────────────────────────────────────────────────────────────

export interface CSVParseResult {
  trips: ParsedTrip[];
  errors: string[];
  totalRows: number;
  skippedRows: number;
}

/**
 * RFC-4180 CSV parser. Correctly handles quoted fields that contain commas,
 * embedded quotes ("" → "), and newlines — essential because Everlance's
 * "Map Image URL" column is a giant quoted string full of commas and % codes.
 * Returns an array of rows, each an array of cell strings.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normalize line endings
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else { inQuotes = false; }                       // closing quote
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else {
        field += ch;
      }
    }
  }
  // Flush last field/row
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Decode the few HTML entities Everlance emits (e.g. "&amp;" → "&"). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Find a header column index by trying multiple candidate names (case-insensitive). */
function colIdx(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const i = norm.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Parse a real Everlance trips CSV export into ParsedTrip[] rows.
 *
 * Real Everlance exports have ~30 summary/header rows (Made with Everlance,
 * Export For, Summary, TOTAL…) BEFORE the actual data table. We scan for the
 * row that contains the real column headers (Value, Miles, From, To, Date…),
 * then parse rows after it. Full addresses are preferred for project matching.
 */
export function parseEverlanceCSV(
  csvText: string,
  ratePerMile: number,
  existingTrips: { trip_date: string; end_address: string }[] = [],
  projects: { id: string; name: string; client_id: string; client?: { address?: string; first_name: string; last_name: string } }[] = []
): CSVParseResult {
  const allRows = parseCSV(csvText);
  if (allRows.length === 0) {
    return { trips: [], errors: ["CSV file appears empty."], totalRows: 0, skippedRows: 0 };
  }

  // Locate the real header row: the one containing both "Miles" and a "From" column.
  let headerRowIdx = -1;
  for (let i = 0; i < allRows.length; i++) {
    const cells = allRows[i].map((c) => c.toLowerCase().trim());
    const hasMiles = cells.includes("miles") || cells.includes("distance (mi)") || cells.includes("distance");
    const hasFrom  = cells.includes("from") || cells.includes("start address") || cells.includes("origin");
    const hasTo    = cells.includes("to") || cells.includes("end address") || cells.includes("destination");
    if (hasMiles && hasFrom && hasTo) { headerRowIdx = i; break; }
  }

  if (headerRowIdx < 0) {
    return { trips: [], errors: ["Could not find the trip table header (expected columns like Miles, From, To, Date). Is this an Everlance trips export?"], totalRows: 0, skippedRows: 0 };
  }

  const headers = allRows[headerRowIdx].map((h) => h.trim());
  const milesIdx = colIdx(headers, ["miles", "distance (mi)", "distance", "mileage"]);
  const dateIdx  = colIdx(headers, ["date", "trip date"]);
  // Prefer the full-address columns; fall back to the short ones.
  const fromFullIdx = colIdx(headers, ["from full address"]);
  const toFullIdx   = colIdx(headers, ["to full address"]);
  const fromIdx     = colIdx(headers, ["from", "start address", "origin"]);
  const toIdx       = colIdx(headers, ["to", "end address", "destination"]);
  const mapIdx      = colIdx(headers, ["map image url", "map url"]);

  const errors: string[] = [];
  if (milesIdx < 0) errors.push("Column 'Miles' not found.");
  if (dateIdx  < 0) errors.push("Column 'Date' not found.");
  if (fromFullIdx < 0 && fromIdx < 0) errors.push("Column 'From' not found.");
  if (toFullIdx   < 0 && toIdx   < 0) errors.push("Column 'To' not found.");
  if (errors.length) return { trips: [], errors, totalRows: 0, skippedRows: 0 };

  const dataRows = allRows.slice(headerRowIdx + 1);
  const trips: ParsedTrip[] = [];
  let skippedRows = 0;

  const cell = (row: string[], idx: number) => (idx >= 0 ? decodeEntities((row[idx] ?? "").trim()) : "");

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    // Skip blank / summary leftover rows
    if (!row || row.every((c) => !c || !c.trim())) { continue; }

    const rawDate  = cell(row, dateIdx);
    const rawMiles = cell(row, milesIdx);

    // Date — support YYYY-MM-DD (Everlance default) and MM/DD/YYYY
    let trip_date = "";
    const slash = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      trip_date = rawDate;
    } else if (slash) {
      trip_date = `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
    } else {
      skippedRows++; continue; // not a real trip row
    }

    const miles = parseFloat(rawMiles.replace(/[^0-9.]/g, ""));
    if (!miles || miles <= 0) { skippedRows++; continue; }

    const start_address = cell(row, fromFullIdx) || cell(row, fromIdx) || "Unknown";
    const end_address   = cell(row, toFullIdx)   || cell(row, toIdx)   || "Unknown";
    const payout        = Math.round(miles * ratePerMile * 100) / 100;
    const mapRaw        = mapIdx >= 0 ? (row[mapIdx] ?? "").trim() : ""; // raw — do NOT decode entities (it's a URL)
    const map_image_url = /^https?:\/\//.test(mapRaw) ? mapRaw : null;

    // Auto-match project by end_address containing the client's street address
    let project_id: string | null = null;
    let client_id: string | null  = null;
    let match_confidence: "auto" | "manual" | "unmatched" = "unmatched";

    const endLower = end_address.toLowerCase();
    for (const proj of projects) {
      const clientAddr = proj.client?.address ?? "";
      const street = clientAddr.toLowerCase().split(",")[0].trim();
      if (street && endLower.includes(street)) {
        project_id = proj.id;
        client_id  = proj.client_id;
        match_confidence = "auto";
        break;
      }
    }

    const is_duplicate = existingTrips.some(
      (t) => t.trip_date === trip_date && t.end_address.toLowerCase() === endLower
    );

    trips.push({
      _id: `parsed-${i}-${Date.now()}`,
      trip_date,
      start_address,
      end_address,
      miles,
      project_id,
      client_id,
      match_confidence,
      is_duplicate,
      payout,
      map_image_url,
    });
  }

  return { trips, errors: [], totalRows: dataRows.length, skippedRows };
}
