import { useParams, Link } from "react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Pencil,
  Calendar,
  FileText,
  FilePlus,
  ChevronDown,
  Send,
  FileSignature,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Upload,
  StickyNote,
  TrendingUp,
  MoveRight,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  X,
  History,
  Plus,
  Hammer,
  Package,
  ClipboardEdit,
  Archive,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { clientsAPI, photosAPI, projectsAPI, estimatesAPI, appointmentsAPI, leadSourcesAPI, notesAPI, activityLogAPI, pipelineStagesAPI, projectPaymentsAPI, receiptsAPI } from "../utils/api";
import { MoveToSoldModal } from "./move-to-sold-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { EmailTemplatesDialog } from "./email-templates-dialog";
import { DocuSignDialog } from "./docusign-dialog";
import { AppointmentDialog } from "./appointment-dialog";
import { PurchaseOrdersSheet } from "./purchase-orders-sheet";
import { ChangeOrdersSheet } from "./change-orders-sheet";
import { CostAttributionsSheet } from "./cost-attributions-sheet";
import { FieldInstallationOrderModal } from "./field-installation-order-modal";
import { Progress } from "./ui/progress";
import { toast } from "sonner";

export function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [clientProposals, setClientProposals] = useState<any[]>([]);
  const [proposalToDelete, setProposalToDelete] = useState<any>(null);
  const [deletingProposal, setDeletingProposal] = useState(false);
  const [soldModalOpen, setSoldModalOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState<any>({});
  const [savingClient, setSavingClient] = useState(false);
  const [clientAppointments, setClientAppointments] = useState<any[]>([]);
  
  // Fetch client from API
  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await clientsAPI.getById(id);
        setClient(data);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch client:", err);
        setError(err.message || "Failed to load client");
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    projectsAPI.getAll().then((all) =>
      setClientProjects(all.filter((p: any) => p.client_id === id))
    ).catch(console.error);
    estimatesAPI.getByClient(id).then(setClientProposals).catch(console.error);
    appointmentsAPI.getByClient(id).then(setClientAppointments).catch(console.error);
    leadSourcesAPI.getAll().then(setLeadSources).catch(console.error);
    pipelineStagesAPI.getAll().then(setPipelineStages).catch(console.error);
    projectPaymentsAPI.getByClient(id).then(setClientPayments).catch(console.error);
  }, [id]);

  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [paymentTrackingOpen, setPaymentTrackingOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState<any>(null);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const EMPTY_PAYMENT = { label: "", amount: "", due_date: "", notes: "" };
  const [newPayment, setNewPayment] = useState(EMPTY_PAYMENT);
  const [paidForm, setPaidForm] = useState({ payment_method: "", notes: "" });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [purchaseOrdersOpen, setPurchaseOrdersOpen] = useState(false);
  const [changeOrdersOpen, setChangeOrdersOpen] = useState(false);
  const [fioOpen, setFioOpen] = useState(false);
  const [costAttributionsOpen, setCostAttributionsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [noteEntries, setNoteEntries] = useState<any[]>([]);
  const [notesPage, setNotesPage] = useState(1);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [filesPage, setFilesPage] = useState(1);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [gpHealthOpen, setGpHealthOpen] = useState<Record<string, boolean>>({});
  const [gpHealthData, setGpHealthData] = useState<Record<string, any>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [scopePopoverOpen, setScopePopoverOpen] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const FILES_PER_PAGE = 5;
  
  // Auto-move SOLD → ACTIVE when start date has passed
  useEffect(() => {
    if (!client || !id) return;
    if (client.status !== "sold") return;
    const project = clientProjects[0];
    if (!project?.startDate) return;
    const start = new Date(project.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= start) {
      clientsAPI.update(id, { status: "active" }).then(() => {
        setClient((prev: any) => ({ ...prev, status: "active" }));
        activityLogAPI.create({ client_id: id, action_type: "status_changed", description: "Automatically moved to Active — start date reached" }).then(loadActivityLog).catch(() => {});
      }).catch(() => {});
    }
  }, [client?.status, clientProjects.length]);

  // Load photos, notes and activity log when client loads
  useEffect(() => {
    if (client && id) {
      loadPhotos();
      loadNotes();
      loadActivityLog();
      setSelectedScopes(Array.isArray(client.scope_of_work) ? client.scope_of_work : []);
    }
  }, [client?.id]);

  const loadNotes = async () => {
    if (!id) return;
    try {
      const data = await notesAPI.getByClient(id);
      setNoteEntries(data || []);
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  };

  const loadActivityLog = async () => {
    if (!id) return;
    try {
      const data = await activityLogAPI.getByClient(id);
      setActivityLog(data || []);
    } catch (error) {
      console.error("Failed to load activity log:", error);
    }
  };

  const loadPhotos = async () => {
    if (!id) return;
    try {
      const data = await photosAPI.getAll(id);
      setPhotos(data || []);
    } catch (error) {
      console.error("Failed to load photos:", error);
    }
  };

  const handleSaveNotes = async () => {
    if (!id || !notes.trim()) return;
    try {
      setSavingNotes(true);
      await notesAPI.create({ client_id: id, content: notes.trim() });
      setNotes("");
      await loadNotes();
      toast.success("Note saved");
    } catch (error: any) {
      console.error("Failed to save note:", error);
      toast.error("Failed to save note");
    } finally {
      setSavingNotes(false);
    }
  };
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files) return;
    
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      try {
        setUploadingPhoto(true);
        await photosAPI.upload(id, file);
        toast.success(`Uploaded ${file.name}`);
      } catch (error: any) {
        console.error("Failed to upload photo:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setUploadingPhoto(false);
    loadPhotos();
    
    // Reset input
    e.target.value = "";
  };
  
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (!id || !e.dataTransfer.files.length) return;
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      try {
        setUploadingPhoto(true);
        await photosAPI.upload(id, file);
        toast.success(`Uploaded ${file.name}`);
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploadingPhoto(false);
    loadPhotos();
  };

  const handleDeletePhoto = async (fileId: string, fileUrl: string) => {
    try {
      await photosAPI.delete(fileId, fileUrl);
      toast.success("File deleted");
      loadPhotos();
    } catch (error: any) {
      console.error("Failed to delete photo:", error);
      toast.error("Failed to delete photo");
    }
  };
  
  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    try {
      setUpdating(true);
      const matchingStage = pipelineStages.find(
        (s) => s.name.toLowerCase() === newStatus.toLowerCase()
      );
      await clientsAPI.update(client.id, {
        status: newStatus,
        pipeline_stage_id: matchingStage?.id ?? client.pipeline_stage_id,
      });
      setClient({ ...client, status: newStatus, pipeline_stage_id: matchingStage?.id ?? client.pipeline_stage_id });
      activityLogAPI.create({ client_id: client.id, action_type: "status_changed", description: `Status changed to "${newStatus}"` }).then(loadActivityLog).catch(() => {});
      toast.success(`Moved to ${newStatus}`);
    } catch (err: any) {
      console.error("Failed to update client status:", err);
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDiscard = async () => {
    if (!client) return;
    setDiscarding(true);
    try {
      await clientsAPI.update(client.id, {
        is_discarded: true,
        discarded_at: new Date().toISOString(),
        discarded_reason: discardReason.trim() || null,
      });
      activityLogAPI.create({ client_id: client.id, action_type: "status_changed", description: `Client discarded${discardReason.trim() ? `: ${discardReason.trim()}` : ""}` }).catch(() => {});
      toast.success("Client discarded. You can revive them anytime.");
      setDiscardOpen(false);
      setDiscardReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to discard client");
    } finally {
      setDiscarding(false);
    }
  };

  const toggleGPHealth = async (projectId: string) => {
    const isOpen = gpHealthOpen[projectId];
    setGpHealthOpen((prev) => ({ ...prev, [projectId]: !isOpen }));
    if (isOpen || gpHealthData[projectId]) return; // already loaded

    try {
      const receipts = await receiptsAPI.getByProject(projectId);
      // Use accepted proposal, fall back to most recent non-declined (move-to-sold may not set "accepted")
      const acceptedProposal =
        clientProposals.find((p) => p.status === "accepted") ??
        [...clientProposals]
          .filter((p) => p.status !== "declined")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const lineItems = acceptedProposal?.line_items ?? [];
      const estimateTotalCost = acceptedProposal?.total_cost ?? 0;

      // Budgeted costs from proposal line items
      const materialBudget = lineItems.reduce((s: number, li: any) =>
        s + (parseFloat(li.material_cost) || 0) * (parseFloat(li.quantity) || 1), 0);
      const laborBudget = lineItems.reduce((s: number, li: any) =>
        s + (parseFloat(li.labor_cost) || 0) * (parseFloat(li.quantity) || 1), 0);
      // If line items have no cost breakdown, distribute estimate.total_cost proportionally
      const lineItemCostTotal = materialBudget + laborBudget;
      const effectiveMaterialBudget = lineItemCostTotal > 0 ? materialBudget : estimateTotalCost * 0.7;
      const effectiveLaborBudget = lineItemCostTotal > 0 ? laborBudget : estimateTotalCost * 0.3;

      // Actual spend from receipts
      const materialActual = receipts.filter((r: any) => r.category === "material")
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const laborActual = receipts.filter((r: any) => r.category === "labor")
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);

      setGpHealthData((prev) => ({
        ...prev,
        [projectId]: {
          materialBudget: effectiveMaterialBudget,
          laborBudget: effectiveLaborBudget,
          materialActual,
          laborActual,
          receipts,
          isFallbackBudget: lineItemCostTotal === 0 && estimateTotalCost > 0,
        },
      }));
    } catch {
      toast.error("Failed to load financial health data");
    }
  };

  const handleLeadSourceChange = async (leadSourceId: string) => {
    if (!client) return;
    try {
      await clientsAPI.update(client.id, { lead_source_id: leadSourceId });
      const selected = leadSources.find((ls) => ls.id === leadSourceId);
      setClient({ ...client, lead_source: selected, lead_source_id: leadSourceId });
      toast.success("Lead source updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update lead source");
    }
  };

  const handleMarkAsMet = async () => {
    if (!client) return;
    try {
      setUpdating(true);
      // Update clients table
      await clientsAPI.update(client.id, { appointment_met: true });
      setClient({ ...client, appointment_met: true });
      // Also mark the matching appointment row as met
      const clientApptDate = client.appointment_date?.split("T")[0];
      const matching = clientAppointments.find(
        (a) => a.appointment_date?.split("T")[0] === clientApptDate && !a.is_met
      );
      if (matching) {
        await appointmentsAPI.markAsMet(matching.id);
        setClientAppointments((prev) =>
          prev.map((a) => a.id === matching.id ? { ...a, is_met: true } : a)
        );
      }
      activityLogAPI.create({ client_id: client.id, action_type: "appointment_met", description: "Appointment marked as met" }).then(loadActivityLog).catch(() => {});
      toast.success("Appointment marked as met!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update appointment");
    } finally {
      setUpdating(false);
    }
  };

  const handleAppointmentScheduled = async () => {
    // Reload client data to get updated appointments
    if (!id) return;
    try {
      const data = await clientsAPI.getById(id);
      setClient(data);
    } catch (err: any) {
      console.error("Failed to reload client:", err);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Client not found</h2>
          <Link to="/clients">
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "sold":
        return "bg-orange-500";
      case "prospect":
        return "bg-blue-500";
      case "completed":
        return "bg-purple-500";
      case "inactive":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-green-500";
      case "planning":
        return "bg-blue-500";
      case "completed":
        return "bg-purple-500";
      case "on_hold":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clients">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company || "—"}
              </h1>
              <Badge className={getStatusColor(client.status)}>{client.status}</Badge>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              Actions
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Client Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setAppointmentDialogOpen(true)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Appointment
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setEmailDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDocusignDialogOpen(true)}
            >
              <FileSignature className="h-4 w-4 mr-2" />
              Send DocuSign
            </DropdownMenuItem>
            <Link to={`/clients/${client.id}/create-proposal`}>
              <DropdownMenuItem>
                <FilePlus className="h-4 w-4 mr-2" />
                Create Proposal
              </DropdownMenuItem>
            </Link>
            {client.appointment_scheduled && !client.appointment_met && (
              <DropdownMenuItem onClick={handleMarkAsMet} disabled={updating}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Mark Appointment as Met
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to Stage</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => handleStatusChange('prospect')}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Prospect
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange('selling')}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Selling
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSoldModalOpen(true)}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Sold
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange('active')}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Active
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange('completed')}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Completed
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDiscardOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Archive className="h-4 w-4 mr-2" />
              Discard Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Contact Information</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              setClientForm({
                first_name: client.first_name ?? "",
                last_name: client.last_name ?? "",
                company: client.company ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                city: client.city ?? "",
                state: client.state ?? "",
                zip: client.zip ?? "",
              });
              setEditClientOpen(true);
            }}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">{client.email || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Phone</div>
                <div className="text-sm text-muted-foreground">{client.phone || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">Address</div>
                <div className="text-sm text-muted-foreground">
                  {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "—"}
                </div>
                {(client.address || client.city) && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setMapOpen((v) => !v)}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      {mapOpen ? "Hide Map" : "View Map"}
                    </button>
                    {mapOpen && (
                      <div className="mt-2 rounded-lg overflow-hidden border shadow-sm">
                        <iframe
                          title="Client Location"
                          width="100%"
                          height="220"
                          style={{ border: 0, display: "block" }}
                          loading="lazy"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent([client.address, client.city, client.state, client.zip].filter(Boolean).join(", "))}&output=embed`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Client Since</div>
                <div className="text-sm text-muted-foreground">{formatDate(client.created_at)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              DocuSign Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.docusign_status === 'completed' ? (
              <div className="space-y-2">
                <Badge className="bg-green-600 flex items-center gap-1 w-fit">
                  <CheckCircle2 className="h-3 w-3" />
                  Contract Completed
                </Badge>
                {client.docusign_sent_date && (
                  <div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                    <div className="text-sm font-medium">{formatDate(client.docusign_sent_date)}</div>
                  </div>
                )}
                {client.docusign_completed_date && (
                  <div>
                    <div className="text-xs text-muted-foreground">Signed</div>
                    <div className="text-sm font-medium">{formatDate(client.docusign_completed_date)}</div>
                  </div>
                )}
                {client.docusign_envelope_id && (
                  <div>
                    <div className="text-xs text-muted-foreground">Envelope ID</div>
                    <div className="text-xs font-mono bg-muted p-1 rounded mt-1">{client.docusign_envelope_id}</div>
                  </div>
                )}
              </div>
            ) : client.docusign_status === 'sent_to_client' ? (
              <div className="space-y-2">
                <Badge className="bg-orange-500 flex items-center gap-1 w-fit">
                  <Clock className="h-3 w-3" />
                  Sent to Client
                </Badge>
                {client.docusign_sent_date && (
                  <div>
                    <div className="text-xs text-muted-foreground">Sent on</div>
                    <div className="text-sm font-medium">{formatDate(client.docusign_sent_date)}</div>
                  </div>
                )}
                {client.docusign_envelope_id && (
                  <div>
                    <div className="text-xs text-muted-foreground">Envelope ID</div>
                    <div className="text-xs font-mono bg-muted p-1 rounded mt-1">{client.docusign_envelope_id}</div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Waiting for client signature
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                  <XCircle className="h-3 w-3" />
                  No Contract Sent
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Use the Actions menu to send a DocuSign contract
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue & Forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium">Total Revenue</div>
              <div className="text-xl font-bold text-green-600 mt-1">
                {formatCurrency(clientProjects.reduce((sum, p) => sum + (p.totalValue ?? 0), 0))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Projects</div>
              <div className="text-lg font-semibold mt-1">{clientProjects.length}</div>
            </div>
            {client.projected_value && (
              <div>
                <div className="text-sm font-medium">Projected Value</div>
                <div className="text-lg font-semibold mt-1">
                  {formatCurrency(client.projected_value)}
                </div>
              </div>
            )}
            {client.closing_probability && (
              <div>
                <div className="text-sm font-medium">Closing Probability</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${client.closing_probability}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{client.closing_probability}%</span>
                </div>
              </div>
            )}
            {client.expected_close_date && (
              <div>
                <div className="text-sm font-medium">Expected Close Date</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.expected_close_date)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Project Info ── */}
      {clientProjects.length > 0 && clientProjects.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge className={getProjectStatusColor(project.status)}>{project.status?.replace("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Contract Value</p>
                <p className="font-semibold text-base">{formatCurrency(project.totalValue ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Profit</p>
                <p className="font-semibold text-base text-green-600">{formatCurrency(project.grossProfit ?? 0)}</p>
              </div>
              <div>
                <button
                  className="text-left group"
                  onClick={() => toggleGPHealth(project.id)}
                >
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    GP %
                    <ChevronDown className={`h-3 w-3 transition-transform ${gpHealthOpen[project.id] ? "rotate-180" : ""}`} />
                  </p>
                  <p className="font-semibold text-base group-hover:text-primary transition-colors">
                    {(project.profitMargin ?? 0).toFixed(1)}%
                  </p>
                </button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className="font-semibold text-base text-blue-600">{formatCurrency(project.commission ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-medium">{project.startDate ? formatDate(project.startDate) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="font-medium">{project.endDate ? formatDate(project.endDate) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Manager</p>
                <p className="font-medium">{project.projectManagerName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Foreman</p>
                <p className="font-medium">{project.foremanName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sales Rep</p>
                <p className="font-medium">{project.salesRepName || "—"}</p>
              </div>
            </div>
            {/* ── GP Health Panel ── */}
            {gpHealthOpen[project.id] && (() => {
              const d = gpHealthData[project.id];
              if (!d) return (
                <div className="border-t pt-3 flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              );

              const contractValue = project.totalValue ?? 0;
              const totalBudget = d.materialBudget + d.laborBudget;
              const totalActual = d.materialActual + d.laborActual;
              const liveGP = contractValue - totalActual;
              const liveGPPct = contractValue > 0 ? (liveGP / contractValue) * 100 : 0;
              const budgetedGP = project.grossProfit ?? 0;

              const health = (actual: number, budget: number) => {
                if (budget === 0) return "text-muted-foreground";
                const ratio = actual / budget;
                if (ratio <= 0.9) return "text-green-600";
                if (ratio <= 1.0) return "text-amber-500";
                return "text-red-600";
              };
              const healthBg = (actual: number, budget: number) => {
                if (budget === 0) return "bg-gray-50";
                const ratio = actual / budget;
                if (ratio <= 0.9) return "bg-green-50 border-green-200";
                if (ratio <= 1.0) return "bg-amber-50 border-amber-200";
                return "bg-red-50 border-red-200";
              };
              const overUnder = (actual: number, budget: number) => {
                if (budget === 0) return null;
                const diff = budget - actual;
                return diff >= 0
                  ? <span className="text-green-600 text-xs font-medium">{formatCurrency(diff)} under budget</span>
                  : <span className="text-red-600 text-xs font-medium">{formatCurrency(Math.abs(diff))} OVER budget</span>;
              };

              return (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial Health</p>

                  {/* Live GP vs Budgeted GP */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-muted-foreground">Budgeted GP</p>
                      <p className="font-bold text-base text-green-600">{formatCurrency(budgetedGP)}</p>
                      <p className="text-xs text-muted-foreground">{(project.profitMargin ?? 0).toFixed(1)}% margin</p>
                    </div>
                    <div className={`border rounded-lg p-3 ${liveGP >= budgetedGP ? "bg-green-50 border-green-200" : liveGP >= 0 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                      <p className="text-xs text-muted-foreground">Live GP (based on receipts)</p>
                      <p className={`font-bold text-base ${liveGP >= budgetedGP ? "text-green-600" : liveGP >= 0 ? "text-amber-600" : "text-red-600"}`}>
                        {formatCurrency(liveGP)}
                      </p>
                      <p className="text-xs text-muted-foreground">{liveGPPct.toFixed(1)}% margin</p>
                    </div>
                  </div>

                  {/* Material breakdown */}
                  <div className={`border rounded-lg p-3 space-y-1.5 ${healthBg(d.materialActual, d.materialBudget)}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Materials</p>
                      {overUnder(d.materialActual, d.materialBudget)}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget: <span className="font-medium text-foreground">{formatCurrency(d.materialBudget)}</span></span>
                      <span>Actual: <span className={`font-semibold ${health(d.materialActual, d.materialBudget)}`}>{formatCurrency(d.materialActual)}</span></span>
                    </div>
                    {d.materialBudget > 0 && (
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.materialActual / d.materialBudget > 1 ? "bg-red-500" : d.materialActual / d.materialBudget > 0.9 ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${Math.min((d.materialActual / d.materialBudget) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Labor breakdown */}
                  <div className={`border rounded-lg p-3 space-y-1.5 ${healthBg(d.laborActual, d.laborBudget)}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Labor</p>
                      {overUnder(d.laborActual, d.laborBudget)}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget: <span className="font-medium text-foreground">{formatCurrency(d.laborBudget)}</span></span>
                      <span>Actual: <span className={`font-semibold ${health(d.laborActual, d.laborBudget)}`}>{formatCurrency(d.laborActual)}</span></span>
                    </div>
                    {d.laborBudget > 0 && (
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${d.laborActual / d.laborBudget > 1 ? "bg-red-500" : d.laborActual / d.laborBudget > 0.9 ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${Math.min((d.laborActual / d.laborBudget) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {totalActual === 0 && (
                    <p className="text-xs text-muted-foreground text-center pb-1">No receipts uploaded yet. Live GP will update as you add receipts via Cost Attributions.</p>
                  )}
                  {d.isFallbackBudget && (
                    <p className="text-xs text-muted-foreground text-center pb-1">* Material/labor split estimated at 70/30 — product cost breakdown not available in proposal line items.</p>
                  )}
                </div>
              );
            })()}

            {client.status === "active" && (() => {
              const paid = clientPayments.filter((p) => p.is_paid).reduce((s, p) => s + (p.amount ?? 0), 0);
              const total = clientPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
              const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
              return (
                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Payment Progress</span>
                    <span className="font-semibold">{pct}% · {formatCurrency(paid)} of {formatCurrency(total)}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ))}

      {/* ── Project Actions ── */}
      {clientProjects.length > 0 && (() => {
        const isSold = ["sold", "active", "completed"].includes(client.status);
        const tileClass = "flex items-center gap-3 border rounded-lg p-4 hover:bg-accent/40 transition-colors text-left";
        return (
          <div className={`grid grid-cols-2 gap-3 ${isSold ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
            <button onClick={() => setPurchaseOrdersOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-amber-600" /></div>
              <div><p className="font-semibold text-sm">Purchase Orders</p><p className="text-xs text-muted-foreground">Order materials</p></div>
            </button>
            <button onClick={() => setChangeOrdersOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0"><ClipboardEdit className="h-5 w-5 text-blue-600" /></div>
              <div><p className="font-semibold text-sm">Change Orders</p><p className="text-xs text-muted-foreground">Scope changes</p></div>
            </button>
            <button onClick={() => setFioOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-green-600" /></div>
              <div><p className="font-semibold text-sm">FIO</p><p className="text-xs text-muted-foreground">Crew labor schedule</p></div>
            </button>
            <button onClick={() => setCostAttributionsOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
              <div><p className="font-semibold text-sm">Cost Attributions</p><p className="text-xs text-muted-foreground">Receipts &amp; actuals</p></div>
            </button>
            {isSold && (
              <button onClick={() => setPaymentTrackingOpen(true)} className={tileClass}>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
                <div><p className="font-semibold text-sm">Payments</p><p className="text-xs text-muted-foreground">Monitor collections</p></div>
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Proposals ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Proposals {clientProposals.length > 0 && <Badge variant="secondary">{clientProposals.length}</Badge>}
          </CardTitle>
          <Link to={`/clients/${client.id}/create-proposal`}>
            <Button size="sm"><FilePlus className="h-4 w-4 mr-2" />New Proposal</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {clientProposals.length > 0 ? (
            <div className="divide-y">
              {clientProposals.map((proposal) => (
                <div key={proposal.id} className="p-4 hover:bg-accent transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <Link to={`/proposals/${proposal.id}`} className="font-semibold text-sm hover:text-primary">
                        {proposal.title ?? `Estimate #${proposal.estimate_number}`}
                      </Link>
                      <p className="text-xs text-muted-foreground">{proposal.notes}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{proposal.status}</Badge>
                        <span className="text-xs text-muted-foreground">Created {formatDate(proposal.created_at)}</span>
                      </div>
                      {proposal.status === "declined" && (
                        <div className="mt-1.5 text-xs text-red-600">
                          {proposal.declined_at && <span>Declined {formatDate(proposal.declined_at)}</span>}
                          {proposal.decline_reason && <span className="block italic text-muted-foreground mt-0.5">"{proposal.decline_reason}"</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-2">
                      <div className="font-semibold">{formatCurrency(proposal.total)}</div>
                      <div className="flex gap-2 justify-end">
                        <Link to={`/proposals/${proposal.id}`}><Button variant="outline" size="sm">View Proposal</Button></Link>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setProposalToDelete(proposal)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No proposals yet</p>
              <Link to={`/clients/${client.id}/create-proposal`}>
                <Button className="mt-4" size="sm"><FilePlus className="h-4 w-4 mr-2" />Create First Proposal</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">Lead Source</div>
              <Select
                value={client.lead_source_id || client.lead_source?.id || ""}
                onValueChange={handleLeadSourceChange}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  {leadSources.map((ls) => (
                    <SelectItem key={ls.id} value={ls.id}>{ls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium">Appointment Status</div>
              <div className="mt-1">
                {client.appointment_met ? (
                  <Badge className="bg-green-500 text-white text-xs">Met</Badge>
                ) : client.appointment_scheduled && client.appointment_date ? (
                  <div className="space-y-0.5">
                    <Badge className="bg-blue-500 text-white text-xs">Scheduled</Badge>
                    <div className="text-xs text-muted-foreground pt-1">
                      {formatDate(client.appointment_date)}
                      {client.appointment_date && ` · ${new Date(client.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                      {client.appointment_end_date && ` – ${new Date(client.appointment_end_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Not Scheduled</span>
                )}
              </div>
            </div>
            {client.last_contact_date && (
              <div>
                <div className="text-sm font-medium">Last Contact</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.last_contact_date)}
                </div>
              </div>
            )}
            {client.next_follow_up_date && (
              <div>
                <div className="text-sm font-medium">Next Follow-up</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.next_follow_up_date)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Scope of Work</Label>
              {(() => {
                const SCOPE_OPTIONS = [
                  { value: "concrete-driveway", label: "Concrete (Driveway, Walkway, Patio)" },
                  { value: "outdoor-kitchen",   label: "Outdoor Kitchen" },
                  { value: "pergola-pavilion",  label: "Pergola/Pavilion" },
                  { value: "landscaping",       label: "Landscaping" },
                  { value: "drainage",          label: "Drainage" },
                  { value: "pool-deck",         label: "Pool Deck" },
                  { value: "retaining-wall",    label: "Retaining Wall" },
                  { value: "fire-pit",          label: "Fire Pit/Fireplace" },
                  { value: "deck",              label: "Deck/Patio Cover" },
                  { value: "fencing",           label: "Fencing" },
                  { value: "lighting",          label: "Outdoor Lighting" },
                  { value: "irrigation",        label: "Irrigation System" },
                ];
                const toggleScope = async (value: string) => {
                  const next = selectedScopes.includes(value)
                    ? selectedScopes.filter((s) => s !== value)
                    : [...selectedScopes, value];
                  setSelectedScopes(next);
                  try { await clientsAPI.update(id!, { scope_of_work: next }); }
                  catch { toast.error("Failed to save scope of work"); }
                };
                return (
                  <div className="space-y-2">
                    <Popover open={scopePopoverOpen} onOpenChange={setScopePopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent/30 transition-colors"
                        >
                          <span className="text-muted-foreground">
                            {selectedScopes.length === 0 ? "Select scope of work" : "Add or remove scopes..."}
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        avoidCollisions={false}
                        className="w-72 p-2"
                      >
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {SCOPE_OPTIONS.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedScopes.includes(opt.value)}
                                onCheckedChange={() => toggleScope(opt.value)}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedScopes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedScopes.map((s) => {
                          const label = SCOPE_OPTIONS.find((o) => o.value === s)?.label;
                          return (
                            <Badge key={s} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                              {label}
                              <button
                                type="button"
                                onClick={() => toggleScope(s)}
                                className="ml-0.5 hover:text-destructive rounded-full"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Checkbox 
                id="call-811" 
                defaultChecked={client.call_811_required}
              />
              <Label 
                htmlFor="call-811" 
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <PhoneCall className="h-4 w-4 text-muted-foreground" />
                Call 811?
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Call before you dig for utility location services
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Notes + Activity Log - side by side below Project Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Internal Notes
              {noteEntries.length > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">{noteEntries.length} note{noteEntries.length !== 1 ? "s" : ""}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-notes" className="text-sm font-medium">Add New Note</Label>
              <Textarea
                id="client-notes"
                placeholder="Add notes for your internal team to review..."
                rows={3}
                className="resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Visible to your team only</p>
            </div>
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes || !notes.trim()}>
              {savingNotes ? "Saving..." : "Save Note"}
            </Button>
            {noteEntries.length > 0 ? (
              <div className="pt-2 border-t">
                <div className="max-h-64 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {noteEntries.map((note) => (
                    <div key={note.id} className="bg-muted/50 p-3 rounded-lg space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {note.profile ? `${note.profile.first_name} ${note.profile.last_name}` : "Team Member"}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(note.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">No notes yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Activity Log
              {activityLog.length > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">{activityLog.length} event{activityLog.length !== 1 ? "s" : ""}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length > 0 ? (
              <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3 py-2.5 border-b last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground">Actions like emails sent, appointments scheduled, and contracts signed will appear here automatically.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">

        {/* ── Payment Tracking Modal ── */}
        <Dialog open={paymentTrackingOpen} onOpenChange={setPaymentTrackingOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Tracking
              </DialogTitle>
              <DialogDescription>Monitor collections for {`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company}</DialogDescription>
            </DialogHeader>
            {(() => {
              const totalAmount = clientPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
              const totalPaid   = clientPayments.filter((p) => p.is_paid).reduce((s, p) => s + (p.amount ?? 0), 0);
              const pct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
              return (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Payment Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Received: {formatCurrency(totalPaid)}</span>
                      <span>Remaining: {formatCurrency(totalAmount - totalPaid)}</span>
                    </div>
                  </div>

                  {/* Milestones */}
                  {clientPayments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No milestones added yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {clientPayments.map((payment) => {
                        const pctOfTotal = totalAmount > 0 ? Math.round((payment.amount / totalAmount) * 100) : 0;
                        return (
                          <div key={payment.id} className={`flex items-center gap-3 border rounded-lg px-4 py-3 transition-colors ${payment.is_paid ? "bg-green-50/50 border-green-200" : "hover:bg-accent/30"}`}>
                            <Checkbox
                              checked={payment.is_paid}
                              onCheckedChange={() => {
                                if (!payment.is_paid) {
                                  setMarkPaidOpen(payment);
                                  setPaidForm({ payment_method: "", notes: payment.notes ?? "" });
                                } else {
                                  projectPaymentsAPI.update(payment.id, { is_paid: false, paid_date: null, payment_method: null });
                                  setClientPayments((prev) => prev.map((p) => p.id === payment.id ? { ...p, is_paid: false, paid_date: null, payment_method: null } : p));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm ${payment.is_paid ? "line-through text-muted-foreground" : ""}`}>{payment.label}</p>
                              <p className="text-xs text-muted-foreground">{pctOfTotal}% · {formatCurrency(payment.amount)}{payment.due_date ? ` · Due ${formatDate(payment.due_date)}` : ""}</p>
                              {payment.is_paid && payment.payment_method && (
                                <p className="text-xs text-green-700 mt-0.5">{payment.payment_method}{payment.paid_date ? ` · ${formatDate(payment.paid_date)}` : ""}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setEditPayment({ ...payment, amount: String(payment.amount), due_date: payment.due_date ?? "" }); setEditPaymentOpen(true); }} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={async () => { await projectPaymentsAPI.delete(payment.id); setClientPayments((prev) => prev.filter((p) => p.id !== payment.id)); toast.success("Milestone removed"); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="space-y-1">
                      <div className="flex justify-between gap-16 text-sm font-semibold">
                        <span>Total Contract Value</span>
                        <span>{formatCurrency(clientProjects[0]?.totalValue ?? 0)}</span>
                      </div>
                      <div className="flex justify-between gap-16 text-sm text-muted-foreground">
                        <span>Total Milestones</span>
                        <span>{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { setNewPayment(EMPTY_PAYMENT); setAddPaymentOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Milestone
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Add Payment Dialog */}
        <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Add Payment Milestone</DialogTitle>
              <DialogDescription>Add a progress payment from the signed contract.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Label</Label><Input placeholder="e.g. Deposit, Progress Payment, Final" value={newPayment.label} onChange={(e) => setNewPayment((p) => ({ ...p, label: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Amount ($)</Label><Input type="number" placeholder="0.00" value={newPayment.amount} onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment((p) => ({ ...p, due_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional note" value={newPayment.notes} onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>Cancel</Button>
              <Button disabled={savingPayment || !newPayment.label || !newPayment.amount} onClick={async () => {
                if (!client) return;
                setSavingPayment(true);
                try {
                  const project = clientProjects[0];
                  const created = await projectPaymentsAPI.create({ project_id: project?.id ?? "", client_id: client.id, label: newPayment.label, amount: parseFloat(newPayment.amount) || 0, due_date: newPayment.due_date || undefined, notes: newPayment.notes || undefined, sort_order: clientPayments.length });
                  setClientPayments((prev) => [...prev, created]);
                  setAddPaymentOpen(false);
                  toast.success("Payment added.");
                } catch (err: any) {
                  toast.error(err.message || "Failed to add payment.");
                } finally { setSavingPayment(false); }
              }}>
                {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark as Paid Dialog */}
        <Dialog open={!!markPaidOpen} onOpenChange={(o) => { if (!o) setMarkPaidOpen(null); }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>{markPaidOpen?.label} — {formatCurrency(markPaidOpen?.amount ?? 0)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Payment Method</Label><Input placeholder="e.g. Check #1042, ACH #8829, Cash" value={paidForm.payment_method} onChange={(e) => setPaidForm((p) => ({ ...p, payment_method: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Notes (optional)</Label><Input placeholder="Any additional notes" value={paidForm.notes} onChange={(e) => setPaidForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidOpen(null)}>Cancel</Button>
              <Button disabled={savingPayment} onClick={async () => {
                if (!markPaidOpen) return;
                setSavingPayment(true);
                try {
                  const updated = await projectPaymentsAPI.update(markPaidOpen.id, { is_paid: true, paid_date: new Date().toISOString().split("T")[0], payment_method: paidForm.payment_method || null, notes: paidForm.notes || null });
                  setClientPayments((prev) => prev.map((p) => p.id === markPaidOpen.id ? { ...p, ...updated } : p));
                  setMarkPaidOpen(null);
                  activityLogAPI.create({ client_id: id!, action_type: "payment_received", description: `Payment marked as paid: ${markPaidOpen.label}${markPaidOpen.amount ? ` — $${Number(markPaidOpen.amount).toLocaleString()}` : ""}` }).then(loadActivityLog).catch(() => {});
                  toast.success("Payment marked as paid.");
                } catch (err: any) {
                  toast.error(err.message || "Failed to update payment.");
                } finally { setSavingPayment(false); }
              }}>
                {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Paid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={editPaymentOpen} onOpenChange={setEditPaymentOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Edit Milestone</DialogTitle>
              <DialogDescription>Update this payment milestone.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Label</Label><Input value={editPayment?.label ?? ""} onChange={(e) => setEditPayment((p: any) => ({ ...p, label: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Amount ($)</Label><Input type="number" value={editPayment?.amount ?? ""} onChange={(e) => setEditPayment((p: any) => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={editPayment?.due_date ?? ""} onChange={(e) => setEditPayment((p: any) => ({ ...p, due_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional note" value={editPayment?.notes ?? ""} onChange={(e) => setEditPayment((p: any) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPaymentOpen(false)}>Cancel</Button>
              <Button disabled={savingPayment} onClick={async () => {
                if (!editPayment) return;
                setSavingPayment(true);
                try {
                  const updated = await projectPaymentsAPI.update(editPayment.id, { label: editPayment.label, amount: parseFloat(editPayment.amount) || 0, due_date: editPayment.due_date || undefined, notes: editPayment.notes || undefined });
                  setClientPayments((prev) => prev.map((p) => p.id === editPayment.id ? { ...p, ...updated } : p));
                  setEditPaymentOpen(false);
                  toast.success("Milestone updated");
                } catch (err: any) {
                  toast.error(err.message || "Failed to update");
                } finally { setSavingPayment(false); }
              }}>
                {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ── Client Files ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Client Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDraggingFile ? "border-primary bg-primary/5" : "hover:border-primary"
                  } ${uploadingPhoto ? "opacity-60 pointer-events-none" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById("photo-upload")?.click()}
                >
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {uploadingPhoto ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {isDraggingFile ? "Drop files here" : "Click or drag files to upload"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Images, PDF, Word, Excel up to 10MB
                      </p>
                    </>
                  )}
                </div>
                {photos.length > 0 ? (
                  <>
                    <div className="divide-y rounded-lg border overflow-hidden">
                      {photos
                        .slice((filesPage - 1) * FILES_PER_PAGE, filesPage * FILES_PER_PAGE)
                        .map((photo: any) => {
                          const isImage = photo.mime_type?.startsWith("image/");
                          const isPdf = photo.mime_type === "application/pdf";
                          return (
                            <div key={photo.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors group">
                              {/* File type icon */}
                              <FileText className={`h-4 w-4 shrink-0 ${isPdf ? "text-red-500" : isImage ? "text-blue-500" : "text-muted-foreground"}`} />

                              {/* Clickable file name */}
                              <button
                                className="flex-1 text-left text-sm font-medium truncate hover:underline"
                                onClick={() => {
                                  if (isImage) setPreviewFile({ url: photo.file_url, name: photo.file_name });
                                  else window.open(photo.file_url, "_blank");
                                }}
                              >
                                {photo.file_name}
                              </button>

                              {/* Date */}
                              <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                                {new Date(photo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>

                              {/* Delete */}
                              <button
                                className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeletePhoto(photo.id, photo.file_url)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                    {photos.length > FILES_PER_PAGE && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          {(filesPage - 1) * FILES_PER_PAGE + 1}–{Math.min(filesPage * FILES_PER_PAGE, photos.length)} of {photos.length} files
                        </p>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setFilesPage(filesPage - 1)} disabled={filesPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground px-1">Page {filesPage} of {Math.ceil(photos.length / FILES_PER_PAGE)}</span>
                          <Button variant="outline" size="sm" onClick={() => setFilesPage(filesPage + 1)} disabled={filesPage >= Math.ceil(photos.length / FILES_PER_PAGE)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No files uploaded yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

      </div>

      <EmailTemplatesDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        client={client}
        onSent={loadActivityLog}
      />
      <DocuSignDialog
        open={docusignDialogOpen}
        onOpenChange={setDocusignDialogOpen}
        client={client}
      />
      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        client={client}
        onAppointmentScheduled={handleAppointmentScheduled}
      />


      {/* Move to Sold Modal */}
      <MoveToSoldModal
        open={soldModalOpen}
        onOpenChange={setSoldModalOpen}
        client={client}
        project={clientProjects[0] ?? null}
        onSuccess={() => {
          setClient({ ...client, status: "sold" });
          loadActivityLog();
        }}
      />

      {/* Edit Client Dialog */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update contact information for this client.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-3 py-2 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={clientForm.first_name ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={clientForm.last_name ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={clientForm.company ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={clientForm.email ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" value={clientForm.phone ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Street Address</Label>
              <Input value={clientForm.address ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={clientForm.city ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={clientForm.state ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, state: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP</Label>
                <Input value={clientForm.zip ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, zip: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditClientOpen(false)}>Cancel</Button>
            <Button disabled={savingClient} onClick={async () => {
              setSavingClient(true);
              try {
                await clientsAPI.update(client.id, clientForm);
                setClient({ ...client, ...clientForm });
                setEditClientOpen(false);
                toast.success("Client updated.");
              } catch (err: any) {
                toast.error(err.message || "Failed to update client.");
              } finally {
                setSavingClient(false);
              }
            }}>
              {savingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Proposal Confirmation */}
      <Dialog open={!!proposalToDelete} onOpenChange={(open) => !open && setProposalToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Proposal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{proposalToDelete?.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setProposalToDelete(null)} disabled={deletingProposal}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingProposal}
              onClick={async () => {
                setDeletingProposal(true);
                try {
                  await estimatesAPI.delete(proposalToDelete.id);
                  setClientProposals((prev) => prev.filter((p) => p.id !== proposalToDelete.id));
                  setProposalToDelete(null);
                } finally {
                  setDeletingProposal(false);
                }
              }}
            >
              {deletingProposal ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Client Dialog */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-destructive" />
              Discard Client
            </DialogTitle>
            <DialogDescription>
              {client?.first_name} {client?.last_name} will be discarded but not deleted. You can revive them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="discard-reason">Reason (optional)</Label>
            <Textarea
              id="discard-reason"
              placeholder="e.g. Not interested, budget too low, went with competitor..."
              rows={3}
              className="resize-none"
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDiscardOpen(false); setDiscardReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={discarding}>
              {discarding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Archive className="h-4 w-4 mr-1.5" />}
              Discard Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Orders Sheet */}
      <PurchaseOrdersSheet
        open={purchaseOrdersOpen}
        onOpenChange={setPurchaseOrdersOpen}
        client={client}
        project={clientProjects[0] ?? null}
      />

      {/* Change Orders Sheet */}
      <ChangeOrdersSheet
        open={changeOrdersOpen}
        onOpenChange={setChangeOrdersOpen}
        client={client}
        project={clientProjects[0] ?? null}
      />

      {/* FIO Modal */}
      <FieldInstallationOrderModal
        open={fioOpen}
        onOpenChange={setFioOpen}
        project={clientProjects[0] ? { ...clientProjects[0], client: { id: client.id } } : null}
      />

      {/* Cost Attributions Sheet */}
      <CostAttributionsSheet
        open={costAttributionsOpen}
        onOpenChange={setCostAttributionsOpen}
        client={client}
        project={clientProjects[0] ?? null}
      />


      {/* Image preview modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-none [&>button]:hidden">
          <div className="relative">
            <button
              className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
              onClick={() => setPreviewFile(null)}
            >
              <X className="h-4 w-4" />
            </button>
            {previewFile && (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}