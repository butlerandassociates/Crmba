import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FileText, DollarSign, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { toast } from "sonner";

export function Integrations() {
  const [docusignConnected, setDocusignConnected] = useState(false);
  const [quickbooksConnected, setQuickbooksConnected] = useState(false);
  const [docusignDialogOpen, setDocusignDialogOpen] = useState(false);
  const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState(false);

  const handleDocusignConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setDocusignConnected(true);
    setDocusignDialogOpen(false);
    toast.success("DocuSign connected successfully!");
  };

  const handleQuickbooksConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickbooksConnected(true);
    setQuickbooksDialogOpen(false);
    toast.success("QuickBooks connected successfully!");
  };

  const handleDocusignDisconnect = () => {
    setDocusignConnected(false);
    toast.info("DocuSign disconnected");
  };

  const handleQuickbooksDisconnect = () => {
    setQuickbooksConnected(false);
    toast.info("QuickBooks disconnected");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">Connect your essential business tools</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DocuSign Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <FileText className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle>DocuSign</CardTitle>
                  <CardDescription>Digital signature management</CardDescription>
                </div>
              </div>
              {docusignConnected ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send, sign, and manage contracts digitally. Streamline your approval process with
              legally binding electronic signatures.
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Send contracts for signature directly from projects</li>
                <li>Track signature status in real-time</li>
                <li>Automatic document storage and archiving</li>
                <li>Template management for recurring contracts</li>
              </ul>
            </div>

            {docusignConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-900">Integration Active</div>
                  <div className="text-xs text-green-700 mt-1">
                    Last synced: Just now
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open DocuSign
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDocusignDisconnect}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Dialog open={docusignDialogOpen} onOpenChange={setDocusignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">Connect DocuSign</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleDocusignConnect}>
                    <DialogHeader>
                      <DialogTitle>Connect DocuSign</DialogTitle>
                      <DialogDescription>
                        Enter your DocuSign API credentials to enable integration.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="docusign-key">API Integration Key</Label>
                        <Input id="docusign-key" placeholder="Enter your integration key" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="docusign-secret">API Secret</Label>
                        <Input
                          id="docusign-secret"
                          type="password"
                          placeholder="Enter your API secret"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="docusign-account">Account ID</Label>
                        <Input id="docusign-account" placeholder="Enter your account ID" required />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        You can find these credentials in your DocuSign Admin console under
                        Integrations → Apps and Keys.
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Connect</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* QuickBooks Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>QuickBooks</CardTitle>
                  <CardDescription>Accounting and invoicing</CardDescription>
                </div>
              </div>
              {quickbooksConnected ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sync your financial data, create invoices, and track payments automatically. Keep
              your books up-to-date with seamless integration.
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Features:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Automatic invoice creation from projects</li>
                <li>Real-time payment tracking and reconciliation</li>
                <li>Expense categorization and reporting</li>
                <li>Financial data synchronization</li>
              </ul>
            </div>

            {quickbooksConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-900">Integration Active</div>
                  <div className="text-xs text-green-700 mt-1">
                    Last synced: 2 minutes ago
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open QuickBooks
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleQuickbooksDisconnect}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Dialog open={quickbooksDialogOpen} onOpenChange={setQuickbooksDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">Connect QuickBooks</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleQuickbooksConnect}>
                    <DialogHeader>
                      <DialogTitle>Connect QuickBooks</DialogTitle>
                      <DialogDescription>
                        Enter your QuickBooks API credentials to enable integration.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="qb-client-id">Client ID</Label>
                        <Input id="qb-client-id" placeholder="Enter your client ID" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="qb-client-secret">Client Secret</Label>
                        <Input
                          id="qb-client-secret"
                          type="password"
                          placeholder="Enter your client secret"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="qb-company-id">Company ID</Label>
                        <Input id="qb-company-id" placeholder="Enter your company ID" required />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        You can find these credentials in your QuickBooks Developer Portal under
                        Apps → Keys & credentials.
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Connect</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integration Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>Overview of all connected services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-red-600" />
                <div>
                  <div className="font-medium">DocuSign</div>
                  <div className="text-sm text-muted-foreground">Digital signatures</div>
                </div>
              </div>
              <Badge className={docusignConnected ? "bg-green-500" : ""} variant={docusignConnected ? "default" : "secondary"}>
                {docusignConnected ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">QuickBooks</div>
                  <div className="text-sm text-muted-foreground">Accounting & invoicing</div>
                </div>
              </div>
              <Badge className={quickbooksConnected ? "bg-green-500" : ""} variant={quickbooksConnected ? "default" : "secondary"}>
                {quickbooksConnected ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
