import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FileText, DollarSign, CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
// import { Input } from "./ui/input";
// import { Label } from "./ui/label";
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
// import { toast } from "sonner";
import { projectId, publicAnonKey } from "utils/supabase/info";
import { useNavigate } from "react-router";

export function Integrations() {
  const navigate = useNavigate();
  const [docusignConnected, setDocusignConnected] = useState(false);
  const [docusignChecking, setDocusignChecking] = useState(true);
  const [quickbooksConnected] = useState(false);
  // QuickBooks — uncomment when building QB integration
  // const [quickbooksDialogOpen, setQuickbooksDialogOpen] = useState(false);
  // const handleQuickbooksConnect = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setQuickbooksConnected(true);
  //   setQuickbooksDialogOpen(false);
  //   toast.success("QuickBooks connected successfully!");
  // };
  // const handleQuickbooksDisconnect = () => {
  //   setQuickbooksConnected(false);
  //   toast.info("QuickBooks disconnected");
  // };

  useEffect(() => {
    checkDocusignConnection();
  }, []);

  const checkDocusignConnection = async () => {
    setDocusignChecking(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/test-connection`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      setDocusignConnected(data.success === true);
    } catch {
      setDocusignConnected(false);
    } finally {
      setDocusignChecking(false);
    }
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
              {docusignChecking ? (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              ) : docusignConnected ? (
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
                  <div className="text-xs text-green-700 mt-1">Token is valid and connected</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href="https://app.docusign.com" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open DocuSign
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/settings")}>
                    Manage
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Configure your DocuSign credentials in Settings to enable digital signatures.
                </div>
                <Button className="w-full" onClick={() => navigate("/settings")}>
                  Configure DocuSign
                </Button>
              </div>
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

            {/* QuickBooks dialog — restore when building QB integration
            {quickbooksConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-900">Integration Active</div>
                  <div className="text-xs text-green-700 mt-1">Last synced: 2 minutes ago</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open QuickBooks
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleQuickbooksDisconnect}>
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
                      <DialogDescription>Enter your QuickBooks API credentials to enable integration.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="qb-client-id">Client ID</Label>
                        <Input id="qb-client-id" placeholder="Enter your client ID" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="qb-client-secret">Client Secret</Label>
                        <Input id="qb-client-secret" type="password" placeholder="Enter your client secret" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="qb-company-id">Company ID</Label>
                        <Input id="qb-company-id" placeholder="Enter your company ID" required />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Found in QuickBooks Developer Portal → Apps → Keys & credentials.
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Connect</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            */}
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              QuickBooks integration coming soon.
            </div>
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
