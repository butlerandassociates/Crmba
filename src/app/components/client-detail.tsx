import { useParams, Link, useSearchParams, useNavigate } from "react-router";
import { formatCurrency } from "@/app/utils/format";
import { supabase } from "@/lib/supabase";
import { projectId, publicAnonKey } from "utils/supabase/info";
import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { PieChart, Pie, Cell, RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } from "recharts";
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
  AlertCircle,
  Video,
  ExternalLink,
  CalendarCheck,
  CreditCard,
  ArrowRightLeft,
  Minus,
  ShoppingCart,
  Receipt,
  HardHat,
  FolderOpen,
  FileDown,
  MailX,
  PhoneMissed,
  ClipboardList,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { clientsAPI, photosAPI, projectsAPI, estimatesAPI, appointmentsAPI, leadSourcesAPI, notesAPI, activityLogAPI, pipelineStagesAPI, projectPaymentsAPI, receiptsAPI, productsAPI, notificationsAPI, fioAPI } from "../utils/api";
import { usePermissions } from "../hooks/usePermissions";
import { MoveToSoldModal } from "./move-to-sold-modal";
import { MoveToActiveModal } from "./move-to-active-modal";
import { MoveToCompletedModal } from "./move-to-completed-modal";
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
import { CostAttributionsSheet } from "./cost-attributions-sheet";
import { FieldInstallationOrderModal } from "./field-installation-order-modal";
import { EditProjectDialog } from "./edit-project-dialog";
import { Progress } from "./ui/progress";
import { toast } from "sonner";
import { PageLoader, SkeletonList, SkeletonInfoCard } from "./ui/page-loader";
import { Skeleton } from "./ui/skeleton";

