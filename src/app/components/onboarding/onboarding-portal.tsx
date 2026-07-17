import { useState, useEffect, useRef } from "react";
import { useBlocker } from "react-router";
import { supabase } from "@/lib/supabase";
import { notificationsAPI } from "../../api/notifications";
import { useAuth } from "../../contexts/auth-context";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent } from "../ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent as AlertContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  BookOpen, FileText, CheckCircle2, Lock, ChevronRight, ChevronLeft,
  Clock, Trophy, Loader2, Info, Lightbulb, AlertTriangle, Star,
  ArrowLeft, Play, XCircle, FileCheck2, GraduationCap, Download, Eye, Bell,
} from "lucide-react";
import { SkeletonList } from "../ui/page-loader";
import jsPDF from "jspdf";
import baLogoUrl from "@/assets/ba-logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "body"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "callout"; callout_type: "tip" | "info" | "warning"; text: string }
  | { type: "table"; cols: string[]; rows: string[][] }
  | { type: "section_heading"; text: string };

type OBModule = {
  id: string; title: string; tagline: string | null; category: string;
  duration_minutes: number; sort_order: number; is_published: boolean; key_takeaways: string[];
};
type OBSection = { id: string; module_id: string; heading: string; content: ContentBlock[]; sort_order: number };
type OBDocument = {
  id: string; title: string; category: string; is_required: boolean; file_size: string | null;
  effective_date: string | null; description: string | null; content: ContentBlock[]; sort_order: number;
  file_url: string | null;
};
type OBQuestion = {
  id: string; category: string; question: string; options: string[];
  correct_index: number; explanation: string | null; sort_order: number;
};
type ModuleProgress = { module_id: string; status: "not_started" | "in_progress" | "completed"; current_section: number; completed_at: string | null };
type DocAck = { document_id: string; acknowledged_at: string };
type QuizAttempt = {
  id: string; score: number; pct: number; question_count: number; attempt_number: number; completed_at: string;
  answers: Array<{ question_id: string; selected_index: number; correct_index: number; is_correct: boolean }>;
};

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT: Record<string, { bg: string; icon: string; badge: string }> = {
  Company:       { bg: "bg-blue-100 dark:bg-blue-900/30",     icon: "text-blue-600",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  Sales:         { bg: "bg-indigo-100 dark:bg-indigo-900/30", icon: "text-indigo-600", badge: "bg-indigo-100 text-indigo-700" },
  Estimating:    { bg: "bg-amber-100 dark:bg-amber-900/30",   icon: "text-amber-600",  badge: "bg-amber-100 text-amber-700" },
  Proposals:     { bg: "bg-purple-100 dark:bg-purple-900/30", icon: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  Communication: { bg: "bg-teal-100 dark:bg-teal-900/30",    icon: "text-teal-600",   badge: "bg-teal-100 text-teal-700" },
  CRM:           { bg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-600",  badge: "bg-slate-100 text-slate-700" },
  Tools:         { bg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-600",  badge: "bg-slate-100 text-slate-700" },
  HR:            { bg: "bg-rose-100 dark:bg-rose-900/30",     icon: "text-rose-600",   badge: "bg-rose-100 text-rose-700" },
  Compensation:  { bg: "bg-green-100 dark:bg-green-900/30",   icon: "text-green-600",  badge: "bg-green-100 text-green-700" },
  Legal:         { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  Safety:        { bg: "bg-yellow-100 dark:bg-yellow-900/30", icon: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
};
const getCat = (c: string) => CAT[c] ?? { bg: "bg-muted", icon: "text-muted-foreground", badge: "bg-muted text-muted-foreground" };

// ─── Document PDF generator ───────────────────────────────────────────────────

let _baLogo: { dataUrl: string; ratio: number } | null | undefined;
async function loadBaLogo(): Promise<{ dataUrl: string; ratio: number } | null> {
  if (_baLogo !== undefined) return _baLogo;
  try {
    const img = new Image();
    img.src = baLogoUrl;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    _baLogo = { dataUrl: c.toDataURL("image/png"), ratio: img.naturalWidth / img.naturalHeight };
  } catch { _baLogo = null; }
  return _baLogo;
}

function normPdfText(s: string): string {
  return Array.from(s).map(c => {
    const code = c.charCodeAt(0);
    if (code === 0x2018 || code === 0x2019) return "'";
    if (code === 0x201C || code === 0x201D) return '"';
    if (code === 0x2013) return "-";
    if (code === 0x2014) return "--";
    if (code === 0x00A0) return " ";
    if (code === 0x2192) return "->";   // →
    if (code === 0x2190) return "<-";   // ←
    if (code === 0x2022) return "*";    // •
    if (code === 0x2026) return "...";  // …
    return code < 128 ? c : "";
  }).join("");
}

async function buildDocumentPDF(doc: OBDocument): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const ML = 20, MR = 20;
  const CW = W - ML - MR;
  const GOLD: [number, number, number] = [187, 152, 77];
  const BLACK: [number, number, number] = [10, 10, 10];
  const WHITE: [number, number, number] = [255, 255, 255];

  const logo = await loadBaLogo();

  const drawFooter = () => {
    pdf.setFillColor(...GOLD);
    pdf.rect(0, H - 11, W, 11, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...WHITE);
    pdf.text(
      "Butler & Associates Construction, Inc.  ·  6275 University Drive NW, Suite 37-314  ·  Huntsville, AL 35806  ·  (256) 617-4691",
      W / 2, H - 4.5, { align: "center" }
    );
  };

  // Page 1 branded header (matches mileage report style)
  pdf.setFillColor(...BLACK);
  pdf.rect(0, 0, W, 30, "F");
  let textX = ML;
  if (logo) {
    const h = 14, w = h * logo.ratio;
    pdf.addImage(logo.dataUrl, "PNG", ML, 8, w, h);
    textX = ML + w + 5;
  }
  pdf.setTextColor(...WHITE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Butler & Associates Construction, Inc.", textX, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(190, 190, 190);
  pdf.text("6275 University Drive NW, Suite 37-314, Huntsville, AL 35806", textX, 20);
  pdf.text("(256) 617-4691  ·  info@butlerconstruction.co", textX, 25.5);
  pdf.setTextColor(...GOLD);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("ONBOARDING DOCUMENT", W - MR, 14, { align: "right" });
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 30, W, 1.5, "F");

  let y = 40;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 16) { drawFooter(); pdf.addPage(); y = 15; }
  };

  // Category label
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(...GOLD);
  pdf.text(doc.category.toUpperCase(), ML, y); y += 6;

  // Title
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(17); pdf.setTextColor(...BLACK);
  const titleLines = pdf.splitTextToSize(doc.title, CW);
  pdf.text(titleLines, ML, y); y += titleLines.length * 7;

  // Description
  if (doc.description) {
    y += 2;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(90, 90, 90);
    const dl = pdf.splitTextToSize(doc.description, CW);
    pdf.text(dl, ML, y); y += dl.length * 5;
  }

  // Meta line
  y += 3;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(110, 110, 110);
  const metaParts: string[] = [];
  if (doc.effective_date) {
    const d = new Date(doc.effective_date + "T00:00:00");
    metaParts.push(`Effective: ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
  }
  if (doc.file_size) metaParts.push(doc.file_size);
  if (doc.is_required) metaParts.push("★ Required");
  if (metaParts.length) pdf.text(metaParts.join("   ·   "), ML, y);
  y += 6;

  // Rule
  pdf.setDrawColor(210, 210, 210); pdf.setLineWidth(0.3); pdf.line(ML, y, W - MR, y); y += 8;

  // Content blocks
  for (const block of doc.content ?? []) {
    if (block.type === "section_heading") {
      ensureSpace(14);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(...BLACK);
      const lines = pdf.splitTextToSize(normPdfText(block.text), CW);
      pdf.text(lines, ML, y); y += lines.length * 6 + 2;
      pdf.setDrawColor(210, 210, 210); pdf.setLineWidth(0.3); pdf.line(ML, y, W - MR, y); y += 5;

    } else if (block.type === "body") {
      ensureSpace(8);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(40, 40, 40);
      const lines = pdf.splitTextToSize(normPdfText(block.text), CW);
      for (const line of lines) { ensureSpace(5.5); pdf.text(line, ML, y); y += 5.5; }
      y += 3;

    } else if (block.type === "bullets") {
      ensureSpace(8);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(40, 40, 40);
      const bulletW = CW - 10;
      for (const item of block.items) {
        ensureSpace(6);
        pdf.setFillColor(...GOLD); pdf.circle(ML + 2.5, y - 1.5, 1.1, "F");
        const lines = pdf.splitTextToSize(normPdfText(item), bulletW);
        for (let li = 0; li < lines.length; li++) {
          ensureSpace(5.5); pdf.text(lines[li], ML + 7, y); y += 5.5;
        }
        y += 0.5;
      }
      y += 2;

    } else if (block.type === "callout") {
      const prefix = block.callout_type === "tip" ? "Tip: " : block.callout_type === "warning" ? "Note: " : "Info: ";
      const isBoldCallout = block.callout_type === "tip";
      pdf.setFont("helvetica", isBoldCallout ? "bold" : "normal"); pdf.setFontSize(9.5);
      const textX = ML + 8;
      const textW = CW - 12; // jsPDF splitTextToSize in mm mode underestimates Helvetica widths by ~1.35×; empirically CW+50 yields the correct visual wrap width
      const lines = pdf.splitTextToSize(normPdfText(prefix + block.text), textW).map((l: string) => l.trimEnd());
      const lineH = 5.5;
      const boxH = lines.length * lineH + 10;
      ensureSpace(boxH + 4);
      const bgRGB: [number, number, number] = block.callout_type === "warning"
        ? [255, 248, 225] : block.callout_type === "tip" ? [229, 242, 255] : [225, 244, 255];
      const accentRGB: [number, number, number] = block.callout_type === "warning"
        ? [187, 152, 77] : block.callout_type === "tip" ? [59, 130, 246] : [14, 165, 233];
      pdf.setFillColor(...bgRGB); pdf.rect(ML, y, CW, boxH, "F");
      pdf.setFillColor(...accentRGB); pdf.rect(ML, y, 2, boxH, "F");
      pdf.setTextColor(70, 70, 70);
      for (let i = 0; i < lines.length; i++) { pdf.text(lines[i], textX, y + 6 + i * lineH); }
      y += boxH + 8;
    } else if (block.type === "table") {
      const colCount = block.cols.length;
      const colW = CW / Math.max(colCount, 1);
      const rowH = 7;
      const tableH = rowH * (block.rows.length + 1);
      ensureSpace(tableH + 6);
      const tableTop = y;
      pdf.setFillColor(230, 230, 230); pdf.rect(ML, tableTop, CW, rowH, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(...BLACK);
      block.cols.forEach((col, ci) => { pdf.text(String(col).substring(0, 26), ML + ci * colW + 3, tableTop + 5); });
      block.rows.forEach((row, ri) => {
        const rowY = tableTop + rowH * (ri + 1);
        if (ri % 2 === 1) { pdf.setFillColor(248, 248, 248); pdf.rect(ML, rowY, CW, rowH, "F"); }
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(40, 40, 40);
        row.forEach((cell, ci) => { pdf.text(String(cell).substring(0, 26), ML + ci * colW + 3, rowY + 5); });
      });
      pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.4); pdf.rect(ML, tableTop, CW, tableH, "S");
      pdf.setLineWidth(0.2);
      for (let ci = 1; ci < colCount; ci++) { pdf.line(ML + ci * colW, tableTop, ML + ci * colW, tableTop + tableH); }
      for (let ri = 1; ri <= block.rows.length; ri++) { pdf.line(ML, tableTop + ri * rowH, W - MR, tableTop + ri * rowH); }
      y = tableTop + tableH + 6;
    }
  }

  drawFooter();
  return pdf;
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 96, light = false }: { pct: number; size?: number; light?: boolean }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "rgba(255,255,255,0.2)" : "hsl(var(--muted))"} strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? "#fff" : "hsl(var(--primary))"} strokeWidth="10"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

// ─── BlockRenderer ────────────────────────────────────────────────────────────

function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks?.length) return <p className="text-sm text-muted-foreground italic">No content yet.</p>;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "section_heading") return <h3 key={i} className="text-base font-bold border-b pb-2 pt-3 mt-4 first:mt-0">{b.text}</h3>;
        if (b.type === "body") return <p key={i} className="text-sm leading-relaxed">{b.text}</p>;
        if (b.type === "bullets") return (
          <ul key={i} className="space-y-2 pl-1">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2.5 text-sm">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        );
        if (b.type === "callout") {
          const cfg = b.callout_type === "tip"
            ? { cls: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: <Lightbulb className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" /> }
            : b.callout_type === "warning"
            ? { cls: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> }
            : { cls: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800", icon: <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" /> };
          return (
            <div key={i} className={`flex gap-3 border rounded-lg p-4 ${cfg.cls}`}>
              {cfg.icon}<p className="text-sm leading-relaxed min-w-0 break-words text-left">{b.text}</p>
            </div>
          );
        }
        if (b.type === "table") return (
          <div key={i} className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">{b.cols.map((c, j) => <th key={j} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b whitespace-nowrap">{c}</th>)}</tr></thead>
              <tbody className="divide-y">{b.rows.map((row, j) => <tr key={j} className="hover:bg-muted/20">{row.map((cell, k) => <td key={k} className="px-4 py-2.5 text-sm">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        return null;
      })}
    </div>
  );
}

// ─── Scroll-gate hook ─────────────────────────────────────────────────────────

function useScrollGate(key: unknown, skip: boolean) {
  const [ready, setReady] = useState(skip);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (skip) { setReady(true); return; }
    setReady(false);
    const el = ref.current;
    if (!el) return;
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    const root = document.querySelector("main");
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setReady(true); }, { root, threshold: 0.1 });
    obs.observe(el);
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect(), mr = root?.getBoundingClientRect();
      if (mr && r.bottom <= mr.bottom) setReady(true);
    });
    return () => obs.disconnect();
  }, [key, skip]);
  return { ref, ready };
}

// ─── SectionReader ────────────────────────────────────────────────────────────

interface SectionReaderProps {
  module: OBModule; sections: OBSection[]; initialSectionIdx: number; isCompleted: boolean;
  onProgressUpdate: (id: string, status: "in_progress" | "completed", idx: number) => Promise<void>;
  onClose: () => void;
}

function SectionReader({ module, sections, initialSectionIdx, isCompleted, onProgressUpdate, onClose }: SectionReaderProps) {
  const [idx, setIdx] = useState(isCompleted ? 0 : initialSectionIdx);
  const [showTakeaways, setShowTakeaways] = useState(false);
  const [saving, setSaving] = useState(false);
  const { ref: sentinelRef, ready: canProceed } = useScrollGate([idx, showTakeaways], isCompleted);
  const section = sections[idx];
  const isLast = idx === sections.length - 1;
  const cat = getCat(module.category);

  const handleNext = async () => {
    if (isLast) { setShowTakeaways(true); return; }
    if (isCompleted) { setIdx(i => i + 1); return; }
    setSaving(true);
    try { await onProgressUpdate(module.id, "in_progress", idx + 1); setIdx(i => i + 1); }
    finally { setSaving(false); }
  };

  const handleComplete = async () => {
    setSaving(true);
    try { await onProgressUpdate(module.id, "completed", idx); toast.success(`"${module.title}" completed!`); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="py-2">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Modules
        </button>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs border-0 ${cat.badge}`}>{module.category}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{module.duration_minutes} min</span>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-6">{module.title}</h2>

      {showTakeaways ? (
        <div className="max-w-xl mx-auto space-y-5">
          <div className="text-center py-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Module Complete!</h3>
            <p className="text-sm text-muted-foreground mt-1">Key takeaways from <span className="font-medium">{module.title}</span></p>
          </div>
          {module.key_takeaways?.length > 0 && (
            <div className="space-y-3">
              {module.key_takeaways.map((kt, i) => (
                <div key={i} className="flex items-start gap-3 border rounded-xl p-4 bg-card">
                  <Star className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm">{kt}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            {!isCompleted && (
              <Button onClick={handleComplete} disabled={saving} size="lg" className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Complete Module
              </Button>
            )}
            <Button onClick={onClose} variant={isCompleted ? "default" : "outline"} size="lg" className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />Back to Modules
            </Button>
          </div>
          <div ref={sentinelRef} className="h-1" />
        </div>
      ) : (
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-52 shrink-0 hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Sections</p>
            <div className="space-y-1">
              {sections.map((s, i) => {
                const done = i < idx || isCompleted;
                const current = i === idx;
                const canClick = isCompleted || i <= idx;
                return (
                  <button key={s.id} disabled={!canClick} onClick={() => { if (canClick) setIdx(i); }}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      current ? "bg-foreground text-background font-semibold" :
                      done ? "hover:bg-accent text-foreground" : "text-muted-foreground cursor-not-allowed"
                    }`}>
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      done && !current ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      current ? "bg-white/20" : "bg-muted"
                    }`}>
                      {done && !current ? "✓" : i + 1}
                    </span>
                    <span className="truncate leading-snug">{s.heading}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-muted-foreground">Section {idx + 1} of {sections.length}</p>
              <div className="flex gap-1">
                {sections.map((_, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i < idx || isCompleted ? "bg-green-500" : i === idx ? "bg-primary/50" : "bg-muted"}`} />
                ))}
              </div>
            </div>
            <h3 className="text-lg font-bold mb-5">{section?.heading}</h3>
            <BlockRenderer blocks={section?.content ?? []} />
            <div ref={sentinelRef} className="h-4 mt-8" />
            <div className="flex items-center justify-between pt-5 border-t mt-4">
              <Button variant="ghost" size="sm" onClick={() => setIdx(i => i - 1)} disabled={idx === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" />Previous
              </Button>
              {!canProceed && !isCompleted && <p className="text-xs text-muted-foreground">Scroll down to continue</p>}
              <Button size="sm" onClick={handleNext} disabled={!canProceed || saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {isLast ? "Finish" : "Next Section"}<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DocumentReader ───────────────────────────────────────────────────────────

interface DocumentReaderProps {
  doc: OBDocument; isAcknowledged: boolean; ackDate: string | null;
  onAcknowledge: (id: string) => Promise<void>; onClose: () => void;
}

function DocumentReader({ doc, isAcknowledged, ackDate, onAcknowledge, onClose }: DocumentReaderProps) {
  const [saving, setSaving] = useState(false);
  const [pdfOp, setPdfOp] = useState<"view" | "download" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfOpened, setPdfOpened] = useState(false);
  const isPdfOnly = !!doc.file_url && !(doc.content ?? []).length;
  const { ref: sentinelRef, ready: canAck } = useScrollGate(doc.id, isAcknowledged);
  const canAcknowledge = isPdfOnly ? pdfOpened : canAck;
  const cat = getCat(doc.category);

  const handleAck = async () => {
    setSaving(true);
    try { await onAcknowledge(doc.id); }
    finally { setSaving(false); }
  };

  const closePreview = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl.split("#")[0]);
    setPreviewUrl(null);
  };

  const handlePdf = async (op: "view" | "download") => {
    if (doc.file_url) {
      if (op === "view") {
        setPdfOpened(true);
        setPreviewUrl(doc.file_url + "#toolbar=0&navpanes=0&view=FitH");
      } else {
        const link = document.createElement("a");
        link.href = doc.file_url;
        link.setAttribute("download", doc.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".pdf");
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      return;
    }
    setPdfOp(op);
    try {
      const pdf = await buildDocumentPDF(doc);
      if (op === "view") {
        setPreviewUrl(String(pdf.output("bloburl")) + "#toolbar=0&navpanes=0&view=FitH");
      } else {
        pdf.save(doc.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".pdf");
      }
    } finally { setPdfOp(null); }
  };

  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Documents
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {doc.effective_date && (
            <span className="text-xs text-muted-foreground">
              Effective {new Date(doc.effective_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
          {doc.is_required && <Badge className="text-xs bg-red-100 text-red-700 border-0">Required</Badge>}
          <button
            onClick={() => handlePdf("view")}
            disabled={!!pdfOp}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50 no-underline"
          >
            {pdfOp === "view" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}View PDF
          </button>
          <button
            onClick={() => handlePdf("download")}
            disabled={!!pdfOp}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors disabled:opacity-50 no-underline"
          >
            {pdfOp === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download
          </button>
        </div>
      </div>

      <div className="mb-8">
        <Badge className={`text-xs border-0 mb-3 ${cat.badge}`}>{doc.category}</Badge>
        <h2 className="text-2xl font-bold">{doc.title}</h2>
        {doc.description && <p className="text-sm text-muted-foreground mt-2">{doc.description}</p>}
        {(doc.effective_date || doc.file_size) && (
          <p className="text-xs text-muted-foreground mt-2">
            {doc.effective_date && `Effective Date: ${new Date(doc.effective_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            {doc.effective_date && doc.file_size && " · "}{doc.file_size}
          </p>
        )}
      </div>

      {doc.file_url && !(doc.content ?? []).length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">This document is available as a PDF.</p>
          <p className="text-xs text-muted-foreground mt-1">Click <span className="font-medium">View PDF</span> above to read the full document.</p>
        </div>
      ) : (
        <BlockRenderer blocks={doc.content ?? []} />
      )}
      <div ref={sentinelRef} className="h-4 mt-8" />

      <div className="mt-10">
        {isAcknowledged ? (
          <div className="border rounded-xl p-5 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              Acknowledged on {ackDate ? new Date(ackDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
            </span>
          </div>
        ) : (
          <div className="border rounded-xl p-6 bg-card">
            <p className="text-sm text-muted-foreground mb-4">
              By clicking <span className="font-semibold text-foreground">Acknowledge & Mark Reviewed</span>, you confirm that you have read and understood this document.
            </p>
            {!canAcknowledge && <p className="text-xs text-muted-foreground mb-3">{isPdfOnly ? "Open the PDF above to enable this button." : "Scroll to the bottom to enable this button."}</p>}
            <Button onClick={handleAck} disabled={!canAcknowledge || saving} size="lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck2 className="h-4 w-4 mr-2" />}
              Acknowledge & Mark Reviewed
            </Button>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={open => { if (!open) closePreview(); }}>
        <DialogContent
          className="h-[95vh] p-0 overflow-hidden flex flex-col gap-0 [&>button:last-child]:hidden"
          style={{ width: 900, maxWidth: "95vw" }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[#3c3c3c] text-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-white/70 shrink-0" />
              <span className="text-sm font-semibold truncate">{doc.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handlePdf("download")}
                disabled={!!pdfOp}
                className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                {pdfOp === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </button>
              <button onClick={closePreview} className="p-1.5 rounded hover:bg-white/10 transition-colors">
                <XCircle className="h-5 w-5 text-white/70 hover:text-white" />
              </button>
            </div>
          </div>
          <iframe
            src={previewUrl ?? undefined}
            className="flex-1 border-0 w-full"
            title={doc.title}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── QuizSection ──────────────────────────────────────────────────────────────

interface QuizSectionProps {
  questions: OBQuestion[]; attempts: QuizAttempt[]; programId: string; userId: string;
  onAttemptComplete: (a: QuizAttempt) => void;
  onStepChange?: (inProgress: boolean) => void;
}

function QuizSection({ questions, attempts, programId, userId, onAttemptComplete, onStepChange }: QuizSectionProps) {
  type Step = "pre" | "in_progress" | "results";
  const [step, setStep] = useState<Step>("pre");
  const [qIdx, setQIdx] = useState(0);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState<QuizAttempt | null>(null);
  useEffect(() => {
    onStepChange?.(step === "in_progress");
    return () => { onStepChange?.(false); }; // reset when component unmounts or step changes
  }, [step]);

  const MAX = 3, PASS = 90;
  const attCount = attempts.length;
  const bestPct = attCount > 0 ? Math.max(...attempts.map(a => Number(a.pct))) : 0;
  const passed = bestPct >= PASS;
  const locked = attCount >= MAX && !passed;
  const handleStart = () => { setAns({}); setQIdx(0); setLatest(null); setStep("in_progress"); };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const arr = questions.map(q => ({
        question_id: q.id, selected_index: ans[q.id] ?? -1, correct_index: q.correct_index,
        is_correct: (ans[q.id] ?? -1) === q.correct_index,
      }));
      const score = arr.filter(a => a.is_correct).length;
      const pct = Math.round((score / questions.length) * 10000) / 100;
      const { data, error } = await supabase.from("onboarding_quiz_attempts").insert({
        user_id: userId, program_id: programId, question_count: questions.length,
        score, pct, answers: arr, attempt_number: attCount + 1, completed_at: new Date().toISOString(),
      }).select("id, score, pct, question_count, attempt_number, completed_at, answers").single();
      if (error) throw error;
      setLatest(data as QuizAttempt);
      onAttemptComplete(data as QuizAttempt);
      setStep("results");
    } catch { toast.error("Failed to submit. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (step === "pre") {
    return (
      <div className="max-w-2xl space-y-5">
        {attCount > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => {
              const a = attempts[i];
              return (
                <div key={i} className={`border rounded-xl p-4 text-center ${a && Number(a.pct) >= PASS ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-border"}`}>
                  <p className="text-xs text-muted-foreground mb-1">Attempt {i + 1}</p>
                  {a ? <><p className="text-2xl font-bold">{Number(a.pct).toFixed(0)}%</p><p className="text-xs text-muted-foreground">{a.score}/{a.question_count}</p></> : <p className="text-lg text-muted-foreground py-1.5">—</p>}
                </div>
              );
            })}
          </div>
        )}

        {locked ? (
          <div className="border rounded-xl p-10 text-center bg-card">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold">Quiz Locked</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">All 3 attempts used. Contact your manager to reset.</p>
          </div>
        ) : (
          <div className="border rounded-xl p-6 bg-card space-y-5">
            {passed && (
              <div className="flex items-center gap-3 border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200">
                <Trophy className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Passed — {bestPct.toFixed(0)}%</p>
                  <p className="text-xs text-green-700 dark:text-green-500">Retake available to improve your score.</p>
                </div>
              </div>
            )}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5"><Info className="h-4 w-4 shrink-0 text-blue-500" />{questions.length} questions</div>
              <div className="flex items-center gap-2.5"><Trophy className="h-4 w-4 shrink-0 text-amber-500" />90% or higher to pass</div>
              <div className="flex items-center gap-2.5"><Lock className="h-4 w-4 shrink-0 text-muted-foreground" />{MAX - attCount} attempt{MAX - attCount !== 1 ? "s" : ""} remaining</div>
            </div>
            <Button onClick={handleStart} size="lg" className="w-full" disabled={(attCount >= MAX && !passed) || questions.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              {attCount === 0 ? "Start" : "Retry"} Quiz — {questions.length} Questions
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (step === "in_progress") {
    const q = questions[qIdx];
    const sel = ans[q.id];
    const answered = sel !== undefined;
    const last = qIdx === questions.length - 1;
    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Question {qIdx + 1} of {questions.length}</span>
          <Badge variant="outline" className="text-xs">{q.category}</Badge>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${((qIdx + 1) / questions.length) * 100}%` }} />
        </div>
        <h3 className="text-base font-semibold leading-relaxed">{q.question}</h3>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => setAns(p => ({ ...p, [q.id]: i }))}
              className={`w-full text-left border rounded-xl px-4 py-3 text-sm transition-colors ${sel === i ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-accent"}`}>
              <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setQIdx(i => i - 1)} disabled={qIdx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />Back
          </Button>
          {last ? (
            <Button onClick={handleSubmit} disabled={!answered || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit Quiz
            </Button>
          ) : (
            <Button onClick={() => setQIdx(i => i + 1)} disabled={!answered}>
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const display = latest ?? attempts[attempts.length - 1];
  if (!display) return null;
  const didPass = Number(display.pct) >= PASS;
  return (
    <div className="max-w-2xl space-y-5">
      <div className="text-center py-4">
        <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4 ${didPass ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
          {didPass ? <Trophy className="h-8 w-8 text-green-600" /> : <XCircle className="h-8 w-8 text-red-500" />}
        </div>
        <p className="text-3xl font-bold">{Number(display.pct).toFixed(0)}%</p>
        <p className="text-sm text-muted-foreground mt-1">{display.score} of {display.question_count} correct</p>
        <Badge className={`mt-2 ${didPass ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}`}>
          {didPass ? "Passed" : "Not Passed — 90% required"}
        </Badge>
      </div>
      <div className="space-y-3">
        {questions.map(q => {
          const a = (display.answers ?? []).find(x => x.question_id === q.id);
          const ok = a?.is_correct ?? false;
          return (
            <div key={q.id} className={`border rounded-xl p-4 ${ok ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
              <div className="flex items-start gap-3">
                {ok ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">Your answer: <span className={ok ? "text-green-700 font-medium" : "text-red-600 font-medium"}>{a && a.selected_index >= 0 ? q.options[a.selected_index] : "No answer"}</span></p>
                  {!ok && <p className="text-xs text-muted-foreground mt-0.5">Correct: <span className="text-foreground font-medium">{q.options[q.correct_index]}</span></p>}
                  {q.explanation && <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">{q.explanation}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="outline" onClick={() => setStep("pre")} className="w-full">Back to Quiz Overview</Button>
    </div>
  );
}

// ─── OnboardingPortal ─────────────────────────────────────────────────────────

export function OnboardingPortal() {
  const { user } = useAuth();
  const userId = user?.profile?.id ?? null;

  const [program, setProgram] = useState<{ id: string; name: string; description: string; due_date: string | null } | null>(null);
  const [modules, setModules] = useState<OBModule[]>([]);
  const [allSections, setAllSections] = useState<OBSection[]>([]);
  const [documents, setDocuments] = useState<OBDocument[]>([]);
  const [questions, setQuestions] = useState<OBQuestion[]>([]);
  const [progress, setProgress] = useState<ModuleProgress[]>([]);
  const [acks, setAcks] = useState<DocAck[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizLeaveOpen, setQuizLeaveOpen] = useState(false);
  const [pendingNavCb, setPendingNavCb] = useState<(() => void) | null>(null);
  const blocker = useBlocker(quizInProgress);
  const completionCheckDone = useRef(false);
  const alreadyComplete = useRef(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [progRes, modsRes, secsRes, docsRes, qsRes, ptRes, acksRes, attRes] = await Promise.all([
        supabase.from("onboarding_programs").select("id, name, description, due_date").eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("onboarding_modules").select("id, title, tagline, category, duration_minutes, sort_order, is_published, key_takeaways").eq("is_active", true).eq("is_published", true).order("sort_order"),
        supabase.from("onboarding_sections").select("id, module_id, heading, content, sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_documents").select("id, title, category, is_required, file_size, effective_date, description, content, sort_order, file_url").eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_quiz_questions").select("id, category, question, options, correct_index, explanation, sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_module_progress").select("module_id, status, current_section, completed_at").eq("user_id", userId),
        supabase.from("onboarding_document_acknowledgments").select("document_id, acknowledged_at").eq("user_id", userId),
        supabase.from("onboarding_quiz_attempts").select("id, score, pct, question_count, attempt_number, completed_at, answers").eq("user_id", userId).order("attempt_number"),
      ]);
      setProgram(progRes.data ?? null);
      setModules(modsRes.data ?? []);
      setAllSections(secsRes.data ?? []);
      setDocuments(docsRes.data ?? []);
      setQuestions(qsRes.data ?? []);
      setProgress(ptRes.data ?? []);
      setAcks(acksRes.data ?? []);
      setQuizAttempts(attRes.data ?? []);
      setLoading(false);
    })();
  }, [userId]);

  useEffect(() => {
    if (blocker.state === "blocked") setQuizLeaveOpen(true);
  }, [blocker.state]);

  useEffect(() => {
    if (!quizInProgress) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [quizInProgress]);

  const getMP = (mid: string): ModuleProgress =>
    progress.find(p => p.module_id === mid) ?? { module_id: mid, status: "not_started", current_section: 0, completed_at: null };
  const isUnlocked = (i: number) => i === 0 || getMP(modules[i - 1]?.id ?? "").status === "completed";
  const isAcked = (id: string) => acks.some(a => a.document_id === id);
  const getAckDate = (id: string) => acks.find(a => a.document_id === id)?.acknowledged_at ?? null;

  const completedMods = modules.filter(m => getMP(m.id).status === "completed").length;
  const totalDocs = documents.length;
  const docIdSet = new Set(documents.map(d => d.id));
  const ackedDocs = acks.filter(a => docIdSet.has(a.document_id)).length;
  const bestQ = quizAttempts.length > 0 ? Math.max(...quizAttempts.map(a => Number(a.pct))) : 0;
  const quizPassed = bestQ >= 90;
  const estMinLeft = modules.filter(m => getMP(m.id).status !== "completed").reduce((s, m) => s + m.duration_minutes, 0);
  const overallPct = (() => {
    let total = 20, earned = quizPassed ? 20 : 0;
    if (modules.length > 0) { total += 50; earned += (completedMods / modules.length) * 50; }
    if (totalDocs > 0)      { total += 30; earned += (ackedDocs / totalDocs) * 30; }
    return Math.round((earned / total) * 100);
  })();
  const nextModule = modules.find((m, i) => isUnlocked(i) && getMP(m.id).status !== "completed");
  const formatTime = (m: number) => m <= 0 ? "Done!" : m < 60 ? `${m}m` : `~${(m / 60).toFixed(1)} hrs`;

  const handleProgressUpdate = async (mid: string, status: "in_progress" | "completed", secIdx: number) => {
    if (!userId) return;
    const { error } = await supabase.from("onboarding_module_progress").upsert(
      { user_id: userId, module_id: mid, status, current_section: secIdx, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) },
      { onConflict: "user_id,module_id" }
    );
    if (error) { toast.error("Progress could not be saved. Please check your connection."); throw error; }
    setProgress(prev => {
      const i = prev.findIndex(p => p.module_id === mid);
      const upd: ModuleProgress = { module_id: mid, status, current_section: secIdx, completed_at: status === "completed" ? new Date().toISOString() : null };
      if (i >= 0) { const a = [...prev]; a[i] = upd; return a; }
      return [...prev, upd];
    });
  };

  const handleAcknowledge = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("onboarding_document_acknowledgments").insert({ user_id: userId, document_id: id });
    if (!error) { setAcks(p => [...p, { document_id: id, acknowledged_at: new Date().toISOString() }]); toast.success("Document acknowledged."); }
    else toast.error("Failed to acknowledge.");
  };

  useEffect(() => {
    if (!loading && !completionCheckDone.current) {
      completionCheckDone.current = true;
      alreadyComplete.current = overallPct >= 100;
    }
  }, [loading, overallPct]);

  useEffect(() => {
    if (!completionCheckDone.current || alreadyComplete.current || loading) return;
    if (overallPct >= 100) {
      alreadyComplete.current = true;
      notificationsAPI.create({
        type: "onboarding_completed",
        title: "Onboarding Complete",
        message: `${user?.profile?.first_name ?? "A team member"} completed their onboarding training.`,
        link: "/admin/onboarding",
        recipient_id: null,
      }).catch(() => {});
    }
  }, [overallPct]);

  const switchTab = (t: string) => {
    if (quizInProgress) {
      setPendingNavCb(() => () => { setActiveTab(t); setSelectedModuleId(null); setSelectedDocId(null); });
      setQuizLeaveOpen(true);
      return;
    }
    setActiveTab(t); setSelectedModuleId(null); setSelectedDocId(null);
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8"><SkeletonList rows={6} /></div>;

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "modules", label: "Training Modules" },
    { id: "documents", label: "Documents" },
    { id: "quiz", label: "Quiz" },
  ];

  const inModuleReader = !!(selectedModuleId && activeTab === "modules");
  const inDocReader = !!(selectedDocId && activeTab === "documents");

  return (
    <div>
      {/* Sticky header with underline tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-0">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            <GraduationCap className="h-6 w-6 shrink-0" />{program?.name ?? "Sales Onboarding"}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">{program?.description ?? "Complete your training to get started with the team."}</p>
          <div className="flex gap-6 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)}
                className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Module reader */}
        {inModuleReader && (() => {
          const mod = modules.find(m => m.id === selectedModuleId);
          if (!mod) { setSelectedModuleId(null); return null; }
          const secs = allSections.filter(s => s.module_id === selectedModuleId).sort((a, b) => a.sort_order - b.sort_order);
          if (secs.length === 0) return (
            <div className="text-center py-16 border rounded-xl">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No sections yet</p>
              <p className="text-xs text-muted-foreground mt-1">This module has no content yet. Check back later.</p>
              <button onClick={() => setSelectedModuleId(null)} className="mt-4 text-xs underline text-muted-foreground">&larr; Back to Modules</button>
            </div>
          );
          const prog = getMP(selectedModuleId);
          return <SectionReader module={mod} sections={secs} initialSectionIdx={prog.current_section} isCompleted={prog.status === "completed"} onProgressUpdate={handleProgressUpdate} onClose={() => setSelectedModuleId(null)} />;
        })()}

        {/* Doc reader */}
        {inDocReader && (() => {
          const doc = documents.find(d => d.id === selectedDocId);
          if (!doc) { setSelectedDocId(null); return null; }
          return <DocumentReader doc={doc} isAcknowledged={isAcked(selectedDocId!)} ackDate={getAckDate(selectedDocId!)} onAcknowledge={handleAcknowledge} onClose={() => setSelectedDocId(null)} />;
        })()}

        {/* Normal tab views */}
        {!inModuleReader && !inDocReader && (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-2xl bg-gray-900 dark:bg-gray-800 text-white p-6 sm:p-8 flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold">
                      Welcome{user?.profile?.first_name ? `, ${user.profile.first_name}` : " to the Team"}!
                    </h2>
                    <p className="text-sm text-gray-300 mt-2 leading-relaxed max-w-sm">
                      {overallPct === 100 ? "You've completed onboarding. Great work!" : "Complete your training to unlock full CRM access and start earning commissions."}
                    </p>
                    {program?.due_date && overallPct < 100 && (
                      <p className="text-xs text-amber-300 mt-2 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        Due {new Date(program.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {nextModule && (
                      <Button onClick={() => { setActiveTab("modules"); setSelectedModuleId(nextModule.id); }} className="mt-4 bg-white text-gray-900 hover:bg-gray-100 border-0" size="sm">
                        {getMP(nextModule.id).status === "in_progress" ? "Continue" : "Start Training"}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                  <div className="relative shrink-0 hidden sm:block">
                    <ProgressRing pct={overallPct} size={104} light />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{overallPct}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Modules Completed", value: `${completedMods} / ${modules.length}`, sub: "Training modules" },
                    { label: "Docs Reviewed", value: `${ackedDocs} / ${totalDocs}`, sub: totalDocs - ackedDocs > 0 ? `${totalDocs - ackedDocs} pending` : "All reviewed!" },
                    { label: "Overall Progress", value: `${overallPct}%`, sub: "Onboarding complete", color: overallPct >= 100 ? "text-green-600" : overallPct >= 50 ? "text-blue-600" : "" },
                    { label: "Est. Time Remaining", value: formatTime(estMinLeft), sub: "To finish all modules", color: estMinLeft > 60 ? "text-amber-500" : estMinLeft > 0 ? "text-blue-600" : "text-green-600" },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="border rounded-xl p-4 bg-card">
                      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                      <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                  ))}
                </div>

                {overallPct === 100 && (
                  <div className="border border-green-200 dark:border-green-800 rounded-2xl p-5 bg-green-50 dark:bg-green-950/30 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                      <Bell className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-800 dark:text-green-300">Onboarding Complete</p>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">You've earned your onboarding badge. Welcome to the team!</p>
                    </div>
                    <Badge className="bg-green-600 text-white border-0 shrink-0">Badge Earned</Badge>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-3">Jump To</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: "modules", label: "Training Modules", desc: "Structured lessons on sales, estimating & CRM.", icon: BookOpen, cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
                      { id: "documents", label: "Documents", desc: totalDocs - ackedDocs > 0 ? `${totalDocs - ackedDocs} required docs need review.` : "All documents reviewed.", icon: FileText, cls: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
                      { id: "quiz", label: "Sales Knowledge Quiz", desc: `${questions.length} questions across all modules.`, icon: Trophy, cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-600" },
                    ].map(({ id, label, desc, icon: Icon, cls }) => (
                      <button key={id} onClick={() => switchTab(id)} className="text-left border rounded-xl p-5 bg-card hover:bg-accent transition-colors">
                        <div className={`h-10 w-10 rounded-xl ${cls} flex items-center justify-center mb-3`}><Icon className="h-5 w-5" /></div>
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-0.5">Open <ChevronRight className="h-3 w-3" /></p>
                      </button>
                    ))}
                  </div>
                </div>

                {nextModule && (
                  <div className="border rounded-xl p-4 bg-card flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl ${getCat(nextModule.category).bg} flex items-center justify-center shrink-0`}>
                      <BookOpen className={`h-5 w-5 ${getCat(nextModule.category).icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">{getMP(nextModule.id).status === "in_progress" ? "In Progress" : "Up Next"}</p>
                      <p className="font-semibold text-sm mt-0.5">{nextModule.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{nextModule.tagline}</p>
                    </div>
                    <Button size="sm" onClick={() => { setActiveTab("modules"); setSelectedModuleId(nextModule.id); }}>Continue</Button>
                  </div>
                )}
              </div>
            )}

            {/* ── MODULES ── */}
            {activeTab === "modules" && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold">Training Modules</h2>
                    <span className="text-sm text-muted-foreground">{completedMods}/{modules.length} completed</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all duration-700" style={{ width: `${modules.length > 0 ? (completedMods / modules.length) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Complete modules in order to unlock the next.</p>
                </div>
                {modules.length === 0 && (
                  <div className="text-center py-16 border rounded-xl">
                    <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium">No training modules yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Check back soon — your manager is preparing the content.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {modules.map((mod, i) => {
                    const prog = getMP(mod.id);
                    const unlocked = isUnlocked(i);
                    const done = prog.status === "completed";
                    const inProg = prog.status === "in_progress";
                    const cat = getCat(mod.category);
                    return (
                      <div key={mod.id} className={`border rounded-xl bg-card overflow-hidden ${!unlocked ? "opacity-60" : ""}`}>
                        <div className="flex items-center gap-4 p-5">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0 ${done ? "bg-green-100 dark:bg-green-900/30" : unlocked ? cat.bg : "bg-muted"}`}>
                            {done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : !unlocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <span className={`text-sm ${cat.icon}`}>{i + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{i + 1}. {mod.title}</span>
                              <Badge className={`text-[10px] border-0 px-2 py-0 ${cat.badge}`}>{mod.category}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mod.tagline}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{mod.duration_minutes} min</span>
                            {done ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-green-600 font-semibold">Done</span>
                                <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => setSelectedModuleId(mod.id)}>Review</Button>
                              </div>
                            ) : unlocked ? (
                              <Button size="sm" onClick={() => setSelectedModuleId(mod.id)}>{inProg ? "Resume" : "Start"}</Button>
                            ) : <Lock className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {activeTab === "documents" && (() => {
              const requiredCount = documents.filter(d => d.is_required).length;
              const docCategories = [...new Set(documents.map(d => d.category))];
              return (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">Company Documents</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">Review all required documents before starting in the field.</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-red-600">{requiredCount} Required</p>
                      <p className="text-xs text-muted-foreground">{ackedDocs} Reviewed</p>
                    </div>
                  </div>
                  {docCategories.length === 0 && (
                    <div className="text-center py-16 border rounded-xl">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium">No documents yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Documents will appear here once they are published.</p>
                    </div>
                  )}
                  {docCategories.map(cat => {
                    const catDocs = documents.filter(d => d.category === cat);
                    const c = getCat(cat);
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{cat}</p>
                        <div className="border rounded-xl overflow-hidden divide-y bg-card">
                          {catDocs.map(doc => {
                            const acked = isAcked(doc.id);
                            return (
                              <div key={doc.id} role="button" tabIndex={0}
                                onClick={() => setSelectedDocId(doc.id)}
                                onKeyDown={e => e.key === "Enter" && setSelectedDocId(doc.id)}
                                className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors cursor-pointer">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${acked ? "bg-green-100 dark:bg-green-900/30" : c.bg}`}>
                                  {acked
                                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    : <FileText className={`h-4 w-4 ${c.icon}`} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{doc.title}</span>
                                    {doc.is_required && <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Required</Badge>}
                                  </div>
                                  {doc.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.description}</p>}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {doc.file_size && <span className="text-xs text-muted-foreground hidden sm:block">{doc.file_size}</span>}
                                  <span className={`text-xs font-medium px-3 py-1 rounded-md ${acked ? "bg-muted text-muted-foreground" : "bg-foreground text-background"}`}>
                                    {acked ? "Review" : "Open"}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── QUIZ ── */}
            {activeTab === "quiz" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold">Sales Knowledge Quiz</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Test your knowledge with the full {questions.length}-question quiz. You need 90% or higher to pass.</p>
                </div>
                {!program ? (
                  <div className="text-center py-16 border rounded-xl">
                    <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium">Quiz not available</p>
                    <p className="text-xs text-muted-foreground mt-1">No active onboarding program is configured.</p>
                  </div>
                ) : program && userId && (
                  <QuizSection questions={questions} attempts={quizAttempts} programId={program.id} userId={userId}
                    onAttemptComplete={a => setQuizAttempts(p => [...p, a])}
                    onStepChange={setQuizInProgress} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={quizLeaveOpen} onOpenChange={open => {
        if (!open) { if (blocker.state === "blocked") blocker.reset?.(); setPendingNavCb(null); }
        setQuizLeaveOpen(open);
      }}>
        <AlertContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave quiz?</AlertDialogTitle>
            <AlertDialogDescription>Your quiz answers won't be saved. You can restart when you come back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setQuizLeaveOpen(false);
              setQuizInProgress(false);
              if (blocker.state === "blocked") blocker.proceed?.();
              else pendingNavCb?.();
              setPendingNavCb(null);
            }}>Leave Quiz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertContent>
      </AlertDialog>
    </div>
  );
}
