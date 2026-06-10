import { useState, useEffect } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { projectId, publicAnonKey } from "utils/supabase/info";
import { supabase } from "@/lib/supabase";

interface DocuSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Record<string, any>;
  project?: Record<string, any>;
  onSent?: (envelopeId: string) => void;
  /** "contract" (default), "certificate", or "subcontractor" — changes labels, email subject, and auto-selects the matching template */
  documentType?: "contract" | "certificate" | "subcontractor";
  /** For the subcontractor agreement, the signer is the project's foreman (not the client). */
  signerName?: string;
  signerEmail?: string;
}

interface DocuSignTemplate {
  templateId: string;
  name: string;
  description?: string;
}


export function DocuSignDialog({
  open,
  onOpenChange,
  client,
  project,
  onSent,
  documentType = "contract",
  signerName,
  signerEmail,
}: DocuSignDialogProps) {
  const isCertificate = documentType === "certificate";
  const isSubcontractor = documentType === "subcontractor";
  const [templates, setTemplates] = useState<DocuSignTemplate[]>([]);
  const [dbTemplates, setDbTemplates] = useState<{ id: string; name: string; template_id: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [envelopeId, setEnvelopeId] = useState("");
  const [manualTemplateId, setManualTemplateId] = useState("");
  const [docusignConnected, setDocusignConnected] = useState<boolean | null>(null);

  const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();

  // Who signs as the 2nd recipient. Contract/certificate = the client; subcontractor = the foreman.
  const effectiveSignerName  = isSubcontractor ? (signerName ?? "") : (fullName || client.email || "Client");
  const effectiveSignerEmail = isSubcontractor ? (signerEmail ?? "") : client.email;

  // Load templates and check connection on open
  useEffect(() => {
    if (open) {
      loadTemplates();
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/test-connection`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      )
        .then((r) => r.json())
        .then((d) => setDocusignConnected(d.success === true))
        .catch(() => setDocusignConnected(false));
    }
  }, [open]);

  const loadDbTemplates = async () => {
    const { data } = await supabase
      .from("docusign_templates")
      .select("id, name, template_id")
      .eq("is_active", true)
      .order("sort_order");
    setDbTemplates(data ?? []);
  };

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

      if (!response.ok) throw new Error("Failed to load templates");

      const data = await response.json();

      if (data.error) {
        await loadDbTemplates();
        if (data.details?.includes("expired") || data.details?.includes("AUTHORIZATION_INVALID_TOKEN")) {
          setErrorMessage("DocuSign token expired. Showing saved templates as fallback.");
        } else {
          setErrorMessage(`Could not load live templates: ${data.details || data.error}`);
        }
        setStatus("error");
        return;
      }

      const templateList = data.envelopeTemplates || [];
      const mapped = templateList.map((t: any) => ({
        templateId: t.templateId,
        name: t.name,
        description: t.description,
      }));
      setTemplates(mapped);
      // Auto-select the matching template by document type
      if (isCertificate) {
        const match = mapped.find((t: DocuSignTemplate) => /certificate of completion/i.test(t.name));
        if (match) setSelectedTemplate(match.templateId);
      } else if (isSubcontractor) {
        const match = mapped.find((t: DocuSignTemplate) => /subcontractor/i.test(t.name));
        if (match) setSelectedTemplate(match.templateId);
      }
    } catch (error) {
      console.error("Error loading DocuSign templates:", error);
      await loadDbTemplates();
      setErrorMessage("Could not reach DocuSign. Showing saved templates as fallback.");
      setStatus("error");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const sendEnvelope = async () => {
    const templateToUse = manualTemplateId || selectedTemplate;
    if (!templateToUse) return;

    // Validate the 2nd-signer email (client for contract/cert, foreman for subcontractor)
    if (!effectiveSignerEmail) {
      setErrorMessage(isSubcontractor
        ? "Cannot send — the project's foreman has no email address. Assign a foreman with an email first."
        : "Cannot send — client has no email address. Update the client's Contact Info first.");
      setStatus("error");
      return;
    }

    setLoading(true);
    setStatus("sending");
    setErrorMessage("");

    try {
      const requestBody = {
        templateId: templateToUse,
        emailSubject: isCertificate
          ? `Certificate of Completion${project ? ` — ${project.name}` : ""} | Butler & Associates Construction, Inc`
          : isSubcontractor
            ? `Subcontractor Agreement | Butler & Associates Construction, Inc`
            : project
              ? `${project.name} Agreement | Butler & Associates Construction, Inc`
              : `Contract | Butler & Associates Construction, Inc`,
        emailBlurb: isCertificate
          ? `Please review and sign the Certificate of Completion${project ? ` for your ${project.name} project` : ""} with Butler & Associates Construction, Inc.`
          : isSubcontractor
            ? `Please review and sign the Subcontractor Agreement${project ? ` for the ${project.name} project` : ""} with Butler & Associates Construction, Inc.`
            : `Thank you for choosing to partner with Butler & Associates Construction, Inc${project ? ` on your ${project.name} project` : ""}!`,
        clientEmail: effectiveSignerEmail,
        clientName: effectiveSignerName || effectiveSignerEmail || "Signer",

        adminEmail: "info@butlerconstruction.co",
        adminName: "Jonathan Butler",
        // Subcontractor template uses different role names than the client docs
        adminRoleName:  isSubcontractor ? "Owner/General Manager" : "Admin",
        signerRoleName: isSubcontractor ? "Subcontractor" : "Client",
        tabs: {},
        // Carry the document type back so the client page routes the status to the
        // correct columns — avoids fuzzy envelope-id matching.
        returnUrl: `${window.location.origin}/clients/${client.id}?${isCertificate ? "certdocusign" : isSubcontractor ? "subdocusign" : "docusign"}=sent`,
      };

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
      setEnvelopeId(data.envelopeId);

      // Open DocuSign sender view in new tab so admin can fill fields and send
      if (data.senderViewUrl) {
        window.open(data.senderViewUrl, "_blank");
      }

      setStatus("success");
      onSent?.(data.envelopeId);

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
    setManualTemplateId("");
    setErrorMessage("");
    setEnvelopeId("");
    setTemplates([]);
    setDbTemplates([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {isCertificate ? "Send Certificate of Completion" : isSubcontractor ? "Send Subcontractor Agreement" : "Send DocuSign Document"}
          </DialogTitle>
          <DialogDescription>
            {isCertificate
              ? `Send the Certificate of Completion for signature to ${fullName || "the client"}`
              : isSubcontractor
                ? `Send the Subcontractor Agreement for signature to ${effectiveSignerName || "the foreman"}`
                : `Select a template and send for signature to ${fullName || "the client"}`}
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <>
            <DialogBody className="py-4 space-y-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Document Sent Successfully!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    DocuSign has opened in a new tab. Fill in the contract details and click <strong>Send</strong> — DocuSign will then route the contract to both signers automatically.
                  </p>
                </div>
                {envelopeId && (
                  <div className="mt-4 p-3 bg-muted rounded-lg w-full">
                    <div className="text-xs text-muted-foreground">Envelope ID</div>
                    <div className="font-mono text-sm mt-1">{envelopeId}</div>
                  </div>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Sticky banners — outside DialogBody so they don't scroll away */}
            {docusignConnected === false && (
              <div className="pb-2">
                <div className="px-6 py-3 bg-yellow-50 border border-yellow-300 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <strong>DocuSign is not connected.</strong> Go to <a href="/integrations" className="underline font-medium">Integrations</a> and configure DocuSign before sending documents.
                  </div>
                </div>
              </div>
            )}
            {!effectiveSignerEmail && (
              <div className="pb-2">
                <div className="px-6 py-3 bg-red-50 border border-red-300 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">
                    {isSubcontractor ? (
                      <><strong>Cannot send —</strong> the project's foreman has no email on record. Assign a foreman with an email to this project first.</>
                    ) : (
                      <><strong>Cannot send DocuSign —</strong> this client has no email address on record. Go to <a href={`/clients/${client.id}`} className="underline font-medium">Edit Client</a> and add an email first.</>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!isSubcontractor && client.email && !client.address && (
              <div className="pb-2">
                <div className="px-6 py-3 bg-yellow-50 border border-yellow-300 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-800">
                    Client address is missing — the address field in the contract will be blank.
                  </div>
                </div>
              </div>
            )}
            {status === "error" && errorMessage && (
              <div className="pb-2">
                <div className="px-6 py-3 bg-red-50 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">{errorMessage}</div>
                </div>
              </div>
            )}

          <DialogBody className="space-y-6">
            {/* Recipient Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-semibold text-blue-900 mb-2">{isSubcontractor ? "Signer (Foreman)" : "Recipient"}</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Name:</span>
                  <span className="text-sm font-medium text-blue-900">{(isSubcontractor ? effectiveSignerName : fullName) || <span className="text-red-500">Not set</span>}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Email:</span>
                  <span className="text-sm font-medium text-blue-900">{effectiveSignerEmail || <span className="text-red-500">Not set</span>}</span>
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
                    <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">
                        {dbTemplates.length > 0
                          ? "Live DocuSign fetch unavailable — showing your saved templates."
                          : "No templates found. Add templates in Admin → List Management → DocuSign Templates, or enter an ID manually below."}
                      </p>
                    </div>

                    {/* DB saved templates dropdown */}
                    {dbTemplates.length > 0 && (
                      <Select
                        value={selectedTemplate}
                        onValueChange={(value) => { setSelectedTemplate(value); setManualTemplateId(""); }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a saved template" />
                        </SelectTrigger>
                        <SelectContent>
                          {dbTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.template_id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Manual fallback — last resort */}
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-template-id" className="text-sm">
                        {dbTemplates.length > 0 ? "Or enter a different Template ID" : "Template ID"}
                      </Label>
                      <Input
                        id="manual-template-id"
                        value={manualTemplateId}
                        onChange={(e) => { setManualTemplateId(e.target.value); if (e.target.value) setSelectedTemplate(""); }}
                        placeholder="e.g. 04bbe153-e82b-46df-a17e-3edcdaabe071"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Find in DocuSign → Templates → click template → copy UUID from URL.
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


          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={sendEnvelope}
              disabled={(!selectedTemplate && !manualTemplateId) || loading || !effectiveSignerEmail || docusignConnected === false}
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
          </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}