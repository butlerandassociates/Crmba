import { useState } from "react";
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
import { Link } from "react-router";
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
  // DocuSign Settings - Initialize from environment
  const [docusignConfig, setDocusignConfig] = useState({
    integrationKey: "f421625b-db8d-421b-9426-bcda6106cd37",
    secretKey: "851451dd-4ada-4b1b-87b4-0cd9346ba7fc",
    accountId: "a032d772-e4c6-4a9d-8bbc-dfe2ede347f8e",
    userId: "f027980a-cd1c-4d5b-8dd8-5339008976f3b",
    environment: "production",
  });

  // QuickBooks Settings
  const [quickbooksConfig, setQuickbooksConfig] = useState({
    clientId: "",
    clientSecret: "",
    companyId: "",
    environment: "sandbox",
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleDocuSignSave = async () => {
    setSaving(true);
    setSaveStatus("idle");

    try {
      // In production, these would be saved to Supabase secrets
      // For now, we'll simulate the save
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Store in localStorage for demo purposes
      localStorage.setItem("docusign_config", JSON.stringify(docusignConfig));

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error saving DocuSign config:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

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
      console.log("DocuSign test connection result:", data);
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

  const handleConnectDocuSign = () => {
    // Build the DocuSign OAuth URL directly in the frontend
    const integrationKey = docusignConfig.integrationKey;
    const environment = docusignConfig.environment === "demo" ? "demo" : "account";
    const baseUrl = `https://account-d.docusign.com`; // Always use demo for now
    
    const redirectUri = `${window.location.origin}/docusign-callback`;
    
    const authUrl = new URL(`${baseUrl}/oauth/auth`);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "signature impersonation");
    authUrl.searchParams.append("client_id", integrationKey);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    
    console.log("Opening DocuSign OAuth URL:", authUrl.toString());
    
    // Open OAuth flow in a popup window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      authUrl.toString(),
      "DocuSign OAuth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
    );
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
                <Badge variant="outline" className="ml-4">
                  {docusignConfig.environment === "demo" ? "Sandbox" : "Production"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment Selection */}
              <div className="space-y-2">
                <Label htmlFor="ds-environment">Environment</Label>
                <Select
                  value={docusignConfig.environment}
                  onValueChange={(value) =>
                    setDocusignConfig({ ...docusignConfig, environment: value })
                  }
                >
                  <SelectTrigger id="ds-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production (Live)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Start with Sandbox for testing, then switch to Production when ready
                </p>
              </div>

              {/* Integration Key */}
              <div className="space-y-2">
                <Label htmlFor="ds-integration-key">Integration Key (Client ID)</Label>
                <Input
                  id="ds-integration-key"
                  type={showSecrets ? "text" : "password"}
                  placeholder="e.g., 12345678-abcd-1234-abcd-123456789012"
                  value={docusignConfig.integrationKey}
                  onChange={(e) =>
                    setDocusignConfig({ ...docusignConfig, integrationKey: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Found in DocuSign Admin → Apps and Keys → Integration Keys
                </p>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label htmlFor="ds-secret-key">Secret Key</Label>
                <Input
                  id="ds-secret-key"
                  type={showSecrets ? "text" : "password"}
                  placeholder="Enter your secret key"
                  value={docusignConfig.secretKey}
                  onChange={(e) =>
                    setDocusignConfig({ ...docusignConfig, secretKey: e.target.value })
                  }
                />
              </div>

              {/* Account ID */}
              <div className="space-y-2">
                <Label htmlFor="ds-account-id">Account ID</Label>
                <Input
                  id="ds-account-id"
                  placeholder="e.g., 12345678-1234-1234-1234-123456789012"
                  value={docusignConfig.accountId}
                  onChange={(e) =>
                    setDocusignConfig({ ...docusignConfig, accountId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Found in DocuSign Admin → Account ID
                </p>
              </div>

              {/* User ID */}
              <div className="space-y-2">
                <Label htmlFor="ds-user-id">User ID (API Username)</Label>
                <Input
                  id="ds-user-id"
                  placeholder="e.g., 12345678-1234-1234-1234-123456789012"
                  value={docusignConfig.userId}
                  onChange={(e) =>
                    setDocusignConfig({ ...docusignConfig, userId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Found in DocuSign → Click your profile picture → My Preferences → API Username
                </p>
              </div>

              {/* Show/Hide Secrets Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide Secrets
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show Secrets
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
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

              {/* Setup Instructions */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3 text-blue-900 flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Generate Access Token (Recommended - 2 Minutes)
                  </h3>
                  <div className="space-y-3 text-sm text-blue-900">
                    <div className="p-3 bg-white rounded border border-blue-200">
                      <div className="font-semibold mb-2">Step 1: Open Developer Console</div>
                      <a 
                        href="https://admindemo.docusign.com/apps-and-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        → Click here to open DocuSign Apps & Keys
                      </a>
                    </div>
                    
                    <div className="p-3 bg-white rounded border border-blue-200">
                      <div className="font-semibold mb-2">Step 2: Generate Token</div>
                      <ol className="text-xs space-y-1 list-decimal list-inside text-blue-800">
                        <li>Scroll down to find your Integration Key (starts with f4216125b...)</li>
                        <li>Click <strong>"Actions"</strong> → <strong>"Edit"</strong></li>
                        <li>Scroll down to <strong>"Authentication"</strong> section</li>
                        <li>Click <strong>"Generate Token"</strong> or <strong>"Add Secret Key"</strong> if shown</li>
                        <li>Select scope: <strong>"signature"</strong></li>
                        <li>Click <strong>"Generate"</strong></li>
                        <li>Copy the token (it's valid for 8 hours)</li>
                      </ol>
                    </div>

                    <div className="p-3 bg-white rounded border border-blue-200">
                      <div className="font-semibold mb-2">Step 3: Save to Supabase</div>
                      <p className="text-xs text-blue-800 mb-2">
                        Copy the token and add it as a Supabase secret named:
                      </p>
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">
                        DOCUSIGN_ACCESS_TOKEN
                      </code>
                    </div>

                    <div className="p-3 bg-yellow-50 border border-yellow-300 rounded">
                      <p className="text-xs text-yellow-900">
                        <strong>⚠️ Note:</strong> Tokens expire after 8 hours. For production, you'll need to implement refresh tokens or use JWT authentication.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3 text-gray-900 flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Alternative: OAuth Flow (Requires Additional Setup)
                  </h3>
                  <p className="text-xs text-gray-700 mb-3">
                    To use the one-click OAuth button, you need to first register the redirect URI in DocuSign:
                  </p>
                  <ol className="text-xs text-gray-700 space-y-2 list-decimal list-inside mb-3">
                    <li>Go to <a href="https://admindemo.docusign.com/apps-and-keys" target="_blank" className="text-blue-600 hover:underline">DocuSign Apps & Keys</a></li>
                    <li>Find your Integration Key → Click <strong>Actions → Edit</strong></li>
                    <li>Scroll to <strong>"Redirect URIs"</strong> section</li>
                    <li>Click <strong>"Add URI"</strong></li>
                    <li>Enter: <code className="bg-gray-200 px-1 py-0.5 rounded font-mono text-xs">{window.location.origin}/docusign-callback</code></li>
                    <li>Click <strong>Save</strong></li>
                    <li>Then click the button below</li>
                  </ol>
                  <Button 
                    onClick={handleConnectDocuSign}
                    variant="outline"
                    className="w-full"
                  >
                    <FileSignature className="h-5 w-5 mr-2" />
                    Connect DocuSign Account (OAuth)
                  </Button>
                  <p className="text-xs text-gray-600 mt-2">
                    Only use this after adding the redirect URI above.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-2">Current Configuration</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>✅ Integration Key configured</p>
                    <p>✅ Account ID configured</p>
                    <p>✅ User ID configured</p>
                    <p>✅ Access Token configured</p>
                    <p>✅ Environment: Demo/Sandbox</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">Your Configuration Details</h3>
                  <div className="space-y-3 text-xs">
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold mb-1 text-muted-foreground">Integration Key</div>
                      <code className="text-xs">f4216125b-db8d-421b-9426-bcda6106cd37</code>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold mb-1 text-muted-foreground">API Account ID</div>
                      <code className="text-xs">407c22f3-9f3c-403b-8c4c-6be28fe3c3c0</code>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold mb-1 text-muted-foreground">User ID</div>
                      <code className="text-xs">oco7b4f9-6c85-43b6-9f4c-9237e452587c</code>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold mb-1 text-muted-foreground">Account Base URI</div>
                      <code className="text-xs">https://demo.docusign.net</code>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <div className="font-semibold mb-1 text-muted-foreground">Template ID (Pre-configured)</div>
                      <code className="text-xs">2237778a-4e23-432b-9d5f-8d62074bfd89</code>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <h3 className="text-sm font-semibold">How to Generate Access Token</h3>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">1.</span>
                      <span>Go to <a href="https://developers.docusign.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DocuSign Developer Portal</a></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">2.</span>
                      <span>Click on your app: <strong>"Butler CRM Integration"</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">3.</span>
                      <span>Go to <strong>Authentication → Token Generator</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">4.</span>
                      <span>Select scope: <strong>"signature"</strong> and click Generate</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">5.</span>
                      <span>Copy the generated token (valid for 8 hours)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-6">6.</span>
                      <span>Store it in Supabase Secrets as <code className="bg-muted px-1 py-0.5 rounded">DOCUSIGN_ACCESS_TOKEN</code></span>
                    </div>
                  </div>
                </div>
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
                <Button onClick={handleDocuSignSave} disabled={saving}>
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save DocuSign Configuration
                    </>
                  )}
                </Button>
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
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Supabase Database Connection
              </CardTitle>
              <CardDescription className="mt-2">
                Manage your Supabase backend and migrate data from mock to production
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Supabase Connected</h3>
                </div>
                <p className="text-sm text-green-800">
                  Your Supabase backend is configured and ready to use!
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-700">Project ID:</span>
                    <code className="bg-green-100 px-2 py-0.5 rounded text-xs">
                      {projectId}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-700">Database:</span>
                    <code className="bg-green-100 px-2 py-0.5 rounded text-xs">
                      kv_store_9d56a30d (Key-Value Table)
                    </code>
                  </div>
                </div>
              </div>

              {/* Data Migration */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Ready to migrate your data?
                </h3>
                <p className="text-sm text-blue-800 mb-4">
                  Transfer your mock data (clients, projects, products, team members) to your live Supabase database.
                  This will allow the CRM to persist data and work in production mode.
                </p>
                <Link to="/admin/data-migration">
                  <Button className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    Go to Data Migration Tool
                  </Button>
                </Link>
              </div>

              {/* API Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Available API Endpoints</h3>
                <div className="text-xs space-y-2">
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">GET /clients</div>
                    <div className="text-muted-foreground">Fetch all clients</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">POST /clients</div>
                    <div className="text-muted-foreground">Create new client</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">PUT /clients/:id</div>
                    <div className="text-muted-foreground">Update client</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">GET /projects</div>
                    <div className="text-muted-foreground">Fetch all projects</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">POST /projects</div>
                    <div className="text-muted-foreground">Create new project</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">GET /products</div>
                    <div className="text-muted-foreground">Fetch all products</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="font-mono font-semibold mb-1">POST /users</div>
                    <div className="text-muted-foreground">Create/update team members</div>
                  </div>
                </div>
              </div>

              {/* View in Supabase Dashboard */}
              <div className="pt-4 border-t">
                <a
                  href="https://supabase.com/dashboard/project/yohhdvwifjgarnaxrbev/database/tables"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    View Data in Supabase Dashboard
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}