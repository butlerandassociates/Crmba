import { useState } from "react";
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
import { Mail, Send } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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

  const templates: EmailTemplate[] = [
    {
      id: "follow-up-1",
      name: "Initial Follow Up",
      subject: `Following Up - Butler & Associates Construction`,
      body: `Hi ${firstName},

I hope this email finds you well! I wanted to reach out and follow up regarding the project we discussed.

At Butler & Associates Construction, we're committed to delivering exceptional quality and service. I'd love to schedule a time to go over the details and answer any questions you might have.

Are you available for a brief call this week? I'm flexible and happy to work around your schedule.

Looking forward to hearing from you!

Best regards,
Butler & Associates Construction Team
Phone: (555) 123-4567
Email: info@butlerassociates.com`,
    },
    {
      id: "follow-up-2",
      name: "Second Follow Up",
      subject: `Checking In - Your Project with Butler & Associates`,
      body: `Hi ${firstName},

I wanted to circle back with you regarding your upcoming project. I know you're probably busy, but I wanted to make sure I didn't miss you.

We're excited about the opportunity to work with you and bring your vision to life. Our team has extensive experience with projects like yours, and we're confident we can deliver exceptional results.

If you have any questions or concerns, please don't hesitate to reach out. I'm here to help make this process as smooth as possible.

Would next week work for a quick conversation?

Best regards,
Butler & Associates Construction Team
Phone: (555) 123-4567
Email: info@butlerassociates.com`,
    },
    {
      id: "thank-you",
      name: "Thank You - Project Awarded",
      subject: `Thank You for Choosing Butler & Associates Construction!`,
      body: `Hi ${firstName},

Thank you for choosing Butler & Associates Construction for your project! We're thrilled to have the opportunity to work with you and bring your vision to life.

Our team is already preparing to get started, and we're committed to delivering exceptional quality, staying on schedule, and maintaining clear communication throughout the entire process.

Here's what happens next:
• You'll receive your signed contract and project timeline within 24 hours
• Your dedicated Project Manager will reach out to schedule a kickoff meeting
• We'll provide you with access to our client portal for real-time project updates

If you have any questions in the meantime, please don't hesitate to reach out. We're here to ensure this is a smooth and successful experience.

We're excited to get started!

Best regards,
Butler & Associates Construction Team
Phone: (555) 123-4567
Email: info@butlerassociates.com`,
    },
    {
      id: "proposal-sent",
      name: "Proposal Sent",
      subject: `Your Project Proposal - Butler & Associates Construction`,
      body: `Hi ${firstName},

Thank you for the opportunity to provide a proposal for your project. I've attached a detailed proposal that outlines our approach, timeline, and investment.

We've carefully reviewed your requirements and put together a comprehensive plan that we believe will exceed your expectations. Our proposal includes:

• Detailed scope of work
• Itemized pricing breakdown
• Project timeline and milestones
• Our quality guarantee and warranty information

Please take your time reviewing the proposal, and feel free to reach out with any questions. I'm happy to schedule a call to walk through the details together.

This proposal is valid for 30 days. We're excited about the possibility of working with you!

Best regards,
Butler & Associates Construction Team
Phone: (555) 123-4567
Email: info@butlerassociates.com`,
    },
    {
      id: "appointment-confirmation",
      name: "Appointment Confirmation",
      subject: `Appointment Confirmed - Butler & Associates Construction`,
      body: `Hi ${firstName},

This email confirms your appointment with Butler & Associates Construction.

Date: [Please specify]
Time: [Please specify]
Location: [Please specify]

During our meeting, we'll:
• Discuss your project goals and vision
• Review the scope of work in detail
• Answer any questions you may have
• Provide an accurate timeline and estimate

Please bring any inspiration photos, plans, or materials you'd like to discuss. If you need to reschedule, just let me know as soon as possible.

Looking forward to meeting with you!

Best regards,
Butler & Associates Construction Team
Phone: (555) 123-4567
Email: info@butlerassociates.com`,
    },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState(client.email);

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
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template or write custom message" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
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