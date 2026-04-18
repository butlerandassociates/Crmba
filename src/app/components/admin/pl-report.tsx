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
const fmtPct = (v: number) => (isFinite(v) ? v.toFixed(1) + "%" : "—");

const now = new Date();
const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

interface PLData {
  materialSold:  number;
  laborSold:     number;
  otherSold:     number;
  materialCosts: number;
  laborCosts:    number;
  fromLabel:     string;
  toLabel:       string;
  periodLabel:   string;
}

/* ─── Excel export (.xlsx via ExcelJS) ──────────────────────────────────── */
async function exportToExcel(data: PLData, logoUrl: string) {
  const totalRevenue = data.materialSold + data.laborSold + data.otherSold;
  const totalCosts   = data.materialCosts + data.laborCosts;
  const grossProfit  = totalRevenue - totalCosts;
  const grossMargin  = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Brand palette
  const C_BLACK  = "0A0A0A";
  const C_GOLD   = "BB984D";
  const C_CREAM  = "F5F3EF";
  const C_SAND   = "F0EDE8";
  const C_ALT    = "FAF8F5";
  const C_WHITE  = "FFFFFF";
  const C_RED_BG = "FEF2F2";
  const C_RED    = "B91C1C";
  const C_GRN_BG = grossProfit >= 0 ? "F0FDF4" : "FEF2F2";
  const C_GRN    = grossProfit >= 0 ? "15803D" : "B91C1C";
  const C_MUTED  = "888888";
  const C_DARK   = "3A3A38";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Butler & Associates Construction";
  wb.created = new Date();

  const ws = wb.addWorksheet("P&L Report", {
    pageSetup: { fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  // Column widths: A=label, B=amount
  ws.columns = [
    { key: "label",  width: 38 },
    { key: "amount", width: 22 },
  ];

  // ── helpers ──
  const fill = (argb: string): ExcelJS.Fill =>
    ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${argb}` } });

  const font = (opts: { bold?: boolean; italic?: boolean; size?: number; color?: string; name?: string }): Partial<ExcelJS.Font> => ({
    name:   opts.name  ?? "Calibri",
    size:   opts.size  ?? 11,
    bold:   opts.bold  ?? false,
    italic: opts.italic ?? false,
    color:  { argb: `FF${opts.color ?? C_DARK}` },
  });

  const topBorder = (color: string): Partial<ExcelJS.Borders> => ({
    top: { style: "medium", color: { argb: `FF${color}` } },
  });

  const addRow = (
    label: string,
    amount: number | string | null,
    opts: {
      labelFont?: Partial<ExcelJS.Font>;
      amtFont?:   Partial<ExcelJS.Font>;
      labelFill?: ExcelJS.Fill;
      amtFill?:   ExcelJS.Fill;
      borders?:   Partial<ExcelJS.Borders>;
      height?:    number;
      indent?:    number;
    } = {}
  ) => {
    const row = ws.addRow({ label, amount: amount ?? "" });
    row.height = opts.height ?? 20;
    const lc = row.getCell("label");
    const ac = row.getCell("amount");

    if (opts.labelFont) lc.font   = opts.labelFont;
    if (opts.amtFont)   ac.font   = opts.amtFont;
    if (opts.labelFill) lc.fill   = opts.labelFill;
    if (opts.amtFill)   ac.fill   = opts.amtFill;
    if (opts.borders)   { lc.border = opts.borders; ac.border = opts.borders; }
    if (opts.indent)    lc.alignment = { indent: opts.indent };

    if (typeof amount === "number") {
      ac.numFmt = '"$"#,##0.00';
      ac.alignment = { horizontal: "right" };
    } else {
      ac.alignment = { horizontal: "right" };
    }
    return row;
  };

  const mergedHeader = (text: string, bg: string, fg: string, sz: number, bold = true, italic = false) => {
    const row = ws.addRow({ label: text, amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const cell = row.getCell("label");
    cell.value = text;
    cell.font  = font({ bold, italic, size: sz, color: fg });
    cell.fill  = fill(bg);
    cell.alignment = { vertical: "middle", wrapText: false };
    row.height = sz + 10;
    return row;
  };

  const goldBar = () => {
    const row = ws.addRow({ label: "", amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell("label").fill = fill(C_GOLD);
    row.height = 3;
    return row;
  };

  const spacer = (bg = C_CREAM) => {
    const row = ws.addRow({ label: "", amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell("label").fill = fill(bg);
    row.height = 6;
    return row;
  };

  const sectionHead = (label: string) => {
    const row = ws.addRow({ label, amount: "" });
    ws.mergeCells(`A${row.number}:B${row.number}`);
    const c = row.getCell("label");
    c.value = label.toUpperCase();
    c.font  = font({ bold: true, size: 9, color: C_GOLD });
    c.fill  = fill(C_BLACK);
    c.alignment = { vertical: "middle" };
    row.height = 22;
    return row;
  };

  // ── Brand header with logo ──
  // Fetch logo and embed as image in col A rows 1-4
  try {
    const res  = await fetch(logoUrl);
    const buf  = await res.arrayBuffer();
    const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const imgId = wb.addImage({ base64: b64, extension: "png" });
    // Place logo over rows 1-4, col A (tl=top-left, br=bottom-right in fractional col/row)
    ws.addImage(imgId, { tl: { col: 1, row: 0 }, br: { col: 2, row: 4 }, editAs: "oneCell" } as any);
  } catch { /* logo optional — skip if fetch fails */ }
  mergedHeader("BUTLER & ASSOCIATES CONSTRUCTION, INC.", C_BLACK, C_GOLD, 9);
  mergedHeader("Profit & Loss Statement", C_BLACK, C_WHITE, 16);
  mergedHeader(`Period: ${data.periodLabel}`, C_BLACK, C_MUTED, 10, false);
  goldBar();

  // ── Summary row (4 values across merged cells) ──
  spacer(C_CREAM);
  const summaryLabelRow = ws.addRow({ label: "Total Revenue", amount: "" });
  ws.mergeCells(`A${summaryLabelRow.number}:B${summaryLabelRow.number}`);
  summaryLabelRow.height = 14;
  // Summary values as a single descriptive row
  const sumRow = ws.addRow({
    label:  `Revenue: ${fmt(totalRevenue)}   |   Costs: ${fmt(totalCosts)}   |   Profit: ${fmt(grossProfit)}   |   Margin: ${fmtPct(grossMargin)}`,
    amount: "",
  });
  ws.mergeCells(`A${sumRow.number}:B${sumRow.number}`);
  const sumCell = sumRow.getCell("label");
  sumCell.font  = font({ bold: true, size: 11, color: C_DARK });
  sumCell.fill  = fill(C_CREAM);
  sumCell.alignment = { horizontal: "left" };
  sumRow.height = 22;
  spacer(C_CREAM);
  goldBar();
  spacer();

  // ── REVENUE ──
  sectionHead("Revenue");
  addRow("Material Sold", data.materialSold, {
    labelFont: font({ size: 11, color: C_DARK }),
    amtFont:   font({ size: 11, color: C_DARK }),
    labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1,
  });
  addRow("Labor Sold", data.laborSold, {
    labelFont: font({ size: 11, color: C_DARK }),
    amtFont:   font({ size: 11, color: C_DARK }),
    labelFill: fill(C_ALT), amtFill: fill(C_ALT), indent: 1,
  });
  if (data.otherSold > 0) {
    addRow("Other", data.otherSold, {
      labelFont: font({ size: 11, color: C_DARK }),
      amtFont:   font({ size: 11, color: C_DARK }),
      labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1,
    });
  }
  addRow("Total Revenue", totalRevenue, {
    labelFont: font({ bold: true, size: 11, color: C_BLACK }),
    amtFont:   font({ bold: true, size: 11, color: C_BLACK }),
    labelFill: fill(C_SAND), amtFill: fill(C_SAND),
    borders: topBorder(C_GOLD), height: 22,
  });

  spacer();

  // ── COST OF GOODS SOLD ──
  sectionHead("Cost of Goods Sold");
  addRow("Material Costs", data.materialCosts, {
    labelFont: font({ size: 11, color: C_DARK }),
    amtFont:   font({ size: 11, color: C_RED }),
    labelFill: fill(C_WHITE), amtFill: fill(C_WHITE), indent: 1,
  });
  addRow("Labor Costs", data.laborCosts, {
    labelFont: font({ size: 11, color: C_RED }),
    amtFont:   font({ size: 11, color: C_RED }),
    labelFill: fill(C_RED_BG), amtFill: fill(C_RED_BG), indent: 1,
  });
  addRow("Total COGS", totalCosts, {
    labelFont: font({ bold: true, size: 11, color: C_RED }),
    amtFont:   font({ bold: true, size: 11, color: C_RED }),
    labelFill: fill(C_RED_BG), amtFill: fill(C_RED_BG),
    borders: topBorder(C_GOLD), height: 22,
  });

  spacer();

  // ── BOTTOM LINE ──
  sectionHead("Bottom Line");
  addRow("Gross Profit", grossProfit, {
    labelFont: font({ bold: true, size: 13, color: C_GRN }),
    amtFont:   font({ bold: true, size: 13, color: C_GRN }),
    labelFill: fill(C_GRN_BG), amtFill: fill(C_GRN_BG),
    borders: topBorder(C_GOLD), height: 26,
  });
  addRow("Gross Margin", `${fmtPct(grossMargin)}`, {
    labelFont: font({ size: 11, color: C_MUTED }),
    amtFont:   font({ bold: true, size: 11, color: C_GRN }),
    labelFill: fill(C_GRN_BG), amtFill: fill(C_GRN_BG),
  });

  spacer();
  goldBar();

  // ── Footer ──
  const genDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  mergedHeader(`Generated ${genDate}  ·  Butler & Associates Construction, Inc.  ·  Huntsville, AL 35806`, C_BLACK, C_MUTED, 8, false);
  mergedHeader("Revenue reflects estimate line items in period. Costs reflect receipts in period. Verify with your accounting method.", C_BLACK, "444444", 7, false);

  // ── Download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = `PL_${data.periodLabel.replace(/\s+–\s+/g, "_to_").replace(/\s/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── PDF Document HTML (A4-optimised, footer pinned to bottom) ─────────── */
function buildPdfDocHtml(data: PLData, logoUrl: string): string {
  const totalRevenue = data.materialSold + data.laborSold + data.otherSold;
  const totalCosts   = data.materialCosts + data.laborCosts;
  const grossProfit  = totalRevenue - totalCosts;
  const grossMargin  = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const GRN          = grossProfit >= 0 ? "#15803D" : "#B91C1C";
  const GRN_BG       = grossProfit >= 0 ? "#F0FDF4" : "#FEF2F2";
  const genDate      = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Inline table rows — no left/right padding (body provides it via 32px sides)
  const row = (label: string, amount: number, opts: { alt?: boolean; red?: boolean; redBg?: boolean } = {}) => `
    <tr style="background:${opts.redBg ? "#FEF2F2" : opts.alt ? "#FAF8F5" : "#fff"};">
      <td style="padding:13px 0 13px 14px;font-size:13px;color:${opts.red ? "#B91C1C" : "#3A3A38"};">${label}</td>
      <td style="padding:13px 0 13px 0;font-size:13px;text-align:right;color:${opts.red ? "#B91C1C" : "#3A3A38"};font-variant-numeric:tabular-nums;">${fmt(amount)}</td>
    </tr>`;

  const totalRow = (label: string, amount: number, opts: { red?: boolean } = {}) => `
    <tr style="background:${opts.red ? "#FEF2F2" : "#F0EDE8"};">
      <td style="padding:14px 0 14px 14px;font-size:13px;font-weight:700;color:${opts.red ? "#B91C1C" : "#0A0A0A"};border-top:2px solid #BB984D;">${label}</td>
      <td style="padding:14px 0 14px 0;font-size:13px;font-weight:700;text-align:right;color:${opts.red ? "#B91C1C" : "#0A0A0A"};border-top:2px solid #BB984D;font-variant-numeric:tabular-nums;">${fmt(amount)}</td>
    </tr>`;

  // Section headers bleed full-width by breaking out of body's 32px padding via negative margin
  const sectionHead = (label: string, mt = "18px") =>
    `<div style="background:#0A0A0A;color:#BB984D;font-size:9px;font-weight:500;
        letter-spacing:2px;text-transform:uppercase;padding:7px 32px;
        margin:${mt} -32px 0;">${label}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:794px;height:1122px;background:#fff;font-family:'Inter',Arial,sans-serif;color:#3A3A38;}
    .doc{width:794px;height:1122px;display:flex;flex-direction:column;background:#fff;}
    .body{flex:1;padding:0 32px 24px;overflow:hidden;}
    table{width:100%;border-collapse:collapse;}
    ::-webkit-scrollbar{display:none;}
  </style>
</head>
<body>
<div class="doc">

  <!-- ── Header ── -->
  <div style="background:#0A0A0A;padding:28px 32px;text-align:center;">
    <img src="${logoUrl}" style="height:56px;width:auto;display:block;margin:0 auto 14px auto;" alt="Logo"/>
    <div style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#BB984D;margin:0 0 10px 0;">Butler &amp; Associates Construction, Inc.</div>
    <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">Profit &amp; Loss Statement</div>
    <div style="font-size:12px;color:#888;">Period: ${data.periodLabel}</div>
  </div>
  <!-- Gold rule -->
  <div style="height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);flex-shrink:0;"></div>

  <!-- ── Summary bar ── -->
  <div style="background:#F5F3EF;padding:16px 32px;display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #E8E4DC;flex-shrink:0;">
    ${[
      ["Total Revenue",  fmt(totalRevenue), "#3A3A38"],
      ["Total Costs",    fmt(totalCosts),   "#B91C1C"],
      ["Gross Profit",   fmt(grossProfit),  GRN],
      ["Gross Margin",   fmtPct(grossMargin), GRN],
    ].map(([label, value, color]) => `
      <div style="padding-right:12px;">
        <div style="font-size:9px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:#888;margin-bottom:4px;">${label}</div>
        <div style="font-size:17px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;">${value}</div>
      </div>`).join("")}
  </div>

  <!-- ── Body ── -->
  <div class="body">

    <!-- REVENUE -->
    ${sectionHead("Revenue", "0")}
    <table>
      ${row("Material Sold", data.materialSold)}
      ${row("Labor Sold", data.laborSold, { alt: true })}
      ${data.otherSold > 0 ? row("Other", data.otherSold) : ""}
      ${totalRow("Total Revenue", totalRevenue)}
    </table>

    <!-- COGS -->
    ${sectionHead("Cost of Goods Sold")}
    <table>
      ${row("Material Costs", data.materialCosts, { red: true })}
      ${row("Labor Costs", data.laborCosts, { red: true, redBg: true })}
      ${totalRow("Total COGS", totalCosts, { red: true })}
    </table>

    <!-- Gross Profit box -->
    <div style="margin-top:18px;background:${GRN_BG};border-top:2px solid #BB984D;border-bottom:2px solid #BB984D;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:15px;font-weight:700;color:${GRN};">Gross Profit</div>
        <div style="font-size:12px;color:#888;margin-top:4px;">Gross Margin</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:15px;font-weight:700;color:${GRN};font-variant-numeric:tabular-nums;">${fmt(grossProfit)}</div>
        <div style="font-size:12px;font-weight:600;color:${GRN};margin-top:4px;">${fmtPct(grossMargin)}</div>
      </div>
    </div>

  </div>

  <!-- ── Footer (pinned to bottom) ── -->
  <div style="background:#0A0A0A;padding:14px 32px;flex-shrink:0;">
    <div style="font-size:10px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:#BB984D;margin-bottom:3px;">
      Butler &amp; Associates Construction, Inc.
    </div>
    <div style="font-size:11px;color:#555;margin-bottom:5px;">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</div>
    <div style="font-size:10px;color:#444;line-height:1.5;">
      Generated ${genDate} · Revenue reflects estimate line items created in period.
      Costs reflect receipts uploaded in period. Verify dates align with your accounting method before filing.
    </div>
  </div>

</div>
</body></html>`;
}

/* ─── Preview HTML ───────────────────────────────────────────────────────── */
function buildPreviewHtml(data: PLData, logoUrl: string): string {
  const totalRevenue = data.materialSold + data.laborSold + data.otherSold;
  const totalCosts   = data.materialCosts + data.laborCosts;
  const grossProfit  = totalRevenue - totalCosts;
  const grossMargin  = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const GRN_FG = grossProfit >= 0 ? "#15803D" : "#B91C1C";
  const GRN_BG = grossProfit >= 0 ? "#F0FDF4" : "#FEF2F2";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',Arial,sans-serif;background:#F5F3EF;color:#3A3A38;padding:24px 16px;}
    .page{max-width:620px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);}
    .hdr{background:#0A0A0A;padding:28px 32px;text-align:center;}
    .eyebrow{font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#BB984D;margin-bottom:10px;}
    .title{font-size:19px;font-weight:700;color:#fff;margin-bottom:3px;}
    .period{font-size:12px;color:#888;}
    .gold{height:2px;background:linear-gradient(90deg,#BB984D,#8A7040);}
    .summary{background:#F5F3EF;padding:14px 28px;display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #E8E4DC;}
    .slabel{font-size:9px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:3px;}
    .sval{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;}
    .body{padding:0 28px 24px;background:#fff;}
    .sec{background:#0A0A0A;color:#BB984D;font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;padding:7px 14px;margin:16px -28px 0;}
    table{width:100%;border-collapse:collapse;}
    td{padding:8px 0;font-size:13px;}
    .lbl{padding-left:14px;}
    .amt{text-align:right;font-variant-numeric:tabular-nums;}
    .alt{background:#FAF8F5;}
    .div td{border-bottom:1px solid #E8E4DC;}
    .tot td{font-weight:700;border-top:2px solid #BB984D;background:#F0EDE8;padding:9px 0;color:#0A0A0A;}
    .red td{color:#B91C1C;}
    .redbg td{background:#FEF2F2;color:#B91C1C;}
    .totred td{font-weight:700;border-top:2px solid #BB984D;background:#FEF2F2;color:#B91C1C;padding:9px 0;}
    .pbox{margin:16px 0 0;background:${GRN_BG};border-top:2px solid #BB984D;border-bottom:2px solid #BB984D;padding:14px 18px;}
    .pr{display:flex;justify-content:space-between;}
    .plbl{font-size:14px;font-weight:700;color:${GRN_FG};}
    .pamt{font-size:14px;font-weight:700;color:${GRN_FG};}
    .mr{display:flex;justify-content:space-between;margin-top:4px;}
    .mlbl{font-size:12px;color:#888;}
    .mamt{font-size:12px;font-weight:600;color:${GRN_FG};}
    .ftr{background:#0A0A0A;padding:12px 28px;}
    .fco{font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#BB984D;margin-bottom:3px;}
    .fadr{font-size:11px;color:#555;margin-bottom:5px;}
    .fnote{font-size:10px;color:#444;line-height:1.5;}
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:4px}
  </style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <img src="${logoUrl}" style="height:56px;width:auto;display:block;margin:0 auto 14px auto;" alt="Logo"/>
    <div class="eyebrow">Butler &amp; Associates Construction, Inc.</div>
    <div class="title">Profit &amp; Loss Statement</div>
    <div class="period">Period: ${data.periodLabel}</div>
  </div>
  <div class="gold"></div>
  <div class="summary">
    <div><div class="slabel">Total Revenue</div><div class="sval" style="color:#3A3A38">${fmt(totalRevenue)}</div></div>
    <div><div class="slabel">Total Costs</div><div class="sval" style="color:#B91C1C">${fmt(totalCosts)}</div></div>
    <div><div class="slabel">Gross Profit</div><div class="sval" style="color:${GRN_FG}">${fmt(grossProfit)}</div></div>
    <div><div class="slabel">Gross Margin</div><div class="sval" style="color:${GRN_FG}">${fmtPct(grossMargin)}</div></div>
  </div>
  <div class="body">
    <div class="sec">Revenue</div>
    <table>
      <tr class="div"><td class="lbl">Material Sold</td><td class="amt">${fmt(data.materialSold)}</td></tr>
      <tr class="alt div"><td class="lbl">Labor Sold</td><td class="amt">${fmt(data.laborSold)}</td></tr>
      ${data.otherSold > 0 ? `<tr class="div"><td class="lbl">Other</td><td class="amt">${fmt(data.otherSold)}</td></tr>` : ""}
      <tr class="tot"><td class="lbl">Total Revenue</td><td class="amt">${fmt(totalRevenue)}</td></tr>
    </table>
    <div class="sec">Cost of Goods Sold</div>
    <table>
      <tr class="red div"><td class="lbl">Material Costs</td><td class="amt">${fmt(data.materialCosts)}</td></tr>
      <tr class="redbg div"><td class="lbl">Labor Costs</td><td class="amt">${fmt(data.laborCosts)}</td></tr>
      <tr class="totred"><td class="lbl">Total COGS</td><td class="amt">${fmt(totalCosts)}</td></tr>
    </table>
    <div class="pbox">
      <div class="pr"><span class="plbl">Gross Profit</span><span class="pamt">${fmt(grossProfit)}</span></div>
      <div class="mr"><span class="mlbl">Gross Margin</span><span class="mamt">${fmtPct(grossMargin)}</span></div>
    </div>
  </div>
  <div class="ftr">
    <div class="fco">Butler &amp; Associates Construction, Inc.</div>
    <div class="fadr">6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806</div>
    <div class="fnote">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · Revenue reflects estimate line items created in period. Costs reflect receipts uploaded in period.</div>
  </div>
</div>
</body></html>`;
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function PLReport() {
  const [fromMonth, setFromMonth] = useState(now.getMonth());
  const [fromYear,  setFromYear]  = useState(now.getFullYear());
  const [toMonth,   setToMonth]   = useState(now.getMonth());
  const [toYear,    setToYear]    = useState(now.getFullYear());
  const [loading,     setLoading]     = useState(false);
  const [data,        setData]        = useState<PLData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!data) return;
    setExportingPdf(true);
    try {

      // A4 at 96dpi = 794 × 1122px — document is built to exactly these dimensions
      const A4_PX_W = 794;
      const A4_PX_H = 1122;

      const iframe = document.createElement("iframe");
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_PX_W}px;height:${A4_PX_H}px;border:0;`;
      document.body.appendChild(iframe);

      const iDoc = iframe.contentDocument!;
      iDoc.open();
      iDoc.write(buildPdfDocHtml(data, baLogoUrl));
      iDoc.close();

      // Wait for Google Fonts to load inside iframe
      await new Promise((r) => setTimeout(r, 800));

      const canvas = await html2canvas(iDoc.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width:       A4_PX_W,
        height:      A4_PX_H,
        windowWidth: A4_PX_W,
        scrollX: 0,
        scrollY: 0,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      // Fill the full A4 page — document HTML is sized to exactly match
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);

      pdf.save(`PL_${data.periodLabel.replace(/\s+–\s+/g, "_to_").replace(/\s/g, "_")}.pdf`);
    } catch (err: any) {
      toast.error(err.message || "PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerate = async () => {
    // Validate range
    const fromDate = new Date(fromYear, fromMonth, 1);
    const toDate   = new Date(toYear,   toMonth,   1);
    if (fromDate > toDate) {
      toast.error("'From' date must be before or equal to 'To' date.");
      return;
    }

    setLoading(true);
    try {
      const rangeStart = fromDate.toISOString();
      const rangeEnd   = new Date(toYear, toMonth + 1, 1).toISOString();

      const fromLabel  = `${MONTHS[fromMonth]} ${fromYear}`;
      const toLabel    = `${MONTHS[toMonth]} ${toYear}`;
      const periodLabel = fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;

      // Get client IDs in active or completed pipeline stages only
      const { data: eligibleClients } = await supabase
        .from("clients")
        .select("id, pipeline_stage:pipeline_stages!pipeline_stage_id(name)")
        .eq("is_discarded", false);
      const eligibleClientIds = (eligibleClients ?? [])
        .filter((c: any) => ["active", "completed"].includes((c.pipeline_stage?.name ?? "").toLowerCase()))
        .map((c: any) => c.id);

      // Revenue: estimates created in range → line items (active + completed clients only)
      const { data: estimates, error: propErr } = await supabase
        .from("estimates")
        .select("id")
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd)
        .in("client_id", eligibleClientIds.length > 0 ? eligibleClientIds : ["00000000-0000-0000-0000-000000000000"]);
      if (propErr) throw new Error(propErr.message);

      let materialSold = 0, laborSold = 0, otherSold = 0;
      let materialCosts = 0, laborCosts = 0;

      if (estimates && estimates.length > 0) {
        const ids = estimates.map((p: any) => p.id);
        const { data: lineItems, error: liErr } = await supabase
          .from("estimate_line_items")
          .select("total_price, labor_cost, material_cost, quantity")
          .in("estimate_id", ids);
        if (liErr) throw new Error(liErr.message);
        for (const li of lineItems ?? []) {
          const revenue = Number(li.total_price) || 0;
          const qty = Number(li.quantity) || 1;
          const lc = Number(li.labor_cost || 0) * qty;
          const mc = Number(li.material_cost || 0) * qty;
          const totalCost = lc + mc;
          // Split revenue proportionally by labor vs material cost
          if (totalCost > 0) {
            laborSold    += (lc / totalCost) * revenue;
            materialSold += (mc / totalCost) * revenue;
          } else {
            otherSold += revenue;
          }
          // Costs = actual labor + material cost from line items
          laborCosts    += lc;
          materialCosts += mc;
        }
      }

      setData({ materialSold, laborSold, otherSold, materialCosts, laborCosts, fromLabel, toLabel, periodLabel });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = data ? data.materialSold + data.laborSold + data.otherSold : 0;
  const totalCosts   = data ? data.materialCosts + data.laborCosts : 0;
  const grossProfit  = totalRevenue - totalCosts;
  const grossMargin  = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* ── Controls ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileBarChart2 className="h-4 w-4" />
            Generate Profit &amp; Loss Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* From */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</p>
              <div className="flex gap-2">
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={fromMonth}
                  onChange={(e) => setFromMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={fromYear}
                  onChange={(e) => setFromYear(Number(e.target.value))}
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <span className="text-muted-foreground pb-1">→</span>

            {/* To */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
              <div className="flex gap-2">
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={toMonth}
                  onChange={(e) => setToMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                >
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
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => { exportToExcel(data, baLogoUrl).catch((e) => toast.error(e.message || "Export failed")); }}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
                {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                {exportingPdf ? "Exporting…" : "Export PDF"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Report ── */}
      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue",  value: totalRevenue, color: "" },
              { label: "Total Costs",    value: totalCosts,   color: "text-red-600" },
              { label: "Gross Profit",   value: grossProfit,  color: grossProfit >= 0 ? "text-green-600" : "text-red-600" },
              { label: "Gross Margin",   value: null,         pct: grossMargin, color: grossMargin >= 0 ? "text-green-600" : "text-red-600" },
            ].map(({ label, value, pct, color }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold mt-0.5 ${color}`}>
                    {pct !== undefined ? fmtPct(pct) : fmt(value!)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* P&L Statement */}
          <Card>
            <CardHeader className="pb-0">
              <div className="text-center space-y-0.5 pb-3 border-b">
                <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                  Butler &amp; Associates Construction, Inc.
                </p>
                <h2 className="text-lg font-bold">Profit &amp; Loss Statement</h2>
                <p className="text-sm text-muted-foreground">{data.periodLabel}</p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm">
                <tbody>
                  {/* REVENUE */}
                  <tr><td colSpan={2} className="pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</td></tr>
                  <tr className="border-b border-dashed"><td className="py-2 pl-5 text-foreground">Material Sold</td><td className="py-2 text-right font-mono">{fmt(data.materialSold)}</td></tr>
                  <tr className="border-b border-dashed"><td className="py-2 pl-5 text-foreground">Labor Sold</td><td className="py-2 text-right font-mono">{fmt(data.laborSold)}</td></tr>
                  {data.otherSold > 0 && <tr className="border-b border-dashed"><td className="py-2 pl-5 text-foreground">Other</td><td className="py-2 text-right font-mono">{fmt(data.otherSold)}</td></tr>}
                  <tr className="bg-muted/40 font-semibold border-t-2"><td className="py-2.5 pl-5">Total Revenue</td><td className="py-2.5 text-right font-mono">{fmt(totalRevenue)}</td></tr>

                  {/* COGS */}
                  <tr><td colSpan={2} className="pt-6 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cost of Goods Sold</td></tr>
                  <tr className="border-b border-dashed"><td className="py-2 pl-5">Material Costs</td><td className="py-2 text-right font-mono text-red-600">{fmt(data.materialCosts)}</td></tr>
                  <tr className="border-b border-dashed"><td className="py-2 pl-5">Labor Costs</td><td className="py-2 text-right font-mono text-red-600">{fmt(data.laborCosts)}</td></tr>
                  <tr className="bg-red-50 font-semibold border-t-2"><td className="py-2.5 pl-5 text-red-700">Total COGS</td><td className="py-2.5 text-right font-mono text-red-600">{fmt(totalCosts)}</td></tr>

                  {/* BOTTOM LINE */}
                  <tr><td colSpan={2} className="pt-6 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bottom Line</td></tr>
                  <tr className={`font-bold text-base border-t-2 border-b-2 ${grossProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                    <td className={`py-3 pl-5 ${grossProfit >= 0 ? "text-green-700" : "text-red-700"}`}>Gross Profit</td>
                    <td className={`py-3 text-right font-mono ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(grossProfit)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pl-5 text-muted-foreground">Gross Margin</td>
                    <td className={`py-2 text-right font-mono font-semibold ${grossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtPct(grossMargin)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-[11px] text-muted-foreground mt-5 pt-3 border-t leading-relaxed">
                Revenue reflects proposal line items with creation dates within the selected period.
                Costs reflect receipts uploaded within the selected period.
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

      {/* ── PDF Preview Dialog ── */}
      {data && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent style={{ width: "700px", maxWidth: "95vw" }} className="flex flex-col p-0 gap-0 h-[88vh]">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Report Preview — {data.periodLabel}
              </DialogTitle>
              <DialogDescription>
                This is exactly how the exported PDF will look.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg">
              <iframe
                srcDoc={buildPreviewHtml(data, baLogoUrl)}
                className="w-full h-full border-0"
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
