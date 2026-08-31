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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Mail, Send, Loader2, Eye, Paperclip, Bold, Italic, Link, Unlink, Check, X, List, ListOrdered } from "lucide-react";
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
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "[Date]";
    const parsed = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
    return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  const startDate = fmtDate(client.project_start_date ?? client.projects?.[0]?.start_date);
  const endDate = fmtDate(client.project_end_date ?? client.projects?.[0]?.end_date);

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
            .replace(/\{address\}/g, clientAddress || "[Address]")
            .replace(/\{start_date\}/g, startDate)
            .replace(/\{end_date\}/g, endDate),
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
      // Normalize: if template body is plain text (no HTML tags), convert \n → <br>
      const htmlBody = template.body.includes("<") ? template.body : template.body.replace(/\n/g, "<br>");
      setBody(htmlBody);
      if (bodyRef.current) bodyRef.current.innerHTML = htmlBody;
    }
  };

  const bodyRef = useRef<HTMLDivElement>(null);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (bodyRef.current) document.execCommand("defaultParagraphSeparator", false, "div");
  }, [open]);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
    if (bodyRef.current) setBody(bodyRef.current.innerHTML);
  };

  const execListCmd = (type: "bullet" | "numbered") => {
    if (!bodyRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const tag = type === "bullet" ? "ul" : "ol";

    // Walk up from selection anchor to find an existing list inside the editor
    let existingList: HTMLElement | null = null;
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node && node !== bodyRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "UL" || el.tagName === "OL") { existingList = el; break; }
      }
      node = node.parentNode;
    }

    if (existingList) {
      if (existingList.tagName.toLowerCase() === tag) {
        // Same type clicked → remove list, put items back as <br>-separated text
        const fragment = document.createDocumentFragment();
        Array.from(existingList.querySelectorAll("li")).forEach((li, i, arr) => {
          const span = document.createElement("span");
          span.innerHTML = li.innerHTML;
          fragment.appendChild(span);
          if (i < arr.length - 1) fragment.appendChild(document.createElement("br"));
        });
        existingList.parentNode?.replaceChild(fragment, existingList);
      } else {
        // Different type clicked → switch ul↔ol, keep all items
        const newList = document.createElement(tag);
        newList.style.cssText = "margin:8px 0;padding-left:20px;";
        while (existingList.firstChild) newList.appendChild(existingList.firstChild);
        existingList.parentNode?.replaceChild(newList, existingList);
      }
      setBody(bodyRef.current.innerHTML);
      bodyRef.current.focus();
      return;
    }

    // No existing list — build one from the selection
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const lines = sel.toString()
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const items = lines.map((l) => `<li>${l}</li>`).join("");
    document.execCommand("insertHTML", false, `<${tag} style="margin:8px 0;padding-left:20px;">${items}</${tag}>`);

    // Remove the empty <div><br></div> the browser appends after the list
    const empties = bodyRef.current.querySelectorAll("ul + div, ol + div");
    empties.forEach((el) => { if (el.innerHTML.trim() === "<br>" || el.innerHTML.trim() === "") el.remove(); });

    setBody(bodyRef.current.innerHTML);
    bodyRef.current.focus();
  };


  const handleLinkButtonClick = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl("");
    setLinkInputOpen(true);
  };

  const handleConfirmLink = () => {
    if (!linkUrl.trim()) { setLinkInputOpen(false); return; }
    const sel = window.getSelection();
    if (savedRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    execCmd("createLink", linkUrl.trim());
    setLinkInputOpen(false);
    setLinkUrl("");
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
      await Promise.all([
        document.fonts.ready,
        ...imgs.map((img) => new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) { resolve(); return; }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })),
      ]);

      const SCALE = 3;
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
            body2El = q("proposal-page-body-2"), body3El = q("proposal-page-body-3"),
            ftrEl = q("proposal-page-footer"), colHdrEl = q("proposal-col-header");
      if (!hdrEl || !body1El || !ftrEl || !colHdrEl) return null;

      // Collect group positions before html2canvas (DOM layout is still intact)
      const body1Rect = body1El.getBoundingClientRect();
      const groupStartsPx: number[] = Array.from(
        body1El.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>
      ).map((el) => Math.round((el.getBoundingClientRect().top - body1Rect.top) * SCALE));

      const groupStartsPx2: number[] = body2El ? Array.from(
        body2El.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>
      ).map((el) => Math.round((el.getBoundingClientRect().top - body2El.getBoundingClientRect().top) * SCALE)) : [];

      const groupStartsPx3: number[] = body3El ? Array.from(
        body3El.querySelectorAll("[data-group]") as NodeListOf<HTMLElement>
      ).map((el) => Math.round((el.getBoundingClientRect().top - body3El.getBoundingClientRect().top) * SCALE)) : [];

      // Capture header/footer/body1/colHeader first so we can size body2 to fill the page slot
      const [hdrC, body1C, ftrC, colC] = await Promise.all([
        html2canvas(hdrEl,    { ...opts, backgroundColor: "#0A0A0A" }),
        html2canvas(body1El,  { ...opts, backgroundColor: "#ffffff" }),
        html2canvas(ftrEl,    { ...opts, backgroundColor: "#0A0A0A" }),
        html2canvas(colHdrEl, { ...opts, backgroundColor: "#F8F8F6" }),
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

      const [body2C, body3C] = await Promise.all([
        body2El ? html2canvas(body2El, { ...opts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
        body3El ? html2canvas(body3El, { ...opts, backgroundColor: "#ffffff" }) : Promise.resolve(null),
      ]);

      const hImg = hdrC.toDataURL("image/jpeg", 0.97);
      const fImg = ftrC.toDataURL("image/jpeg", 0.97);
      const colImg = colC.toDataURL("image/jpeg", 0.97);

      const slice = (src: HTMLCanvasElement, yPx: number, hPx: number) => {
        const h = Math.max(1, Math.min(hPx, src.height - yPx));
        const out = document.createElement("canvas");
        out.width = src.width; out.height = h;
        out.getContext("2d")!.drawImage(src, 0, yPx, src.width, h, 0, 0, src.width, h);
        return out;
      };

      const findSafeCutPx = (src: HTMLCanvasElement, desiredPx: number, searchBackPx: number): number => {
        if (desiredPx >= src.height) return src.height;
        const ctx = src.getContext("2d")!;
        const stripW = 120, stripX = Math.floor((src.width - stripW) / 2);
        const scanTop = Math.max(0, desiredPx - searchBackPx);
        const scanH = desiredPx - scanTop;
        if (scanH <= 1) return desiredPx;
        const { data } = ctx.getImageData(stripX, scanTop, stripW, scanH);
        for (let dy = scanH - 1; dy >= 0; dy--) {
          let clear = true;
          for (let x = 0; x < stripW; x += 6) {
            const i = (dy * stripW + x) * 4;
            if (data[i] < 195 || data[i + 1] < 195 || data[i + 2] < 195) { clear = false; break; }
          }
          if (clear) return scanTop + dy;
        }
        return desiredPx;
      };

      const renderPages = (bodyC: HTMLCanvasElement, showCol: boolean, startPage: number, groups: number[] = groupStartsPx): number => {
        const bodyH = toPt(bodyC);
        let consumed = 0, pageIdx = startPage;
        while (consumed < bodyH - 1) {
          if (pageIdx > 0) pdf.addPage();
          const isFirst = pageIdx === startPage;
          const avail = (!isFirst && showCol) ? slotCol : slotFull;
          const remaining = bodyH - consumed;
          let sliceH: number;
          if (remaining <= avail + 1) {
            sliceH = remaining;
          } else {
            const consumedPx  = Math.round(consumed * pxPerPt);
            const idealCutPx  = consumedPx + Math.round(avail * pxPerPt);
            const groupEndsE  = groups.map((_, i) =>
              i + 1 < groups.length ? groups[i + 1] : bodyC.height
            );
            const splitIdxE   = groups.findIndex(
              (start, i) => idealCutPx > start && idealCutPx < groupEndsE[i]
            );
            const orphanZonePx = Math.round(75 * pxPerPt);
            const orphanedE   = groups
              .filter((g) => g >= idealCutPx - orphanZonePx && g < idealCutPx)
              .sort((a, b) => a - b)[0];
            const cutBeforeE  = splitIdxE !== -1 ? groups[splitIdxE] : orphanedE;
            let safeCutPx: number;
            if (cutBeforeE !== undefined && cutBeforeE > consumedPx + Math.round(avail * 0.3 * pxPerPt)) {
              safeCutPx = findSafeCutPx(bodyC, cutBeforeE - 2, Math.round(30 * pxPerPt));
            } else {
              safeCutPx = findSafeCutPx(bodyC, idealCutPx, Math.round(90 * pxPerPt));
            }
            sliceH = Math.max((safeCutPx - consumedPx) / pxPerPt, avail * 0.3);
          }
          const sc = slice(bodyC, Math.round(consumed * pxPerPt), Math.round(sliceH * pxPerPt));
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, pageH, "F");
          pdf.addImage(hImg, "JPEG", 0, 0, pageW, hdrH);
          let bodyY = hdrH + PAD;
          if (!isFirst && showCol) { pdf.addImage(colImg, "JPEG", colX, hdrH + PAD, colW, colH); bodyY = hdrH + PAD + colH + COL_GAP; }
          pdf.addImage(sc.toDataURL("image/jpeg", 0.96), "JPEG", 0, bodyY, pageW, sliceH);
          pdf.addImage(fImg, "JPEG", 0, pageH - ftrH, pageW, ftrH);
          consumed += sliceH; pageIdx++;
        }
        return pageIdx;
      };

      const p1 = renderPages(body1C, true, 0);
      const p2 = body2C ? renderPages(body2C, false, p1, groupStartsPx2) : p1;
      if (body3C) renderPages(body3C, false, p2, groupStartsPx3);
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
          <div style="font-family:Inter,sans-serif;font-size:14px;color:#3A3A38;line-height:1.7;margin:0 0 28px 0;">
            <style>ul{margin:8px 0;padding-left:20px;}ol{margin:8px 0;padding-left:20px;}li{margin:4px 0;}a{color:#BB984D;}</style>
            ${body.includes("<") ? body : body.replace(/\n/g, "<br>")}
          </div>
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
        body: { to: client.email, subject, html, from_name: "Butler & Associates Construction", attachments, cc: ["info@butlerconstruction.co"] },
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
    if (bodyRef.current) bodyRef.current.innerHTML = "";
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
            <Label>Message <span className="text-destructive">*</span></Label>
            <div className={`rounded-md border bg-background ${(sendTouched || fieldTouched.body) && bodyErr ? "border-red-500" : "border-input"}`}>
              {/* Toolbar */}
              <div className="border-b">
                <div className="flex items-center gap-0.5 px-2 py-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execListCmd("bullet"); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Bullet list"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execListCmd("numbered"); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Numbered list"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleLinkButtonClick(); }}
                    className={`p-1.5 rounded transition-colors ${linkInputOpen ? "bg-muted text-primary" : "hover:bg-muted"}`}
                    title="Insert link"
                  >
                    <Link className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execCmd("unlink"); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Remove link"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </div>
                {linkInputOpen && (
                  <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
                    <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleConfirmLink(); } if (e.key === "Escape") { setLinkInputOpen(false); } }}
                      placeholder="https://example.com"
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmLink}
                      className="p-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      title="Apply link"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkInputOpen(false)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {/* Editable area */}
              <div
                ref={bodyRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => { if (bodyRef.current) setBody(bodyRef.current.innerHTML); }}
                onBlur={() => setFieldTouched((p) => ({ ...p, body: true }))}
                className="min-h-[280px] px-3 py-2 text-sm font-['Lato',sans-serif] leading-relaxed focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
                style={{ whiteSpace: "pre-wrap" }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  const anchor = target.closest("a");
                  if (anchor?.href) { e.preventDefault(); window.open(anchor.href, "_blank", "noopener,noreferrer"); }
                }}
              />
            </div>
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
          <Button onClick={handleSend} disabled={sending || !client.email} className="min-w-[120px]">
            <span className="flex items-center gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending..." : "Send Email"}
            </span>
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