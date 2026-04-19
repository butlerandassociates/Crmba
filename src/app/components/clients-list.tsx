import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link, useLocation } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Plus, Search, Mail, Phone, Loader2, CalendarCheck, Calendar, Users, Trash2, MoveRight, GitMerge, X } from "lucide-react";
import { SkeletonList } from "./ui/page-loader";
import { clientsAPI, leadSourcesAPI, pipelineStagesAPI } from "../utils/api";
import { supabase } from "@/lib/supabase";
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

export function ClientsList() {
  const location = useLocation();
  const stageFilter = new URLSearchParams(location.search).get("stage") ?? "";

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
  const [bulkMoveSkipped, setBulkMoveSkipped] = useState<any[]>([]);

  // Bulk merge dialog
  const [bulkMergeOpen, setBulkMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState("");

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
    if (newClient.zip.trim() && !/^[A-Za-z0-9\s\-]{3,10}$/.test(newClient.zip.trim())) errors.zip = "Enter a valid postal code.";
    if (!newClient.lead_source_id) errors.lead_source_id = "Lead source is required.";
    return errors;
  };

  useEffect(() => {
    fetchClients();
    fetchLeadSources();
    pipelineStagesAPI.getAll().then(setPipelineStages).catch(console.error);
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await clientsAPI.getAll();
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

    // Block gated stages
    const gateReason = stageGateReason(stageName);
    if (gateReason) {
      toast.error(gateReason, { duration: 6000 });
      return;
    }

    // Block backward moves — compare against each client's current stage
    const ids = Array.from(selectedIds);
    const targetIdx = STAGE_ORDER.indexOf(stageName);
    const blockedBackward = clients.filter((c) => {
      const currentIdx = STAGE_ORDER.indexOf(c.status?.toLowerCase() ?? "");
      return selectedIds.has(c.id) && currentIdx > targetIdx && currentIdx >= STAGE_ORDER.indexOf("sold");
    });
    if (blockedBackward.length > 0) {
      toast.error(`${blockedBackward.length} client${blockedBackward.length > 1 ? "s" : ""} cannot be moved backward once past the Sold stage.`);
      return;
    }

    setBulkActioning(true);
    try {
      let eligibleIds = ids;
      const skipped: any[] = [];

      // Selling gate: must have at least one appointment
      if (stageName === "selling") {
        const { data: appts } = await supabase
          .from("appointments")
          .select("client_id")
          .in("client_id", ids);
        const withAppt = new Set((appts ?? []).map((a: any) => a.client_id));
        const noAppt = clients.filter((c) => ids.includes(c.id) && !withAppt.has(c.id));
        if (noAppt.length === ids.length) {
          toast.error("None of the selected clients have an appointment scheduled. An appointment is required before moving to Selling.");
          setBulkActioning(false);
          return;
        }
        noAppt.forEach((c) => skipped.push(c));
        eligibleIds = ids.filter((id) => withAppt.has(id));
      }

      await supabase
        .from("clients")
        .update({ pipeline_stage_id: bulkMoveStageId, status: stageName })
        .in("id", eligibleIds);

      if (skipped.length > 0) {
        setBulkMoveSkipped(skipped);
        toast.warning(`${eligibleIds.length} client${eligibleIds.length > 1 ? "s" : ""} moved to ${stage?.name}. ${skipped.length} skipped — no appointment scheduled.`, { duration: 6000 });
      } else {
        toast.success(`${eligibleIds.length} client${eligibleIds.length > 1 ? "s" : ""} moved to ${stage?.name}`);
      }

      setBulkMoveOpen(false);
      setBulkMoveStageId("");
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
    const primary = clients.find((c) => c.id === mergePrimaryId);
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
  const stageClients = stageFilter
    ? clients.filter((c) => c.status === stageFilter)
    : clients;

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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

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

  const ClientTable = ({ list }: { list: any[] }) => {
    const visible = filterClients(list);
    const allSelected = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));
    const someSelected = visible.some((c) => selectedIds.has(c.id));

    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleSelectAll(list)}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Lead Source</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Appointment</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Forecast</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((client) => (
                  <tr key={client.id} className={`hover:bg-accent/50 transition-colors ${selectedIds.has(client.id) ? "bg-primary/5" : ""}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.has(client.id)}
                        onCheckedChange={() => toggleSelect(client.id)}
                        aria-label={`Select ${client.first_name} ${client.last_name}`}
                      />
                    </td>
                    <td className="p-3">
                      <Badge className={`${getStatusColor(client.status)} text-xs text-white`}>
                        {client.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Link to={`/clients/${client.id}`} className="font-semibold text-sm hover:text-primary no-underline">
                        {client.first_name} {client.last_name}
                      </Link>
                    </td>
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
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">
                        {client.lead_source?.name ?? "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      {client.appointment_met ? (
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
                    <td className="p-3">
                      <Link to={`/clients/${client.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

  const selectedClients = clients.filter((c) => selectedIds.has(c.id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your client relationships</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={() => setBulkDiscardOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Discard
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkMoveOpen(true)}>
            <MoveRight className="h-3.5 w-3.5 mr-1.5" /> Move to...
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
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
          <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
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
          <ClientTable list={stageClients} />
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
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent className="sm:max-w-[380px]">
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
            <Select value={bulkMoveStageId} onValueChange={setBulkMoveStageId}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>Cancel</Button>
            <Button disabled={!bulkMoveStageId || bulkActioning} onClick={handleBulkMove}>
              {bulkActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  type="email"
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
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={newClient.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
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
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