export function ClientDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [clientProposals, setClientProposals] = useState<any[]>([]);
  const [proposalToDelete, setProposalToDelete] = useState<any>(null);
  const [deletingProposal, setDeletingProposal] = useState(false);
  const [soldModalOpen, setSoldModalOpen] = useState(false);
  const [activeModalOpen, setActiveModalOpen] = useState(false);
  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const [sellingGateOpen, setSellingGateOpen] = useState(false);
  const [backwardConfirmOpen, setBackwardConfirmOpen] = useState(false);
  const [backwardTargetStatus, setBackwardTargetStatus] = useState("");
  const [backwardReason, setBackwardReason] = useState("");
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState<any>({});
  const [savingClient, setSavingClient] = useState(false);
  const [editClientTouched, setEditClientTouched] = useState(false);
  const [clientAppointments, setClientAppointments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [scopeOptions, setScopeOptions] = useState<any[]>([]);

  // 811 completion dialog
  const [call811Open, setCall811Open] = useState(false);
  const [call811Date, setCall811Date] = useState("");
  const [call811Time, setCall811Time] = useState("");
  const [saving811, setSaving811] = useState(false);

  // Intake form
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeViewOpen, setIntakeViewOpen] = useState(false);
  const [intakeUndoOpen, setIntakeUndoOpen] = useState(false);
  const [intakeClearOpen, setIntakeClearOpen] = useState(false);
  const [intakeUnsavedOpen, setIntakeUnsavedOpen] = useState(false);
  const [intakeData, setIntakeData] = useState<Record<string, any>>({});
  const [savingIntake, setSavingIntake] = useState(false);

  const INTAKE_EMPTY: Record<string, any> = {
    email: "", name: "", phone: "", address: "",
    project_scope: "", project_goals: [], timeline: "", budget: "",
    referral_source: "", existing_features: "", decision_factors: [],
  };

  const intakeHasChanges = () =>
    JSON.stringify(intakeData) !== JSON.stringify(client?.intake_form_data ?? INTAKE_EMPTY);

  const toggleIntakeCheck = (field: "project_goals" | "decision_factors", value: string) => {
    setIntakeData((prev) => {
      const arr: string[] = prev[field] ?? [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };
  
  // Fetch client from API
  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await clientsAPI.getById(id);
        setClient(data);
        // Prime leadSources with the client's current lead source immediately so the
        // Select trigger shows the correct name before the full list loads (Radix Select
        // does not re-sync the displayed label when options arrive asynchronously after
        // the value is already set).
        if (data?.lead_source) {
          setLeadSources((prev) =>
            prev.some((ls) => ls.id === data.lead_source.id)
              ? prev
              : [data.lead_source, ...prev]
          );
        }
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

  const loadScopeOptions = async () => {
    const { data } = await supabase.from("scope_of_work").select("id, name").eq("is_active", true).order("sort_order");
    setScopeOptions(data ?? []);
  };

  useEffect(() => {
    productsAPI.getCategories()
      .then((cats) => setCategories(cats || []))
      .catch(console.error);
    loadScopeOptions().catch(console.error);
  }, []);

  useRealtimeRefetch(
    () => {
      Promise.all([productsAPI.getCategories()]).then(([cats]) => { setCategories(cats || []); }).catch(console.error);
      loadScopeOptions().catch(console.error);
    },
    ["product_categories", "scope_of_work"],
    "product-manager"
  );


  useEffect(() => {
    if (searchParams.get("payments") === "open") setPaymentTrackingOpen(true);
  }, [searchParams]);

  // When DocuSign sender view redirects back after clicking Send, refresh status
  useEffect(() => {
    if (searchParams.get("docusign") === "sent" && client?.docusign_envelope_id) {
      refreshDocusignStatus();
    }
  }, [searchParams, client?.docusign_envelope_id]);

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
  const [paidForm, setPaidForm] = useState({ payment_method: "", notes: "", paid_date: new Date().toISOString().split("T")[0] });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [refreshingDocusign, setRefreshingDocusign] = useState(false);
  const [openingContractorSigning, setOpeningContractorSigning] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentHistoryOpen, setAppointmentHistoryOpen] = useState(false);
  const [purchaseOrdersOpen, setPurchaseOrdersOpen] = useState(false);
  const [fioOpen, setFioOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [costAttributionsOpen, setCostAttributionsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesErr, setNotesErr] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [noteEntries, setNoteEntries] = useState<any[]>([]);
  const [notesPage, setNotesPage] = useState(1);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [savingNoteEdit, setSavingNoteEdit] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [filesPage, setFilesPage] = useState(1);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [fileCategory, setFileCategory] = useState("other");
  const [gpHealthOpen, setGpHealthOpen] = useState<Record<string, boolean>>({});
  const [gpHealthData, setGpHealthData] = useState<Record<string, any>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [discardNote, setDiscardNote] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [sellingModalOpen, setSellingModalOpen] = useState(false);
  const [sellingProbability, setSellingProbability] = useState("");
  const [sellingCloseDate, setSellingCloseDate] = useState("");
  const [savingSelling, setSavingSelling] = useState(false);
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

  // DB triggers (migrations 049+050) keep total_costs/gross_profit/profit_margin current.
  // No need to auto-fetch live GP on load — stored values are already correct.

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

  useRealtimeRefetch(loadNotes, ["client_notes"], `notes-${id}`);

  const refreshDocusignStatus = async () => {
    if (!client?.docusign_envelope_id) return;
    setRefreshingDocusign(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/status/${client.docusign_envelope_id}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (!response.ok) return;
      const data = await response.json();
      const dsStatus = data.status; // DocuSign envelope status: completed, sent, declined, voided

      let clientStatus = client.docusign_status;
      let completedDate = client.docusign_completed_date;

      if (dsStatus === "completed") {
        clientStatus = "completed";
        completedDate = data.completedDateTime || new Date().toISOString();
      } else if (dsStatus === "sent") {
        clientStatus = "sent_to_client";
      } else if (dsStatus === "declined") {
        clientStatus = "declined";
      } else if (dsStatus === "voided") {
        clientStatus = "voided";
      }

      if (clientStatus !== client.docusign_status) {
        await supabase.from("clients").update({
          docusign_status: clientStatus,
          docusign_completed_date: completedDate ?? null,
        }).eq("id", client.id);
        setClient((prev: any) => ({ ...prev, docusign_status: clientStatus, docusign_completed_date: completedDate }));
        if (clientStatus === "completed" && client.docusign_status !== "completed") {
          const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
          notificationsAPI.create({
            type: "docusign_completed",
            title: "DocuSign Completed",
            message: `${clientName} has signed the contract.`,
            link: `/clients/${client.id}`,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Failed to refresh DocuSign status:", e);
    } finally {
      setRefreshingDocusign(false);
    }
  };

  const openSenderView = async () => {
    if (!client?.docusign_envelope_id) return;
    setOpeningContractorSigning(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/get-sender-view`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            envelopeId: client.docusign_envelope_id,
            returnUrl: `${window.location.origin}/clients/${client.id}?docusign=sent`,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || err.error || "Failed to open document");
      }
      const data = await response.json();
      window.open(data.senderViewUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to open document");
    } finally {
      setOpeningContractorSigning(false);
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
    if (!notes.trim()) { setNotesErr("Note cannot be empty."); return; }
    if (!id) return;
    setNotesErr("");
    try {
      setSavingNotes(true);
      const noteContent = notes.trim();
      await notesAPI.create({ client_id: id, content: noteContent });
      setNotes("");
      await loadNotes();
      activityLogAPI.create({ client_id: id, action_type: "note_added", description: `Note added: "${noteContent.slice(0, 80)}${noteContent.length > 80 ? "…" : ""}"` }).then(loadActivityLog).catch(() => {});
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
        await photosAPI.upload(id, file, fileCategory);
        activityLogAPI.create({ client_id: id, action_type: "file_uploaded", description: `File uploaded: "${file.name}"` }).then(loadActivityLog).catch(() => {});
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
        await photosAPI.upload(id, file, fileCategory);
        activityLogAPI.create({ client_id: id, action_type: "file_uploaded", description: `File uploaded: "${file.name}"` }).then(loadActivityLog).catch(() => {});
        toast.success(`Uploaded ${file.name}`);
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploadingPhoto(false);
    loadPhotos();
  };

  const handleDeletePhoto = async (fileId: string, fileUrl: string, fileName: string) => {
    try {
      await photosAPI.delete(fileId, fileUrl);
      activityLogAPI.create({ client_id: id!, action_type: "file_deleted", description: `File deleted: "${fileName}"` }).then(loadActivityLog).catch(() => {});
      toast.success("File deleted");
      loadPhotos();
    } catch (error: any) {
      console.error("Failed to delete photo:", error);
      toast.error("Failed to delete photo");
    }
  };
  
  const stageOrder = ['prospect', 'scheduled', 'selling', 'sold', 'active', 'completed'];
  const isBackwardMove = (target: string) => {
    const currentIdx = stageOrder.indexOf(client?.status?.toLowerCase() ?? '');
    const targetIdx = stageOrder.indexOf(target.toLowerCase());
    return currentIdx > 0 && targetIdx >= 0 && targetIdx < currentIdx;
  };
  const handleStageClick = (target: string, forwardAction: () => void) => {
    if (isBackwardMove(target)) {
      // Only Selling → Prospect is allowed backward. All others are blocked.
      const current = client?.status?.toLowerCase() ?? "";
      if (current === "selling" && target.toLowerCase() === "prospect") {
        setBackwardTargetStatus(target);
        setBackwardReason("");
        setBackwardConfirmOpen(true);
      } else {
        toast.error("This stage cannot be reversed. Once a contract is signed the pipeline can only move forward.");
      }
    } else {
      forwardAction();
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
      // Keep project status in sync with client status
      const activeProject = clientProjects[0];
      if (activeProject?.id) {
        await projectsAPI.update(activeProject.id, { status: newStatus }).catch(() => {});
      }
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
      const { data: { user } } = await supabase.auth.getUser();
      await clientsAPI.update(client.id, {
        is_discarded: true,
        discarded_at: new Date().toISOString(),
        discarded_reason: `${discardReason}${discardNote.trim() ? ` — ${discardNote.trim()}` : ""}`,
        discarded_by: user?.id ?? null,
      });
      const discardedOnLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      activityLogAPI.create({ client_id: client.id, action_type: "status_changed", description: `Client discarded on ${discardedOnLabel}: ${discardReason}${discardNote.trim() ? ` — ${discardNote.trim()}` : ""}` }).catch(() => {});
      toast.success("Client discarded. You can revive them anytime.");
      setDiscardOpen(false);
      setDiscardReason("");
      setDiscardNote("");
    } catch (err: any) {
      toast.error(err.message || "Failed to discard client");
    } finally {
      setDiscarding(false);
    }
  };

  const handleConfirm811 = async () => {
    if (!client || !call811Date || !call811Time) return;
    setSaving811(true);
    try {
      const completedAt = new Date(`${call811Date}T${call811Time}`).toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("clients").update({
        call_811_completed_at: completedAt,
        call_811_completed_by: user?.id ?? null,
      }).eq("id", client.id);

      // Notify all admin + project_manager users (Jonathan + DeWayne)
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("role", ["admin", "project_manager"])
        .eq("is_active", true);

      const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
      const displayDate = new Date(`${call811Date}T${call811Time}`).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      });

      await supabase.from("notifications").insert({
        type: "call_811",
        title: "811 Call Confirmed",
        message: `811 was called for ${clientName} on ${displayDate}. Utility location services satisfied.`,
        link: `/clients/${client.id}`,
        created_by: user?.id ?? null,
      });

      activityLogAPI.create({
        client_id: client.id,
        action_type: "note_added",
        description: `811 call confirmed — satisfied on ${displayDate}`,
      }).catch(() => {});

      setClient({ ...client, call_811_completed_at: completedAt });
      toast.success("811 confirmed — team has been notified.");
      setCall811Open(false);
      setCall811Date("");
      setCall811Time("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save 811 confirmation.");
    } finally {
      setSaving811(false);
    }
  };

  const loadGpHealth = async (projectId: string) => {
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

      // Actual spend from cost attribution receipts
      const materialActual = receipts.filter((r: any) => r.category === "material")
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const laborFromReceipts = receipts.filter((r: any) => r.category === "labor")
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);

      // FIO assigned labor (crew payout scheduled in FIO)
      const fio = await fioAPI.getByProject(projectId).catch(() => null);
      const fioAssigned = (fio?.items ?? []).reduce((s: number, item: any) =>
        s + (parseFloat(item.labor_cost_per_unit) || 0) * (parseFloat(item.quantity) || 0), 0);

      // Actual labor paid via FIO crew payments
      const crewPayments = fio?.id
        ? await fioAPI.getCrewPayments(fio.id).catch(() => [] as any[])
        : [];
      const laborFromCrewPayments = crewPayments.reduce((s: number, cp: any) =>
        s + (parseFloat(cp.amount_paid) || 0), 0);

      // Use whichever is larger: committed FIO labor vs actual paid
      // This matches the DB trigger logic in migration 050
      const laborActual = laborFromReceipts + Math.max(fioAssigned, laborFromCrewPayments);

      setGpHealthData((prev) => ({
        ...prev,
        [projectId]: {
          materialBudget: effectiveMaterialBudget,
          laborBudget: effectiveLaborBudget,
          materialActual,
          laborActual,
          fioAssigned,
          receipts,
          isFallbackBudget: lineItemCostTotal === 0 && estimateTotalCost > 0,
        },
      }));
    } catch {
      toast.error("Failed to load financial data — please refresh the page.");
    }
  };

  const toggleGPHealth = (projectId: string) => {
    const isOpen = gpHealthOpen[projectId];
    setGpHealthOpen((prev) => ({ ...prev, [projectId]: !isOpen }));
    if (!isOpen) loadGpHealth(projectId);
  };

  const handleMoveToSelling = async () => {
    if (!sellingProbability || !sellingCloseDate) return;
    setSavingSelling(true);
    try {
      const matchingStage = pipelineStages.find((s) => s.name.toLowerCase() === "selling");
      await clientsAPI.update(client.id, {
        status: "selling",
        pipeline_stage_id: matchingStage?.id ?? client.pipeline_stage_id,
        closing_probability: parseFloat(sellingProbability),
        expected_close_date: sellingCloseDate,
      });
      setClient({ ...client, status: "selling", closing_probability: parseFloat(sellingProbability), expected_close_date: sellingCloseDate });
      const alreadySelling = client.status === "selling";
      activityLogAPI.create({ client_id: client.id, action_type: alreadySelling ? "forecast_updated" : "status_changed", description: alreadySelling ? `Forecast updated — ${sellingProbability}% probability, est. close ${formatDate(sellingCloseDate)}` : `Moved to Selling — ${sellingProbability}% probability, est. close ${formatDate(sellingCloseDate)}` }).catch(() => {});
      toast.success("Moved to Selling");
      setSellingModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setSavingSelling(false);
    }
  };

  const handleLeadSourceChange = async (leadSourceId: string) => {
    if (!client) return;
    try {
      await clientsAPI.update(client.id, { lead_source_id: leadSourceId });
      const selected = leadSources.find((ls) => ls.id === leadSourceId) ?? { id: leadSourceId, name: "" };
      setClient({ ...client, lead_source: selected, lead_source_id: leadSourceId });
      activityLogAPI.create({ client_id: client.id, action_type: "lead_source_changed", description: `Lead source changed to "${selected?.name ?? "unknown"}"` }).then(loadActivityLog).catch(() => {});
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

  const handleMarkIndividualAsMet = async (apptId: string) => {
    try {
      await appointmentsAPI.markAsMet(apptId);
      setClientAppointments((prev) =>
        prev.map((a) => a.id === apptId ? { ...a, is_met: true, met_at: new Date().toISOString() } : a)
      );
      activityLogAPI.create({ client_id: client!.id, action_type: "appointment_met", description: "Appointment marked as met" }).then(loadActivityLog).catch(() => {});
      toast.success("Appointment marked as met!");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark appointment as met");
    }
  };

  const handleAppointmentScheduled = async () => {
    if (!id) return;
    try {
      const [data, appts] = await Promise.all([
        clientsAPI.getById(id),
        appointmentsAPI.getByClient(id),
      ]);
      setClient(data);
      setClientAppointments(appts);
    } catch (err: any) {
      console.error("Failed to reload client:", err);
    }
  };
  
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {/* Header: back button + name/badge + actions button — matches real layout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        {/* 3 tall info cards: Contact Info / Lead Info / Project Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonInfoCard rows={5} />
          <SkeletonInfoCard rows={4} />
          <SkeletonInfoCard rows={5} />
        </div>
        <PageLoader title="Loading client profile…" description="Fetching contact info, proposals, appointments & project history" className="min-h-[6vh]" />
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
      case "scheduled":
        return "bg-indigo-500";
      case "selling":
        return "bg-yellow-500";
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


  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const toggleScope = async (value: string) => {
    const removing = selectedScopes.includes(value);
    const next = removing
      ? selectedScopes.filter((s) => s !== value)
      : [...selectedScopes, value];

    setSelectedScopes(next);

    try {
      await clientsAPI.update(id!, { scope_of_work: next });
      const scopeLabel = scopeOptions.find((o) => o.id === value)?.name ?? value;
      activityLogAPI.create({ client_id: id!, action_type: removing ? "scope_removed" : "scope_added", description: `Scope ${removing ? "removed" : "added"}: "${scopeLabel}"` }).then(loadActivityLog).catch(() => {});
    } catch {
      toast.error("Failed to save scope of work");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/clients?stage=${client?.status ?? ""}`}>
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
            {can("can_schedule_appointments") && (
              <DropdownMenuItem onClick={() => setAppointmentDialogOpen(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Appointment
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setEmailDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </DropdownMenuItem>
            {can("can_send_docusign") && (
              <DropdownMenuItem onClick={() => setDocusignDialogOpen(true)}>
                <FileSignature className="h-4 w-4 mr-2" />
                Send DocuSign
              </DropdownMenuItem>
            )}
            {["prospect", "selling"].includes(client.status) && (
              <DropdownMenuItem
                onClick={() => {
                  setSellingProbability(client.closing_probability?.toString() ?? "");
                  setSellingCloseDate(client.expected_close_date ?? "");
                  setSellingModalOpen(true);
                }}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Update Forecast
              </DropdownMenuItem>
            )}
            {can("can_create_proposals") && (
              <Link to={`/clients/${client.id}/create-proposal`}>
                <DropdownMenuItem>
                  <FilePlus className="h-4 w-4 mr-2" />
                  Create Proposal
                </DropdownMenuItem>
              </Link>
            )}
            {client.appointment_scheduled && !client.appointment_met && (
              <DropdownMenuItem onClick={handleMarkAsMet} disabled={updating}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                Mark Appointment as Met
              </DropdownMenuItem>
            )}
            {can("can_move_pipeline_stage") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Move to Stage</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleStageClick('prospect', () => handleStatusChange('prospect'))}>
                  <MoveRight className="h-4 w-4 mr-2" />Prospect
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStageClick('selling', () => {
                  if (clientAppointments.length === 0) { setSellingGateOpen(true); return; }
                  setSellingProbability(""); setSellingCloseDate(""); setSellingModalOpen(true);
                })}>
                  <MoveRight className="h-4 w-4 mr-2" />Selling
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStageClick('sold', () => setSoldModalOpen(true))}>
                  <MoveRight className="h-4 w-4 mr-2" />Sold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStageClick('active', () => setActiveModalOpen(true))}>
                  <MoveRight className="h-4 w-4 mr-2" />Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCompletedModalOpen(true)}>
                  <MoveRight className="h-4 w-4 mr-2" />Completed
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {can("can_discard_clients") && (
              <DropdownMenuItem
                onClick={() => setDiscardOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Archive className="h-4 w-4 mr-2" />
                Discard Client
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="min-h-[300px] flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Contact Information</CardTitle>
            {can("can_edit_clients") && (
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
            )}
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
                  <button
                    type="button"
                    onClick={() => setMapOpen(true)}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary"
                  >
                    <MapPin className="h-3 w-3" />
                    View Map
                  </button>
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

        {/* Lead Information — moved to top row */}
        <Card className="min-h-[300px] flex flex-col">
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
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">Appointment</div>
                {clientAppointments.length > 0 && (
                  <button
                    onClick={() => setAppointmentDialogOpen(true)}
                    className="px-2 py-0.5 bg-black text-white text-[11px] font-medium rounded hover:bg-black/80 transition-colors"
                  >
                    + Schedule
                  </button>
                )}
              </div>
              {clientAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-5 gap-2 text-center rounded-lg border border-dashed">
                  <Calendar className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No appointment scheduled</p>
                  {can("can_schedule_appointments") && (
                    <button
                      onClick={() => setAppointmentDialogOpen(true)}
                      className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-md hover:bg-black/80 transition-colors"
                    >
                      Schedule Appointment
                    </button>
                  )}
                </div>
              ) : (() => {
                const latest = clientAppointments[0];
                const dateLabel = latest.appointment_date
                  ? new Date(latest.appointment_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                  : "—";
                const timeRange = [latest.appointment_time, latest.end_time].filter(Boolean).join(" – ");
                const isPast = latest.appointment_date ? new Date(latest.appointment_date) < new Date() : false;
                return (
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold">{latest.title || "Appointment"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dateLabel}{timeRange ? ` · ${timeRange}` : ""}
                      </p>
                    </div>
                    {latest.is_met ? (
                      <Badge className="bg-green-500 text-white text-[10px] px-2">Met</Badge>
                    ) : isPast ? (
                      <Badge className="bg-amber-500 text-white text-[10px] px-2">Pending Update</Badge>
                    ) : (
                      <Badge className="bg-blue-500 text-white text-[10px] px-2">Scheduled</Badge>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {latest.google_meet_link && (
                        <a
                          href={latest.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors no-underline"
                        >
                          <Video className="h-3 w-3" />
                          Join Google Meet
                        </a>
                      )}
                      {!latest.is_met && (
                        <button
                          onClick={() => handleMarkIndividualAsMet(latest.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Mark as Met
                        </button>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setAppointmentHistoryOpen(true)}
                        className="text-xs text-primary font-medium hover:opacity-70 transition-opacity flex items-center gap-1"
                      >
                        History ({clientAppointments.length})
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            {client.last_contact_date && (
              <div>
                <div className="text-sm font-medium">Last Contact</div>
                <div className="text-sm text-muted-foreground mt-1">{formatDate(client.last_contact_date)}</div>
              </div>
            )}
            {client.next_follow_up_date && (
              <div>
                <div className="text-sm font-medium">Next Follow-up</div>
                <div className="text-sm text-muted-foreground mt-1">{formatDate(client.next_follow_up_date)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Details — moved to top row */}
        <Card className="min-h-[300px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* <div className="space-y-2">
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
                  const removing = selectedScopes.includes(value);
                  const next = removing
                    ? selectedScopes.filter((s) => s !== value)
                    : [...selectedScopes, value];
                  setSelectedScopes(next);
                  try {
                    await clientsAPI.update(id!, { scope_of_work: next });
                    const scopeLabel = SCOPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
                    activityLogAPI.create({ client_id: id!, action_type: removing ? "scope_removed" : "scope_added", description: `Scope ${removing ? "removed" : "added"}: "${scopeLabel}"` }).then(loadActivityLog).catch(() => {});
                  } catch { toast.error("Failed to save scope of work"); }
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
                      <PopoverContent side="bottom" align="start" sideOffset={4} avoidCollisions={false} className="w-72 p-2">
                        <div className="space-y-1 max-h-60 overflow-y-auto thin-scroll">
                          {SCOPE_OPTIONS.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer text-sm">
                              <Checkbox checked={selectedScopes.includes(opt.value)} onCheckedChange={() => toggleScope(opt.value)} />
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
                              <button type="button" onClick={() => toggleScope(s)} className="ml-0.5 hover:text-destructive rounded-full">
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
            </div> */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Scope of Work</Label>

              <div className="space-y-2">
                <Popover open={scopePopoverOpen} onOpenChange={setScopePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent/30 transition-colors"
                    >
                      <span className="text-muted-foreground">
                        {selectedScopes.length === 0
                          ? "Select scope of work"
                          : "Add or remove scopes..."}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    </button>
                  </PopoverTrigger>

                  <PopoverContent
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="w-[var(--radix-popover-trigger-width)] p-2"
                  >
                    <div className="space-y-1 max-h-60 overflow-y-auto thin-scroll">
                      {scopeOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-2 py-1">
                          Loading...
                        </p>
                      ) : (
                        scopeOptions.map((opt: any) => (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={selectedScopes.includes(opt.id)}
                              onCheckedChange={() => toggleScope(opt.id)}
                            />
                            {opt.name}
                          </label>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Selected badges */}
                {selectedScopes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedScopes.map((s: string) => {
                      const label = scopeOptions.find((o: any) => o.id === s)?.name;

                      return (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-xs flex items-center gap-1 pr-1"
                        >
                          {label || s}
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
            </div>
            <div className="pt-2 space-y-1">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="call-811"
                    checked={!!client.call_811_completed_at}
                    disabled={!can("can_confirm_811")}
                    onCheckedChange={() => {
                      if (!can("can_confirm_811")) return;
                      if (!client.call_811_completed_at) {
                        setCall811Date(new Date().toISOString().split("T")[0]);
                        setCall811Time(new Date().toTimeString().slice(0, 5));
                        setCall811Open(true);
                      }
                    }}
                  />
                  <Label htmlFor="call-811" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-muted-foreground" />
                    Call 811?
                    {client.call_811_completed_at && (
                      <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 ml-1">
                        Satisfied
                      </Badge>
                    )}
                  </Label>
                </div>
                {client.call_811_completed_at ? (
                  <p className="text-xs text-green-700 pl-6">
                    Called on {new Date(client.call_811_completed_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">Call before you dig for utility location services</p>
                )}
              </div>

              {/* Intake Form */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Intake Form</span>
                  {client.intake_form_completed ? (
                    <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Completed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Incomplete</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {client.intake_form_completed && (
                    <button
                      type="button"
                      onClick={() => setIntakeViewOpen(true)}
                      className="text-xs text-primary hover:opacity-75 font-medium"
                    >
                      View
                    </button>
                  )}
                  {!client.intake_form_completed && (
                    <button
                      type="button"
                      onClick={() => { setIntakeData(client?.intake_form_data ?? INTAKE_EMPTY); setIntakeOpen(true); }}
                      className="text-xs text-primary hover:opacity-75 font-medium"
                    >
                      Mark Complete
                    </button>
                  )}
                  {client.intake_form_completed && (
                    <button
                      type="button"
                      onClick={() => setIntakeUndoOpen(true)}
                      className="text-xs text-muted-foreground hover:text-destructive font-medium"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
              {client.intake_form_completed_at && (
                <p className="text-xs text-green-700 pl-6">
                  Completed {new Date(client.intake_form_completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
          </CardContent>
        </Card>

      </div>

      {/* DocuSign + Revenue row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* DocuSign — compact */}
        <Card className="flex flex-col min-h-[240px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-medium">
              <FileSignature className="h-4 w-4" />
              DocuSign
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1 flex flex-col justify-center">
            {client.docusign_status === "completed" ? (
              <div className="flex flex-col items-center justify-center py-3 gap-2 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <Badge className="bg-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Signed
                </Badge>
                {client.docusign_completed_date && (
                  <span className="text-xs text-muted-foreground">{formatDate(client.docusign_completed_date)}</span>
                )}
              </div>
            ) : client.docusign_status === "preparing" ? (
              <div className="flex flex-col items-center justify-center py-3 gap-2 text-center">
                <FileSignature className="h-8 w-8 text-blue-400" />
                <Badge className="bg-blue-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Review Pending
                </Badge>
                <span className="text-xs text-muted-foreground">Click Send in DocuSign tab to continue</span>
                <button
                  onClick={openSenderView}
                  disabled={openingContractorSigning}
                  className="mt-1 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-md hover:bg-black/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {openingContractorSigning ? (
                    <><span className="animate-spin inline-block h-3 w-3 border border-current border-t-transparent rounded-full" /> Opening...</>
                  ) : (
                    <><FileSignature className="h-3 w-3" /> Back to Review</>
                  )}
                </button>
              </div>
            ) : client.docusign_status === "sent_to_client" ? (
              <div className="flex flex-col items-center justify-center py-3 gap-2 text-center">
                <Clock className="h-8 w-8 text-orange-400" />
                <Badge className="bg-orange-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Awaiting Signature
                </Badge>
                {client.docusign_sent_date && (
                  <span className="text-xs text-muted-foreground">Sent {formatDate(client.docusign_sent_date)}</span>
                )}
                <button
                  onClick={refreshDocusignStatus}
                  disabled={refreshingDocusign}
                  className="mt-1 px-3 py-1.5 border border-slate-200 text-xs font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {refreshingDocusign ? (
                    <><span className="animate-spin inline-block h-3 w-3 border border-current border-t-transparent rounded-full" /> Checking...</>
                  ) : (
                    <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Refresh Status</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 gap-2 text-center">
                <FileSignature className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs font-medium text-muted-foreground">No contract sent yet</p>
                <button
                  onClick={() => setDocusignDialogOpen(true)}
                  className="mt-1 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-md hover:bg-black/80 transition-colors"
                >
                  Send DocuSign
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue & Forecast */}
        <Card className="lg:col-span-2 flex flex-col min-h-[240px]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {["active", "completed"].includes(client.status) ? "Project Financials" : "Revenue & Forecast"}
            </CardTitle>
            <Link to={`/clients/${client.id}/create-proposal`}>
              <Button size="sm" variant="outline" className="h-8 text-xs"><FilePlus className="h-3.5 w-3.5 mr-1.5" />New Proposal</Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {["active", "completed"].includes(client.status) ? (() => {
              const acceptedProposal = clientProposals.find((p) => p.status === "accepted");
              const totalValue = clientProjects[0]?.totalValue || acceptedProposal?.total || 0;
              // DB triggers keep these columns current — read directly, no secondary fetch needed
              const cost = clientProjects[0]?.totalCosts ?? 0;
              const grossProfit = clientProjects[0]?.grossProfit ?? 0;
              const margin = clientProjects[0]?.profitMargin ?? 0;
              const commission = clientProjects[0]?.commission ?? 0;
              const donutData = totalValue > 0
                ? [
                    { name: "Cost", value: cost < 0 ? 0 : cost },
                    { name: "Gross Profit", value: grossProfit < 0 ? 0 : grossProfit },
                  ]
                : [{ name: "No data", value: 1 }];
              const COLORS = totalValue > 0 ? ["#e2e8f0", "#16a34a"] : ["#f1f5f9"];
              return (
                <div className="flex items-center gap-4">
                  {/* Donut */}
                  <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={56}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => formatCurrency(v)}
                          contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                          wrapperStyle={{ zIndex: 20 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
                      <span className="text-xs font-bold leading-none">{margin.toFixed(1)}%</span>
                      <span className="text-[9px] text-muted-foreground leading-none mt-0.5">GP</span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Contract Value</div>
                      <div className="text-lg font-bold text-green-600 leading-tight">{formatCurrency(totalValue)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Gross Profit</div>
                        <div className="text-sm font-semibold text-green-600">{formatCurrency(grossProfit)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total Cost</div>
                        <div className="text-sm font-semibold text-slate-600">{formatCurrency(cost > 0 ? cost : 0)}</div>
                      </div>
                    </div>
                    {commission > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Commission</div>
                        <div className="text-sm font-semibold text-blue-600">{formatCurrency(commission)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              /* Pre-sale — radial gauge + forecast fields */
              (() => {
                const latestProposal = [...clientProposals]
                  .filter((p) => p.status !== "declined")
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                const projectedValue = latestProposal?.total ?? client.projected_value;
                const isSelling = client.status === "selling";
                const hasData = projectedValue || (isSelling && (client.closing_probability || client.expected_close_date));
                return (
                  !hasData ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                      <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-xs font-medium text-muted-foreground">No revenue data recorded</p>
                      <p className="text-xs text-muted-foreground/60">Forecast details will appear once a proposal is saved</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {isSelling && client.closing_probability != null && (
                        <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                              cx="50%"
                              cy="50%"
                              innerRadius={36}
                              outerRadius={56}
                              startAngle={90}
                              endAngle={-270}
                              data={[
                                { value: client.closing_probability, fill: "#3b82f6" },
                                { value: 100 - client.closing_probability, fill: "#e2e8f0" },
                              ]}
                            >
                              <RadialBar dataKey="value" cornerRadius={4} background={false} />
                            </RadialBarChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold leading-none">{client.closing_probability}%</span>
                            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">Close</span>
                          </div>
                        </div>
                      )}
                      <div className="flex-1 space-y-2.5 min-w-0">
                        {projectedValue != null && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                              Projected Value{latestProposal ? " · from proposal" : ""}
                            </div>
                            <div className="text-lg font-bold text-green-600 leading-tight">{formatCurrency(projectedValue)}</div>
                          </div>
                        )}
                        {isSelling && client.expected_close_date && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Est. Close Date</div>
                            <div className="text-sm font-semibold text-slate-700">{formatDate(client.expected_close_date)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                );
              })()
            )}

            {/* ── Proposals (multiple) ── */}
            <div className="border-t mt-4 pt-3">
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto thin-scroll pr-1">
              {clientProposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                  <FileText className="h-6 w-6 mb-1.5 opacity-20" />
                  <p className="text-xs font-medium">No proposal yet</p>
                  <p className="text-xs mt-0.5">Create one to auto-populate revenue figures.</p>
                </div>
              ) : (
                clientProposals
                  .slice()
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((proposal) => (
                    <Link key={proposal.id} to={`/proposals/${proposal.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent/40 hover:bg-accent/70 transition-colors group">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {proposal.title ?? `Estimate #${proposal.estimate_number}`}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{proposal.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(proposal.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div className="text-sm font-semibold">{formatCurrency(proposal.total)}</div>
                        {can("can_delete_proposals") && (
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); setProposalToDelete(proposal); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Link>
                  ))
              )}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── Project Info ── */}
      {clientProjects.length > 0 && clientProjects.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge className={getProjectStatusColor(project.status)}>{project.status?.replace("_", " ")}</Badge>
              <button onClick={() => { setEditingProject(project); setEditProjectOpen(true); }} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
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
                      <p className="text-xs text-muted-foreground">Live GP (based on cost attributions)</p>
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
                    {(d.fioAssigned ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Assigned (FIO): <span className="font-medium text-foreground">{formatCurrency(d.fioAssigned)}</span>
                      </div>
                    )}
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
                    <p className="text-xs text-muted-foreground text-center pb-1">No cost attributions yet — live GP updates automatically as you add receipts.</p>
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

      {/* ── Project Actions — only visible for Sold / Active / Completed ── */}
      {clientProjects.length > 0 && ["sold", "active", "completed"].includes(client.status) && (() => {
        const tileClass = "flex items-center gap-3 border rounded-lg p-4 hover:bg-accent/40 transition-colors text-left";
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <button onClick={() => setPurchaseOrdersOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0"><Package className="h-5 w-5 text-amber-600" /></div>
              <div><p className="font-semibold text-sm">Purchase Orders</p><p className="text-xs text-muted-foreground">Order materials</p></div>
            </button>
            <button onClick={() => navigate(`/clients/${id}/change-order`)} className={tileClass}>
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
            <button onClick={() => setPaymentTrackingOpen(true)} className={tileClass}>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="font-semibold text-sm">Payments</p><p className="text-xs text-muted-foreground">Monitor collections</p></div>
            </button>
          </div>
        );
      })()}

      {/* ── Notes & Files + Activity Log ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Notes & Files */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes & Files
              {(noteEntries.length + photos.length) > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">{noteEntries.length + photos.length} items</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Compact upload row */}
            <div className="flex gap-2 items-center">
              <div
                className={`flex-1 border border-dashed rounded-lg px-4 py-2 flex items-center gap-3 cursor-pointer transition-colors ${isDraggingFile ? "border-primary bg-primary/5" : "hover:border-primary"} ${uploadingPhoto ? "opacity-60 pointer-events-none" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById("photo-upload")?.click()}
              >
                <input id="photo-upload" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={handlePhotoUpload} />
                {uploadingPhoto
                  ? <><Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" /><span className="text-xs text-muted-foreground">Uploading...</span></>
                  : <><Upload className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-xs text-muted-foreground">{isDraggingFile ? "Drop files here" : "Click or drag to upload"}</span></>
                }
              </div>
              <Select value={fileCategory} onValueChange={setFileCategory}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="File type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="photo">Site Photo</SelectItem>
                  <SelectItem value="certificate">Certificate of Completion</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor Agreement</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Inline note input */}
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note for your team..."
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); if (e.target.value.trim()) setNotesErr(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveNotes(); }}
                  className={`text-sm${notesErr ? " border-red-500" : ""}`}
                />
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="shrink-0">
                  {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
              {notesErr && <p className="text-xs text-red-500">{notesErr}</p>}
            </div>

            {/* Notes + Files feed */}
            {(() => {
              const feedItems = [
                ...noteEntries.map((n: any) => ({ ...n, _type: "note" })),
                ...photos.map((p: any) => ({ ...p, _type: "file" })),
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              if (feedItems.length === 0) return (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <StickyNote className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No notes or files yet</p>
                  <p className="text-xs mt-1">Add a note or upload a file to keep track of client details.</p>
                </div>
              );

              return (
                <div className="max-h-52 overflow-y-auto thin-scroll space-y-0 pr-1">
                  {feedItems.map((item) => {
                    const ts = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
                    if (item._type === "note") return (
                      <div key={`note-${item.id}`} className="flex gap-3 py-2.5 border-b last:border-0 group cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" onClick={() => { setSelectedNote(item); setEditingNoteContent(item.content); }}>
                        <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.content.split("\n")[0]}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.is_system_generated ? "System" : "Team"} · {ts}
                          </p>
                        </div>
                        {can("can_delete_notes") && (
                          <button className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={async (e) => { e.stopPropagation(); await notesAPI.delete(item.id); loadNotes(); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                    const isImage = item.mime_type?.startsWith("image/");
                    const isPdf = item.mime_type === "application/pdf";
                    return (
                      <div key={`file-${item.id}`} className="flex gap-3 py-2.5 border-b last:border-0 group">
                        <FileText className={`h-3.5 w-3.5 shrink-0 mt-1 ${isPdf ? "text-red-500" : isImage ? "text-blue-500" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <button className="text-sm font-medium hover:opacity-75 truncate block w-full text-left" onClick={() => { if (isImage) setPreviewFile({ url: item.file_url, name: item.file_name }); else window.open(item.file_url, "_blank"); }}>
                            {item.file_name}
                          </button>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.file_type && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded capitalize">{item.file_type}</span>}
                            <p className="text-xs text-muted-foreground">{ts}</p>
                          </div>
                        </div>
                        {can("can_delete_files") && (
                          <button className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeletePhoto(item.id, item.file_url, item.file_name ?? item.file_url.split("/").pop() ?? "file")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
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
              <div className="max-h-[310px] overflow-y-auto thin-scroll pr-1">
                {activityLog.map((entry) => {
                  const type = entry.action_type ?? "";
                  const icon =
                    type === "appointment_scheduled"     ? <Calendar className="h-3.5 w-3.5 text-purple-500" />
                    : type === "appointment_met"         ? <CalendarCheck className="h-3.5 w-3.5 text-green-500" />
                    : type === "email_sent"              ? <Mail className="h-3.5 w-3.5 text-blue-500" />
                    : type === "docusign_sent"           ? <FileSignature className="h-3.5 w-3.5 text-indigo-500" />
                    : type === "docusign_completed"      ? <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                    : type === "docusign_declined"       ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                    : type === "note_added"              ? <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                    : type === "note_deleted"            ? <StickyNote className="h-3.5 w-3.5 text-red-400" />
                    : type === "file_uploaded"           ? <Upload className="h-3.5 w-3.5 text-cyan-500" />
                    : type === "file_deleted"            ? <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    : type === "payment_received"        ? <DollarSign className="h-3.5 w-3.5 text-green-500" />
                    : type === "payment_milestone_added" ? <CreditCard className="h-3.5 w-3.5 text-green-400" />
                    : type === "status_changed"          ? <MoveRight className="h-3.5 w-3.5 text-orange-500" />
                    : type === "pipeline_changed"        ? <ArrowRightLeft className="h-3.5 w-3.5 text-orange-400" />
                    : type === "scope_added"             ? <Plus className="h-3.5 w-3.5 text-teal-500" />
                    : type === "scope_removed"           ? <Minus className="h-3.5 w-3.5 text-red-400" />
                    : type === "lead_source_changed"     ? <MapPin className="h-3.5 w-3.5 text-pink-500" />
                    : type === "client_updated"          ? <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    : type === "forecast_updated"        ? <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                    : type === "po_created"              ? <ShoppingCart className="h-3.5 w-3.5 text-violet-500" />
                    : type === "po_status_updated"       ? <Package className="h-3.5 w-3.5 text-violet-400" />
                    : type === "co_created"              ? <ClipboardEdit className="h-3.5 w-3.5 text-orange-500" />
                    : type === "co_updated"              ? <ClipboardEdit className="h-3.5 w-3.5 text-yellow-500" />
                    : type === "co_deleted"              ? <ClipboardEdit className="h-3.5 w-3.5 text-red-400" />
                    : type === "co_merged"               ? <ClipboardEdit className="h-3.5 w-3.5 text-green-500" />
                    : type === "receipt_added"           ? <Receipt className="h-3.5 w-3.5 text-emerald-500" />
                    : type === "receipt_deleted"         ? <Receipt className="h-3.5 w-3.5 text-red-400" />
                    : type === "fio_created"             ? <HardHat className="h-3.5 w-3.5 text-stone-500" />
                    : type === "project_created"         ? <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                    : type === "proposal_created"        ? <FileText className="h-3.5 w-3.5 text-blue-400" />
                    : type === "proposal_accepted"       ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    : type === "proposal_rejected"       ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                    : type === "proposal_deleted"        ? <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    : type === "email_bounced"           ? <MailX className="h-3.5 w-3.5 text-red-500" />
                    : type === "sms_failed"              ? <PhoneMissed className="h-3.5 w-3.5 text-red-500" />
                    : type === "proposal_sent"           ? <Send className="h-3.5 w-3.5 text-blue-600" />
                    : type === "project_value_updated"   ? <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    : type === "project_updated"         ? <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
                    : type === "fio_updated"             ? <HardHat className="h-3.5 w-3.5 text-yellow-500" />
                    : type === "crew_payment_submitted"  ? <DollarSign className="h-3.5 w-3.5 text-amber-500" />
                    : type.includes("pdf_exported")      ? <FileDown className="h-3.5 w-3.5 text-slate-400" />
                    : <History className="h-3.5 w-3.5 text-muted-foreground" />;
                  return (
                    <div key={entry.id} className="flex gap-3 py-2.5 border-b last:border-0">
                      <div className="shrink-0 mt-0.5">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground">Emails, appointments, status changes, and payments will appear here automatically.</p>
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
                <div className="space-y-4 px-6 py-4">
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
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Calendar className="h-9 w-9 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No milestones added yet</p>
                      <p className="text-xs mt-1">Add payment milestones to track project progress.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPayments.map((payment) => {
                        const pctOfTotal = totalAmount > 0 ? Math.round((payment.amount / totalAmount) * 100) : 0;
                        return (
                          <div key={payment.id} className={`flex items-center gap-3 border rounded-lg px-4 py-3 transition-colors ${payment.is_paid ? "bg-green-50/50 border-green-200" : "hover:bg-accent/30"}`}>
                            <Checkbox
                              checked={payment.is_paid}
                              disabled={!can("can_record_payments")}
                              onCheckedChange={() => {
                                if (!can("can_record_payments")) return;
                                if (!payment.is_paid) {
                                  setMarkPaidOpen(payment);
                                  setPaidForm({ payment_method: "", notes: payment.notes ?? "", paid_date: new Date().toISOString().split("T")[0] });
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
                        <span className={Math.abs(totalAmount - (clientProjects[0]?.totalValue ?? 0)) > 0.01 ? "text-amber-600 font-medium" : ""}>
                          {formatCurrency(totalAmount)}
                          {Math.abs(totalAmount - (clientProjects[0]?.totalValue ?? 0)) > 0.01 && (
                            <span className="ml-1.5 text-xs">
                              ({totalAmount < (clientProjects[0]?.totalValue ?? 0) ? "-" : "+"}{formatCurrency(Math.abs(totalAmount - (clientProjects[0]?.totalValue ?? 0)))})
                            </span>
                          )}
                        </span>
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
        <Dialog open={addPaymentOpen} onOpenChange={(o) => { setAddPaymentOpen(o); if (!o) setNewPayment(EMPTY_PAYMENT); }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Add Payment Milestone</DialogTitle>
              <DialogDescription>Add a progress payment from the signed contract.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 py-4">
              <div className="space-y-1.5"><Label>Label</Label><Input placeholder="e.g. Deposit, Progress Payment, Final" value={newPayment.label} onChange={(e) => setNewPayment((p) => ({ ...p, label: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Amount ($)</Label><Input type="number" placeholder="0.00" value={newPayment.amount} onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment((p) => ({ ...p, due_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional note" value={newPayment.notes} onChange={(e) => setNewPayment((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>Cancel</Button>
              <Button disabled={savingPayment || !newPayment.label || !newPayment.amount} onClick={async () => {
                if (!client) return;
                const project = clientProjects[0];
                if (!project?.id) { toast.error("No project found — create a project first before adding milestones."); return; }
                setSavingPayment(true);
                try {
                  const created = await projectPaymentsAPI.create({ project_id: project.id, client_id: client.id, label: newPayment.label, amount: parseFloat(newPayment.amount) || 0, due_date: newPayment.due_date || undefined, notes: newPayment.notes || undefined, sort_order: clientPayments.length });
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
        <Dialog open={!!markPaidOpen} onOpenChange={(o) => { if (!o) { setMarkPaidOpen(null); setPaidForm({ payment_method: "", notes: "", paid_date: new Date().toISOString().split("T")[0] }); } }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>{markPaidOpen?.label} — {formatCurrency(markPaidOpen?.amount ?? 0)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 py-4">
              <div className="space-y-1.5"><Label>Date Paid <span className="text-destructive">*</span></Label><Input type="date" value={paidForm.paid_date} onChange={(e) => setPaidForm((p) => ({ ...p, paid_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Payment Method</Label><Input placeholder="e.g. Check #1042, ACH #8829, Cash" value={paidForm.payment_method} onChange={(e) => setPaidForm((p) => ({ ...p, payment_method: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Notes (optional)</Label><Input placeholder="Any additional notes" value={paidForm.notes} onChange={(e) => setPaidForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidOpen(null)}>Cancel</Button>
              <Button disabled={savingPayment} onClick={async () => {
                if (!markPaidOpen) return;
                setSavingPayment(true);
                try {
                  const updated = await projectPaymentsAPI.update(markPaidOpen.id, { is_paid: true, paid_date: paidForm.paid_date || new Date().toISOString().split("T")[0], payment_method: paidForm.payment_method || null, notes: paidForm.notes || null });
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
        <Dialog open={editPaymentOpen} onOpenChange={(o) => { setEditPaymentOpen(o); if (!o) setEditPayment(null); }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Edit Milestone</DialogTitle>
              <DialogDescription>Update this payment milestone.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 py-4">
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
                  activityLogAPI.create({ client_id: id!, action_type: "payment_milestone_added", description: `Payment milestone updated: "${editPayment.label}" — $${(parseFloat(editPayment.amount) || 0).toLocaleString()}` }).then(loadActivityLog).catch(() => {});
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
        onSent={async (envelopeId: string) => {
          const sentDate = new Date().toISOString();
          await supabase.from("clients").update({
            docusign_status: "preparing",
            docusign_sent_date: sentDate,
            docusign_envelope_id: envelopeId,
          }).eq("id", client.id);
          setClient((prev: any) => ({ ...prev, docusign_status: "preparing", docusign_sent_date: sentDate, docusign_envelope_id: envelopeId }));
          const sentDateLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          const clientLabel = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company || "client";
          activityLogAPI.create({ client_id: client.id, action_type: "docusign_sent", description: `DocuSign contract sent to ${clientLabel}${client.email ? ` (${client.email})` : ""} on ${sentDateLabel} — envelope ID: ${envelopeId}` }).then(loadActivityLog).catch(() => {});
        }}
      />
      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        client={client}
        onAppointmentScheduled={handleAppointmentScheduled}
      />

      {/* ── Note Detail Sheet ── */}
      <Sheet open={!!selectedNote} onOpenChange={(o) => { if (!o) setSelectedNote(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Note
              {selectedNote?.is_system_generated && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">System</span>
              )}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {selectedNote && new Date(selectedNote.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <Textarea
              className="flex-1 min-h-[200px] text-sm resize-none"
              value={editingNoteContent}
              onChange={(e) => setEditingNoteContent(e.target.value)}
              placeholder="Note content…"
            />
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedNote(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={savingNoteEdit || !editingNoteContent.trim()}
              onClick={async () => {
                if (!selectedNote || !editingNoteContent.trim()) return;
                setSavingNoteEdit(true);
                await supabase.from("client_notes").update({ content: editingNoteContent.trim() }).eq("id", selectedNote.id);
                setSavingNoteEdit(false);
                setSelectedNote(null);
                loadNotes();
              }}
            >
              {savingNoteEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Appointment History Sheet ── */}
      <Sheet open={appointmentHistoryOpen} onOpenChange={setAppointmentHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Appointment History
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({clientAppointments.length})
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {clientAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No appointments yet</p>
                <p className="text-xs mt-1">Schedule one from the Actions menu.</p>
              </div>
            ) : (
              clientAppointments.map((appt) => {
                const isPast = appt.appointment_date
                  ? new Date(appt.appointment_date) < new Date()
                  : false;
                const dateLabel = appt.appointment_date
                  ? new Date(appt.appointment_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                  : "—";
                const timeRange = [appt.appointment_time, appt.end_time].filter(Boolean).join(" – ");

                return (
                  <div key={appt.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{appt.title || "Appointment"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dateLabel}{timeRange ? ` · ${timeRange}` : ""}
                        </p>
                        {appt.assigned_to_profile && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Assigned to {appt.assigned_to_profile.first_name} {appt.assigned_to_profile.last_name}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {appt.is_met ? (
                          <Badge className="bg-green-500 text-white text-[10px] px-2">Met</Badge>
                        ) : isPast ? (
                          <Badge className="bg-amber-500 text-white text-[10px] px-2">Pending Update</Badge>
                        ) : (
                          <Badge className="bg-blue-500 text-white text-[10px] px-2">Scheduled</Badge>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {appt.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 italic">
                        {appt.notes}
                      </p>
                    )}

                    {/* Met timestamp */}
                    {appt.is_met && appt.met_at && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Marked as met {new Date(appt.met_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {appt.google_meet_link && (
                        <a
                          href={appt.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition-colors no-underline"
                        >
                          <Video className="h-3 w-3" />
                          Join Google Meet
                        </a>
                      )}
                      {appt.google_event_html_link && (
                        <a
                          href={appt.google_event_html_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border px-2.5 py-1 rounded-md transition-colors no-underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View in Calendar
                        </a>
                      )}
                      {!appt.is_met && isPast && (
                        <button
                          onClick={() => handleMarkIndividualAsMet(appt.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Mark as Met
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t">
            <button
              onClick={() => { setAppointmentHistoryOpen(false); setAppointmentDialogOpen(true); }}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium border rounded-lg py-2.5 hover:bg-accent transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Schedule New Appointment
            </button>
          </div>
        </SheetContent>
      </Sheet>


      {/* Selling Gate — no appointment warning */}
      <Dialog open={sellingGateOpen} onOpenChange={setSellingGateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>No Appointment Scheduled</DialogTitle>
            <DialogDescription>
              This client has no appointment on record. It's recommended to schedule a meeting before moving to Selling.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Moving to Selling without an appointment means no meeting has been recorded for this client.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setSellingGateOpen(false); setAppointmentDialogOpen(true); }}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Schedule Appointment
            </Button>
            <Button size="sm" onClick={() => { setSellingGateOpen(false); setSellingProbability(""); setSellingCloseDate(""); setSellingModalOpen(true); }}>
              Move Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completed Gate — unpaid milestones warning */}
      {/* Move to Completed Modal */}
      <MoveToCompletedModal
        open={completedModalOpen}
        onOpenChange={setCompletedModalOpen}
        client={client}
        project={clientProjects[0] ?? null}
        onSuccess={() => {
          setClient({ ...client, status: "completed" });
          loadActivityLog();
          const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
          notificationsAPI.create({
            type: "project_completed",
            title: "Project Completed",
            message: `${clientName}'s project has been marked as completed.`,
            link: `/clients/${client.id}`,
            metadata: { client_id: client.id },
          }).catch(() => {});
        }}
      />

      {/* Backward Stage Move — Confirmation */}
      <Dialog open={backwardConfirmOpen} onOpenChange={setBackwardConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move Stage Backward?</DialogTitle>
            <DialogDescription>
              You're moving this client back to <span className="font-semibold capitalize">{backwardTargetStatus}</span>. This will update their pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Client requested more time, proposal revision needed…"
                value={backwardReason}
                onChange={(e) => setBackwardReason(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBackwardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={async () => {
              setBackwardConfirmOpen(false);
              await handleStatusChange(backwardTargetStatus);
              if (backwardReason.trim()) {
                activityLogAPI.create({
                  client_id: client.id,
                  action_type: "note_added",
                  description: `Stage moved back to ${backwardTargetStatus}: ${backwardReason.trim()}`,
                }).catch(() => {});
              }
              setBackwardReason("");
            }}>
              Yes, Move Back
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
        hasProposal={clientProposals.length > 0}
        onSuccess={() => {
          setClient({ ...client, status: "sold" });
          loadActivityLog();
        }}
      />

      {/* Move to Active Modal */}
      <MoveToActiveModal
        open={activeModalOpen}
        onOpenChange={setActiveModalOpen}
        client={client}
        project={clientProjects[0] ?? null}
        acceptedProposal={clientProposals.find((p: any) => p.status === "accepted") ?? null}
        onSuccess={() => {
          setClient({ ...client, status: "active" });
          loadActivityLog();
          projectsAPI.getAll().then((all: any[]) => setClientProjects(all.filter((p: any) => p.client_id === id)));
          const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
          notificationsAPI.create({
            type: "project_active",
            title: "Project Started",
            message: `${clientName} moved to Active — project is now underway.`,
            link: `/clients/${client.id}`,
            metadata: { client_id: client.id },
          }).catch(() => {});
        }}
      />

      {/* Edit Client Dialog */}
      {(() => {
        const ec = clientForm;
        const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 7;
        const fnErr    = !(ec.first_name ?? "").trim() && !(ec.company ?? "").trim() ? "First name or company is required." : (ec.first_name ?? "").trim().length > 0 && (ec.first_name ?? "").trim().length < 2 ? "Min 2 characters." : "";
        const emailErr = (ec.email ?? "").trim() && !isValidEmail((ec.email ?? "").trim()) ? "Enter a valid email address." : "";
        const phoneErr = (ec.phone ?? "").trim() && !isValidPhone(ec.phone ?? "") ? "Enter a valid phone number (min 7 digits)." : "";
        const zipErr   = (ec.zip ?? "").trim() && (ec.zip ?? "").trim().length < 4 ? "ZIP must be at least 4 characters." : "";
        const hasErr = !!fnErr || !!emailErr || !!phoneErr || !!zipErr;
        const t = editClientTouched;
        return (
          <Dialog open={editClientOpen} onOpenChange={(open) => { setEditClientOpen(open); if (!open) { setEditClientTouched(false); setClientForm({}); } }}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Edit Client</DialogTitle>
                <DialogDescription>Update contact information for this client.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name <span className="text-destructive">*</span></Label>
                    <Input value={ec.first_name ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, first_name: e.target.value }))} className={t && fnErr ? "border-red-500" : ""} />
                    {t && fnErr && <p className="text-xs text-red-500">{fnErr}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input value={ec.last_name ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input value={ec.company ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={ec.email ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, email: e.target.value }))} className={t && emailErr ? "border-red-500" : ""} />
                  {t && emailErr && <p className="text-xs text-red-500">{emailErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={ec.phone ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, phone: e.target.value }))} className={t && phoneErr ? "border-red-500" : ""} placeholder="(555) 123-4567" />
                  {t && phoneErr && <p className="text-xs text-red-500">{phoneErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Street Address</Label>
                  <Input value={ec.address ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={ec.city ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input value={ec.state ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, state: e.target.value }))} maxLength={2} placeholder="AL" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ZIP</Label>
                    <Input value={ec.zip ?? ""} onChange={(e) => setClientForm((f: any) => ({ ...f, zip: e.target.value }))} className={t && zipErr ? "border-red-500" : ""} placeholder="35801" />
                    {t && zipErr && <p className="text-xs text-red-500">{zipErr}</p>}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditClientOpen(false); setEditClientTouched(false); }}>Cancel</Button>
                <Button disabled={savingClient} onClick={async () => {
                  setEditClientTouched(true);
                  if (hasErr) return;
                  setSavingClient(true);
                  try {
                    await clientsAPI.update(client.id, clientForm);
                    setClient({ ...client, ...clientForm });
                    setEditClientOpen(false);
                    setEditClientTouched(false);
                    activityLogAPI.create({ client_id: client.id, action_type: "client_updated", description: `Client info updated` }).then(loadActivityLog).catch(() => {});
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
        );
      })()}

      {/* Intake Form — Mark Complete */}
      <Dialog open={intakeOpen} onOpenChange={(open) => {
        if (!open && intakeHasChanges()) { setIntakeUnsavedOpen(true); return; }
        setIntakeOpen(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mark Intake Form Complete</DialogTitle>
            <DialogDescription>Enter the client's responses from the Google Form, or leave fields blank to just mark as complete.</DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[65vh] overflow-y-auto thin-scroll">
            <div className="space-y-5">
              {/* Page 1 */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Page 1 — Contact Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Email</Label>
                    <Input placeholder="client@example.com" value={intakeData.email ?? ""} onChange={e => setIntakeData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Name</Label>
                    <Input placeholder="Full name" value={intakeData.name ?? ""} onChange={e => setIntakeData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Phone</Label>
                    <Input placeholder="(555) 000-0000" value={intakeData.phone ?? ""} onChange={e => setIntakeData(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Home Address</Label>
                    <Input placeholder="123 Main St…" value={intakeData.address ?? ""} onChange={e => setIntakeData(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Page 2 */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Page 2 — Project Details</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Project Scope</Label>
                    <Textarea placeholder="Describe the scope of the project…" value={intakeData.project_scope ?? ""} onChange={e => setIntakeData(p => ({ ...p, project_scope: e.target.value }))} rows={3} className="resize-none text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Project Goals</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Increase usable space", "Fix an existing issue", "Enhance curb appeal", "Other"].map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="rounded" checked={(intakeData.project_goals ?? []).includes(opt)} onChange={() => toggleIntakeCheck("project_goals", opt)} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Ideal Timeline</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={intakeData.timeline ?? ""}
                        onChange={e => setIntakeData(p => ({ ...p, timeline: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        <option>Within the next few weeks</option>
                        <option>Within the next month or two</option>
                        <option>ASAP</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Budget</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={intakeData.budget ?? ""}
                        onChange={e => setIntakeData(p => ({ ...p, budget: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        <option>$15,000 - $30,000</option>
                        <option>$31,000 - $50,000</option>
                        <option>$50,000 - $75,000</option>
                        <option>$75,000+</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">How Did You Hear About Us?</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      value={intakeData.referral_source ?? ""}
                      onChange={e => setIntakeData(p => ({ ...p, referral_source: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      <option>Referral</option>
                      <option>Google</option>
                      <option>Yelp</option>
                      <option>Facebook/Instagram</option>
                      <option>Yard Sign</option>
                      <option>Nextdoor</option>
                      <option>HomeAdvisor/Angi</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Existing Features</Label>
                    <Textarea placeholder="Any existing hardscape, landscaping, or structures…" value={intakeData.existing_features ?? ""} onChange={e => setIntakeData(p => ({ ...p, existing_features: e.target.value }))} rows={2} className="resize-none text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">How Will You Be Making Your Decision?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Depends on the design", "Depends on the cost", "Depends on the timing", "All of the above"].map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="rounded" checked={(intakeData.decision_factors ?? []).includes(opt)} onChange={() => toggleIntakeCheck("decision_factors", opt)} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {intakeHasChanges() && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Unsaved changes — click Save to keep responses.
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (intakeHasChanges()) { setIntakeUnsavedOpen(true); return; }
              setIntakeOpen(false);
            }}>Cancel</Button>
            <Button disabled={savingIntake} onClick={async () => {
              setSavingIntake(true);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                const now = new Date().toISOString();
                await clientsAPI.update(client!.id, {
                  intake_form_completed: true,
                  intake_form_completed_at: now,
                  intake_form_completed_by: user?.id ?? null,
                  intake_form_data: intakeData,
                });
                setClient({ ...client!, intake_form_completed: true, intake_form_completed_at: now, intake_form_data: intakeData });
                activityLogAPI.create({ client_id: client!.id, action_type: "status_changed", description: "Intake form marked as completed" }).then(loadActivityLog).catch(() => {});
                toast.success("Intake form marked complete.");
                setIntakeOpen(false);
              } catch (err: any) {
                toast.error(err.message || "Failed to save.");
              } finally {
                setSavingIntake(false);
              }
            }}>
              {savingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intake Form — View Responses */}
      <Dialog open={intakeViewOpen} onOpenChange={setIntakeViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Intake Form Responses
            </DialogTitle>
            <DialogDescription>
              {client?.intake_form_completed_at
                ? `Completed ${new Date(client.intake_form_completed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Intake form responses"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[60vh] overflow-y-auto thin-scroll">
            {client?.intake_form_data && Object.values(client.intake_form_data).some((v: any) => v && (Array.isArray(v) ? v.length > 0 : String(v).trim())) ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact Info</p>
                  <div className="space-y-2">
                    {([["Email", "email"], ["Name", "name"], ["Phone", "phone"], ["Address", "address"]] as const).map(([label, key]) =>
                      client.intake_form_data?.[key] ? (
                        <div key={key} className="flex gap-3 text-sm">
                          <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                          <span className="font-medium">{client.intake_form_data[key]}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
                <div className="border-t" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project Details</p>
                  <div className="space-y-3">
                    {client.intake_form_data.project_scope && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Project Scope</p>
                        <p className="font-medium">{client.intake_form_data.project_scope}</p>
                      </div>
                    )}
                    {(client.intake_form_data.project_goals ?? []).length > 0 && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Project Goals</p>
                        <div className="flex flex-wrap gap-1">
                          {(client.intake_form_data.project_goals as string[]).map((g: string) => <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>)}
                        </div>
                      </div>
                    )}
                    {client.intake_form_data.timeline && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-muted-foreground w-36 shrink-0">Timeline</span>
                        <span className="font-medium">{client.intake_form_data.timeline}</span>
                      </div>
                    )}
                    {client.intake_form_data.budget && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-muted-foreground w-36 shrink-0">Budget</span>
                        <span className="font-medium">{client.intake_form_data.budget}</span>
                      </div>
                    )}
                    {client.intake_form_data.referral_source && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-muted-foreground w-36 shrink-0">Referral Source</span>
                        <span className="font-medium">{client.intake_form_data.referral_source}</span>
                      </div>
                    )}
                    {client.intake_form_data.existing_features && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Existing Features</p>
                        <p className="font-medium">{client.intake_form_data.existing_features}</p>
                      </div>
                    )}
                    {(client.intake_form_data.decision_factors ?? []).length > 0 && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Decision Factors</p>
                        <div className="flex flex-wrap gap-1">
                          {(client.intake_form_data.decision_factors as string[]).map((d: string) => <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No responses recorded</p>
                <p className="text-xs mt-1">Form was marked complete without entering responses.</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => { setIntakeViewOpen(false); setIntakeClearOpen(true); }}>
              Clear Responses
            </Button>
            <Button variant="outline" onClick={() => setIntakeViewOpen(false)}>Close</Button>
            <Button variant="ghost" onClick={() => { setIntakeViewOpen(false); setIntakeData(client?.intake_form_data ?? INTAKE_EMPTY); setIntakeOpen(true); }}>
              Edit Responses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intake Form — Unsaved Changes Warning */}
      <AlertDialog open={intakeUnsavedOpen} onOpenChange={setIntakeUnsavedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved responses</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you close now the responses you typed will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { setIntakeUnsavedOpen(false); setIntakeOpen(false); }}>
              Discard & close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Intake Form — Undo Confirmation */}
      <AlertDialog open={intakeUndoOpen} onOpenChange={setIntakeUndoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark intake form incomplete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the intake form as incomplete. The responses already saved will be kept — you can view or edit them anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await clientsAPI.update(client!.id, { intake_form_completed: false, intake_form_completed_at: null, intake_form_completed_by: null });
              setClient({ ...client!, intake_form_completed: false, intake_form_completed_at: null });
              toast.success("Intake form marked incomplete. Responses preserved.");
              setIntakeUndoOpen(false);
            }}>
              Yes, mark incomplete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Intake Form — Clear Responses Confirmation */}
      <AlertDialog open={intakeClearOpen} onOpenChange={setIntakeClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all responses?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the saved intake form responses. The form will remain marked as complete but responses will be gone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={async () => {
              await clientsAPI.update(client!.id, { intake_form_notes: null, intake_form_data: null });
              setClient({ ...client!, intake_form_notes: null, intake_form_data: null });
              toast.success("Responses cleared.");
              setIntakeClearOpen(false);
            }}>
              Clear Responses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  activityLogAPI.create({ client_id: id!, action_type: "proposal_deleted", description: `Proposal deleted: "${proposalToDelete.title}"` }).then(loadActivityLog).catch(() => {});
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

      {/* Map Sheet */}
      <Sheet open={mapOpen} onOpenChange={setMapOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ")}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1">
            <iframe
              title="Client Location"
              width="100%"
              height="100%"
              style={{ border: 0, display: "block", minHeight: "500px" }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent([client.address, client.city, client.state, client.zip].filter(Boolean).join(", "))}&output=embed`}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Move to Selling / Update Forecast Modal */}
      <Dialog open={sellingModalOpen} onOpenChange={(o) => { setSellingModalOpen(o); if (!o) { setSellingProbability(""); setSellingCloseDate(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              {client?.status === "selling" ? "Update Forecast" : "Move to Selling"}
            </DialogTitle>
            <DialogDescription>
              {client?.status === "selling"
                ? `Update the forecast details for ${client?.first_name} ${client?.last_name}.`
                : `Enter the forecast details for ${client?.first_name} ${client?.last_name} before moving to Selling.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="selling-prob">Closing Probability <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="selling-prob"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 75"
                  value={sellingProbability}
                  onChange={(e) => setSellingProbability(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selling-date">Est. Close Date <span className="text-destructive">*</span></Label>
              <Input
                id="selling-date"
                type="date"
                value={sellingCloseDate}
                onChange={(e) => setSellingCloseDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                Closing Probability + Est. Close Date allows our team to forecast incoming sales. Please be as accurate as possible!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellingModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleMoveToSelling}
              disabled={savingSelling || !sellingProbability || !sellingCloseDate}
            >
              {savingSelling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <MoveRight className="h-4 w-4 mr-1.5" />}
              {client?.status === "selling" ? "Update" : "Move to Selling"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Client Dialog */}
      <Dialog open={discardOpen} onOpenChange={(v) => { setDiscardOpen(v); if (!v) { setDiscardReason(""); setDiscardNote(""); } }}>
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
          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="discard-reason">Reason <span className="text-destructive">*</span></Label>
              <select
                id="discard-reason"
                className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${!discardReason ? "text-muted-foreground" : ""} ${!discardReason ? "border-input" : "border-input"}`}
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
              >
                <option value="">Select a reason...</option>
                <option>Out of price range</option>
                <option>Out of scope</option>
                <option>Unresponsive</option>
                <option>Hired another contractor</option>
                <option>Project on pause</option>
                <option>Change mind</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discard-note">Notes <span className="text-destructive">*</span></Label>
              <Textarea
                id="discard-note"
                placeholder="Add details (min. 5 characters)..."
                rows={3}
                className="resize-none"
                value={discardNote}
                onChange={(e) => setDiscardNote(e.target.value)}
              />
              {discardNote.length > 0 && discardNote.trim().length < 5 && (
                <p className="text-xs text-destructive">Notes must be at least 5 characters</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDiscardOpen(false); setDiscardReason(""); setDiscardNote(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDiscard}
              disabled={discarding || !discardReason || discardNote.trim().length < 5}
            >
              {discarding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Archive className="h-4 w-4 mr-1.5" />}
              Discard Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 811 Confirmation Dialog */}
      <Dialog open={call811Open} onOpenChange={(v) => { setCall811Open(v); if (!v) { setCall811Date(""); setCall811Time(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Confirm 811 Call
            </DialogTitle>
            <DialogDescription>
              Enter the date and time you called 811 to satisfy the utility location requirement.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Date Called <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={call811Date}
                onChange={(e) => setCall811Date(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Time Called <span className="text-destructive">*</span></Label>
              <Input
                type="time"
                value={call811Time}
                onChange={(e) => setCall811Time(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Jonathan and the Project Manager will receive an in-app notification once confirmed.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCall811Open(false)}>Cancel</Button>
            <Button
              onClick={handleConfirm811}
              disabled={saving811 || !call811Date || !call811Time}
            >
              {saving811 ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Confirm & Notify Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      {editingProject && (
        <EditProjectDialog
          open={editProjectOpen}
          onOpenChange={setEditProjectOpen}
          project={editingProject}
          onSaved={() => { setEditProjectOpen(false); projectsAPI.getAll().then((all: any[]) => setClientProjects(all.filter((p: any) => p.client_id === id))); }}
        />
      )}

      {/* Purchase Orders Sheet */}
      <PurchaseOrdersSheet
        open={purchaseOrdersOpen}
        onOpenChange={setPurchaseOrdersOpen}
        client={client}
        project={clientProjects[0] ?? null}
        onSave={loadActivityLog}
      />


      {/* FIO Modal */}
      <FieldInstallationOrderModal
        open={fioOpen}
        onOpenChange={setFioOpen}
        project={clientProjects[0] ? { ...clientProjects[0], client: { id: client.id } } : null}
        onCrewPayment={() => {
          const projectId = clientProjects[0]?.id;
          if (projectId) loadGpHealth(projectId);
          loadActivityLog();
        }}
      />

      {/* Cost Attributions Sheet */}
      <CostAttributionsSheet
        open={costAttributionsOpen}
        onOpenChange={setCostAttributionsOpen}
        client={client}
        project={clientProjects[0] ?? null}
        onReceiptChange={() => {
          const projectId = clientProjects[0]?.id;
          if (projectId) loadGpHealth(projectId);
        }}
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