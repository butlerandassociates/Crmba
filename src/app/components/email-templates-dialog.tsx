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
  const [to, setTo] = useState(client.email ?? "");

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    supabase
      .from("email_templates")
      .select("id, name, subject, body_html")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const mapped: EmailTemplate[] = (data ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          subject: (t.subject ?? "").replace(/\{client_name\}/g, firstName),
          body: (t.body_html ?? "")
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
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
    </head>
    <body style="margin:0;padding:0;background:#F5F3EF;font-family:Inter,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px 6px 0 0;overflow:hidden;">
          <tr>
            <td bgcolor="#0A0A0A" style="background:#0A0A0A;border-radius:6px 6px 0 0;padding:28px 32px;text-align:center;">
              <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png" alt="Butler &amp; Associates" height="56" style="height:56px;width:auto;display:block;margin:0 auto 14px auto;background:#0A0A0A;" />
              <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0;">Butler &amp; Associates Construction, Inc.</p>
            </td>
          </tr>
        </table>
        <!-- Gold rule -->
        <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);"></div>

        <!-- Body -->
        <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 6px 6px;padding:32px;">
          <p style="font-family:Inter,sans-serif;font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">
            Message from Butler &amp; Associates
          </p>
          <p style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;white-space:pre-line;margin:0 0 28px 0;">${body}</p>
          <p style="font-family:Inter,sans-serif;font-size:12px;color:#3A3A38;opacity:0.65;margin:0;line-height:1.6;">
            Questions? Reply to this email or reach us at
            <a href="tel:2566174691" style="color:#BB984D;text-decoration:none;">(256) 617-4691</a>.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding:20px 0 0 0;">
          <p style="font-family:Inter,sans-serif;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#BB984D;margin:0;">
            Butler &amp; Associates Construction, Inc.
          </p>
          <p style="font-family:Inter,sans-serif;font-size:11px;color:#3A3A38;opacity:0.55;margin:4px 0 0 0;">
            6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
          </p>
        </div>

      </div>
    </body>
    </html>`;

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
      setTo(client.email ?? "");
      setSendTouched(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSelectedTemplate(""); setSubject(""); setBody(""); setTo(client.email ?? ""); } onOpenChange(o); }}>
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