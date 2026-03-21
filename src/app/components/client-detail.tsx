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
} from "lucide-react";
import { mockProjects, mockProposals } from "../data/mock-data";
import { clientsAPI, photosAPI } from "../utils/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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

  const clientProjects = mockProjects.filter((p) => p.clientId === id);
  const clientProposals = mockProposals.filter((p) => p.clientId === id);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [noteEntries, setNoteEntries] = useState<Array<{
    id: string;
    text: string;
    timestamp: string;
    userName: string;
  }>>([]);
  const [photoEntries, setPhotoEntries] = useState<Array<{
    id: string;
    url: string;
    name: string;
    timestamp: string;
    userName: string;
  }>>([]);
  const [notesPage, setNotesPage] = useState(1);
  const [photosPage, setPhotosPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Load photos and notes when client loads
  useEffect(() => {
    if (client && id) {
      setNotes("");
      setNoteEntries(client.noteEntries || []);
      loadPhotos();
    }
  }, [client, id]);
  
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
    if (!client || !notes.trim()) return;
    
    try {
      setSavingNotes(true);
      
      // Create new note entry with timestamp and user
      const newNoteEntry = {
        id: Date.now().toString(),
        text: notes.trim(),
        timestamp: new Date().toISOString(),
        userName: "Jonathan Butler",
      };
      
      const updatedNoteEntries = [...noteEntries, newNoteEntry];
      
      await clientsAPI.update(client.id, {
        ...client,
        noteEntries: updatedNoteEntries,
      });
      
      setClient({ ...client, noteEntries: updatedNoteEntries });
      setNoteEntries(updatedNoteEntries);
      setNotes(""); // Clear input after saving
      
      toast.success("Notes saved successfully");
    } catch (error: any) {
      console.error("Failed to save notes:", error);
      toast.error("Failed to save notes");
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
  
  const handleDeletePhoto = async (fileName: string) => {
    if (!id) return;
    
    try {
      await photosAPI.delete(id, fileName);
      toast.success("Photo deleted");
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
      
      const updatedClient = {
        ...client,
        status: newStatus,
      };
      
      await clientsAPI.update(client.id, updatedClient);
      
      // Update local state
      setClient(updatedClient);
      
      toast.success(`Client status updated to ${newStatus}`);
    } catch (err: any) {
      console.error("Failed to update client status:", err);
      toast.error(err.message || "Failed to update status");
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
              <h1 className="text-2xl font-bold">{client.name}</h1>
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
            <DropdownMenuItem>
              <TrendingUp className="h-4 w-4 mr-2" />
              Update Closing Probability
            </DropdownMenuItem>
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
              onClick={() => handleStatusChange('sold')}
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">{client.email}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Phone</div>
                <div className="text-sm text-muted-foreground">{client.phone}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Address</div>
                <div className="text-sm text-muted-foreground">{client.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Client Since</div>
                <div className="text-sm text-muted-foreground">{formatDate(client.createdAt)}</div>
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
            {client.docusignStatus === 'completed' ? (
              <div className="space-y-2">
                <Badge className="bg-green-600 flex items-center gap-1 w-fit">
                  <CheckCircle2 className="h-3 w-3" />
                  Contract Completed
                </Badge>
                {client.docusignSentDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Sent</div>
                    <div className="text-sm font-medium">{formatDate(client.docusignSentDate)}</div>
                  </div>
                )}
                {client.docusignCompletedDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Signed</div>
                    <div className="text-sm font-medium">{formatDate(client.docusignCompletedDate)}</div>
                  </div>
                )}
                {client.docusignEnvelopeId && (
                  <div>
                    <div className="text-xs text-muted-foreground">Envelope ID</div>
                    <div className="text-xs font-mono bg-muted p-1 rounded mt-1">{client.docusignEnvelopeId}</div>
                  </div>
                )}
              </div>
            ) : client.docusignStatus === 'sent_to_client' ? (
              <div className="space-y-2">
                <Badge className="bg-orange-500 flex items-center gap-1 w-fit">
                  <Clock className="h-3 w-3" />
                  Sent to Client
                </Badge>
                {client.docusignSentDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Sent on</div>
                    <div className="text-sm font-medium">{formatDate(client.docusignSentDate)}</div>
                  </div>
                )}
                {client.docusignEnvelopeId && (
                  <div>
                    <div className="text-xs text-muted-foreground">Envelope ID</div>
                    <div className="text-xs font-mono bg-muted p-1 rounded mt-1">{client.docusignEnvelopeId}</div>
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
                {formatCurrency(client.totalRevenue)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Projects</div>
              <div className="text-lg font-semibold mt-1">{client.projectsCount}</div>
            </div>
            {client.projectedValue && (
              <div>
                <div className="text-sm font-medium">Projected Value</div>
                <div className="text-lg font-semibold mt-1">
                  {formatCurrency(client.projectedValue)}
                </div>
              </div>
            )}
            {client.closingProbability && (
              <div>
                <div className="text-sm font-medium">Closing Probability</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${client.closingProbability}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{client.closingProbability}%</span>
                </div>
              </div>
            )}
            {client.expectedCloseDate && (
              <div>
                <div className="text-sm font-medium">Expected Close Date</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.expectedCloseDate)}
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
            {client.leadSource && (
              <div>
                <div className="text-sm font-medium">Lead Source</div>
                <Badge variant="outline" className="mt-1">{client.leadSource}</Badge>
              </div>
            )}
            {client.assignedTo && (
              <div>
                <div className="text-sm font-medium">Assigned To</div>
                <div className="text-sm text-muted-foreground mt-1">Sales Rep</div>
              </div>
            )}
            {client.appointmentScheduled !== undefined && (
              <div>
                <div className="text-sm font-medium">Appointment Status</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {client.appointmentMet
                    ? "Met"
                    : client.appointmentScheduled
                    ? `Scheduled for ${client.appointmentDate ? formatDate(client.appointmentDate) : "TBD"}`
                    : "Not Scheduled"}
                </div>
              </div>
            )}
            {client.lastContactDate && (
              <div>
                <div className="text-sm font-medium">Last Contact</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.lastContactDate)}
                </div>
              </div>
            )}
            {client.nextFollowUpDate && (
              <div>
                <div className="text-sm font-medium">Next Follow-up</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {formatDate(client.nextFollowUpDate)}
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
              <Select defaultValue={client.scopeOfWork?.[0]}>
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
                defaultChecked={client.call811Required}
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

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects ({clientProjects.length})</TabsTrigger>
          <TabsTrigger value="proposals">Proposals ({clientProposals.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {clientProjects.length > 0 ? (
                <div className="divide-y">
                  {clientProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="block p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{project.name}</h3>
                            <Badge className={getProjectStatusColor(project.status)}>
                              {project.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>PM: {project.projectManagerName}</span>
                            <span>Foreman: {project.foremanName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(project.startDate)}
                            {project.endDate && ` - ${formatDate(project.endDate)}`}
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <div className="font-semibold text-sm">
                            {formatCurrency(project.totalValue)}
                          </div>
                          <div className="text-xs text-green-600">
                            {formatCurrency(project.grossProfit)} profit
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.profitMargin.toFixed(1)}% margin
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No projects yet</p>
                  <Button className="mt-4" size="sm">
                    <FilePlus className="h-4 w-4 mr-2" />
                    Create First Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="mt-4">
          <Card>
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
                            {proposal.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">{proposal.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{proposal.status}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Created {formatDate(proposal.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="font-semibold">{formatCurrency(proposal.total)}</div>
                          <Link to={`/proposals/${proposal.id}`}>
                            <Button variant="outline" size="sm">
                              View Proposal
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No proposals yet</p>
                  <Button className="mt-4" size="sm">
                    <FilePlus className="h-4 w-4 mr-2" />
                    Create First Proposal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Saved Notes History */}
                {noteEntries.length > 0 && (
                  <>
                    <div className="space-y-3">
                      {noteEntries
                        .slice()
                        .reverse()
                        .slice((notesPage - 1) * ITEMS_PER_PAGE, notesPage * ITEMS_PER_PAGE)
                        .map((entry) => (
                          <div key={entry.id} className="bg-muted/50 p-3 rounded-lg space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{entry.userName}</span>
                              <span>•</span>
                              <span>
                                {new Date(entry.timestamp).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
                          </div>
                        ))}
                    </div>
                    
                    {/* Pagination Controls */}
                    {noteEntries.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          Showing {Math.min((notesPage - 1) * ITEMS_PER_PAGE + 1, noteEntries.length)} - {Math.min(notesPage * ITEMS_PER_PAGE, noteEntries.length)} of {noteEntries.length} notes
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNotesPage(notesPage - 1)}
                            disabled={notesPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Page {notesPage} of {Math.ceil(noteEntries.length / ITEMS_PER_PAGE)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNotesPage(notesPage + 1)}
                            disabled={notesPage >= Math.ceil(noteEntries.length / ITEMS_PER_PAGE)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {/* Add New Note */}
                <div className="space-y-2">
                  <Label htmlFor="client-notes" className="text-sm font-medium">
                    Add New Note
                  </Label>
                  <Textarea
                    id="client-notes"
                    placeholder="Add notes for your internal team to review..."
                    rows={6}
                    className="resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    These notes are only visible to your team members
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={handleSaveNotes} 
                  disabled={savingNotes || !notes.trim()}
                >
                  {savingNotes ? "Saving..." : "Save Note"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Client Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photo-upload" className="text-sm font-medium">
                    Upload Photos
                  </Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload client-provided photos
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, GIF up to 10MB each
                      </p>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Photos uploaded by the client for reference
                  </p>
                </div>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((photo: any, index: number) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo.url}
                          alt={`Client photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeletePhoto(photo.name)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No photos uploaded yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EmailTemplatesDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        client={client}
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
    </div>
  );
}