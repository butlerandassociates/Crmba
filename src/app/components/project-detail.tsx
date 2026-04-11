import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ArrowLeft,
  DollarSign,
  Edit,
  FileText,
  Users,
  TrendingUp,
  Building2,
  ChevronDown,
  Send,
  FileCheck,
  FileSignature,
  BarChart3,
  Upload,
  Receipt,
  Wallet,
  Plus,
  Trash2,
  FileImage,
  Loader2,
  Eye,
} from "lucide-react";
import { projectsAPI, receiptsAPI, projectPaymentsAPI, commissionPaymentsAPI } from "../utils/api";
import { EditProjectDialog } from "./edit-project-dialog";
import { Progress } from "./ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState, useEffect } from "react";
import { EmailTemplatesDialog } from "./email-templates-dialog";
import { DocuSignDialog } from "./docusign-dialog";
import { ForemanPaymentBreakdown } from "./foreman-payment-breakdown";
import { FieldInstallationOrderModal } from "./field-installation-order-modal";
import { PurchaseOrderModal } from "./purchase-order-modal";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<any | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadingProject(true);
    projectsAPI.getById(id)
      .then(setProject)
      .catch(console.error)
      .finally(() => setLoadingProject(false));
    receiptsAPI.getByProject(id).then(setReceipts).catch(console.error);
  }, [id]);

  const client = project?.client ?? null;

  const [fioOpen, setFioOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'details' | 'cost-attributions' | 'docusign' | 'files' | 'crew-payment' | 'payments'>('details');
  const [costAttributionsDialogOpen, setCostAttributionsDialogOpen] = useState(false);

  // Payment tracking state
  const [projectPayments, setProjectPayments] = useState<any[]>([]);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState<{ label: string; percentage: string; amount: string; notes: string; due_date: string }>({ label: '', percentage: '', amount: '', notes: '', due_date: '' });
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPaymentForm, setNewPaymentForm] = useState({ label: '', percentage: '', amount: '', due_date: '' });

  // Load payments from DB when project loads
  useEffect(() => {
    if (!id) return;
    projectPaymentsAPI.getByProject(id).then(async (data) => {
      if (data.length === 0 && project) {
        // Seed defaults if none exist
        const seeded = await projectPaymentsAPI.seedDefaults(id, project.totalValue);
        setProjectPayments(seeded || []);
      } else {
        setProjectPayments(data);
      }
    }).catch(console.error);
  }, [id, project?.id]);

  // Receipt tracking state
  const [receipts, setReceipts] = useState<any[]>([]);
  const [newReceipt, setNewReceipt] = useState({
    name: '',
    amount: '',
    category: 'material' as 'material' | 'labor',
    note: '',
    fileName: '',
  });
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<{ url: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; fileUrl?: string; name: string } | null>(null);
  const [deletePaymentConfirm, setDeletePaymentConfirm] = useState<{ id: string; label: string } | null>(null);

  if (loadingProject) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Project not found</h2>
          <Link to="/projects">
            <Button className="mt-4">Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "prospect":
        return "bg-blue-500";
      case "selling":
        return "bg-orange-500";
      case "sold":
        return "bg-purple-500";
      case "completed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDocusignStatusColor = (status?: string) => {
    switch (status) {
      case "signed":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "not_sent":
        return "bg-gray-500";
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

  // Calculate progress based on payments received
  const paymentProgressPercentage = projectPayments.length > 0
    ? projectPayments.filter(p => p.is_paid).reduce((sum, p) => sum + Number(p.percentage), 0)
    : 0;

  const progressPercentage = project.status === "completed" ? 100 :
    project.status === "active" ? paymentProgressPercentage :
    project.status === "sold" ? paymentProgressPercentage : 15;

  const handleTogglePaid = async (payment: any, checked: boolean) => {
    const updates = { is_paid: checked, paid_date: checked ? new Date().toISOString().split('T')[0] : null };
    try {
      const updated = await projectPaymentsAPI.update(payment.id, updates);
      setProjectPayments(prev => prev.map(p => p.id === payment.id ? updated : p));

      // Auto-create/delete commission installment if project has a PM and commission set
      const pmId = project?.project_manager_id;
      const grossProfit = project?.gross_profit ?? 0;
      const commissionRate = project?.commission ?? 0; // stored as % e.g. 3
      if (pmId && grossProfit > 0 && commissionRate > 0) {
        const totalCommission = grossProfit * (commissionRate / 100);
        const totalPayments = projectPayments.length || 1;
        const installmentAmount = totalCommission / totalPayments;
        if (checked) {
          await commissionPaymentsAPI.createFromProgressPayment(project.id, payment.id, pmId, installmentAmount);
        } else {
          await commissionPaymentsAPI.deleteByProgressPayment(payment.id);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment');
    }
  };

  const handleSavePaymentEdit = async (paymentId: string) => {
    if (!editPaymentForm.label.trim()) { toast.error('Label is required'); return; }
    if (!editPaymentForm.amount || parseFloat(editPaymentForm.amount) <= 0) { toast.error('Amount must be greater than 0'); return; }
    try {
      const updated = await projectPaymentsAPI.update(paymentId, {
        label: editPaymentForm.label.trim(),
        percentage: parseFloat(editPaymentForm.percentage),
        amount: parseFloat(editPaymentForm.amount),
        notes: editPaymentForm.notes,
        due_date: editPaymentForm.due_date || null,
      });
      setProjectPayments(prev => prev.map(p => p.id === paymentId ? updated : p));
      setEditingPayment(null);
      toast.success('Payment updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payment');
    }
  };

  const handleAddPayment = async () => {
    if (!newPaymentForm.label || !newPaymentForm.amount) {
      toast.error('Label and amount are required');
      return;
    }
    try {
      const created = await projectPaymentsAPI.create({
        project_id: id!,
        label: newPaymentForm.label,
        percentage: parseFloat(newPaymentForm.percentage) || 0,
        amount: parseFloat(newPaymentForm.amount),
        sort_order: projectPayments.length,
        due_date: newPaymentForm.due_date || undefined,
      });
      setProjectPayments(prev => [...prev, created]);
      setNewPaymentForm({ label: '', percentage: '', amount: '', due_date: '' });
      setAddingPayment(false);
      toast.success('Payment milestone added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add payment');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await projectPaymentsAPI.delete(paymentId);
      setProjectPayments(prev => prev.filter(p => p.id !== paymentId));
      toast.success('Payment removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete payment');
    }
  };

  // Receipt handling functions
  // const handleAddReceipt = async () => {
  //   if (!newReceipt.name || !newReceipt.amount) {
  //     toast.error('Please enter receipt name and amount');
  //     return;
  //   }
  //   if (!id) return;
  //   try {
  //     setSavingReceipt(true);
  //     const saved = await receiptsAPI.create(
  //       {
  //         project_id: id,
  //         name: newReceipt.name,
  //         amount: parseFloat(newReceipt.amount),
  //         category: newReceipt.category,
  //         note: newReceipt.note || undefined,
  //       },
  //       droppedFile || undefined
  //     );
  //     setReceipts((prev) => [saved, ...prev]);
  //     setNewReceipt({ name: '', amount: '', category: 'material', note: '', fileName: '' });
  //     setDroppedFile(null);
  //     toast.success('Receipt added');
  //   } catch (err: any) {
  //     toast.error(err.message || 'Failed to add receipt');
  //   } finally {
  //     setSavingReceipt(false);
  //   }
  // };
  const handleAddReceipt = async () => {
    if (!newReceipt.name || !newReceipt.amount) {
      toast.error('Please enter receipt name and amount');
      return;
    }
    if (!id) return;
    try {
      setSavingReceipt(true);
      const saved = await receiptsAPI.create(
        {
          project_id: id,
          name: newReceipt.name,
          amount: parseFloat(newReceipt.amount),
          category: newReceipt.category,
          note: newReceipt.note || undefined,
        },
        droppedFile || undefined
      );
      setReceipts((prev) => [saved, ...prev]);
      const updatedProject = await projectsAPI.getById(id);
      setProject(updatedProject); 
      setNewReceipt({ name: '', amount: '', category: 'material', note: '', fileName: '' });
      setDroppedFile(null);
      toast.success('Receipt added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add receipt');
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string, fileUrl?: string) => {
    if (!id) return;
    try {
      await receiptsAPI.delete(receiptId, fileUrl);
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      const updatedProject = await projectsAPI.getById(id);
      setProject(updatedProject);
      toast.success('Receipt deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete receipt');
    }
  };

  // OLD file upload handler — replaced by drag & drop
  // const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (file) { setNewReceipt({ ...newReceipt, fileName: file.name }); }
  // };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setDroppedFile(file); setNewReceipt((prev) => ({ ...prev, fileName: file.name })); }
  };

  // Calculate financial health stats
  const calculateFinancialHealth = () => {
    const actualMaterialCost = receipts.filter(r => r.category === 'material').reduce((sum, r) => sum + r.amount, 0);
    const actualLaborCost = receipts.filter(r => r.category === 'labor').reduce((sum, r) => sum + r.amount, 0);
    const totalActualCosts = actualMaterialCost + actualLaborCost;
    const actualGrossProfit = project.totalValue - totalActualCosts;
    const actualProfitMargin = project.totalValue > 0 ? (actualGrossProfit / project.totalValue) * 100 : 0;
    
    return {
      materialCost: actualMaterialCost,
      laborCost: actualLaborCost,
      totalCosts: totalActualCosts,
      grossProfit: actualGrossProfit,
      profitMargin: actualProfitMargin,
    };
  };

  const financialHealth = calculateFinancialHealth();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/clients/${project.client_id ?? project.client?.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Client
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Badge className={getStatusColor(project.status)}>
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">{project.clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Actions
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send Email to Client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDocusignDialogOpen(true)}>
                <FileSignature className="h-4 w-4 mr-2" />
                Send DocuSign
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileCheck className="h-4 w-4 mr-2" />
                Create QuickBooks Invoice
              </DropdownMenuItem>
              {['sold', 'active', 'completed', 'scheduled'].includes(project.status) && (
                <DropdownMenuItem onClick={() => setPoOpen(true)}>
                  <Receipt className="h-4 w-4 mr-2" />
                  Purchase Orders
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(project.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Contract amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(project.totalCosts)}</div>
            <p className="text-xs text-muted-foreground mt-1">Materials + Labor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(project.grossProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {project.profitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(project.commission)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {project.commissionRate}% of total value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex gap-6">
        {/* Left Sidebar Navigation */}
        <Card className="w-48 h-fit">
          <CardContent className="p-3">
            <nav className="space-y-1">
              <button
                onClick={() => setCostAttributionsDialogOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted"
              >
                <BarChart3 className="h-4 w-4" />
                Cost Attributions
              </button>
              <button
                onClick={() => setActiveSection('docusign')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeSection === 'docusign'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <FileSignature className="h-4 w-4" />
                DocuSign
              </button>
              <button
                onClick={() => setActiveSection('files')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeSection === 'files'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Upload className="h-4 w-4" />
                Files
              </button>
              {(project.status === 'sold' || project.status === 'active' || project.status === 'completed') && 
               project.lineItems && project.lineItems.length > 0 && (
                <button
                  onClick={() => setActiveSection('crew-payment')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
                    activeSection === 'crew-payment'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Receipt className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Crew Payment Sheet</span>
                </button>
              )}
              <button
                onClick={() => setActiveSection('payments')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeSection === 'payments'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Payments
              </button>
              {['sold', 'active', 'completed', 'scheduled'].includes(project.status) && (
                <button
                  onClick={() => setPoOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted"
                >
                  <Receipt className="h-4 w-4 flex-shrink-0" />
                  Purchase Orders
                </button>
              )}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1 text-sm">Description</h3>
                <p className="text-muted-foreground text-sm">{project.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Timeline</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-medium">{formatDate(project.startDate)}</span>
                  </div>
                  {project.endDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">End Date:</span>
                      <span className="font-medium">{formatDate(project.endDate)}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Team</h3>
                <div className="space-y-2">
                  {project.projectManagerName && (
                    <div className="flex items-start gap-2 p-2 border rounded-md">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Project Manager</div>
                        <div className="font-medium text-sm">{project.projectManagerName}</div>
                      </div>
                    </div>
                  )}
                  {project.foremanName && (
                    <button
                      onClick={() => setFioOpen(true)}
                      className="w-full flex items-start gap-2 p-2 border rounded-md hover:bg-primary/5 hover:border-primary transition-colors text-left"
                    >
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Foreman</div>
                        <div className="font-medium text-sm text-primary">{project.foremanName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Click to view payment breakdown</div>
                      </div>
                    </button>
                  )}
                  {project.salesRepName && (
                    <div className="flex items-start gap-2 p-2 border rounded-md">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Sales Rep</div>
                        <div className="font-medium text-sm">{project.salesRepName}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          {client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Name</div>
                  <Link
                    to={`/clients/${client.id}`}
                    className="font-medium text-sm text-primary hover:opacity-75"
                  >
                    {`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || client.company || "—"}
                  </Link>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Company</div>
                  <div className="font-medium text-sm">{client.company}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <a
                    href={`mailto:${client.email}`}
                    className="text-xs text-primary hover:opacity-75"
                  >
                    {client.email}
                  </a>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <a href={`tel:${client.phone}`} className="text-xs text-primary hover:opacity-75">
                    {client.phone}
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Section Content Based on Active Selection */}
      {activeSection === 'docusign' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              DocuSign Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium text-sm">Contract Status</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {project.docusignStatus?.replace("_", " ") || "not sent"}
                </div>
              </div>
              <Badge className={getDocusignStatusColor(project.docusignStatus)}>
                {project.docusignStatus?.replace("_", " ") || "not sent"}
              </Badge>
            </div>
            {project.docusignStatus === "signed" ? (
              <Button variant="outline" className="w-full" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                View Contract
              </Button>
            ) : (
              <Button className="w-full" size="sm" onClick={() => setDocusignDialogOpen(true)}>
                <FileSignature className="h-4 w-4 mr-2" />
                Send for Signature
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'files' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Project Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">File management coming soon...</p>
          </CardContent>
        </Card>
      )}

      {activeSection === 'crew-payment' && 
       (project.status === 'sold' || project.status === 'active' || project.status === 'completed') && 
       project.lineItems && project.lineItems.length > 0 && (
        <ForemanPaymentBreakdown project={project} />
      )}

      {activeSection === 'payments' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Payment Tracking
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddingPayment(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Milestone
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment Progress Summary */}
            <div className="p-3 bg-muted/50 rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Payment Progress</span>
                <span className="text-sm font-bold">{paymentProgressPercentage.toFixed(0)}%</span>
              </div>
              <Progress value={paymentProgressPercentage} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>Received: {formatCurrency(projectPayments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.amount), 0))}</span>
                <span>Remaining: {formatCurrency(projectPayments.filter(p => !p.is_paid).reduce((s, p) => s + Number(p.amount), 0))}</span>
              </div>
            </div>

            {/* Payment Items */}
            <div className="space-y-2">
              {projectPayments.map((payment) => (
                <div key={payment.id}>
                  {editingPayment === payment.id ? (
                    <div className="p-3 border rounded-md bg-muted/20 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input value={editPaymentForm.label} onChange={(e) => setEditPaymentForm(f => ({ ...f, label: e.target.value }))} className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Due Date</Label>
                          <Input type="date" value={editPaymentForm.due_date} onChange={(e) => setEditPaymentForm(f => ({ ...f, due_date: e.target.value }))} className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Percentage %</Label>
                          <Input type="number" value={editPaymentForm.percentage} onChange={(e) => setEditPaymentForm(f => ({ ...f, percentage: e.target.value }))} className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input type="number" value={editPaymentForm.amount} onChange={(e) => setEditPaymentForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-sm mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditingPayment(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => handleSavePaymentEdit(payment.id)}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex items-center justify-between p-2.5 border rounded-md transition-colors ${payment.is_paid ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={payment.is_paid}
                          onCheckedChange={(checked) => typeof checked === 'boolean' && handleTogglePaid(payment, checked)}
                        />
                        <div>
                          <div className="font-medium text-sm">{payment.label}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{payment.percentage}% · {formatCurrency(payment.amount)}</span>
                            {payment.is_paid && payment.paid_date && <span className="text-green-600">Paid {payment.paid_date}</span>}
                            {!payment.is_paid && payment.due_date && (() => {
                              const today = new Date().toISOString().split('T')[0];
                              const isOverdue = payment.due_date < today;
                              const isToday = payment.due_date === today;
                              return (
                                <span className={`font-medium ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-500' : 'text-muted-foreground'}`}>
                                  {isOverdue ? '⚠ Overdue · ' : isToday ? '● Due Today · ' : 'Due '}
                                  {new Date(payment.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingPayment(payment.id);
                          setEditPaymentForm({ label: payment.label, percentage: String(payment.percentage), amount: String(payment.amount), notes: payment.notes || '', due_date: payment.due_date || '' });
                        }}>
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletePaymentConfirm({ id: payment.id, label: payment.label })}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

            </div>

            {/* Total Summary */}
            <div className="pt-3 border-t space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total Contract Value:</span>
                <span className="font-bold">{formatCurrency(project.totalValue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Milestones:</span>
                <span>{formatCurrency(projectPayments.reduce((s, p) => s + Number(p.amount), 0))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Templates Dialog */}
      {client && (
        <EmailTemplatesDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          client={client}
        />
      )}

      {/* DocuSign Dialog */}
      {client && (
        <DocuSignDialog
          open={docusignDialogOpen}
          onOpenChange={setDocusignDialogOpen}
          client={client}
          project={project}
        />
      )}

      {/* Cost Attributions Dialog */}
      <Dialog open={costAttributionsDialogOpen} onOpenChange={setCostAttributionsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Fixed header */}
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Cost Attributions
              </DialogTitle>
              <DialogDescription>
                Upload receipts and track actual project costs
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* OLD Add Receipt Form — commented out, replaced by drag & drop below */}
            {false && (
              <div className="p-3 border rounded-md bg-muted/20">
                <h3 className="font-semibold text-sm mb-3">Add New Receipt</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input placeholder="e.g., Lumber Purchase" className="h-8 text-sm" />
                  <Input type="number" placeholder="0.00" className="h-8 text-sm" />
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <Input type="file" accept="image/*,application/pdf" className="h-8 text-xs" />
                  <Button size="sm" className="h-8"><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
              </div>
            )}

            {/* NEW — Drag & Drop + form fields */}
            <div className="p-4 border rounded-md bg-muted/20 space-y-4">
              <h3 className="font-semibold text-sm">Add New Receipt</h3>

              {/* Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Receipt Name</Label>
                  <Input
                    placeholder="e.g., Lumber Purchase"
                    value={newReceipt.name}
                    onChange={(e) => setNewReceipt({ ...newReceipt, name: e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newReceipt.amount}
                    onChange={(e) => setNewReceipt({ ...newReceipt, amount: e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={newReceipt.category}
                    onValueChange={(value: 'material' | 'labor') => setNewReceipt({ ...newReceipt, category: value })}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Note (optional)</Label>
                  <Input
                    placeholder="Additional info"
                    value={newReceipt.note}
                    onChange={(e) => setNewReceipt({ ...newReceipt, note: e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </div>
              {/* Drag & drop / click to upload */}
              <div>
                <input
                  id="receipt-file-input"
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setDroppedFile(file); setNewReceipt((prev) => ({ ...prev, fileName: file.name })); }
                  }}
                />
                <label
                  htmlFor="receipt-file-input"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  {newReceipt.fileName ? (
                    <div className="flex items-center gap-2 text-sm">
                      <FileImage className="h-4 w-4 text-primary" />
                      <span className="font-medium">{newReceipt.fileName}</span>
                      <button
                        className="text-muted-foreground hover:text-destructive text-xs underline ml-2"
                        onClick={(e) => { e.preventDefault(); setDroppedFile(null); setNewReceipt((prev) => ({ ...prev, fileName: '' })); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 mb-2 text-muted-foreground opacity-60" />
                      <p className="text-sm text-muted-foreground">Drag & drop or <span className="text-primary underline">click to upload</span> receipt</p>
                      <p className="text-xs text-muted-foreground mt-1">Images or PDF</p>
                    </>
                  )}
                </label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAddReceipt} size="sm" disabled={savingReceipt}>
                  {savingReceipt ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  {savingReceipt ? 'Saving...' : 'Add Receipt'}
                </Button>
              </div>
            </div>

            {/* Receipts List */}
            {receipts.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Receipts ({receipts.length})</h3>
                <div className="border rounded-md">
                  {receipts.map((receipt, index) => (
                    <div
                      key={receipt.id}
                      className={`flex items-center justify-between p-2.5 ${
                        index !== receipts.length - 1 ? 'border-b' : ''
                      } hover:bg-muted/50 transition-colors`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{receipt.name}</span>
                          <Badge
                            variant={receipt.category === 'material' ? 'default' : 'secondary'}
                            className="text-xs px-1.5 py-0"
                          >
                            {receipt.category}
                          </Badge>
                        </div>
                        {receipt.note && (
                          <div className="text-xs text-muted-foreground mt-0.5">{receipt.note}</div>
                        )}
                        {receipt.file_name && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <FileImage className="h-3 w-3" />
                            {receipt.file_name}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{formatCurrency(receipt.amount)}</span>
                        {receipt.file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setPreviewReceipt({ url: receipt.file_url, name: receipt.file_name })}
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteConfirm({ id: receipt.id, fileUrl: receipt.file_url, name: receipt.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                No receipts added yet. Add your first receipt above.
              </div>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <EditProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={project}
        onSaved={() => {
          projectsAPI.getById(id!).then(setProject).catch(console.error);
        }}
      />

      {/* Financial Health Stats Section - Always Visible at Bottom */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Actual Financial Health
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({receipts.length} receipt{receipts.length !== 1 ? 's' : ''} tracked)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-background rounded-md border">
              <div className="text-xs text-muted-foreground mb-1">Material Costs</div>
              <div className="font-bold text-lg">{formatCurrency(financialHealth.materialCost)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                from actual receipts
              </div>
            </div>
            <div className="p-3 bg-background rounded-md border">
              <div className="text-xs text-muted-foreground mb-1">Labor Costs</div>
              <div className="font-bold text-lg">{formatCurrency(financialHealth.laborCost)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                from Field Installation Order
              </div>
            </div>
            <div className="p-3 bg-background rounded-md border">
              <div className="text-xs text-muted-foreground mb-1">Total Actual Costs</div>
              <div className="font-bold text-lg">{formatCurrency(financialHealth.totalCosts)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                vs {formatCurrency(project.totalCosts)} estimated
              </div>
            </div>
            <div className="p-3 bg-background rounded-md border">
              <div className="text-xs text-muted-foreground mb-1">Actual Gross Profit</div>
              <div className={`font-bold text-lg ${financialHealth.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(financialHealth.grossProfit)}
                <span className="text-sm ml-1">({financialHealth.profitMargin.toFixed(1)}%)</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                vs {project.profitMargin.toFixed(1)}% estimated
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Receipt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirm?.name}"</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deleteConfirm) handleDeleteReceipt(deleteConfirm.id, deleteConfirm.fileUrl);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt file preview modal */}
      <Dialog open={!!previewReceipt} onOpenChange={(open) => !open && setPreviewReceipt(null)}>
        <DialogContent className="p-0 overflow-hidden w-[90vw] max-w-[90vw] bg-white rounded-xl shadow-2xl [&>button]:text-foreground [&>button]:top-3 [&>button]:right-3">
          {previewReceipt && (
            <div className="flex flex-col h-[90vh]">
              <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center gap-2 pr-12 shrink-0">
                <span className="text-sm font-medium truncate max-w-[70vw]">{previewReceipt.name}</span>
              </div>
              {previewReceipt.name?.toLowerCase().endsWith('.pdf') ? (
                <iframe src={previewReceipt.url} className="w-full flex-1" />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-muted/10 p-4 overflow-auto">
                  <img
                    src={previewReceipt.url}
                    alt={previewReceipt.name}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete payment confirmation modal */}
      <Dialog open={!!deletePaymentConfirm} onOpenChange={(open) => !open && setDeletePaymentConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Milestone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">"{deletePaymentConfirm?.label}"</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeletePaymentConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (deletePaymentConfirm) handleDeletePayment(deletePaymentConfirm.id);
                setDeletePaymentConfirm(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Milestone modal */}
      <Dialog open={addingPayment} onOpenChange={(open) => { setAddingPayment(open); if (!open) setNewPaymentForm({ label: '', percentage: '', amount: '', due_date: '' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Add Payment Milestone
            </DialogTitle>
            <DialogDescription>
              Add a new milestone to the payment schedule for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Milestone Label</Label>
              <Input
                placeholder="e.g., Framing Complete"
                value={newPaymentForm.label}
                onChange={(e) => setNewPaymentForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Percentage (%)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 25"
                  value={newPaymentForm.percentage}
                  onChange={(e) => setNewPaymentForm(f => ({ ...f, percentage: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newPaymentForm.amount}
                  onChange={(e) => setNewPaymentForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            {newPaymentForm.percentage && project?.totalValue && (
              <p className="text-xs text-muted-foreground">
                {newPaymentForm.percentage}% of {formatCurrency(project.totalValue)} = {formatCurrency(project.totalValue * parseFloat(newPaymentForm.percentage) / 100)}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Due Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="date"
                value={newPaymentForm.due_date}
                onChange={(e) => setNewPaymentForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setAddingPayment(false); setNewPaymentForm({ label: '', percentage: '', amount: '', due_date: '' }); }}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Milestone
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Installation Order Modal */}
      {project && (
        <FieldInstallationOrderModal
          open={fioOpen}
          onOpenChange={setFioOpen}
          project={project}
        />
      )}

      {/* Purchase Order Modal */}
      {project && (
        <PurchaseOrderModal
          open={poOpen}
          onOpenChange={setPoOpen}
          project={project}
        />
      )}
    </div>
  );
}