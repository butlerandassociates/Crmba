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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { clientsAPI, photosAPI, projectsAPI, estimatesAPI, appointmentsAPI, leadSourcesAPI, notesAPI, activityLogAPI, pipelineStagesAPI, projectPaymentsAPI } from "../utils/api";
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
import { toast } from "sonner";

export function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [clientProposals, setClientProposals] = useState<any[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
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
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState<any>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const EMPTY_PAYMENT = { label: "", amount: "", due_date: "", notes: "" };
  const [newPayment, setNewPayment] = useState(EMPTY_PAYMENT);
  const [paidForm, setPaidForm] = useState({ payment_method: "", notes: "" });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
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
  const ITEMS_PER_PAGE = 10;
  const FILES_PER_PAGE = 6;
  
  // Load photos, notes and activity log when client loads
  useEffect(() => {
    if (client && id) {
      loadPhotos();
      loadNotes();
      loadActivityLog();
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
              <div>
                <div className="text-sm font-medium">Address</div>
                <div className="text-sm text-muted-foreground">
                  {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "—"}
                </div>
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
              <Label htmlFor="scope-of-work" className="text-sm font-medium">
                Scope of Work
              </Label>
              <Select defaultValue={client.scope_of_work?.[0]}>
                <SelectTrigger id="scope-of-work">
                  <SelectValue placeholder="Select scope of work" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concrete-driveway">Concrete (Driveway, Walkway, Patio)</SelectItem>
                  <SelectItem value="outdoor-kitchen">Outdoor Kitchen</SelectItem>
                  <SelectItem value="pergola-pavilion">Pergola/Pavilion</SelectItem>
                  <SelectItem value="landscaping">Landscaping</SelectItem>
                  <SelectItem value="drainage">Drainage</SelectItem>
                  <SelectItem value="pool-deck">Pool Deck</SelectItem>
                  <SelectItem value="retaining-wall">Retaining Wall</SelectItem>
                  <SelectItem value="fire-pit">Fire Pit/Fireplace</SelectItem>
                  <SelectItem value="deck">Deck/Patio Cover</SelectItem>
                  <SelectItem value="fencing">Fencing</SelectItem>
                  <SelectItem value="lighting">Outdoor Lighting</SelectItem>
                  <SelectItem value="irrigation">Irrigation System</SelectItem>
                </SelectContent>
              </Select>
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

        {/* ── Projects ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              Projects {clientProjects.length > 0 && <Badge variant="secondary">{clientProjects.length}</Badge>}
            </CardTitle>
            <Button size="sm" onClick={() => { setNewProjectName(""); setShowNewProject(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {clientProjects.length === 0 ? (
              <div className="text-center py-10">
                <Hammer className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No projects yet</p>
                <Button className="mt-3" size="sm" onClick={() => { setNewProjectName(""); setShowNewProject(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {clientProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{project.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{project.status?.replace("_", " ")}</p>
                    </div>
                    <Link to={`/projects/${project.id}`}>
                      <Button variant="outline" size="sm">View Project</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Project Info (detailed cards) ── */}
        {clientProjects.length > 0 && clientProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hammer className="h-4 w-4" />
                Project
                <Badge className={getProjectStatusColor(project.status)}>{project.status?.replace("_", " ")}</Badge>
              </CardTitle>
              <Link to={`/projects/${project.id}`}>
                <Button variant="outline" size="sm">View Full Project</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Project Name</p>
                  <p className="font-medium">{project.name || "—"}</p>
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
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  <p className="font-medium">{formatCurrency(project.totalValue ?? 0)}</p>
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
                  <p className="text-xs text-muted-foreground">Gross Profit</p>
                  <p className="font-medium text-green-600">{formatCurrency(project.grossProfit ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className="font-medium">{project.profitMargin?.toFixed(1) ?? "0.0"}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* ── Proposals ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Proposals {clientProposals.length > 0 && <Badge variant="secondary">{clientProposals.length}</Badge>}
            </CardTitle>
            <Link to={`/clients/${client.id}/create-proposal`}>
              <Button size="sm">
                <FilePlus className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
              {clientProposals.length > 0 ? (
                <div className="divide-y">
                  {clientProposals.map((proposal) => (
                    <div key={proposal.id} className="p-4 hover:bg-accent transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <Link
                            to={`/proposals/${proposal.id}`}
                            className="font-semibold text-sm hover:text-primary"
                          >
                            {proposal.title ?? `Estimate #${proposal.estimate_number}`}
                          </Link>
                          <p className="text-xs text-muted-foreground">{proposal.notes}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{proposal.status}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Created {formatDate(proposal.created_at)}
                            </span>
                          </div>
                          {proposal.status === "declined" && (
                            <div className="mt-1.5 text-xs text-red-600">
                              {proposal.declined_at && (
                                <span>Declined {formatDate(proposal.declined_at)}</span>
                              )}
                              {proposal.decline_reason && (
                                <span className="block italic text-muted-foreground mt-0.5">"{proposal.decline_reason}"</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <div className="font-semibold">{formatCurrency(proposal.total)}</div>
                          <div className="flex gap-2 justify-end">
                            <Link to={`/proposals/${proposal.id}`}>
                              <Button variant="outline" size="sm">
                                View Proposal
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setProposalToDelete(proposal)}
                            >
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
                    <Button className="mt-4" size="sm">
                      <FilePlus className="h-4 w-4 mr-2" />
                      Create First Proposal
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

        {/* ── Payments ── */}
        <div className="space-y-4">
          {/* Summary */}
          {(() => {
            const totalAmount = clientPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
            const totalPaid   = clientPayments.filter((p) => p.is_paid).reduce((s, p) => s + (p.amount ?? 0), 0);
            const outstanding = totalAmount - totalPaid;
            return (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Contract Total</p>
                    <p className="text-xl font-bold mt-1">{formatCurrency(totalAmount)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Paid</p>
                    <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalPaid)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Outstanding</p>
                    <p className={`text-xl font-bold mt-1 ${outstanding > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{formatCurrency(outstanding)}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Payments Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Payment Schedule</CardTitle>
              <Button size="sm" onClick={() => { setNewPayment(EMPTY_PAYMENT); setAddPaymentOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {clientPayments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-sm">No payments added yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Add payment milestones from the signed contract.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Milestone</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Due Date</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Paid Date</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Method / Note</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clientPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-accent/50">
                        <td className="p-3 font-medium text-sm">{payment.label}</td>
                        <td className="p-3 text-sm font-semibold">{formatCurrency(payment.amount)}</td>
                        <td className="p-3 text-sm text-muted-foreground">{payment.due_date ? formatDate(payment.due_date) : "—"}</td>
                        <td className="p-3">
                          <Badge className={payment.is_paid ? "bg-green-100 text-green-800 border-green-200" : "bg-orange-100 text-orange-800 border-orange-200"} variant="outline">
                            {payment.is_paid ? "Paid" : "Pending"}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{payment.paid_date ? formatDate(payment.paid_date) : "—"}</td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[180px] truncate">
                          {payment.payment_method && <span className="font-medium text-foreground">{payment.payment_method}</span>}
                          {payment.payment_method && payment.notes && <span className="mx-1">·</span>}
                          {payment.notes}
                        </td>
                        <td className="p-3">
                          {!payment.is_paid ? (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setMarkPaidOpen(payment); setPaidForm({ payment_method: "", notes: payment.notes ?? "" }); }}>
                              Mark Paid
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={async () => {
                              await projectPaymentsAPI.update(payment.id, { is_paid: false, paid_date: null, payment_method: null });
                              setClientPayments((prev) => prev.map((p) => p.id === payment.id ? { ...p, is_paid: false, paid_date: null, payment_method: null } : p));
                            }}>
                              Undo
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Add Payment Dialog */}
          <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Add Payment Milestone</DialogTitle>
                <DialogDescription>Add a progress payment from the signed contract.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input placeholder="e.g. Deposit, Progress Payment, Final" value={newPayment.label} onChange={(e) => setNewPayment((p) => ({ ...p, label: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount ($)</Label>
                  <Input type="number" placeholder="0.00" value={newPayment.amount} onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment((p) => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input placeholder="Optional note" value={newPayment.notes} onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>Cancel</Button>
                <Button disabled={savingPayment || !newPayment.label || !newPayment.amount} onClick={async () => {
                  if (!client) return;
                  setSavingPayment(true);
                  try {
                    const project = clientProjects[0];
                    const created = await projectPaymentsAPI.create({
                      project_id: project?.id ?? "",
                      client_id: client.id,
                      label: newPayment.label,
                      amount: parseFloat(newPayment.amount) || 0,
                      due_date: newPayment.due_date || undefined,
                      notes: newPayment.notes || undefined,
                      sort_order: clientPayments.length,
                    });
                    setClientPayments((prev) => [...prev, created]);
                    setAddPaymentOpen(false);
                    toast.success("Payment added.");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to add payment.");
                  } finally {
                    setSavingPayment(false);
                  }
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
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Input placeholder="e.g. Check #1042, ACH #8829, Cash" value={paidForm.payment_method} onChange={(e) => setPaidForm((p) => ({ ...p, payment_method: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input placeholder="Any additional notes" value={paidForm.notes} onChange={(e) => setPaidForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMarkPaidOpen(null)}>Cancel</Button>
                <Button disabled={savingPayment} onClick={async () => {
                  if (!markPaidOpen) return;
                  setSavingPayment(true);
                  try {
                    const updated = await projectPaymentsAPI.update(markPaidOpen.id, {
                      is_paid: true,
                      paid_date: new Date().toISOString().split("T")[0],
                      payment_method: paidForm.payment_method || null,
                      notes: paidForm.notes || null,
                    });
                    setClientPayments((prev) => prev.map((p) => p.id === markPaidOpen.id ? { ...p, ...updated } : p));
                    setMarkPaidOpen(null);
                    activityLogAPI.create({ client_id: id!, action_type: "payment_received", description: `Payment marked as paid: ${markPaidOpen.label}${markPaidOpen.amount ? ` — $${Number(markPaidOpen.amount).toLocaleString()}` : ""}` }).then(loadActivityLog).catch(() => {});
                    toast.success("Payment marked as paid.");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to update payment.");
                  } finally {
                    setSavingPayment(false);
                  }
                }}>
                  {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Paid"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Appointments ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointments {clientAppointments.length > 0 && <Badge variant="secondary">{clientAppointments.length}</Badge>}
            </CardTitle>
            <Button size="sm" onClick={() => setAppointmentDialogOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </CardHeader>
          <CardContent className="p-0">
              {clientAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No appointments scheduled yet</p>
                  <Button className="mt-4" size="sm" onClick={() => setAppointmentDialogOpen(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {clientAppointments.map((appt) => {
                    const APPOINTMENT_TYPES: Record<string, string> = {
                      initial: "Initial Appointment",
                      followup: "Followup Appointment",
                      presentation: "Presentation Appointment",
                      prewalk: "PreWalk Appointment",
                      finalwalk: "Final Walk Appointment",
                    };
                    const typeLabel = APPOINTMENT_TYPES[appt.appointment_type] ?? appt.title ?? "Appointment";
                    const timeRange = appt.end_time
                      ? `${appt.appointment_time?.slice(0, 5)} – ${appt.end_time?.slice(0, 5)}`
                      : appt.appointment_time?.slice(0, 5);

                    return (
                      <div key={appt.id} className="p-4 hover:bg-accent/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{typeLabel}</span>
                              {appt.is_met ? (
                                <Badge className="bg-green-500 text-white text-xs">Met</Badge>
                              ) : (
                                <Badge className="bg-blue-500 text-white text-xs">Upcoming</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(appt.appointment_date)} · {timeRange}
                            </div>
                            {appt.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>
                            )}
                            {appt.google_meet_link && (
                              <a
                                href={appt.google_meet_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline flex items-center gap-1 mt-1"
                              >
                                <Clock className="h-3 w-3" />
                                Join Google Meet
                              </a>
                            )}
                          </div>
                          {!appt.is_met && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={async () => {
                                try {
                                  await appointmentsAPI.markAsMet(appt.id);
                                  setClientAppointments((prev) =>
                                    prev.map((a) => a.id === appt.id ? { ...a, is_met: true } : a)
                                  );
                                  // Only update clients.appointment_met if this is the latest appointment
                                  // (matches the date stored on the client record)
                                  const apptDate = appt.appointment_date?.split("T")[0];
                                  const clientApptDate = client.appointment_date?.split("T")[0];
                                  if (apptDate === clientApptDate) {
                                    await clientsAPI.update(client.id, { appointment_met: true });
                                    setClient((prev: any) => ({ ...prev, appointment_met: true }));
                                  }
                                  toast.success("Appointment marked as met!");
                                } catch (err: any) {
                                  toast.error(err.message || "Failed to update");
                                }
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                              Mark as Met
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        {/* ── Client Files ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-notes" className="text-sm font-medium">Add New Note</Label>
                  <Textarea
                    id="client-notes"
                    placeholder="Add notes for your internal team to review..."
                    rows={4}
                    className="resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">These notes are only visible to your team members</p>
                </div>
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes || !notes.trim()}>
                  {savingNotes ? "Saving..." : "Save Note"}
                </Button>
                {noteEntries.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    {noteEntries
                      .slice((notesPage - 1) * ITEMS_PER_PAGE, notesPage * ITEMS_PER_PAGE)
                      .map((note) => (
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
                    {noteEntries.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          Showing {Math.min((notesPage - 1) * ITEMS_PER_PAGE + 1, noteEntries.length)} - {Math.min(notesPage * ITEMS_PER_PAGE, noteEntries.length)} of {noteEntries.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setNotesPage(notesPage - 1)} disabled={notesPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">Page {notesPage} of {Math.ceil(noteEntries.length / ITEMS_PER_PAGE)}</span>
                          <Button variant="outline" size="sm" onClick={() => setNotesPage(notesPage + 1)} disabled={notesPage >= Math.ceil(noteEntries.length / ITEMS_PER_PAGE)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card> */}

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
                    <div className="grid grid-cols-2 gap-2">
                      {photos
                        .slice((filesPage - 1) * FILES_PER_PAGE, filesPage * FILES_PER_PAGE)
                        .map((photo: any) => (
                          <div key={photo.id} className="relative group rounded-lg overflow-hidden border bg-muted">
                            {photo.mime_type?.startsWith("image/") ? (
                              <img
                                src={photo.file_url}
                                alt={photo.file_name}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <div className="w-full h-32 flex flex-col items-center justify-center gap-1 px-2">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate max-w-[90%] text-center">{photo.file_name}</span>
                              </div>
                            )}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {photo.mime_type?.startsWith("image/") && (
                                <button
                                  className="bg-black/60 hover:bg-black/80 text-white rounded-md p-1"
                                  onClick={() => setPreviewFile({ url: photo.file_url, name: photo.file_name })}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                className="bg-red-500/80 hover:bg-red-600 text-white rounded-md p-1"
                                onClick={() => handleDeletePhoto(photo.id, photo.file_url)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-black/40 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-white text-xs truncate">{photo.file_name}</p>
                            </div>
                          </div>
                        ))}
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

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a project for {client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "this client"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Project Name</Label>
            <Input
              placeholder="e.g. Backyard Patio & Concrete"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)} disabled={creatingProject}>Cancel</Button>
            <Button
              disabled={!newProjectName.trim() || creatingProject}
              onClick={async () => {
                setCreatingProject(true);
                try {
                  await projectsAPI.create({
                    client_id: client.id,
                    name: newProjectName.trim(),
                    status: "active",
                  });
                  const all = await projectsAPI.getAll();
                  setClientProjects(all.filter((p: any) => p.client_id === id));
                  setShowNewProject(false);
                  setNewProjectName("");
                } catch (err: any) {
                  toast.error(err.message || "Failed to create project");
                } finally {
                  setCreatingProject(false);
                }
              }}
            >
              {creatingProject ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Image preview modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-none">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}