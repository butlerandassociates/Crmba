import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/app/utils/format";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link, useLocation, useNavigate } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Plus, Search, Mail, Phone, Loader2, CalendarCheck, Calendar, Users, Trash2, MoveRight, GitMerge, X, Upload, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, TrendingUp, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { SkeletonList } from "./ui/page-loader";
import { clientsAPI, leadSourcesAPI, pipelineStagesAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../contexts/auth-context";
import { useViewAs } from "../contexts/view-as-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

const PM_STAGES = ["sold", "active", "completed"];
const SALES_REP_STAGES = ["scheduled", "selling", "sold", "active", "completed"];

export function ClientsList() {
  const { role } = usePermissions();
  const { user } = useAuth();
  const { viewAsProfileId, viewAsRole } = useViewAs();
  const currentProfileId = user?.profile?.id ?? null;
  const navigate = useNavigate();

  const location = useLocation();
  const stageFilter = new URLSearchParams(location.search).get("stage") ?? "";
  // Keep a ref so the realtime callback (registered once at mount) always uses the latest stage
  const stageRef = useRef(stageFilter);
  stageRef.current = stageFilter;

  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);

  // Bulk discard dialog
  const [bulkDiscardOpen, setBulkDiscardOpen] = useState(false);
  const [bulkDiscardReason, setBulkDiscardReason] = useState("");

  // Bulk move dialog
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveStageId, setBulkMoveStageId] = useState("");
  const [bulkMoveReason, setBulkMoveReason] = useState("");

  // Bulk move results dialog
  const [bulkMoveResultOpen, setBulkMoveResultOpen] = useState(false);
  const [bulkMoveResult, setBulkMoveResult] = useState<{
    moved: any[];
    skipped: { client: any; reason: string }[];
    stageName: string;
  } | null>(null);

  // Bulk merge dialog
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState("");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ created: number; skipped: number } | null>(null);

  const SERVICE_MAP: Record<string, string> = {
    "pavers": "Pavers", "concrete": "Concrete (Driveway, Walkway, Patio)",
    "outdoor kitchen": "Outdoor Kitchen", "fire feature": "Fire Pit/Fireplace",
    "retaining wall": "Retaining Wall", "pergola / pavilion": "Pergola/Pavilion",
    "pergola/pavilion": "Pergola/Pavilion", "landscaping": "Landscaping",
    "drainage": "Drainage", "lighting": "Outdoor Lighting",
    "artificial grass": "Artificial Grass", "turf": "Artificial Grass",
    "design": "Design Services",
  };
  const normalizeService = (s: string) => SERVICE_MAP[s.toLowerCase().trim()] ?? s.trim();

  const SKIP_FORMS = ["concrete promotion", "20% off", "promo", "careers", "career", "5% off"];
  const isSkippableForm = (formName: string) =>
    SKIP_FORMS.some((k) => formName.toLowerCase().includes(k));

  const parseFormspreeFile = (json: any): any[] => {
    const submissions: any[] = json.submissions ?? (Array.isArray(json) ? json : [json]);
    return submissions.map((f: any) => {
      const sourceForm: string = f.source_form ?? f.form_name ?? f.page_title ?? f.page ?? f._subject ?? "Unknown Form";
      if (isSkippableForm(sourceForm)) return { skip: true, skipReason: "Promo/careers form", sourceForm };

      // Referral forms: new lead = referralName/referralPhone, submitter = clientName/Submitted By
      const isReferral = !!(f.referralName ?? f["Referral Name"]);
      let firstName: string, lastName: string, phone: string;
      if (isReferral) {
        const refName = (f.referralName ?? f["Referral Name"] ?? "").trim();
        const parts = refName.split(/\s+/);
        firstName = parts[0] ?? "Unknown";
        lastName  = parts.slice(1).join(" ") ?? "";
        phone     = f.referralPhone ?? f["Referral Phone"] ?? f.phone ?? f.phone_number ?? "";
      } else {
        const rawName = f.name ?? f.full_name ?? f["Full Name"] ?? f["Submitted By"] ?? "";
        const nameParts = rawName.trim().split(/\s+/);
        firstName = f.first_name ?? f.firstName ?? nameParts[0] ?? "";
        lastName  = f.last_name  ?? f.lastName  ?? nameParts.slice(1).join(" ") ?? "";
        phone     = f.phone ?? f.phone_number ?? "";
      }

      const email  = f.email ?? f._replyto ?? "";
      const zip    = f.zip ?? f.zip_code ?? "";
      const city   = f.city ?? "";
      const address = f.address ?? "";

      if (!firstName && !email && !phone) return { skip: true, skipReason: "No contact data", sourceForm };

      const multiRaw: string | string[] = f["services[]"] ?? f.services ?? f.interest ?? f.service ?? f.primary_service ?? f.calc_type ?? "";
      const singleRaw: string = f.project_type ?? f.calc_project_type ?? "";
      const services: string[] = multiRaw
        ? (Array.isArray(multiRaw)
            ? multiRaw.filter(Boolean)
            : multiRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
          ).map(normalizeService)
        : singleRaw ? [normalizeService(singleRaw)] : [];

      return {
        skip: false, sourceForm, isReferral,
        firstName: firstName || "Unknown", lastName,
        email: email || null, phone: phone || null,
        zip: zip || null, city: city || null, address: address || null,
        services,
        budget:         f.budget ?? f.budget_range ?? f.estimated_range_primary ?? "",
        projectDetails: f.details ?? f.message ?? f.notes ?? f["Notes (Public)"] ?? f.project_details ?? "",
        timeline:       f.timeline ?? f.ideal_start_date ?? f.desired_start_date ?? "",
        squareFootage:  f.square_footage ?? f.estimated_sqft ?? f.calc_sqft ?? "",
        primaryUse:     f.primary_use ?? "",
        turfTier:       f.turf_tier ?? f.selected_tier ?? "",
        selectedRate:   f.selected_rate ?? "",
        estimateRange:  f.estimate_range ?? f.budget_range ?? "",
        estimateTotal:  f.estimate_total ?? f.calc_estimate ?? f.calc_est_range ?? f.estimated_range_primary ?? "",
        projectType:    f.project_type ?? f.calc_type ?? f.calc_project_type ?? "",
        calcFinish:     f.calc_finish ?? "",
        calcThickness:  f.calc_thickness_in ?? "",
        selections:     f.selections ?? "",
        verdict:        f.verdict ?? "",
        optionsSummary: f.options_summary ?? "",
        referrerName:   isReferral ? (f.clientName ?? f["Submitted By"] ?? "") : "",
        referrerPhone:  isReferral ? (f.referralPhone ?? f["Referral Phone"] ?? "") : "",
        submittedBy:    isReferral ? (f["Submitted By"] ?? f.clientName ?? "") : "",
      };
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setImportRows(parseFormspreeFile(json));
        setImportDone(null);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    const toImport = importRows.filter((r) => !r.skip);
    if (!toImport.length) return;
    setImporting(true);

    const websiteSource  = leadSources.find((s) => s.name === "Website");
    const referralSource = leadSources.find((s) => s.name === "Referral");
    const firstStage = pipelineStages.slice().sort((a, b) => a.order_index - b.order_index)[0];

    // Fetch live scope_of_work names from DB for matching
    const { data: scopeRows } = await supabase.from("scope_of_work").select("name").eq("is_active", true);
    const scopeNames: string[] = (scopeRows ?? []).map((r: any) => r.name);
    const matchScope = (raw: string): string => {
      const lower = raw.toLowerCase().trim();
      return scopeNames.find((n) => n.toLowerCase() === lower) ?? raw;
    };

    let created = 0;
    for (const row of toImport) {
      const matchedServices = (row.services ?? []).map(matchScope);
      try {
        const { data: client, error: clientErr } = await supabase.from("clients").insert({
          first_name: row.firstName, last_name: row.lastName,
          email: row.email, phone: row.phone,
          zip: row.zip, city: row.city, address: row.address,
          lead_source_id: (row.isReferral ? referralSource?.id : websiteSource?.id) ?? null,
          pipeline_stage_id: firstStage?.id ?? null,
          status: "prospect",
          scope_of_work: matchedServices,
        }).select("id").single();
        if (clientErr || !client) continue;

        const noteParts: string[] = [];
        if (row.projectDetails) noteParts.push(`Project details: ${row.projectDetails}`);
        if (row.budget)         noteParts.push(`Budget: ${row.budget}`);
        if (row.timeline)       noteParts.push(`Timeline: ${row.timeline}`);
        if (matchedServices.length) noteParts.push(`Services: ${matchedServices.join(", ")}`);
        if (row.squareFootage)  noteParts.push(`Square footage: ${row.squareFootage}`);
        if (row.primaryUse)     noteParts.push(`Primary use: ${row.primaryUse}`);
        if (row.turfTier)       noteParts.push(`Tier selected: ${row.turfTier}`);
        if (row.selectedRate)   noteParts.push(`Rate per sqft: ${row.selectedRate}`);
        if (row.estimateTotal)  noteParts.push(`Estimate total: ${row.estimateTotal}`);
        if (row.estimateRange)  noteParts.push(`Estimate range: ${row.estimateRange}`);
        if (row.projectType)    noteParts.push(`Project type: ${row.projectType}`);
        if (row.calcFinish)     noteParts.push(`Concrete finish: ${row.calcFinish}`);
        if (row.calcThickness)  noteParts.push(`Thickness: ${row.calcThickness}"`);
        if (row.selections)     noteParts.push(`Selections: ${row.selections}`);
        if (row.verdict)        noteParts.push(`Recommendation: ${row.verdict}`);
        if (row.optionsSummary) noteParts.push(`Options summary: ${row.optionsSummary}`);
        if (row.referrerName)   noteParts.push(`Referred by: ${row.referrerName}`);
        if (row.referrerPhone)  noteParts.push(`Referrer phone: ${row.referrerPhone}`);
        if (row.submittedBy && row.submittedBy !== row.referrerName) noteParts.push(`Form submitted by: ${row.submittedBy}`);

        if (noteParts.length) {
          await supabase.from("client_notes").insert({
            client_id: client.id, content: noteParts.join("\n"),
            is_system_generated: true, action_type: "lead_received",
          });
        }
        await supabase.from("activity_log").insert({
          client_id: client.id, action_type: "lead_received",
          description: `Lead imported from ${row.sourceForm}${row.services?.length ? ` — ${row.services.join(", ")}` : ""}`,
        });
        created++;
      } catch { /* skip failed row */ }
    }

    const skipped = importRows.filter((r) => r.skip).length;
    setImportDone({ created, skipped });
    setImporting(false);
    fetchClients();
  };

  const EMPTY_CLIENT = {
    first_name: "", last_name: "",
    email: "", phone: "",
    address: "", city: "", state: "", zip: "",
    status: "prospect", lead_source_id: "",
  };

  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const setField = (field: string, value: string) => {
    setNewClient((p) => ({ ...p, [field]: value }));
    setFormErrors((e) => { const next = { ...e }; delete next[field]; return next; });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newClient.first_name.trim()) errors.first_name = "First name is required.";
    else if (newClient.first_name.trim().length < 2) errors.first_name = "First name must be at least 2 characters.";
    if (!newClient.email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email.trim())) errors.email = "Enter a valid email address.";
    if (!newClient.phone.trim()) errors.phone = "Phone is required.";
    else { const d = newClient.phone.replace(/\D/g, ""); if (d.length < 7 || d.length > 15) errors.phone = "Phone must be 7–15 digits."; }
    if (!newClient.address.trim()) errors.address = "Address is required.";
    else if (newClient.address.trim().length < 5) errors.address = "Address must be at least 5 characters.";
    if (newClient.zip.trim() && !/^[A-Za-z0-9\s\-]{3,10}$/.test(newClient.zip.trim())) errors.zip = "Enter a valid postal code.";
    if (!newClient.lead_source_id) errors.lead_source_id = "Lead source is required.";
    return errors;
  };

  // One-time: load reference data that doesn't change with stage
  useEffect(() => {
    fetchLeadSources();
    pipelineStagesAPI.getAll().then(setPipelineStages).catch(console.error);
  }, []);

  // Refetch clients whenever the stage tab changes
  useEffect(() => {
    clearSelection();
    fetchClients();
  }, [stageFilter]);

  // Redirect PM/Sales Rep away from stages they cannot see
  useEffect(() => {
    if (!role) return;
    if (role === "project_manager") {
      if (!stageFilter || !PM_STAGES.includes(stageFilter)) {
        navigate("/clients?stage=sold", { replace: true });
      }
    } else if (role === "sales_rep") {
      if (!stageFilter || !SALES_REP_STAGES.includes(stageFilter)) {
        navigate("/clients?stage=scheduled", { replace: true });
      }
    }
  }, [role, stageFilter]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await clientsAPI.getAll(stageRef.current || undefined);
      setClients(data ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefetch(fetchClients, ["clients"], "clients-list");

  const fetchLeadSources = async () => {
    try {
      const data = await leadSourcesAPI.getAll();
      setLeadSources(data ?? []);
    } catch {
      // non-critical
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      const newStage = pipelineStages.slice().sort((a, b) => a.order_index - b.order_index)[0];
      await clientsAPI.create({
        first_name: newClient.first_name.trim(),
        last_name:  newClient.last_name.trim(),
        email:      newClient.email.trim() || null,
        phone:      newClient.phone.trim() || null,
        address:    newClient.address.trim() || null,
        city:       newClient.city.trim() || null,
        state:      newClient.state.trim() || null,
        zip:        newClient.zip.trim() || null,
        status:     newClient.status,
        lead_source_id: newClient.lead_source_id || null,
        pipeline_stage_id: newStage?.id ?? null,
        appointment_met: false,
        appointment_scheduled: false,
        docusign_status: "not_sent",
      });
      toast.success("Client added successfully!");
      setAddDialogOpen(false);
      setNewClient(EMPTY_CLIENT);
      setFormErrors({});
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to add client");
    } finally {
      setSaving(false);
    }
  };

  // ── Selection helpers ──────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (list: any[]) => {
    const ids = filterClients(list).map((c) => c.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk actions ───────────────────────────────────────────
  const handleBulkDiscard = async () => {
    if (!bulkDiscardReason.trim()) return;
    setBulkActioning(true);
    try {
      await supabase
        .from("clients")
        .update({ is_discarded: true, discarded_at: new Date().toISOString(), discarded_reason: bulkDiscardReason.trim() })
        .in("id", Array.from(selectedIds));
      toast.success(`${selectedIds.size} client${selectedIds.size > 1 ? "s" : ""} discarded`);
      setBulkDiscardOpen(false);
      setBulkDiscardReason("");
      clearSelection();
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to discard clients");
    } finally {
      setBulkActioning(false);
    }
  };

  const STAGE_ORDER = ["prospect", "scheduled", "selling", "sold", "active", "completed"];

  const stageGateReason = (stageName: string) => {
    const n = stageName.toLowerCase();
    if (n === "sold") return "Moving to Sold requires uploading a signed contract, deposit receipt, assigning crew, and setting a payment schedule — this must be completed per client.";
    if (n === "active") return "Moving to Active requires confirming a signed contract and deposit — this must be completed per client.";
    if (n === "completed") return "Moving to Completed requires verifying all payments received, crew paid, site photos, and completion documents — this must be verified per client.";
    return null;
  };

  const handleBulkMove = async () => {
    if (!bulkMoveStageId) return;
    const stage = pipelineStages.find((s) => s.id === bulkMoveStageId);
    const stageName = stage?.name?.toLowerCase() ?? "";
    const targetIdx = STAGE_ORDER.indexOf(stageName);

    // Block completely gated stages (Sold/Active/Completed — require individual setup)
    const gateReason = stageGateReason(stageName);
    if (gateReason) {
      toast.error(gateReason, { duration: 6000 });
      return;
    }

    setBulkActioning(true);
    try {
      const selected = visibleClients.filter((c) => selectedIds.has(c.id));
      let eligibleIds: string[] = selected.map((c) => c.id);
      const skipped: { client: any; reason: string }[] = [];

      // ── Backward move checks ──────────────────────────────
      for (const c of selected) {
        const currentIdx = STAGE_ORDER.indexOf(c.status?.toLowerCase() ?? "");
        if (currentIdx <= targetIdx) continue; // forward move — handled below
        // Past Sold — can never go backward
        if (currentIdx >= STAGE_ORDER.indexOf("sold")) {
          skipped.push({ client: c, reason: `Cannot move backward from ${c.status}` });
          eligibleIds = eligibleIds.filter((id) => id !== c.id);
          continue;
        }
        // Selling backward — block if signed contract exists
        if (c.status?.toLowerCase() === "selling" && c.docusign_status === "completed") {
          skipped.push({ client: c, reason: "Signed contract present — cannot move backward" });
          eligibleIds = eligibleIds.filter((id) => id !== c.id);
        }
      }

      // ── Forward move: Scheduled gate (4 required fields) ──
      if (stageName === "scheduled") {
        for (const c of selected.filter((c) => eligibleIds.includes(c.id))) {
          const currentIdx = STAGE_ORDER.indexOf(c.status?.toLowerCase() ?? "");
          if (currentIdx >= targetIdx) continue; // only check forward moves
          const missing: string[] = [];
          if (!c.first_name?.trim()) missing.push("First Name");
          if (!c.phone?.trim()) missing.push("Phone");
          if (!c.email?.trim()) missing.push("Email");
          if (!c.address?.trim()) missing.push("Address");
          if (missing.length > 0) {
            skipped.push({ client: c, reason: `Missing: ${missing.join(", ")}` });
            eligibleIds = eligibleIds.filter((id) => id !== c.id);
          }
        }
      }

      // ── Forward move: Selling gate (appointment required) ──
      if (stageName === "selling") {
        const forwardEligible = selected.filter((c) => eligibleIds.includes(c.id) && STAGE_ORDER.indexOf(c.status?.toLowerCase() ?? "") < targetIdx);
        if (forwardEligible.length > 0) {
          const { data: appts } = await supabase.from("appointments").select("client_id").in("client_id", forwardEligible.map((c) => c.id));
          const withAppt = new Set((appts ?? []).map((a: any) => a.client_id));
          for (const c of forwardEligible) {
            if (!withAppt.has(c.id)) {
              skipped.push({ client: c, reason: "No appointment scheduled" });
              eligibleIds = eligibleIds.filter((id) => id !== c.id);
            }
          }
        }
      }

      // ── Execute move ──────────────────────────────────────
      if (eligibleIds.length > 0) {
        await supabase.from("clients").update({ pipeline_stage_id: bulkMoveStageId, status: stageName }).in("id", eligibleIds);
      }

      const movedClients = selected.filter((c) => eligibleIds.includes(c.id));
      setBulkMoveResult({ moved: movedClients, skipped, stageName: stage?.name ?? stageName });
      setBulkMoveResultOpen(true);
      setBulkMoveOpen(false);
      setBulkMoveStageId("");
      setBulkMoveReason("");
      clearSelection();
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to move clients");
    } finally {
      setBulkActioning(false);
    }
  };

  const handleBulkMerge = async () => {
    if (!mergePrimaryId) return;
    const ineligible = selectedClients.filter(c => !["prospect", "scheduled"].includes(c.status?.toLowerCase() ?? ""));
    if (ineligible.length > 0) {
      toast.error("Merge is only available for Prospect and Scheduled stage clients.");
      return;
    }
    const secondaryIds = Array.from(selectedIds).filter((id) => id !== mergePrimaryId);
    const primary = visibleClients.find((c) => c.id === mergePrimaryId);
    const primaryName = `${primary?.first_name ?? ""} ${primary?.last_name ?? ""}`.trim();
    setBulkActioning(true);
    try {
      // Move all related records from secondary clients → primary
      const tables: { table: string; col: string }[] = [
        { table: "client_notes", col: "client_id" },
        { table: "client_files", col: "client_id" },
        { table: "appointments", col: "client_id" },
        { table: "activity_log", col: "client_id" },
        { table: "estimates", col: "client_id" },
        { table: "purchase_orders", col: "client_id" },
        { table: "change_orders", col: "client_id" },
      ];
      for (const { table, col } of tables) {
        await supabase.from(table).update({ [col]: mergePrimaryId }).in(col, secondaryIds);
      }
      // Discard secondary clients
      await supabase
        .from("clients")
        .update({ is_discarded: true, discarded_at: new Date().toISOString(), discarded_reason: `Merged into ${primaryName}` })
        .in("id", secondaryIds);
      toast.success(`${secondaryIds.length} client${secondaryIds.length > 1 ? "s" : ""} merged into ${primaryName}`);
      setBulkMergeOpen(false);
      setMergePrimaryId("");
      clearSelection();
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to merge clients");
    } finally {
      setBulkActioning(false);
    }
  };

  // ── Filtering ──────────────────────────────────────────────
  // In View As mode: if a specific person is picked, filter to their clients.
  // If only a role is selected (no person yet), show all clients with that role's UI.
  // Outside View As mode: filter to the logged-in user's own assigned clients.
  const effectiveProfileId = viewAsProfileId || (!viewAsRole ? currentProfileId : null);
  const visibleClients =
    role === "sales_rep" && effectiveProfileId
      ? clients.filter((c) => c.salesRepId === effectiveProfileId)
      : role === "project_manager" && effectiveProfileId
        ? clients.filter((c) => c.pmId === effectiveProfileId)
        : clients;

  const stageClients = stageFilter
    ? visibleClients.filter((c) => c.status === stageFilter)
    : visibleClients;

  const filterClients = (list: any[]) =>
    list.filter((c) => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || (c.email ?? "").toLowerCase().includes(term);
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":     return "bg-green-500";
      case "sold":       return "bg-orange-500";
      case "prospect":   return "bg-blue-500";
      case "scheduled":  return "bg-indigo-500";
      case "selling":    return "bg-yellow-500";
      case "completed":  return "bg-purple-500";
      default:           return "bg-gray-500";
    }
  };


  const formatDateTime = (startStr: string, endStr?: string | null) => {
    const s = new Date(startStr);
    const datePart = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (endStr) {
      const endTime = new Date(endStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${datePart} · ${startTime} – ${endTime}`;
    }
    return `${datePart} · ${startTime}`;
  };

  const clientProjectTotal = (client: any) =>
    (client.project_total ?? 0) > 0 ? (client.project_total ?? 0) : (client.proposal_forecast ?? 0);

  const PAGE_SIZE = 15;

  const CLIENT_REVENUE_STAGES = ["sold", "active", "completed"];

  const fmtDate = (val: string | null | undefined) =>
    val ? new Date(val + (val.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const ClientTable = ({ list, stage }: { list: any[]; stage?: string }) => {
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    // Date-column sort (Jonathan: asc/desc arrows on the appointment/date column, all stages)
    const [dateSort, setDateSort] = useState<"asc" | "desc" | null>(null);
    const dateField = stage === "completed" ? "updated_at"
      : (stage === "sold" || stage === "active") ? "project_start_date"
      : "appointment_date";
    const cycleDateSort = () => setDateSort((d) => (d === null ? "asc" : d === "asc" ? "desc" : null));
    const SortArrow = () => (
      <button onClick={(e) => { e.stopPropagation(); cycleDateSort(); }} title="Sort by date"
        className="ml-1 inline-flex items-center align-middle text-muted-foreground hover:text-foreground">
        {dateSort === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : dateSort === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />}
      </button>
    );

    const visible = filterClients(list);
    const sortedVisible = dateSort
      ? [...visible].sort((a, b) => {
          const av = a[dateField] ? new Date(a[dateField]).getTime() : null;
          const bv = b[dateField] ? new Date(b[dateField]).getTime() : null;
          if (av === null && bv === null) return 0;
          if (av === null) return 1;   // missing dates always last
          if (bv === null) return -1;
          return dateSort === "asc" ? av - bv : bv - av;
        })
      : visible;
    const totalPages = Math.ceil(sortedVisible.length / PAGE_SIZE);
    const paged = sortedVisible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const allSelected = paged.length > 0 && paged.every((c) => selectedIds.has(c.id));
    const someSelected = paged.some((c) => selectedIds.has(c.id));

    useEffect(() => { setPage(0); }, [visible.length, dateSort]);

    const totalValue = visible.reduce((sum, c) => sum + clientProjectTotal(c), 0);

    const isActive       = stage === "active";
    const isCompleted    = stage === "completed";
    const isProjectStage = isActive || isCompleted;

    const gpColor = (pct: number | null) => {
      if (pct == null) return "text-muted-foreground";
      if (pct >= 30)   return "text-green-700";
      if (pct >= 15)   return "text-yellow-700";
      return "text-red-600";
    };

    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] table-fixed">
              {isActive ? (
                <colgroup>
                  {role === "admin" && <col className="w-10" />}
                  <col className="w-24" />
                  <col className="w-40" />
                  <col className="w-44" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-32" />
                </colgroup>
              ) : isCompleted ? (
                <colgroup>
                  {role === "admin" && <col className="w-10" />}
                  <col className="w-24" />
                  <col className="w-40" />
                  <col className="w-44" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-28" />
                  <col className="w-32" />
                </colgroup>
              ) : (
                <colgroup>
                  {role === "admin" && <col className="w-10" />}
                  <col className="w-28" />
                  <col className="w-40" />
                  <col className="w-44" />
                  <col className="w-32" />
                  <col className="w-32" />
                  <col className="w-32" />
                  <col className="w-44" />
                  <col className="w-28" />
                  <col className="w-24" />
                </colgroup>
              )}
              <thead className="border-b bg-muted/50">
                <tr>
                  {role === "admin" && (
                    <th className="p-3">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={() => toggleSelectAll(paged)}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>

                  {isProjectStage ? (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Sales Rep / PM</th>
                  ) : (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                  )}

                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    {isProjectStage ? "Lead Source" : "Date Received"}
                  </th>

                  {!isProjectStage && (
                    <>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Sales Rep</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Lead Source</th>
                    </>
                  )}

                  {isActive && (
                    <>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">Start Date<SortArrow /></th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">End Date</th>
                    </>
                  )}
                  {isCompleted && (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">Completed On<SortArrow /></th>
                  )}
                  {!isProjectStage && (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">
                      {stage === "sold" ? "Start Date" : "Appointment"}<SortArrow />
                    </th>
                  )}

                  {isProjectStage && (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">GP%</th>
                  )}

                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    {stage === "sold" ? "Contract Value" : stage && CLIENT_REVENUE_STAGES.includes(stage) ? "Revenue" : "Forecast"}
                  </th>

                  {isProjectStage ? (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Progress</th>
                  ) : (
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((client) => (
                  <tr
                    key={client.id}
                    className={`hover:bg-accent/50 transition-colors ${isProjectStage ? "cursor-pointer" : ""} ${selectedIds.has(client.id) ? "bg-primary/5" : ""}`}
                    onClick={isProjectStage ? () => navigate(`/clients/${client.id}`) : undefined}
                  >
                    {role === "admin" && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(client.id)}
                          onCheckedChange={() => toggleSelect(client.id)}
                          aria-label={`Select ${client.first_name} ${client.last_name}`}
                        />
                      </td>
                    )}
                    <td className="p-3">
                      <Badge className={`${getStatusColor(client.status)} text-xs text-white`}>
                        {client.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {isProjectStage ? (
                        <span className="font-semibold text-sm">{client.first_name} {client.last_name}</span>
                      ) : (
                        <Link to={`/clients/${client.id}`} className="font-semibold text-sm hover:text-primary no-underline">
                          {client.first_name} {client.last_name}
                        </Link>
                      )}
                    </td>

                    {/* Col 4 — Contact (default) or PM/Foreman (project stages) */}
                    {isProjectStage ? (
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground">
                          {client.project_staff_label ?? "—"}
                        </span>
                      </td>
                    ) : (
                      <td className="p-3">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Col 5 — Lead Source (project stages) or Date Received (default) */}
                    {isProjectStage ? (
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">{client.lead_source?.name ?? "—"}</span>
                      </td>
                    ) : (
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {client.created_at
                            ? new Date(client.created_at).toLocaleString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                                hour: "numeric", minute: "2-digit", hour12: true,
                              })
                            : "—"}
                        </span>
                      </td>
                    )}

                    {/* Col 6 — Sales Rep (default only) */}
                    {!isProjectStage && (
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">{client.salesRepName ?? "—"}</span>
                      </td>
                    )}

                    {/* Col 7 — Lead Source (default only) */}
                    {!isProjectStage && (
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground">{client.lead_source?.name ?? "—"}</span>
                      </td>
                    )}

                    {/* Active: Start Date + End Date */}
                    {isActive && (
                      <>
                        <td className="p-3">
                          {client.project_start_date ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{fmtDate(client.project_start_date)}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3">
                          {client.project_end_date ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{fmtDate(client.project_end_date)}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </>
                    )}

                    {/* Completed: Completed On */}
                    {isCompleted && (
                      <td className="p-3">
                        {client.updated_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{fmtDate(client.updated_at)}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    )}

                    {/* Default stages: Appointment / Start Date col */}
                    {!isProjectStage && (
                      <td className="p-3">
                        {stage === "sold" ? (
                          client.project_start_date ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{fmtDate(client.project_start_date)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        ) : client.appointment_met ? (
                          <div className="flex items-center gap-1.5">
                            <CalendarCheck className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-xs font-medium text-green-700">Met</span>
                          </div>
                        ) : client.appointment_scheduled && client.appointment_date ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-medium text-blue-700">Scheduled</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(client.appointment_date, client.appointment_end_date)}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}

                    {/* GP% — project stages only. Completed tab also shows GP$ below it. */}
                    {isProjectStage && (
                      <td className="p-3">
                        {client.project_profit_margin != null ? (
                          <div className={`flex items-center gap-1 text-xs font-medium ${gpColor(client.project_profit_margin)}`}>
                            <TrendingUp className="h-3 w-3" />
                            {client.project_profit_margin.toFixed(1)}%
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {isCompleted && client.project_gross_profit != null && (
                          <div className="text-xs font-semibold text-foreground mt-0.5">
                            {formatCurrency(client.project_gross_profit)}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Revenue / Forecast */}
                    <td className="p-3">
                      {(() => {
                        const total = clientProjectTotal(client);
                        if (total > 0) {
                          return <div className="text-sm font-medium">{formatCurrency(total)}</div>;
                        }
                        if (client.projected_value) {
                          return (
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-muted-foreground">{formatCurrency(client.projected_value)}</div>
                              {client.closing_probability && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${client.closing_probability}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{client.closing_probability}%</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-xs text-muted-foreground">—</span>;
                      })()}
                    </td>

                    {/* Progress% (project stages) or Actions (default) */}
                    {isProjectStage ? (
                      <td className="p-3">
                        {client.payment_progress_pct != null ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${client.payment_progress_pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                                  style={{ width: `${client.payment_progress_pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums">{client.payment_progress_pct}%</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    ) : (
                      <td className="p-3">
                        <Link to={`/clients/${client.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {visible.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    {isActive ? (
                      <>
                        <td colSpan={role === "admin" ? 8 : 7} className="p-3 text-xs text-muted-foreground">{visible.length} client{visible.length !== 1 ? "s" : ""}</td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground block">Total Revenue</span>
                          <span className="text-sm font-bold">{formatCurrency(totalValue)}</span>
                        </td>
                        <td />
                      </>
                    ) : isCompleted ? (
                      <>
                        <td colSpan={role === "admin" ? 7 : 6} className="p-3 text-xs text-muted-foreground">{visible.length} client{visible.length !== 1 ? "s" : ""}</td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground block">Total Revenue</span>
                          <span className="text-sm font-bold">{formatCurrency(totalValue)}</span>
                        </td>
                        <td />
                      </>
                    ) : (
                      <>
                        <td colSpan={role === "admin" ? 9 : 8} className="p-3 text-xs text-muted-foreground">{visible.length} client{visible.length !== 1 ? "s" : ""}</td>
                        <td className="p-3">
                          <span className="text-xs text-muted-foreground block">{stage && CLIENT_REVENUE_STAGES.includes(stage) ? "Total Revenue" : "Total"}</span>
                          <span className="text-sm font-bold">{formatCurrency(totalValue)}</span>
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {visible.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} &nbsp;·&nbsp; {visible.length} clients
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No clients found</p>
              <p className="text-xs mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const selectedClients = visibleClients.filter((c) => selectedIds.has(c.id));

  return (
    <div className="p-4 space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 -mt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your client relationships</p>
          </div>
          {role !== "project_manager" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { setImportOpen(true); setImportRows([]); setImportDone(null); }}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedIds.size > 0 && role === "admin" && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-sm font-medium text-primary mr-1">{selectedIds.size} selected</span>
              <Button size="sm" variant="ghost" onClick={() => setBulkDiscardOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Discard
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBulkMoveOpen(true)}>
                <MoveRight className="h-3.5 w-3.5 mr-1.5" /> Move to...
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const ineligible = selectedClients.filter(c => !["prospect", "scheduled"].includes(c.status?.toLowerCase() ?? ""));
                if (ineligible.length > 0) {
                  toast.error(`Merge is only available for Prospect and Scheduled clients. ${ineligible.map(c => `${c.first_name} ${c.last_name}`).join(", ")} cannot be merged.`);
                  return;
                }
                setMergePrimaryId(Array.from(selectedIds)[0]);
                setBulkMergeOpen(true);
              }} disabled={selectedIds.size < 2}>
                <GitMerge className="h-3.5 w-3.5 mr-1.5" /> Merge
              </Button>
              <button className="p-1 text-muted-foreground hover:text-foreground" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>


      {loading && <SkeletonList rows={8} />}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {stageFilter && (
            <p className="text-sm text-muted-foreground mb-3">
              {stageClients.length} clients in <span className="capitalize">{stageFilter}</span>
            </p>
          )}
          <ClientTable list={stageClients} stage={stageFilter} />
        </>
      )}

      {/* ── Bulk Discard Dialog ── */}
      <Dialog open={bulkDiscardOpen} onOpenChange={setBulkDiscardOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Discard {selectedIds.size} Client{selectedIds.size > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              These clients will be marked as discarded and removed from the active pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div className="max-h-32 overflow-y-auto space-y-1 text-sm text-muted-foreground">
              {selectedClients.map((c) => (
                <p key={c.id}>· {c.first_name} {c.last_name}</p>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="e.g. Not interested, Spam, Duplicate..."
                value={bulkDiscardReason}
                onChange={(e) => setBulkDiscardReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDiscardOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!bulkDiscardReason.trim() || bulkActioning} onClick={handleBulkDiscard}>
              {bulkActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Move Dialog ── */}
      {(() => {
        const targetStageName = pipelineStages.find((s) => s.id === bulkMoveStageId)?.name?.toLowerCase() ?? "";
        const targetIdx = STAGE_ORDER.indexOf(targetStageName);
        const isAnyBackward = bulkMoveStageId
          ? selectedClients.some((c) => STAGE_ORDER.indexOf(c.status?.toLowerCase() ?? "") > targetIdx)
          : false;
        return (
          <Dialog open={bulkMoveOpen} onOpenChange={(o) => { setBulkMoveOpen(o); if (!o) { setBulkMoveStageId(""); setBulkMoveReason(""); } }}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MoveRight className="h-4 w-4" />
                  Move {selectedIds.size} Client{selectedIds.size > 1 ? "s" : ""} to Stage
                </DialogTitle>
                <DialogDescription>
                  Select the pipeline stage to move all selected clients to.
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pb-2 space-y-3">
                <Select value={bulkMoveStageId} onValueChange={(v) => { setBulkMoveStageId(v); setBulkMoveReason(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map((s) => {
                      const gated = stageGateReason(s.name);
                      return (
                        <SelectItem key={s.id} value={s.id} disabled={!!gated}>
                          <span className={gated ? "text-muted-foreground" : ""}>{s.name}</span>
                          {gated && <span className="ml-2 text-xs text-muted-foreground">(requires individual setup)</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {isAnyBackward && (
                  <div className="space-y-1.5">
                    <Label>Reason for moving backward <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="e.g. Client requested reschedule, missed appointment..."
                      value={bulkMoveReason}
                      onChange={(e) => setBulkMoveReason(e.target.value)}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkMoveOpen(false); setBulkMoveStageId(""); setBulkMoveReason(""); }}>Cancel</Button>
                <Button
                  disabled={!bulkMoveStageId || bulkActioning || (isAnyBackward && !bulkMoveReason.trim())}
                  onClick={handleBulkMove}
                >
                  {bulkActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Bulk Merge Dialog ── */}
      <Dialog open={bulkMergeOpen} onOpenChange={setBulkMergeOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-4 w-4" />
              Merge {selectedIds.size} Clients
            </DialogTitle>
            <DialogDescription>
              Choose the primary client to keep. All notes, files, appointments, and proposals from the others will be moved to the primary, and the others will be discarded.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-2">
            <Label>Primary client (keep this record)</Label>
            <div className="space-y-2 mt-1">
              {selectedClients.map((c) => (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mergePrimaryId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                  <input
                    type="radio"
                    name="merge-primary"
                    value={c.id}
                    checked={mergePrimaryId === c.id}
                    onChange={() => setMergePrimaryId(c.id)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMergeOpen(false)}>Cancel</Button>
            <Button disabled={!mergePrimaryId || bulkActioning} onClick={handleBulkMerge}>
              {bulkActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportRows([]); setImportDone(null); } }}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Leads from Formspree
            </DialogTitle>
            <DialogDescription>
              Upload a Formspree JSON export file. All valid submissions will be imported as prospects.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            {!importDone && (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to select a Formspree JSON export file</span>
                <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              </label>
            )}

            {importDone && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-lg font-semibold">{importDone.created} client{importDone.created !== 1 ? "s" : ""} imported</p>
                {importDone.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">{importDone.skipped} skipped (promo/careers forms or no contact data)</p>
                )}
              </div>
            )}

            {!importDone && importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{importRows.filter(r => !r.skip).length} to import · {importRows.filter(r => r.skip).length} skipped</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border text-sm [scrollbar-width:thin]">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Name</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Contact</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Form</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Services</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importRows.map((row, i) => (
                        <tr key={i} className={row.skip ? "opacity-40" : ""}>
                          <td className="p-2">{row.skip ? "—" : `${row.firstName} ${row.lastName}`.trim()}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {row.skip ? "—" : (row.email || row.phone || "—")}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[140px] truncate">{row.sourceForm}</td>
                          <td className="p-2 text-xs text-muted-foreground">{row.skip ? "—" : (row.services?.join(", ") || "—")}</td>
                          <td className="p-2">
                            {row.skip
                              ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="h-3 w-3" /> {row.skipReason}</span>
                              : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> Import</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {importDone ? (
              <Button onClick={() => { setImportOpen(false); setImportRows([]); setImportDone(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button
                  disabled={importRows.filter(r => !r.skip).length === 0 || importing}
                  onClick={handleConfirmImport}
                >
                  {importing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                    : `Import ${importRows.filter(r => !r.skip).length} Records`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Move Results Dialog ── */}
      <Dialog open={bulkMoveResultOpen} onOpenChange={setBulkMoveResultOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-4 w-4" />
              Move Results
            </DialogTitle>
            <DialogDescription>
              Summary of the bulk move to {bulkMoveResult?.stageName}.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-3 max-h-80 overflow-y-auto">
            {/* Moved */}
            {(bulkMoveResult?.moved.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {bulkMoveResult!.moved.length} client{bulkMoveResult!.moved.length !== 1 ? "s" : ""} moved to {bulkMoveResult!.stageName}
                </p>
                <div className="space-y-1">
                  {bulkMoveResult!.moved.map((c) => (
                    <p key={c.id} className="text-sm text-green-700 pl-5">
                      {c.first_name} {c.last_name}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {bulkMoveResult?.moved.length === 0 && (
              <p className="text-sm text-muted-foreground">No clients were moved.</p>
            )}
            {/* Skipped */}
            {(bulkMoveResult?.skipped.length ?? 0) > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {bulkMoveResult!.skipped.length} client{bulkMoveResult!.skipped.length !== 1 ? "s" : ""} skipped
                </p>
                <div className="space-y-2">
                  {bulkMoveResult!.skipped.map(({ client: c, reason }) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-amber-800">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-amber-600 mt-0.5">{reason}</p>
                      </div>
                      <a
                        href={`/clients/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary font-medium shrink-0 no-underline hover:underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setBulkMoveResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Client Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setNewClient(EMPTY_CLIENT); setFormErrors({}); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Add a new lead to your pipeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="flex flex-col flex-1 min-h-0">
            <div className="grid gap-4 px-6 py-5 overflow-y-auto flex-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={newClient.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    className={formErrors.first_name ? "border-red-500" : ""}
                  />
                  {formErrors.first_name && <p className="text-xs text-red-500">{formErrors.first_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={newClient.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="john.doe@example.com"
                  value={newClient.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={formErrors.email ? "border-red-500" : ""}
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                <Input
                  id="phone"
                  placeholder="+1 (256) 555-0100"
                  value={newClient.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={formErrors.phone ? "border-red-500" : ""}
                />
                {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Street Address <span className="text-destructive">*</span></Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={newClient.address}
                  onChange={(e) => setField("address", e.target.value)}
                  className={formErrors.address ? "border-red-500" : ""}
                />
                {formErrors.address && <p className="text-xs text-red-500">{formErrors.address}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Huntsville"
                    value={newClient.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="AL"
                    value={newClient.state}
                    onChange={(e) => setField("state", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    placeholder="35801"
                    value={newClient.zip}
                    onChange={(e) => setField("zip", e.target.value)}
                    className={formErrors.zip ? "border-red-500" : ""}
                  />
                  {formErrors.zip && <p className="text-xs text-red-500">{formErrors.zip}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={newClient.status}
                    onValueChange={(v) => setNewClient((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="selling">Selling</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lead Source <span className="text-destructive">*</span></Label>
                  <Select
                    value={newClient.lead_source_id}
                    onValueChange={(v) => { setNewClient((p) => ({ ...p, lead_source_id: v })); setFormErrors((e) => { const next = { ...e }; delete next.lead_source_id; return next; }); }}
                  >
                    <SelectTrigger className={formErrors.lead_source_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadSources.map((src) => (
                        <SelectItem key={src.id} value={src.id}>
                          {src.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.lead_source_id && <p className="text-xs text-red-500">{formErrors.lead_source_id}</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || Object.keys(formErrors).length > 0}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
