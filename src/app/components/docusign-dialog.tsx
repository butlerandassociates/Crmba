import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FileSignature, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { projectId, publicAnonKey } from "utils/supabase/info";

interface DocuSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Record<string, any>;
  project?: Record<string, any>;
  onSent?: () => void;
}

interface DocuSignTemplate {
  templateId: string;
  name: string;
  description?: string;
}

interface FieldMapping {
  [key: string]: string;
}

export function DocuSignDialog({
  open,
  onOpenChange,
  client,
  project,
  onSent,
}: DocuSignDialogProps) {
  const [templates, setTemplates] = useState<DocuSignTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [envelopeId, setEnvelopeId] = useState("");
  const [manualTemplateId, setManualTemplateId] = useState("2237778a-4e23-432b-9d5f-8d62074bfd89");
  const [useManualTemplate, setUseManualTemplate] = useState(false);

  // Auto-map CRM fields to DocuSign template fields
  const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  const fieldMapping: FieldMapping = {
    // Client fields
    client_name: fullName,
    client_first_name: client.first_name ?? "",
    client_last_name: client.last_name ?? "",
    client_email: client.email ?? "",
    client_phone: client.phone ?? "",
    client_company: client.company ?? "",
    client_address: client.address ?? "",
    
    // Project fields (if available)
    ...(project && {
      project_name: project.name,
      project_description: project.description,
      project_address: project.clientAddress,
      project_value: project.totalValue.toString(),
      total_value: project.totalValue.toString(),
      contract_amount: project.totalValue.toString(),
      project_start_date: project.startDate,
      start_date: project.startDate,
      project_manager: project.projectManagerName,
      foreman: project.foremanName,
      
      // Financial fields
      total_cost: project.totalCosts.toString(),
      gross_profit: project.grossProfit.toString(),
      profit_margin: project.profitMargin.toString(),
    }),
    
    // Company fields
    company_name: "Butler & Associates Construction, Inc.",
    company_phone: "(555) 123-4567",
    company_email: "info@butlerassociates.com",
    
    // Date fields
    current_date: new Date().toLocaleDateString("en-US"),
    today_date: new Date().toLocaleDateString("en-US"),
  };

  // Load templates on mount
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/templates`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load templates");
      }

      const data = await response.json();
      
      // Check for error response
      if (data.error) {
        // Check if it's a token expiration error
        if (data.details && data.details.includes('expired') || data.details.includes('AUTHORIZATION_INVALID_TOKEN')) {
          setErrorMessage("DocuSign access token has expired. Please refresh your DocuSign token in the admin settings.");
        } else {
          setErrorMessage(`Failed to load templates: ${data.details || data.error}`);
        }
        setStatus("error");
        setLoadingTemplates(false);
        return;
      }
      
      // DocuSign returns templates in envelopeTemplates array
      const templateList = data.envelopeTemplates || [];
      setTemplates(
        templateList.map((t: any) => ({
          templateId: t.templateId,
          name: t.name,
          description: t.description,
        }))
      );
    } catch (error) {
      console.error("Error loading DocuSign templates:", error);
      setErrorMessage("Failed to load templates. Please check your DocuSign configuration.");
      setStatus("error");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const sendEnvelope = async () => {
    const templateToUse = manualTemplateId || selectedTemplate;
    if (!templateToUse) return;

    setLoading(true);
    setStatus("sending");
    setErrorMessage("");

    try {
      // Build template tabs from field mapping
      const textTabs = Object.entries(fieldMapping).map(([tabLabel, value]) => ({
        tabLabel,
        value: value || "",
      }));

      const requestBody = {
        templateId: templateToUse,
        emailSubject: project 
          ? `Contract for ${project.name} - Butler & Associates Construction`
          : `Contract - Butler & Associates Construction`,
        emailBlurb: `Hi ${client.name.split(" ")[0]}, please review and sign the attached contract.`,
        clientEmail: client.email,
        clientName: client.name,
        returnUrl: `${window.location.origin}/clients/${client.id}?docusign=complete`,
        tabs: {
          textTabs,
        },
      };

      console.log("Creating DocuSign embedded envelope with data:", requestBody);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/create-embedded-envelope`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to create envelope");
      }

      const data = await response.json();
      
      // Open DocuSign in new tab
      console.log("Opening DocuSign signing ceremony:", data.signingUrl);
      const docusignWindow = window.open(data.signingUrl, '_blank');
      
      if (!docusignWindow) {
        throw new Error("Popup blocked! Please allow popups for this site.");
      }

      // Store envelope ID and close dialog
      setEnvelopeId(data.envelopeId);
      onOpenChange(false);
      onSent?.();
      console.log("DocuSign envelope created successfully:", data);
      
    } catch (error: any) {
      console.error("Error creating DocuSign envelope:", error);
      setErrorMessage(error.message || "Failed to create document");
      setStatus("error");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setSelectedTemplate("");
    setErrorMessage("");
    setEnvelopeId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Send DocuSign Document
          </DialogTitle>
          <DialogDescription>
            Select a template and send for signature to {client.name}
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-8 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Document Sent Successfully!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {client.name} will receive an email with the document to sign.
                </p>
              </div>
              {envelopeId && (
                <div className="mt-4 p-3 bg-muted rounded-lg w-full">
                  <div className="text-xs text-muted-foreground">Envelope ID</div>
                  <div className="font-mono text-sm mt-1">{envelopeId}</div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Recipient Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-semibold text-blue-900 mb-2">Recipient</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Name:</span>
                  <span className="text-sm font-medium text-blue-900">{client.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Email:</span>
                  <span className="text-sm font-medium text-blue-900">{client.email}</span>
                </div>
                {project && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700">Project:</span>
                    <span className="text-sm font-medium text-blue-900">{project.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Template Selection */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template">DocuSign Template</Label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading templates...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-yellow-900 mb-1">
                            No Templates Found
                          </div>
                          <div className="text-sm text-yellow-800 space-y-1">
                            <p>
                              <strong>Where to find templates:</strong> Your templates should be in your{" "}
                              <strong>production DocuSign account</strong> (not the developer portal).
                            </p>
                            <p className="pt-1">
                              If you have a template ID, enter it below to continue.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual Template ID Input */}
                    <div className="space-y-2">
                      <Label htmlFor="manual-template-id" className="font-semibold">
                        Enter Template ID Manually
                      </Label>
                      <Input
                        id="manual-template-id"
                        value={manualTemplateId}
                        onChange={(e) => {
                          setManualTemplateId(e.target.value);
                          if (e.target.value) {
                            setSelectedTemplate("");
                          }
                        }}
                        placeholder="e.g., 04bbe153-e82b-46df-a17e-3edcdaabe071"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        You can find your template ID in DocuSign → Templates → Click on template → 
                        look for "Template ID" in the URL or template details
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Select 
                      value={selectedTemplate} 
                      onValueChange={(value) => {
                        setSelectedTemplate(value);
                        setManualTemplateId("");
                      }}
                    >
                      <SelectTrigger id="template">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.templateId} value={template.templateId}>
                            <div className="flex flex-col">
                              <span>{template.name}</span>
                              {template.description && (
                                <span className="text-xs text-muted-foreground">
                                  {template.description}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Or manual override */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or use a different template
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manual-template-id-override">Custom Template ID</Label>
                      <Input
                        id="manual-template-id-override"
                        value={manualTemplateId}
                        onChange={(e) => {
                          setManualTemplateId(e.target.value);
                          if (e.target.value) {
                            setSelectedTemplate("");
                          }
                        }}
                        placeholder="Enter a different template ID"
                        className="font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Auto-fill Preview */}
            {(selectedTemplate || manualTemplateId) && (
              <div className="space-y-2">
                <Label>Auto-Fill Fields Preview</Label>
                <div className="p-4 border rounded-lg bg-muted/50 max-h-48 overflow-y-auto">
                  <div className="text-xs space-y-1.5">
                    {Object.entries(fieldMapping)
                      .filter(([_, value]) => value)
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-muted-foreground font-mono min-w-[140px]">
                            {key}:
                          </span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    {Object.entries(fieldMapping).filter(([_, value]) => value).length > 10 && (
                      <div className="text-muted-foreground italic pt-1">
                        + {Object.entries(fieldMapping).filter(([_, value]) => value).length - 10} more fields...
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  These fields will be automatically populated in your DocuSign template
                </p>
              </div>
            )}

            {/* Error Message */}
            {status === "error" && errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button 
                onClick={sendEnvelope} 
                disabled={(!selectedTemplate && !manualTemplateId) || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send for Signature
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}