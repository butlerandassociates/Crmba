import { useState } from "react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/lib/supabase";
import baLogoUrl from "@/assets/ba-logo.png";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Loader2, Download, FileBarChart2, Eye, FileDown } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt  = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
const fmtPct = (v: number) => (isFinite(v) ? v.toFixed(1).replace(/\s/g, "") + "%" : "—");

const now = new Date();
const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

interface PLSection {
  materialSold:  number;
  laborSold:     number;
  otherSold:     number;
  materialCosts: number;
  laborCosts:    number;
}

interface PLData {
  active:      PLSection;
  completed:   PLSection;
  fromLabel:   string;
  toLabel:     string;
  periodLabel: string;
}

function sectionTotals(s: PLSection) {
  const rev    = s.materialSold + s.laborSold + s.otherSold;
  const cost   = s.materialCosts + s.laborCosts;
  const gp     = rev - cost;
  const margin = rev > 0 ? (gp / rev) * 100 : 0;
  return { rev, cost, gp, margin };
}

function combineSection(a: PLSection, b: PLSection): PLSection {
  return {
    materialSold:  a.materialSold  + b.materialSold,
    laborSold:     a.laborSold     + b.laborSold,
    otherSold:     a.otherSold     + b.otherSold,
    materialCosts: a.materialCosts + b.materialCosts,
    laborCosts:    a.laborCosts    + b.laborCosts,
  };
}

async function buildSectionData(clientIds: string[], rangeStart: string, rangeEnd: string): Promise<PLSection> {
  const empty: PLSection = { materialSold: 0, laborSold: 0, otherSold: 0, materialCosts: 0, laborCosts: 0 };
  if (!clientIds.length) return empty;

  const { data: estimates } = await supabase
    .from("estimates")
    .select("id, bad_amount")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd)
    .in("client_id", clientIds);

  if (!estimates?.length) return empty;

  let materialSold = 0, laborSold = 0, otherSold = 0, materialCosts = 0, laborCosts = 0;
  let totalBad = 0;
  for (const est of estimates) totalBad += Number(est.bad_amount) || 0;

  const ids = estimates.map((e: any) => e.id);
  const { data: lineItems } = await supabase
    .from("estimate_line_items")
    .select("total_price, labor_cost, material_cost, quantity")
    .in("estimate_id", ids);

  for (const li of lineItems ?? []) {
    const revenue = Number(li.total_price) || 0;
    const qty     = Number(li.quantity) || 1;
    const lc      = Number(li.labor_cost    || 0) * qty;
    const mc      = Number(li.material_cost || 0) * qty;
    const tc      = lc + mc;
    if (tc > 0) {
      laborSold    += (lc / tc) * revenue;
      materialSold += (mc / tc) * revenue;
    } else {
      otherSold += revenue;
    }
    laborCosts    += lc;
    materialCosts += mc;
  }
  otherSold += totalBad;
  return { materialSold, laborSold, otherSold, materialCosts, laborCosts };
}

