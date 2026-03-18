import { useState } from "react";
import { useParams, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Download,
  Mail,
  Eye,
  Share2,
} from "lucide-react";
import { mockProposals, mockClients } from "../data/mock-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProposalExport } from "./proposal-export";

export function ProposalDetail() {
  const { id } = useParams();
  const proposal = mockProposals.find((p) => p.id === id);
  const client = proposal ? mockClients.find((c) => c.id === proposal.clientId) : null;
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  if (!proposal || !client) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Proposal not found</h2>
          <Link to="/clients">
            <Button className="mt-4">Back to Clients</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const handleDownload = () => {
    // Create a printable version
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Proposal - ${proposal.title}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; }
              @media print {
                @page { margin: 0.5in; }
              }
            </style>
          </head>
          <body>
            <div id="proposal-content"></div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      const exportElement = document.getElementById("proposal-export-content");
      if (exportElement) {
        printWindow.document.getElementById("proposal-content")!.innerHTML = exportElement.innerHTML;
      }
      printWindow.document.close();
    }
  };

  const handleEmail = () => {
    setShowEmailDialog(true);
    // In a real app, this would send the proposal via email
    console.log("Sending proposal to:", client.email);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/clients/${client.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Client
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{proposal.title}</h1>
              <Badge variant="outline">{proposal.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{client.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Share2 className="h-4 w-4 mr-2" />
                Export to Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Share Proposal</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Email to Client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Proposal Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatDate(proposal.createdAt)}</p>
            <p className="text-xs text-muted-foreground">By {proposal.createdBy}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valid Until</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatDate(proposal.validUntil)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatCurrency(proposal.subtotal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(proposal.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Proposal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input defaultValue={proposal.title} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea defaultValue={proposal.description} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Item
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Quantity
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Unit
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Price/Unit
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Total
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proposal.lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/50">
                    <td className="p-3">
                      <div className="font-medium text-sm">{item.productName}</div>
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        defaultValue={item.quantity}
                        className="w-24"
                      />
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">{item.unit}</span>
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        defaultValue={item.pricePerUnit}
                        className="w-28"
                      />
                    </td>
                    <td className="p-3">
                      <span className="font-semibold">{formatCurrency(item.totalPrice)}</span>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatCurrency(proposal.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (8%)</span>
              <span className="font-semibold">{formatCurrency(proposal.tax)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t">
              <span className="font-bold">Total</span>
              <span className="font-bold text-green-600">{formatCurrency(proposal.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Preview</DialogTitle>
            <DialogDescription>
              This is how the proposal will appear to the client
            </DialogDescription>
          </DialogHeader>
          <ProposalExport proposal={proposal} client={client} />
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Proposal</DialogTitle>
            <DialogDescription>
              Send this proposal directly to {client.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input defaultValue={client.email} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input defaultValue={`Proposal: ${proposal.title}`} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                defaultValue={`Hi ${client.name},\n\nPlease find attached our proposal for your project. We look forward to working with you.\n\nBest regards,\nButler & Associates Construction, Inc.`}
                rows={6}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowEmailDialog(false);
              // In real app, send email here
              alert("Proposal sent successfully!");
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden export content for download */}
      <div className="hidden">
        <div id="proposal-export-content">
          <ProposalExport proposal={proposal} client={client} />
        </div>
      </div>
    </div>
  );
}
