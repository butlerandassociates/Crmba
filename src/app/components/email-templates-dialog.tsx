import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { supabase } from "@/lib/supabase";
interface EmailTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Record<string, any>;
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

  const handleSend = () => {
    // In production, this would integrate with an email service
    console.log("Sending email:", { to, subject, body });
    alert(`Email sent successfully to ${client.name}!`);
    onOpenChange(false);
    // Reset form
    setSelectedTemplate("");
    setSubject("");
    setBody("");
    setTo(client.email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {client.name}
          </DialogTitle>
          <DialogDescription>
            Choose a template or compose a custom email message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
            />
          </div>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email message..."
              rows={12}
              className="font-['Lato',sans-serif] text-sm"
            />
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
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!to || !subject || !body}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}