import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  mockProjects,
  mockInvoices,
  mockChangeOrders,
  mockContracts,
  mockPayments,
  mockClients,
} from "../../data/mock-data";
import {
  Calendar,
  DollarSign,
  FileText,
  CreditCard,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

// For demo purposes, we'll use client c1 (John Anderson)
const DEMO_CLIENT_ID = "c1";

export function ClientDashboard() {
  const client = mockClients.find((c) => c.id === DEMO_CLIENT_ID)!;
  const clientProjects = mockProjects.filter((p) => p.clientId === DEMO_CLIENT_ID);
  const clientInvoices = mockInvoices.filter((i) => i.clientId === DEMO_CLIENT_ID);
  const clientChangeOrders = mockChangeOrders.filter((co) => co.clientId === DEMO_CLIENT_ID);
  const clientContracts = mockContracts.filter((c) => c.clientId === DEMO_CLIENT_ID);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "completed":
      case "approved":
      case "signed":
        return "bg-green-500";
      case "sent":
      case "in_progress":
      case "pending":
        return "bg-orange-500";
      case "overdue":
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = clientInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const totalDue = clientInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Welcome, {client.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{client.company}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Butler & Associates Construction
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{clientProjects.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Invoiced
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Balance Due
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalDue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="projects" className="w-full">
          <TabsList>
            <TabsTrigger value="projects">Projects ({clientProjects.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({clientInvoices.length})</TabsTrigger>
            <TabsTrigger value="change-orders">Change Orders ({clientChangeOrders.length})</TabsTrigger>
            <TabsTrigger value="contracts">Contracts ({clientContracts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4 space-y-4">
            {clientProjects.map((project) => (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Project Manager</div>
                      <div className="text-sm font-medium mt-1">{project.projectManagerName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Foreman</div>
                      <div className="text-sm font-medium mt-1">{project.foremanName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Start Date</div>
                      <div className="text-sm font-medium mt-1">{formatDate(project.startDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">End Date</div>
                      <div className="text-sm font-medium mt-1">
                        {project.endDate ? formatDate(project.endDate) : "TBD"}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Total Contract Value</div>
                        <div className="text-lg font-bold mt-1">{formatCurrency(project.totalValue)}</div>
                      </div>
                      <Button variant="outline" size="sm">View Timeline</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Invoice #
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Date
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Due Date
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Status
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Total
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Paid
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Balance
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-accent/50">
                          <td className="p-3">
                            <span className="font-semibold text-sm">{invoice.invoiceNumber}</span>
                          </td>
                          <td className="p-3 text-sm">{formatDate(invoice.invoiceDate)}</td>
                          <td className="p-3 text-sm">{formatDate(invoice.dueDate)}</td>
                          <td className="p-3">
                            <Badge className={`${getStatusColor(invoice.status)} text-xs`}>
                              {invoice.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm font-semibold">{formatCurrency(invoice.total)}</td>
                          <td className="p-3 text-sm text-green-600">{formatCurrency(invoice.amountPaid)}</td>
                          <td className="p-3 text-sm font-semibold text-orange-600">
                            {formatCurrency(invoice.amountDue)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <Download className="h-3 w-3 mr-1" />
                                PDF
                              </Button>
                              {invoice.amountDue > 0 && (
                                <Button size="sm">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="change-orders" className="mt-4 space-y-4">
            {clientChangeOrders.map((co) => (
              <Card key={co.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{co.title}</CardTitle>
                        <Badge className={getStatusColor(co.status)}>{co.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Order #{co.orderNumber} • Requested {formatDate(co.requestDate)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{co.description}</p>
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Original Amount</div>
                      <div className="text-sm font-semibold mt-1">{formatCurrency(co.originalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Change Amount</div>
                      <div className="text-sm font-semibold text-orange-600 mt-1">
                        +{formatCurrency(co.changeAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">New Total</div>
                      <div className="text-sm font-semibold mt-1">{formatCurrency(co.newAmount)}</div>
                    </div>
                  </div>
                  {co.approvedBy && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Approved by {co.approvedBy} on {formatDate(co.approvedDate!)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="contracts" className="mt-4 space-y-4">
            {clientContracts.map((contract) => (
              <Card key={contract.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{contract.title}</CardTitle>
                        <Badge className={getStatusColor(contract.status)}>{contract.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Contract #{contract.contractNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatCurrency(contract.totalValue)}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Start Date</div>
                      <div className="text-sm font-medium mt-1">{formatDate(contract.startDate)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">End Date</div>
                      <div className="text-sm font-medium mt-1">
                        {contract.endDate ? formatDate(contract.endDate) : "TBD"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Signed Date</div>
                      <div className="text-sm font-medium mt-1">
                        {contract.signedDate ? formatDate(contract.signedDate) : "Not signed"}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-2">Terms</div>
                    <p className="text-sm">{contract.terms}</p>
                  </div>
                  <div className="pt-3 border-t">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download Contract
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
