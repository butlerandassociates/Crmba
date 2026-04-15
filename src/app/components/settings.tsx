import { useState } from "react";
import { useAuth } from "../contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import {
  Settings as SettingsIcon,
  FileSignature,
  DollarSign,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Database,
} from "lucide-react";
import { projectId, publicAnonKey } from "utils/supabase/info";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  hint?: string;
  environment?: string;
  accountId?: string;
  templatesFound?: number;
  templates?: Array<{
    id: string;
    name: string;
    description?: string;
    created?: string;
    lastModified?: string;
  }>;
}

export function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.profile?.role === "admin";

  // QuickBooks Settings
  const [quickbooksConfig, setQuickbooksConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("quickbooks_config");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return { clientId: "", clientSecret: "", companyId: "", environment: "sandbox" };
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [dbPing, setDbPing] = useState<"idle" | "checking" | "ok" | "error">("idle");

  const handleQuickBooksSave = async () => {
    setSaving(true);
    setSaveStatus("idle");

    try {
      // In production, these would be saved to Supabase secrets
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Store in localStorage for demo purposes
      localStorage.setItem("quickbooks_config", JSON.stringify(quickbooksConfig));

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error saving QuickBooks config:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDbPing = async () => {
    setDbPing("checking");
    try {
      const { error } = await import("@/lib/supabase").then(({ supabase }) =>
        supabase.from("clients").select("id").limit(1)
      );
      setDbPing(error ? "error" : "ok");
    } catch {
      setDbPing("error");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/test-connection`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      setTestResult(data);
    } catch (error: any) {
      console.error("Error testing DocuSign connection:", error);
      setTestResult({
        success: false,
        error: "Connection test failed",
        details: error.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your integrations and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="docusign" className="space-y-6">
        <TabsList>
          <TabsTrigger value="docusign" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            DocuSign
          </TabsTrigger>
          <TabsTrigger value="quickbooks" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            QuickBooks
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* DocuSign Configuration */}
        <TabsContent value="docusign" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    DocuSign API Configuration
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Configure your DocuSign integration to send documents for e-signature
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-4">Production</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* JWT Private Key explanation */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-blue-900">Authentication: JWT Grant (Private Key)</p>
                <p className="text-xs text-blue-800">
                  This integration uses <strong>DocuSign JWT Grant</strong> authentication. The edge function automatically generates short-lived access tokens using your RSA private key — no manual token management needed.
                </p>
              </div>

              {/* Supabase Secrets required */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-amber-900">Required Supabase Secrets</p>
                <p className="text-xs text-amber-800">
                  All DocuSign credentials are stored server-side in Supabase Secrets — never in the browser. Ensure these are set in your Supabase project:
                </p>
                <div className="text-xs font-mono space-y-1 bg-amber-100 rounded p-2 text-amber-900">
                  <div>DOCUSIGN_INTEGRATION_KEY &nbsp;— your app's Client ID</div>
                  <div>DOCUSIGN_USER_ID &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— API username (impersonation user)</div>
                  <div>DOCUSIGN_ACCOUNT_ID &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— your DocuSign account ID</div>
                  <div>DOCUSIGN_PRIVATE_KEY &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;— RSA private key (PEM format)</div>
                </div>
                <p className="text-xs text-amber-700">
                  Supabase Dashboard → Project Settings → Edge Functions → Secrets
                </p>
              </div>

              {/* Test Connection */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Verifies that the edge function can authenticate with DocuSign using the private key
                </p>
              </div>

              {/* Test Results */}
              {testResult && (
                <div
                  className={`p-4 border rounded-lg ${
                    testResult.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4
                        className={`font-semibold ${
                          testResult.success ? "text-green-900" : "text-red-900"
                        }`}
                      >
                        {testResult.success ? "✅ Connection Successful!" : "❌ Connection Failed"}
                      </h4>
                      {testResult.message && (
                        <p
                          className={`text-sm mt-1 ${
                            testResult.success ? "text-green-800" : "text-red-800"
                          }`}
                        >
                          {testResult.message}
                        </p>
                      )}
                      {testResult.error && (
                        <p className="text-sm mt-1 text-red-800 font-medium">
                          {testResult.error}
                        </p>
                      )}
                      {testResult.details && (
                        <p className="text-sm mt-1 text-red-700">{testResult.details}</p>
                      )}
                      {testResult.hint && (
                        <p className="text-sm mt-2 text-red-800 font-medium">
                          💡 {testResult.hint}
                        </p>
                      )}
                    </div>
                  </div>

                  {testResult.success && (
                    <div className="mt-3 pt-3 border-t border-green-300 space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-green-700 font-medium">Environment:</span>
                          <span className="ml-2 text-green-900">{testResult.environment}</span>
                        </div>
                        <div>
                          <span className="text-green-700 font-medium">Templates Found:</span>
                          <span className="ml-2 text-green-900 font-semibold">
                            {testResult.templatesFound}
                          </span>
                        </div>
                      </div>

                      {testResult.templates && testResult.templates.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-sm text-green-700 font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Available Templates:
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {testResult.templates.map((template) => (
                              <div
                                key={template.id}
                                className="bg-white p-3 rounded border border-green-200"
                              >
                                <div className="font-medium text-sm text-gray-900">
                                  {template.name}
                                </div>
                                {template.description && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {template.description}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1 font-mono">
                                  ID: {template.id}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {testResult.templatesFound === 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-sm text-yellow-800">
                            <strong>No templates found.</strong> You'll need to create templates in
                            your DocuSign production account. Once created, they'll appear here and
                            be available for use in the CRM.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* JWT private key setup guide */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold">Initial setup checklist</h3>
                <div className="text-xs text-muted-foreground space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold min-w-5">1.</span>
                    <span>In DocuSign Admin → Apps and Keys → your app → <strong>Actions → Edit</strong> → ensure <strong>RSA Keypair</strong> is generated and the public key is uploaded</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold min-w-5">2.</span>
                    <span>Grant <strong>impersonation consent</strong> for your User ID — visit:<br/>
                      <code className="bg-muted px-1 py-0.5 rounded break-all">
                        https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
                      </code>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold min-w-5">3.</span>
                    <span>Add all four secrets to Supabase (listed above) — the edge function handles token generation automatically from there</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold min-w-5">4.</span>
                    <span>Click <strong>Test Connection</strong> to confirm everything is working</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QuickBooks Configuration */}
        <TabsContent value="quickbooks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    QuickBooks API Configuration
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Configure your QuickBooks integration for invoicing and accounting
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-4">
                  {quickbooksConfig.environment === "sandbox" ? "Sandbox" : "Production"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment Selection */}
              <div className="space-y-2">
                <Label htmlFor="qb-environment">Environment</Label>
                <Select
                  value={quickbooksConfig.environment}
                  onValueChange={(value) =>
                    setQuickbooksConfig({ ...quickbooksConfig, environment: value })
                  }
                >
                  <SelectTrigger id="qb-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production (Live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show/Hide secrets toggle */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecrets((v) => !v)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  {showSecrets ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSecrets ? "Hide secrets" : "Show secrets"}
                </Button>
              </div>

              {/* Client ID */}
              <div className="space-y-2">
                <Label htmlFor="qb-client-id">Client ID</Label>
                <Input
                  id="qb-client-id"
                  type={showSecrets ? "text" : "password"}
                  placeholder="Enter your QuickBooks Client ID"
                  value={quickbooksConfig.clientId}
                  onChange={(e) =>
                    setQuickbooksConfig({ ...quickbooksConfig, clientId: e.target.value })
                  }
                />
              </div>

              {/* Client Secret */}
              <div className="space-y-2">
                <Label htmlFor="qb-client-secret">Client Secret</Label>
                <Input
                  id="qb-client-secret"
                  type={showSecrets ? "text" : "password"}
                  placeholder="Enter your QuickBooks Client Secret"
                  value={quickbooksConfig.clientSecret}
                  onChange={(e) =>
                    setQuickbooksConfig({ ...quickbooksConfig, clientSecret: e.target.value })
                  }
                />
              </div>

              {/* Company ID */}
              <div className="space-y-2">
                <Label htmlFor="qb-company-id">Company ID (Realm ID)</Label>
                <Input
                  id="qb-company-id"
                  placeholder="e.g., 123456789"
                  value={quickbooksConfig.companyId}
                  onChange={(e) =>
                    setQuickbooksConfig({ ...quickbooksConfig, companyId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Found in QuickBooks → Company Settings or OAuth flow
                </p>
              </div>

              {/* Setup Instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Setup Instructions</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>
                    Create a developer account at{" "}
                    <a
                      href="https://developer.intuit.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      developer.intuit.com
                    </a>
                  </li>
                  <li>Create a new app in the QuickBooks Developer Portal</li>
                  <li>Copy the Client ID and Client Secret</li>
                  <li>Set up OAuth 2.0 redirect URIs</li>
                  <li>Connect your QuickBooks company</li>
                  <li>Copy your Company ID (Realm ID)</li>
                </ol>
              </div>

              {/* Save Status */}
              {saveStatus === "success" && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Configuration saved successfully!
                  </span>
                </div>
              )}

              {saveStatus === "error" && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-red-800 font-medium">
                    Failed to save configuration. Please try again.
                  </span>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleQuickBooksSave} disabled={saving}>
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save QuickBooks Configuration
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Configuration */}
        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Supabase Database
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Connection status and database access
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-4 text-green-700 border-green-300 bg-green-50">
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Project info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-blue-900">Project Details</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 w-20 shrink-0">Project ID</span>
                    <code className="bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-xs font-mono text-blue-900">{projectId}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 w-20 shrink-0">Provider</span>
                    <span className="text-xs text-blue-900">Supabase (PostgreSQL)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 w-20 shrink-0">Auth</span>
                    <span className="text-xs text-blue-900">Row Level Security enabled</span>
                  </div>
                </div>
              </div>

              {/* Live connection check */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Connection Check</p>
                    <p className="text-xs text-amber-700 mt-0.5">Verify the database is reachable from your browser</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDbPing}
                    disabled={dbPing === "checking"}
                    className="h-8 bg-white border-amber-300 text-amber-900 hover:bg-amber-50 shrink-0"
                  >
                    {dbPing === "checking" ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Checking...</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Check Now</>
                    )}
                  </Button>
                </div>

                {dbPing === "idle" && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-amber-200 rounded-lg text-sm text-amber-800">
                    <Database className="h-4 w-4 shrink-0 text-amber-500" />
                    Click "Check Now" to ping the database and confirm it's reachable.
                  </div>
                )}
                {dbPing === "ok" && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-800 font-medium">Database is reachable — all good.</span>
                  </div>
                )}
                {dbPing === "error" && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm text-red-800 font-medium">Connection failed — check your Supabase project status.</span>
                  </div>
                )}
              </div>

              {/* Supabase dashboard link — admin only */}
              {isAdmin && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Admin only — opens the Supabase dashboard. Requires a Supabase account with access to this project.
                  </p>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectId}/database/tables`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                    <Button variant="outline" className="w-full">
                      <Database className="h-4 w-4 mr-2" />
                      View Tables in Supabase Dashboard
                    </Button>
                  </a>
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}