/* ─── Excel export ───────────────────────────────────────────────────────── */
async function exportToExcel(data: PLData, logoUrl: string) {
  const active    = sectionTotals(data.active);
  const completed = sectionTotals(data.completed);
  const combined  = sectionTotals(combineSection(data.active, data.completed));

  const C_BLACK = "0A0A0A"; const C_GOLD = "BB984D"; const C_CREAM = "F5F3EF";
  const C_SAND  = "F0EDE8"; const C_ALT  = "FAF8F5"; const C_WHITE = "FFFFFF";
  const C_RED_BG = "FEF2F2"; const C_RED = "B91C1C";
  const C_GRN_BG = combined.gp >= 0 ? "F0FDF4" : "FEF2F2";
  const C_GRN    = combined.gp >= 0 ? "15803D" : "B91C1C";
  const C_MUTED  = "888888"; const C_DARK = "3A3A38";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Butler & Associates Construction";
  wb.created = new Date();
  const ws = wb.addWorksheet("P&L Report", { pageSetup: { fitToPage: true, fitToWidth: 1, paperSize: 9 } });
  ws.columns = [{ key: "label", width: 38 }, { key: "amount", width: 22 }];

  const fill  = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${argb}` } });
  const font  = (o: { bold?: boolean; italic?: boolean; size?: number; color?: string }): Partial<ExcelJS.Font> =>
    ({ name: "Calibri", size: o.size ?? 11, bold: o.bold ?? false, italic: o.italic ?? false, color: { argb: `FF${o.color ?? C_DARK}` } });
  const topBorder = (c: string): Partial<ExcelJS.Borders> => ({ top: { style: "medium", color: { argb: `FF${c}` } } });

  const addRow = (label: string, amount: number | string | null, opts: any = {}) => {
    const row = ws.addRow({ label, amount: amount ?? "" });
    row.height = opts.height ?? 20;
    const lc = row.getCell("label"); const ac = row.getCell("amount");
    if (opts.labelFont) lc.font = opts.labelFont;
    if (opts.amtFont)   ac.font = opts.amtFont;
    if (opts.labelFill) lc.fill = opts.labelFill;
    if (opts.amtFill)   ac.fill = opts.amtFill;
    if (opts.borders)   { lc.border = opts.borders; ac.border = opts.borders; }
    if (opts.indent)    lc.alignment = { indent: opts.indent };
    if (typeof amount === "number") { ac.numFmt = '"$"#,##0.00'; ac.alignment = { horizontal: "right" }; }
    else ac.alignment = { horizontal: "right" };
    return row;
  };

  const mergedHeader = (text: string, bg: string, fg: string, sz: number, bold = true) => {
    const row = ws.addRow({ label: text, amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cell = row.getCell("label");
    cell.value = text; cell.font = font({ bold, size: sz, color: fg }); cell.fill = fill(bg);
    cell.alignment = { vertical: "middle" }; row.height = sz + 10; return row;
  };

  const goldBar = () => {
    const row = ws.addRow({ label: "", amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell("label").fill = fill(C_GOLD); row.height = 3; return row;
  };

  const spacer = (bg = C_CREAM) => {
    const row = ws.addRow({ label: "", amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell("label").fill = fill(bg); row.height = 6; return row;
  };

  const sectionHead = (label: string) => {
    const row = ws.addRow({ label, amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const c = row.getCell("label");
    c.value = label.toUpperCase(); c.font = font({ bold: true, size: 9, color: C_GOLD });
    c.fill = fill(C_BLACK); c.alignment = { vertical: "middle" }; row.height = 22; return row;
  };

  const groupHead = (label: string) => {
    const row = ws.addRow({ label, amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const c = row.getCell("label");
    c.value = label; c.font = font({ bold: true, size: 11, color: C_GOLD });
    c.fill = fill("1A1A1A"); c.alignment = { vertical: "middle" }; row.height = 24; return row;
  };

  try {
    const res = await fetch(logoUrl);
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const imgId = wb.addImage({ base64: b64, extension: "png" });
    ws.addImage(imgId, { tl: { col: 1, row: 0 }, br: { col: 2, row: 4 }, editAs: "oneCell" } as any);
  } catch { /* logo optional */ }

  mergedHeader("BUTLER & ASSOCIATES CONSTRUCTION, INC.", C_BLACK, C_GOLD, 9);
  mergedHeader("Profit & Loss Statement", C_BLACK, C_WHITE, 16);
  mergedHeader(`Period: ${data.periodLabel}`, C_BLACK, C_MUTED, 10, false);
  goldBar();
  spacer(C_CREAM);
  const sumRow = ws.addRow({ label: `Revenue: ${fmt(combined.rev)}   |   Costs: ${fmt(combined.cost)}   |   Profit: ${fmt(combined.gp)}   |   Margin: ${fmtPct(combined.margin)}`, amount: "" });
  ws.mergeCells(`A${sumRow.number}:B${sumRow.number}`);
  sumRow.getCell("label").font = font({ bold: true, size: 11, color: C_DARK });
  sumRow.getCell("label").fill = fill(C_CREAM); sumRow.height = 22;
  spacer(C_CREAM); goldBar(); spacer();

  const writeSection = (s: PLSection, t: ReturnType<typeof sectionTotals>, label: string) => {
    groupHead(label);
    sectionHead("Revenue");
    addRow("Material Sold", s.materialSold, { labelFont: font({ size: 11, color: C_DARK }), amtFont: font({ size: 11, color: C_DARK }), labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1 });
    addRow("Labor Sold",    s.laborSold,    { labelFont: font({ size: 11, color: C_DARK }), amtFont: font({ size: 11, color: C_DARK }), labelFill: fill(C_ALT),   amtFill: fill(C_ALT),   indent: 1 });
    if (s.otherSold > 0) addRow("Other", s.otherSold, { labelFont: font({ size: 11, color: C_DARK }), amtFont: font({ size: 11, color: C_DARK }), labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1 });
    addRow("Total Revenue", t.rev, { labelFont: font({ bold: true, size: 11, color: C_BLACK }), amtFont: font({ bold: true, size: 11, color: C_BLACK }), labelFill: fill(C_SAND), amtFill: fill(C_SAND), borders: topBorder(C_GOLD), height: 22 });
    spacer();
    sectionHead("Cost of Goods Sold");
    addRow("Material Costs", s.materialCosts, { labelFont: font({ size: 11, color: C_DARK }), amtFont: font({ size: 11, color: C_RED }), labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1 });
    addRow("Labor Costs",    s.laborCosts,    { labelFont: font({ size: 11, color: C_RED }),  amtFont: font({ size: 11, color: C_RED }), labelFill: fill(C_RED_BG), amtFill: fill(C_RED_BG), indent: 1 });
    addRow("Total COGS",     t.cost, { labelFont: font({ bold: true, size: 11, color: C_RED }), amtFont: font({ bold: true, size: 11, color: C_RED }), labelFill: fill(C_RED_BG), amtFill: fill(C_RED_BG), borders: topBorder(C_GOLD), height: 22 });
    spacer();
    const gpBg = t.gp >= 0 ? "F0FDF4" : "FEF2F2"; const gpFg = t.gp >= 0 ? "15803D" : "B91C1C";
    sectionHead("Bottom Line");
    addRow("Gross Profit", t.gp,  { labelFont: font({ bold: true, size: 13, color: gpFg }), amtFont: font({ bold: true, size: 13, color: gpFg }), labelFill: fill(gpBg), amtFill: fill(gpBg), borders: topBorder(C_GOLD), height: 26 });
    addRow("Gross Margin", `${fmtPct(t.margin)}`, { labelFont: font({ size: 11, color: C_MUTED }), amtFont: font({ bold: true, size: 11, color: gpFg }), labelFill: fill(gpBg), amtFill: fill(gpBg) });
    spacer(); goldBar(); spacer();
  };

  writeSection(data.active,    active,    "► Current Jobs (Active)");
  writeSection(data.completed, completed, "► Closed Jobs (Completed)");
  writeSection(combineSection(data.active, data.completed), combined, "► Combined Total");

  const genDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  mergedHeader(`Generated ${genDate}  ·  Butler & Associates Construction, Inc.  ·  Huntsville, AL 35806`, C_BLACK, C_MUTED, 8, false);
  mergedHeader("Revenue reflects estimate line items in period. Costs reflect receipts in period. Verify with your accounting method.", C_BLACK, "444444", 7, false);

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href = url; a.download = `PL_${data.periodLabel.replace(/\s+–\s+/g, "_to_").replace(/\s/g, "_")}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

/* ─── Shared HTML section builder ───────────────────────────────────────── */
function buildSectionHtml(s: PLSection, t: ReturnType<typeof sectionTotals>, label: string, compact = false): string {
  const GRN    = t.gp >= 0 ? "#15803D" : "#B91C1C";
  const GRN_BG = t.gp >= 0 ? "#F0FDF4" : "#FEF2F2";
  const p  = compact ? "9px" : "13px";
  const fs = compact ? "12px" : "13px";

  const row = (lbl: string, amount: number, opts: { alt?: boolean; red?: boolean; redBg?: boolean } = {}) => `
    <tr style="background:${opts.redBg ? "#FEF2F2" : opts.alt ? "#FAF8F5" : "#fff"};">
      <td style="padding:${p} 0 ${p} 14px;font-size:${fs};color:${opts.red ? "#B91C1C" : "#3A3A38"};">${lbl}</td>
      <td style="padding:${p} 0 ${p} 0;font-size:${fs};text-align:right;color:${opts.red ? "#B91C1C" : "#3A3A38"};font-variant-numeric:tabular-nums;">${fmt(amount)}</td>
    </tr>`;

  const totRow = (lbl: string, amount: number, opts: { red?: boolean } = {}) => `
    <tr style="background:${opts.red ? "#FEF2F2" : "#F0EDE8"};">
      <td style="padding:${p} 0 ${p} 14px;font-size:${fs};font-weight:700;color:${opts.red ? "#B91C1C" : "#0A0A0A"};border-top:2px solid #BB984D;">${lbl}</td>
      <td style="padding:${p} 0 ${p} 0;font-size:${fs};font-weight:700;text-align:right;color:${opts.red ? "#B91C1C" : "#0A0A0A"};border-top:2px solid #BB984D;font-variant-numeric:tabular-nums;">${fmt(amount)}</td>
    </tr>`;

  const secHead = (lbl: string) =>
    `<div style="background:#0A0A0A;color:#BB984D;font-size:9px;font-weight:500;letter-spacing:2px;text-transform:uppercase;padding:6px 32px;margin:10px -32px 0;">${lbl}</div>`;

  return `
    <div style="background:#1A1A1A;color:#BB984D;font-size:11px;font-weight:700;padding:8px 32px;margin:16px -32px 0;letter-spacing:1px;">${label}</div>
    ${secHead("Revenue")}
    <table style="width:100%;border-collapse:collapse;">
      ${row("Material Sold", s.materialSold)}
      ${row("Labor Sold", s.laborSold, { alt: true })}
      ${s.otherSold > 0 ? row("Other (incl. BAD)", s.otherSold) : ""}
      ${totRow("Total Revenue", t.rev)}
    </table>
    ${secHead("Cost of Goods Sold")}
    <table style="width:100%;border-collapse:collapse;">
      ${row("Material Costs", s.materialCosts, { red: true })}
      ${row("Labor Costs",    s.laborCosts,    { red: true, redBg: true })}
      ${totRow("Total COGS", t.cost, { red: true })}
    </table>
    <div style="margin-top:10px;background:${GRN_BG};border-top:2px solid #BB984D;border-bottom:2px solid #BB984D;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:700;color:${GRN};">Gross Profit</div>
        <div style="font-size:11px;color:#888;margin-top:2px;">Gross Margin</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;color:${GRN};font-variant-numeric:tabular-nums;">${fmt(t.gp)}</div>
        <div style="font-size:11px;font-weight:600;color:${GRN};margin-top:2px;">${fmtPct(t.margin)}</div>
      </div>
    </div>`;
}

/* ─── PDF Document HTML (A4 794×1122px, comparison table layout) ────────── */
function buildPdfDocHtml(data: PLData, logoUrl: string): string {
  const combined  = sectionTotals(combineSection(data.active, data.completed));
  const active    = sectionTotals(data.active);
  const completed = sectionTotals(data.completed);
  const GRN       = combined.gp >= 0 ? "#15803D" : "#B91C1C";
  const genDate   = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const cell = (val: string, bold = false, color = "#3A3A38", bg = "#fff") =>
    `<td style="padding:9px 14px;font-size:11px;font-weight:${bold ? 700 : 400};color:${color};background:${bg};text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;border-bottom:1px solid #F0EDE8;">${val}</td>`;

  const labelCell = (val: string, bold = false, bg = "#fff") =>
    `<td style="padding:9px 16px;font-size:11px;font-weight:${bold ? 700 : 400};color:#3A3A38;background:${bg};border-bottom:1px solid #F0EDE8;">${val}</td>`;

  const gpBg  = combined.gp >= 0 ? "#F0FDF4" : "#FEF2F2";
  const gpFgA = active.gp    >= 0 ? "#15803D" : "#B91C1C";
  const gpFgC = completed.gp >= 0 ? "#15803D" : "#B91C1C";
  const gpFgT = combined.gp  >= 0 ? "#15803D" : "#B91C1C";

  const rows = [
    // [label, boldLabel, activeVal, completedVal, combinedVal, boldVals, labelBg, cellBg, amtColor]
    ["REVENUE", true, "", "", "", true, "#0A0A0A", "#0A0A0A", "#BB984D"],
    ["Material Sold", false, fmt(data.active.materialSold), fmt(data.completed.materialSold), fmt(combineSection(data.active, data.completed).materialSold), false, "#fff", "#fff", "#3A3A38"],
    ["Labor Sold", false, fmt(data.active.laborSold), fmt(data.completed.laborSold), fmt(combineSection(data.active, data.completed).laborSold), false, "#FAF8F5", "#FAF8F5", "#3A3A38"],
    ...(data.active.otherSold > 0 || data.completed.otherSold > 0
      ? [["Other (incl. BAD)", false, fmt(data.active.otherSold), fmt(data.completed.otherSold), fmt(combineSection(data.active, data.completed).otherSold), false, "#fff", "#fff", "#3A3A38"]] : []),
    ["Total Revenue", true, fmt(active.rev), fmt(completed.rev), fmt(combined.rev), true, "#F0EDE8", "#F0EDE8", "#0A0A0A"],
    ["COST OF GOODS SOLD", true, "", "", "", true, "#0A0A0A", "#0A0A0A", "#BB984D"],
    ["Material Costs", false, fmt(data.active.materialCosts), fmt(data.completed.materialCosts), fmt(combineSection(data.active, data.completed).materialCosts), false, "#fff", "#fff", "#B91C1C"],
    ["Labor Costs", false, fmt(data.active.laborCosts), fmt(data.completed.laborCosts), fmt(combineSection(data.active, data.completed).laborCosts), false, "#FEF2F2", "#FEF2F2", "#B91C1C"],
    ["Total COGS", true, fmt(active.cost), fmt(completed.cost), fmt(combined.cost), true, "#FEF2F2", "#FEF2F2", "#B91C1C"],
    ["BOTTOM LINE", true, "", "", "", true, "#0A0A0A", "#0A0A0A", "#BB984D"],
    ["Gross Profit", true, fmt(active.gp), fmt(completed.gp), fmt(combined.gp), true, gpBg, gpBg, "MIXED_GP"],
    ["Gross Margin", false, fmtPct(active.margin), fmtPct(completed.margin), fmtPct(combined.margin), false, gpBg, gpBg, "MIXED_GP"],
  ] as const;

  const tableRows = rows.map(([label, boldL, av, cv, tv, boldV, lBg, cBg, amtColor]) => {
    const isSection = (amtColor as string) === "#BB984D";
    const isMixedGP = (amtColor as string) === "MIXED_GP";
    const borderTop = label === "Total Revenue" || label === "Total COGS" || label === "Gross Profit" ? "border-top:2px solid #BB984D;" : "";

    if (isSection) {
      return `<tr>
        <td colspan="4" style="padding:7px 16px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#BB984D;background:#0A0A0A;${borderTop}">${label}</td>
      </tr>`;
    }
    const aColor = isMixedGP ? gpFgA : (amtColor as string);
    const cColor = isMixedGP ? gpFgC : (amtColor as string);
    const tColor = isMixedGP ? gpFgT : (amtColor as string);
    return `<tr>
      ${labelCell(label as string, boldL as boolean, lBg as string)}
      ${cell(av as string, boldV as boolean, aColor, cBg as string)}
      ${cell(cv as string, boldV as boolean, cColor, cBg as string)}
      ${cell(tv as string, boldV as boolean, tColor, cBg as string)}
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:794px;height:1122px;background:#fff;font-family:'Inter',Arial,sans-serif;color:#3A3A38;}
    .doc{width:794px;height:1122px;display:flex;flex-direction:column;background:#fff;}
    .body{flex:1;padding:0 32px 0;overflow:hidden;}
    table{width:100%;border-collapse:collapse;}
  </style>
</head>
<body>
<div class="doc">
  <!-- Header -->
  <div style="background:#0A0A0A;padding:22px 32px;text-align:center;flex-shrink:0;">
    <img src="${logoUrl}" style="height:46px;width:auto;display:block;margin:0 auto 10px auto;" alt="Logo"/>
    <div style="font-size:8px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#BB984D;margin-bottom:6px;">Butler &amp; Associates Construction, Inc.</div>
    <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:3px;">Profit &amp; Loss Statement</div>
    <div style="font-size:11px;color:#888;">Period: ${data.periodLabel}</div>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);flex-shrink:0;"></div>

  <!-- Summary bar -->
  <div style="background:#F5F3EF;display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #E8E4DC;flex-shrink:0;">
    ${[["Total Revenue", fmt(combined.rev), "#3A3A38"], ["Total Costs", fmt(combined.cost), "#B91C1C"], ["Gross Profit", fmt(combined.gp), GRN], ["Gross Margin", fmtPct(combined.margin).replace(" %","%"), GRN]].map(([l, v, c]) =>
      `<div style="padding:13px 20px;text-align:center;"><div style="font-size:8px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:#888;margin-bottom:5px;">${l}</div><div style="font-size:15px;font-weight:700;color:${c};font-variant-numeric:tabular-nums;white-space:nowrap;">${v}</div></div>`).join("")}
  </div>

  <!-- Comparison table -->
  <div class="body">
    <table style="margin-top:18px;">
      <thead>
        <tr>
          <th style="padding:8px 16px;font-size:10px;font-weight:600;text-align:left;color:#888;border-bottom:2px solid #BB984D;background:#fff;width:40%;"></th>
          <th style="padding:8px 14px;font-size:10px;font-weight:600;text-align:right;color:#3A3A38;border-bottom:2px solid #BB984D;background:#F5F3EF;">Current (Active)</th>
          <th style="padding:8px 14px;font-size:10px;font-weight:600;text-align:right;color:#3A3A38;border-bottom:2px solid #BB984D;background:#F5F3EF;">Closed (Completed)</th>
          <th style="padding:8px 14px;font-size:10px;font-weight:600;text-align:right;border-bottom:2px solid #BB984D;background:#0A0A0A;color:#BB984D;">Combined Total</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#0A0A0A;padding:12px 32px;flex-shrink:0;margin-top:auto;text-align:center;">
    <div style="font-size:9px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:#BB984D;margin-bottom:3px;">Butler &amp; Associates Construction, Inc.</div>
    <div style="font-size:10px;color:#555;margin-bottom:4px;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</div>
    <div style="font-size:9px;color:#444;line-height:1.5;">Generated ${genDate} · Revenue reflects estimate line items created in period. Costs reflect receipts in period. BAD included in revenue per company policy.</div>
  </div>
</div>
</body></html>`;
}

const PREVIEW_SCALE = 0.84;
const PREVIEW_W = Math.round(794 * PREVIEW_SCALE); // 667px
const PREVIEW_H = Math.round(1122 * PREVIEW_SCALE); // 942px

/* ─── Preview HTML — same as PDF but scaled to fit dialog width ──────────── */
function buildPreviewHtml(data: PLData, logoUrl: string): string {
  return buildPdfDocHtml(data, logoUrl)
    .replace(
      "html,body{width:794px;height:1122px;background:#fff;",
      `html,body{width:${PREVIEW_W}px;height:${PREVIEW_H}px;background:#fff;overflow:hidden;margin:0;`
    )
    .replace(
      ".doc{width:794px;height:1122px;",
      `.doc{width:794px;height:1122px;transform:scale(${PREVIEW_SCALE});transform-origin:top left;`
    );
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function PLReport() {
  const [fromMonth, setFromMonth] = useState(now.getMonth());
  const [fromYear,  setFromYear]  = useState(now.getFullYear());
  const [toMonth,   setToMonth]   = useState(now.getMonth());
  const [toYear,    setToYear]    = useState(now.getFullYear());
  const [loading,      setLoading]      = useState(false);
  const [data,         setData]         = useState<PLData | null>(null);
  const [showPreview,  setShowPreview]  = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!data) return;
    setExportingPdf(true);
    try {
      const A4_W = 794; const A4_H = 1122;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;height:${A4_H}px;border:0;`;
      document.body.appendChild(iframe);
      const iDoc = iframe.contentDocument!;
      iDoc.open(); iDoc.write(buildPdfDocHtml(data, baLogoUrl)); iDoc.close();
      await new Promise((r) => setTimeout(r, 900));
      const canvas = await html2canvas(iDoc.body, { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: A4_W, height: A4_H, windowWidth: A4_W, scrollX: 0, scrollY: 0 });
      document.body.removeChild(iframe);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      pdf.save(`PL_${data.periodLabel.replace(/\s+–\s+/g, "_to_").replace(/\s/g, "_")}.pdf`);
    } catch (err: any) {
      toast.error(err.message || "PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerate = async () => {
    const fromDate = new Date(fromYear, fromMonth, 1);
    const toDate   = new Date(toYear,   toMonth,   1);
    if (fromDate > toDate) { toast.error("'From' date must be before or equal to 'To' date."); return; }

    setLoading(true);
    try {
      const rangeStart  = fromDate.toISOString();
      const rangeEnd    = new Date(toYear, toMonth + 1, 1).toISOString();
      const fromLabel   = `${MONTHS[fromMonth]} ${fromYear}`;
      const toLabel     = `${MONTHS[toMonth]} ${toYear}`;
      const periodLabel = fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;

      const { data: allClients } = await supabase
        .from("clients")
        .select("id, pipeline_stage:pipeline_stages!pipeline_stage_id(name)")
        .eq("is_discarded", false);

      const activeIds    = (allClients ?? []).filter((c: any) => (c.pipeline_stage?.name ?? "").toLowerCase() === "active").map((c: any) => c.id);
      const completedIds = (allClients ?? []).filter((c: any) => (c.pipeline_stage?.name ?? "").toLowerCase() === "completed").map((c: any) => c.id);

      const [activeSection, completedSection] = await Promise.all([
        buildSectionData(activeIds,    rangeStart, rangeEnd),
        buildSectionData(completedIds, rangeStart, rangeEnd),
      ]);

      setData({ active: activeSection, completed: completedSection, fromLabel, toLabel, periodLabel });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const combined  = data ? sectionTotals(combineSection(data.active, data.completed)) : null;
  const active    = data ? sectionTotals(data.active)    : null;
  const completed = data ? sectionTotals(data.completed) : null;

  const SectionTable = ({ s, t, label }: { s: PLSection; t: ReturnType<typeof sectionTotals>; label: string }) => (
    <div className="space-y-0">
      <div className="bg-[#1A1A1A] text-[#BB984D] text-xs font-bold px-5 py-2 tracking-wide">{label}</div>
      <table className="w-full text-sm">
        <tbody>
          <tr><td colSpan={2} className="pt-4 pb-1.5 px-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</td></tr>
          <tr className="border-b border-dashed"><td className="py-2 pl-8 text-foreground">Material Sold</td><td className="py-2 text-right font-mono pr-4">{fmt(s.materialSold)}</td></tr>
          <tr className="border-b border-dashed"><td className="py-2 pl-8 text-foreground">Labor Sold</td><td className="py-2 text-right font-mono pr-4">{fmt(s.laborSold)}</td></tr>
          {s.otherSold > 0 && <tr className="border-b border-dashed"><td className="py-2 pl-8 text-foreground">Other (incl. BAD)</td><td className="py-2 text-right font-mono pr-4">{fmt(s.otherSold)}</td></tr>}
          <tr className="bg-muted/40 font-semibold border-t-2"><td className="py-2 pl-8">Total Revenue</td><td className="py-2 text-right font-mono pr-4">{fmt(t.rev)}</td></tr>
          <tr><td colSpan={2} className="pt-5 pb-1.5 px-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cost of Goods Sold</td></tr>
          <tr className="border-b border-dashed"><td className="py-2 pl-8">Material Costs</td><td className="py-2 text-right font-mono text-red-600 pr-4">{fmt(s.materialCosts)}</td></tr>
          <tr className="border-b border-dashed"><td className="py-2 pl-8">Labor Costs</td><td className="py-2 text-right font-mono text-red-600 pr-4">{fmt(s.laborCosts)}</td></tr>
          <tr className="bg-red-50 font-semibold border-t-2"><td className="py-2 pl-8 text-red-700">Total COGS</td><td className="py-2 text-right font-mono text-red-600 pr-4">{fmt(t.cost)}</td></tr>
          <tr className={`font-bold text-base border-t-2 border-b-2 ${t.gp >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <td className={`py-2.5 pl-8 ${t.gp >= 0 ? "text-green-700" : "text-red-700"}`}>Gross Profit</td>
            <td className={`py-2.5 text-right font-mono pr-4 ${t.gp >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(t.gp)}</td>
          </tr>
          <tr>
            <td className="py-1.5 pl-8 text-muted-foreground text-sm">Gross Margin</td>
            <td className={`py-1.5 text-right font-mono font-semibold text-sm pr-4 ${t.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtPct(t.margin)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4" />
            Generate Profit &amp; Loss Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</p>
              <div className="flex gap-2">
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <span className="text-muted-foreground pb-1">→</span>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
              <div className="flex gap-2">
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="flex h-9 rounded-md border border-input bg-background px-2 text-sm" value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="h-9 self-end">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Generating…" : "Generate Report"}
            </Button>
          </div>

          {data && (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => { exportToExcel(data, baLogoUrl).catch((e) => toast.error(e.message || "Export failed")); }}>
                <Download className="h-4 w-4 mr-2" />Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
                {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                {exportingPdf ? "Exporting…" : "Export PDF"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {data && combined && active && completed && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue", value: combined.rev,  color: "" },
              { label: "Total Costs",   value: combined.cost, color: "text-red-600" },
              { label: "Gross Profit",  value: combined.gp,   color: combined.gp >= 0 ? "text-green-600" : "text-red-600" },
              { label: "Gross Margin",  value: null, pct: combined.margin, color: combined.margin >= 0 ? "text-green-600" : "text-red-600" },
            ].map(({ label, value, pct, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${color}`}>{pct !== undefined ? fmtPct(pct) : fmt(value!)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-0">
              <div className="text-center space-y-0.5 pb-3 border-b">
                <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">Butler &amp; Associates Construction, Inc.</p>
                <h2 className="text-lg font-bold">Profit &amp; Loss Statement</h2>
                <p className="text-sm text-muted-foreground">{data.periodLabel}</p>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y">
              <SectionTable s={data.active}    t={active}    label="▶ Current Jobs (Active)" />
              <SectionTable s={data.completed} t={completed} label="▶ Closed Jobs (Completed)" />
              <SectionTable s={combineSection(data.active, data.completed)} t={combined} label="▶ Combined Total" />
              <p className="text-[11px] text-muted-foreground px-5 py-4 leading-relaxed">
                Revenue reflects proposal line items with creation dates within the selected period.
                Costs reflect receipts uploaded within the selected period.
                BAD (Base, Aggregate &amp; Disposal) is included in revenue per company policy.
                Verify dates align with your accounting method before filing.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileBarChart2 className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No report generated yet</p>
          <p className="text-xs mt-1">Select a date range above, then click Generate Report.</p>
        </div>
      )}

      {data && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent style={{ width: `${PREVIEW_W + 48}px`, maxWidth: "95vw" }} className="flex flex-col p-0 gap-0 h-[92vh]">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Report Preview — {data.periodLabel}
              </DialogTitle>
              <DialogDescription>This is exactly how the exported PDF will look.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-b-lg flex justify-center bg-[#F5F3EF] p-3">
              <iframe
                srcDoc={buildPreviewHtml(data, baLogoUrl)}
                style={{ width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px`, border: "none", display: "block", flexShrink: 0 }}
                title="P&L Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
