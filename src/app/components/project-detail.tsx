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
} from "lucide-react";
import { projectsAPI } from "../utils/api";
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
  }, [id]);

  const client = project?.client ?? null;

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'details' | 'cost-attributions' | 'docusign' | 'files' | 'crew-payment' | 'payments'>('details');
  const [costAttributionsDialogOpen, setCostAttributionsDialogOpen] = useState(false);

  // Payment tracking state
  const [payments, setPayments] = useState({
    deposit:  { paid: false, percentage: 30, amount: 0 },
    progress: { paid: false, percentage: 40, amount: 0 },
    final:    { paid: false, percentage: 30, amount: 0 },
  });

  // Recalculate payment amounts when project loads
  useEffect(() => {
    if (!project) return;
    setPayments({
      deposit:  { paid: false, percentage: 30, amount: project.totalValue * 0.3 },
      progress: { paid: false, percentage: 40, amount: project.totalValue * 0.4 },
      final:    { paid: false, percentage: 30, amount: project.totalValue * 0.3 },
    });
  }, [project?.id]);

  // Receipt tracking state
  const [receipts, setReceipts] = useState<Array<{
    id: string;
    name: string;
    amount: number;
    category: 'material' | 'labor';
    note: string;
    fileName?: string;
    uploadDate: string;
  }>>([]);

  const [newReceipt, setNewReceipt] = useState({
    name: '',
    amount: '',
    category: 'material' as 'material' | 'labor',
    note: '',
    fileName: '',
  });

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
  const calculatePaymentProgress = () => {
    let totalPaid = 0;
    if (payments.deposit.paid) totalPaid += payments.deposit.percentage;
    if (payments.progress.paid) totalPaid += payments.progress.percentage;
    if (payments.final.paid) totalPaid += payments.final.percentage;
    return totalPaid;
  };

  const paymentProgressPercentage = calculatePaymentProgress();
  const progressPercentage = project.status === "completed" ? 100 : 
                              project.status === "active" ? paymentProgressPercentage : 
                              project.status === "sold" ? paymentProgressPercentage : 15;

  const handlePaymentChange = (paymentType: 'deposit' | 'progress' | 'final', checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setPayments({
        ...payments,
        [paymentType]: { ...payments[paymentType], paid: checked }
      });
    }
  };

  // Receipt handling functions
  const handleAddReceipt = () => {
    if (!newReceipt.name || !newReceipt.amount) {
      toast.error('Please enter receipt name and amount');
      return;
    }
    
    const receipt = {
      id: `receipt-${Date.now()}`,
      name: newReceipt.name,
      amount: parseFloat(newReceipt.amount),
      category: newReceipt.category,
      note: newReceipt.note,
      fileName: newReceipt.fileName,
      uploadDate: new Date().toISOString(),
    };
    
    setReceipts([...receipts, receipt]);
    setNewReceipt({
      name: '',
      amount: '',
      category: 'material',
      note: '',
      fileName: '',
    });
    toast.success('Receipt added successfully');
  };

  const handleDeleteReceipt = (id: string) => {
    setReceipts(receipts.filter(r => r.id !== id));
    toast.info('Receipt deleted');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewReceipt({ ...newReceipt, fileName: file.name });
    }
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
        <Link to="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
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
                  <div className="flex items-start gap-2 p-2 border rounded-md">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Project Manager</div>
                      <div className="font-medium text-sm">{project.projectManagerName}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 border rounded-md">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-xs text-muted-foreground">Foreman</div>
                      <div className="font-medium text-sm">{project.foremanName}</div>
                    </div>
                  </div>
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
                    className="font-medium text-sm text-primary hover:underline"
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
                    className="text-xs text-primary hover:underline"
                  >
                    {client.email}
                  </a>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <a href={`tel:${client.phone}`} className="text-xs text-primary hover:underline">
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
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payment Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment Progress Summary */}
            <div className="p-3 bg-muted/50 rounded-md border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Payment Progress</span>
                <span className="text-sm font-bold">{paymentProgressPercentage}%</span>
              </div>
              <Progress value={paymentProgressPercentage} className="h-2" />
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>Received: {formatCurrency((project.totalValue * paymentProgressPercentage) / 100)}</span>
                <span>Remaining: {formatCurrency((project.totalValue * (100 - paymentProgressPercentage)) / 100)}</span>
              </div>
            </div>

            {/* Payment Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-sm">Deposit</div>
                  <div className="text-xs text-muted-foreground">
                    {payments.deposit.percentage}% · {formatCurrency(payments.deposit.amount)}
                  </div>
                </div>
                <Checkbox
                  checked={payments.deposit.paid}
                  onCheckedChange={(checked) => handlePaymentChange('deposit', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-sm">Progress Payment</div>
                  <div className="text-xs text-muted-foreground">
                    {payments.progress.percentage}% · {formatCurrency(payments.progress.amount)}
                  </div>
                </div>
                <Checkbox
                  checked={payments.progress.paid}
                  onCheckedChange={(checked) => handlePaymentChange('progress', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <div className="font-medium text-sm">Final Payment</div>
                  <div className="text-xs text-muted-foreground">
                    {payments.final.percentage}% · {formatCurrency(payments.final.amount)}
                  </div>
                </div>
                <Checkbox
                  checked={payments.final.paid}
                  onCheckedChange={(checked) => handlePaymentChange('final', checked)}
                />
              </div>
            </div>

            {/* Total Summary */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total Contract Value:</span>
                <span className="font-bold">{formatCurrency(project.totalValue)}</span>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cost Attributions
            </DialogTitle>
            <DialogDescription>
              Upload receipts and track actual project costs
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add Receipt Form */}
            <div className="p-3 border rounded-md bg-muted/20">
              <h3 className="font-semibold text-sm mb-3">Add New Receipt</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="dialog-receipt-name" className="text-xs">Receipt Name</Label>
                  <Input
                    id="dialog-receipt-name"
                    placeholder="e.g., Lumber Purchase"
                    value={newReceipt.name}
                    onChange={(e) => setNewReceipt({ ...newReceipt, name: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dialog-receipt-amount" className="text-xs">Amount</Label>
                  <Input
                    id="dialog-receipt-amount"
                    type="number"
                    placeholder="0.00"
                    value={newReceipt.amount}
                    onChange={(e) => setNewReceipt({ ...newReceipt, amount: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="dialog-receipt-category" className="text-xs">Category</Label>
                  <Select
                    value={newReceipt.category}
                    onValueChange={(value: 'material' | 'labor') =>
                      setNewReceipt({ ...newReceipt, category: value })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="labor">Labor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dialog-receipt-note" className="text-xs">Note (optional)</Label>
                  <Input
                    id="dialog-receipt-note"
                    placeholder="Additional info"
                    value={newReceipt.note}
                    onChange={(e) => setNewReceipt({ ...newReceipt, note: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2 mt-3">
                <div className="flex-1">
                  <Label htmlFor="dialog-receipt-file" className="text-xs">Upload Receipt (optional)</Label>
                  <div className="relative">
                    <Input
                      id="dialog-receipt-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="h-8 text-xs"
                    />
                    {newReceipt.fileName && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <FileImage className="h-3 w-3" />
                        {newReceipt.fileName}
                      </span>
                    )}
                  </div>
                </div>
                <Button onClick={handleAddReceipt} size="sm" className="h-8">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Receipts List */}
            {receipts.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Receipts ({receipts.length})</h3>
                <div className="border rounded-md max-h-64 overflow-y-auto">
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
                        {receipt.fileName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <FileImage className="h-3 w-3" />
                            {receipt.fileName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{formatCurrency(receipt.amount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteReceipt(receipt.id)}
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
                from actual receipts
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
    </div>
  );
}