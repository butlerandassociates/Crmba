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
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Mail, Send, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { supabase } from "@/lib/supabase";
import { activityLogAPI } from "../utils/api";
interface EmailTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Record<string, any>;
  onSent?: () => void;
}


interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export function EmailTemplatesDialog({
  open,
  onOpenChange,
  client,
  onSent,
}: EmailTemplatesDialogProps) {
  const firstName = client.first_name ?? client.name?.split(" ")[0] ?? "there";
  const clientAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(", ");

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState(client.email);

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    supabase
      .from("appointment_types")
      .select("id, name, email_subject, email_body")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        const mapped: EmailTemplate[] = (data ?? [])
          .filter((t) => t.email_subject || t.email_body)
          .map((t) => ({
            id: t.id,
            name: t.name,
            subject: (t.email_subject ?? "").replace("{client_name}", firstName),
            body: (t.email_body ?? "")
              .replace(/\{client_name\}/g, firstName)
              .replace(/\{address\}/g, clientAddress || "[Address]"),
          }));
        setTemplates(mapped);
        setLoadingTemplates(false);
      });
  }, [open]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const [sending, setSending] = useState(false);
  const [sendTouched, setSendTouched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const buildEmailHtml = () => `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#111;">
      <div style="max-width:600px;margin:0 auto;">
        <div style="background:#111;padding:16px 24px;margin-bottom:24px;">
          <span style="color:#fff;font-size:18px;font-weight:bold;">Butler &amp; Associates Construction</span>
        </div>
        <div style="padding:0 24px 32px;">
          <p style="white-space:pre-line;font-size:14px;line-height:1.7;color:#374151;">${body}</p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding:16px 24px;font-size:11px;color:#9ca3af;text-align:center;">
          Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
        </div>
      </div>
    </body></html>`;

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const toErr      = !to.trim() ? "Recipient email is required." : !isValidEmail(to.trim()) ? "Enter a valid email address." : "";
  const subjectErr = !subject.trim() ? "Subject is required." : "";
  const bodyErr    = !body.trim() ? "Message is required." : "";

  const handleSend = async () => {
    setSendTouched(true);
    if (toErr || subjectErr || bodyErr) return;
    setSending(true);
    try {
      const html = buildEmailHtml();
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html, from_name: "Butler & Associates Construction" },
      });
      if (error) throw error;
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "email_sent",
        description: `Email sent to ${to}: "${subject}"`,
      }).catch(() => {});
      toast.success(`Email sent to ${to}`);
      onSent?.();
      onOpenChange(false);
      setSelectedTemplate("");
      setSubject("");
      setBody("");
      setTo(client.email);
      setSendTouched(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {client.name}
          </DialogTitle>
          <DialogDescription>
            Choose a template or compose a custom email message
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Email Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect} disabled={loadingTemplates}>
              <SelectTrigger id="template">
                {loadingTemplates
                  ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading templates...</span>
                  : <SelectValue placeholder="Select a template or write custom message" />
                }
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0
                  ? <SelectItem value="none" disabled>No templates — add them in Admin → List Management</SelectItem>
                  : templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* To Field */}
          <div className="space-y-1.5">
            <Label htmlFor="to">To <span className="text-destructive">*</span></Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              className={sendTouched && toErr ? "border-red-500" : ""}
            />
            {sendTouched && toErr && <p className="text-xs text-red-500">{toErr}</p>}
          </div>

          {/* Subject Field */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className={sendTouched && subjectErr ? "border-red-500" : ""}
            />
            {sendTouched && subjectErr && <p className="text-xs text-red-500">{subjectErr}</p>}
          </div>

          {/* Body Field */}
          <div className="space-y-1.5">
            <Label htmlFor="body">Message <span className="text-destructive">*</span></Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email message..."
              rows={12}
              className={`font-['Lato',sans-serif] text-sm${sendTouched && bodyErr ? " border-red-500" : ""}`}
            />
            {sendTouched && bodyErr && <p className="text-xs text-red-500">{bodyErr}</p>}
          </div>

          {/* Template Preview Info */}
          {selectedTemplate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="font-semibold text-blue-900 mb-1">
                Template Applied: {templates.find((t) => t.id === selectedTemplate)?.name}
              </div>
              <div className="text-blue-700">
                You can edit the subject and message above before sending.
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={!body.trim()}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Branded email preview dialog */}
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent style={{ width: "680px", maxWidth: "95vw" }} className="flex flex-col p-0 gap-0 h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Email Preview
          </DialogTitle>
          <DialogDescription>
            This is exactly what {client.first_name ?? "the client"} will see in their inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg">
          <iframe
            srcDoc={buildEmailHtml()}
            className="w-full h-full border-0"
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}