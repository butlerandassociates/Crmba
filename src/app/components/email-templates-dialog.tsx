import { useState, useEffect, useRef } from "react";
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
import { Mail, Send, Loader2, Eye, Paperclip } from "lucide-react";
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
import { ProposalExport } from "./proposal-export";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface EmailTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Record<string, any>;
  proposals?: any[];
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
  proposals = [],
  onSent,
}: EmailTemplatesDialogProps) {
  const firstName = client.first_name ?? client.name?.split(" ")[0] ?? "there";
  const clientAddress = [client.address, client.city, client.state, client.zip].filter(Boolean).join(", ");

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string>("");
  const [proposalReviews, setProposalReviews] = useState<any[]>([]);
  const exportRef = useRef<HTMLDivElement>(null);

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
    // Pre-select the most recent proposal if there is one
    if (proposals.length > 0) {
      const sorted = [...proposals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSelectedProposalId(sorted[0].id);
    }
  }, [open]);

  // Load reviews when a proposal is selected and attachment is checked
  useEffect(() => {
    if (!attachPdf || !selectedProposalId) return;
    supabase
      .from("reviews")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setProposalReviews(data ?? []));
  }, [attachPdf, selectedProposalId]);

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
  const [fieldTouched, setFieldTouched] = useState({ subject: false, body: false });
  const [showPreview, setShowPreview] = useState(false);

  const generatePdfBase64 = async (): Promise<string | null> => {
    const container = exportRef.current;
    if (!container) return null;
    try {
      const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(imgs.map((img) => new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) { resolve(); return; }
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })));

      const SCALE = 2;
      const opts = {
        scale: SCALE, useCORS: true, allowTaint: false, logging: false,
        imageTimeout: 10000, removeContainer: true,
        onclone: (_doc: Document, el: HTMLElement) => {
          const root = el.getRootNode() as Document;
          Array.from(root.querySelectorAll('link[rel="stylesheet"], style')).forEach((s) => s.remove());
          Array.from(root.querySelectorAll('.screen-only')).forEach((s) => (s as HTMLElement).style.display = 'none');
        },
      };

      const q = (id: string) => container.querySelector(`[id="${id}"]`) as HTMLElement | null;
      const hdrEl = q("proposal-page-header"), body1El = q("proposal-page-body"),
            body2El = q("proposal-page-body-2"), ftrEl = q("proposal-page-footer"),
            colHdrEl = q("proposal-col-header");
      if (!hdrEl || !body1El || !body2El || !ftrEl || !colHdrEl) return null;

      const [hdrC, body1C, body2C, ftrC, colC] = await Promise.all([
        html2canvas(hdrEl,    { ...opts, backgroundColor: "#0A0A0A" }),
        html2canvas(body1El,  { ...opts, backgroundColor: "#F5F3EF" }),
        html2canvas(body2El,  { ...opts, backgroundColor: "#F5F3EF" }),
        html2canvas(ftrEl,    { ...opts, backgroundColor: "#0A0A0A" }),
        html2canvas(colHdrEl, { ...opts, backgroundColor: "#0A0A0A" }),
      ]);

      const pdf   = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerPt = body1C.width / pageW;
      const toPt    = (c: HTMLCanvasElement) => c.height / pxPerPt;

      const hdrH = toPt(hdrC), ftrH = toPt(ftrC), colH = toPt(colC);
      const colW = colC.width / pxPerPt, colX = (pageW - colW) / 2;
      const PAD = 10, COL_GAP = 4;
      const slot = pageH - hdrH - ftrH;
      const slotFull = slot - 2 * PAD, slotCol = slot - colH - COL_GAP - 2 * PAD;

      const hImg = hdrC.toDataURL("image/jpeg", 0.93);
      const fImg = ftrC.toDataURL("image/jpeg", 0.93);
      const colImg = colC.toDataURL("image/jpeg", 0.93);

      const slice = (src: HTMLCanvasElement, yPx: number, hPx: number) => {
        const h = Math.max(1, Math.min(hPx, src.height - yPx));
        const out = document.createElement("canvas");
        out.width = src.width; out.height = h;
        out.getContext("2d")!.drawImage(src, 0, yPx, src.width, h, 0, 0, src.width, h);
        return out;
      };

      const renderPages = (bodyC: HTMLCanvasElement, showCol: boolean, startPage: number): number => {
        const bodyH = toPt(bodyC);
        let consumed = 0, pageIdx = startPage;
        while (consumed < bodyH - 1) {
          if (pageIdx > 0) pdf.addPage();
          const isFirst = pageIdx === startPage;
          const avail = (!isFirst && showCol) ? slotCol : slotFull;
          const sliceH = Math.min(avail, bodyH - consumed);
          const sc = slice(bodyC, Math.round(consumed * pxPerPt), Math.round(sliceH * pxPerPt));
          pdf.setFillColor(245, 243, 239);
          pdf.rect(0, 0, pageW, pageH, "F");
          pdf.addImage(hImg, "JPEG", 0, 0, pageW, hdrH);
          let bodyY = hdrH + PAD;
          if (!isFirst && showCol) { pdf.addImage(colImg, "JPEG", colX, hdrH + PAD, colW, colH); bodyY = hdrH + PAD + colH + COL_GAP; }
          pdf.addImage(sc.toDataURL("image/jpeg", 0.92), "JPEG", 0, bodyY, pageW, sliceH);
          pdf.addImage(fImg, "JPEG", 0, pageH - ftrH, pageW, ftrH);
          consumed += sliceH; pageIdx++;
        }
        return pageIdx;
      };

      renderPages(body2C, false, renderPages(body1C, true, 0));
      return pdf.output("datauristring").split(",")[1];
    } catch (err) {
      console.error("PDF generation error:", err);
      return null;
    }
  };

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

  const subjectErr = !subject.trim() ? "Subject is required." : "";
  const bodyErr    = !body.trim() ? "Message is required." : "";

  const handleSend = async () => {
    setSendTouched(true);
    if (subjectErr || bodyErr) return;
    setSending(true);
    try {
      const html = buildEmailHtml();

      let attachments: { content: string; filename: string; type: string; disposition: string }[] | undefined;
      if (attachPdf && selectedProposalId) {
        const pdfBase64 = await generatePdfBase64();
        if (pdfBase64) {
          const proposal = proposals.find((p) => p.id === selectedProposalId);
          const proposalTitle = proposal?.title ?? "Proposal";
          const clientName = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.name || "Client";
          attachments = [{
            content: pdfBase64,
            filename: `${proposalTitle} - ${clientName}.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          }];
        }
      }

      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: client.email, subject, html, from_name: "Butler & Associates Construction", attachments },
      });
      if (error) throw error;
      await activityLogAPI.create({
        client_id: client.id,
        action_type: "email_sent",
        description: `Email sent to ${client.email}: "${subject}"`,
      }).catch(() => {});
      toast.success(`Email sent to ${client.email}`);
      onSent?.();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSelectedTemplate("");
    setSubject("");
    setBody("");
    setSendTouched(false);
    setFieldTouched({ subject: false, body: false });
    setAttachPdf(false);
    setSelectedProposalId("");
    setProposalReviews([]);
  };

  const selectedProposal = proposals.find((p) => p.id === selectedProposalId) ?? null;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {client.first_name || client.name ? `Send Email to ${client.first_name ?? client.name}` : "Send Email"}
          </DialogTitle>
          <DialogDescription>
            Choose a template or compose a custom email message
          </DialogDescription>
        </DialogHeader>

        {/* Sticky banner — no email on file */}
        {!client.email && (
          <div className="pb-2">
            <div className="px-6 py-3 bg-red-50 border border-red-300 text-xs text-red-800">
              <span className="font-semibold">No email on file.</span> Go to <a href={`/clients/${client.id}`} className="underline font-medium">Edit Client</a> and add an email address before sending.
            </div>
          </div>
        )}

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

          {/* To — read only, sourced from client record */}
          <div className="space-y-1.5">
            <Label>To</Label>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {client.email ?? <span className="italic">No email on file</span>}
            </div>
          </div>

          {/* Subject Field */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => setFieldTouched((p) => ({ ...p, subject: true }))}
              placeholder="Email subject"
              className={(sendTouched || fieldTouched.subject) && subjectErr ? "border-red-500" : ""}
            />
            {(sendTouched || fieldTouched.subject) && subjectErr && <p className="text-xs text-red-500">{subjectErr}</p>}
          </div>

          {/* Body Field */}
          <div className="space-y-1.5">
            <Label htmlFor="body">Message <span className="text-destructive">*</span></Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => setFieldTouched((p) => ({ ...p, body: true }))}
              placeholder="Email message..."
              rows={12}
              className={`font-['Lato',sans-serif] text-sm${(sendTouched || fieldTouched.body) && bodyErr ? " border-red-500" : ""}`}
            />
            {(sendTouched || fieldTouched.body) && bodyErr && <p className="text-xs text-red-500">{bodyErr}</p>}
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

          {/* Attach Proposal PDF */}
          {proposals.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attach-pdf-etd"
                  checked={attachPdf}
                  onChange={(e) => setAttachPdf(e.target.checked)}
                  className="h-4 w-4 rounded border cursor-pointer accent-primary"
                />
                <label htmlFor="attach-pdf-etd" className="text-sm cursor-pointer select-none flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Attach Proposal PDF
                </label>
              </div>
              {attachPdf && proposals.length > 1 && (
                <Select value={selectedProposalId} onValueChange={setSelectedProposalId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select proposal to attach" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...proposals]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title ?? "Untitled"} — {p.status}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
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
          <Button onClick={handleSend} disabled={sending || !client.email}>
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

    {/* Off-screen proposal renderer for PDF generation */}
    {attachPdf && selectedProposal && (
      <div
        ref={exportRef}
        style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <ProposalExport proposal={selectedProposal} client={client} reviews={proposalReviews} />
      </div>
    )}
    </>
  );
}