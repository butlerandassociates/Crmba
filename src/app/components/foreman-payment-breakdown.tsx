import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { FileDown, Loader2, HardHat } from "lucide-react";
import { fioAPI, activityLogAPI } from "../utils/api";
import { toast } from "sonner";

interface ForemanPaymentBreakdownProps {
  project: any;
}

export function ForemanPaymentBreakdown({ project }: ForemanPaymentBreakdownProps) {
  const [fio, setFio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.id) return;
    fioAPI.getByProject(project.id)
      .then(setFio)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [project?.id]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const items: any[] = fio?.items || [];
  const total = items.reduce((s, it) =>
    s + (parseFloat(it.quantity) || 0) * (parseFloat(it.labor_cost_per_unit) || 0), 0);

  const exportPDF = () => {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const GOLD = "#BB984D";
    const BLACK = "#0A0A0A";
    const LOGO = "https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png";

    const rows = items.map((item, idx) => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.labor_cost_per_unit) || 0;
      return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f9fafb"};border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:12px;">${item.product_name}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${item.unit}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;">${qty.toLocaleString()}</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;">${rate > 0 ? fmt(rate) : "—"}</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;">${fmt(qty * rate)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Crew Labor Schedule — ${project.name ?? "Project"}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;background:#fff;padding:40px 48px;display:flex;flex-direction:column;min-height:100vh;}@page{margin:0;}table{border-collapse:collapse;width:100%;}</style>
</head><body>
<div style="background:${BLACK};padding:28px 32px;text-align:center;">
  <img src="${LOGO}" alt="Butler &amp; Associates" style="height:56px;width:auto;display:block;margin:0 auto 14px auto;" />
  <p style="font-size:9px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD};margin:0;font-family:Arial,sans-serif;">Butler &amp; Associates Construction, Inc.</p>
</div>
<div style="height:2px;background:linear-gradient(90deg,${GOLD},#8A7040);margin-bottom:24px;"></div>
<div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #d1d5db;">
  <div style="color:${GOLD};font-size:13px;">Project: ${project.name ?? "—"}</div>
  <div style="font-size:13px;">Date: ${today}</div>
</div>
<div style="margin-bottom:24px;">
  <h3 style="font-size:15px;font-weight:bold;margin-bottom:12px;">Scope 1 — ${project.name ?? "Labor Items"}</h3>
  <table>
    <thead>
      <tr style="background:${BLACK};color:#fff;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:bold;">Scope Item</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:80px;">Unit</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:bold;width:70px;">Qty</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:bold;width:90px;">Rate</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:bold;width:110px;">Crew Pay</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <td colspan="4" style="padding:10px 14px;text-align:right;font-size:12px;color:${GOLD};font-weight:bold;border-top:1px solid #e5e7eb;">Subtotal</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;color:${GOLD};font-weight:bold;border-top:1px solid #e5e7eb;">${fmt(total)}</td>
      </tr>
    </tbody>
  </table>
</div>
<div style="background:${BLACK};color:#fff;display:flex;justify-content:space-between;align-items:center;padding:16px 24px;margin-bottom:36px;">
  <div style="font-size:14px;font-weight:bold;letter-spacing:0.5px;">TOTAL CREW PAYOUT</div>
  <div style="font-size:18px;font-weight:bold;color:${GOLD};">${fmt(total)}</div>
</div>
<div style="flex:1;"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px;">
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Butler &amp; Associates Construction</div>
    <div style="border-bottom:1px solid #111;margin-bottom:6px;"></div>
    <div style="font-size:11px;color:#6b7280;">Authorized Signature / Date</div>
  </div>
  <div>
    <div style="font-size:12px;margin-bottom:40px;">Crew Lead / Subcontractor${project.foremanName ? ` — ${project.foremanName}` : ""}</div>
    <div style="border-bottom:1px solid #111;margin-bottom:6px;"></div>
    <div style="font-size:11px;color:#6b7280;">Signature / Date</div>
  </div>
</div>
<div style="margin-top:48px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
  Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup blocked — allow popups and try again."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
    activityLogAPI.create({ client_id: project.client?.id, action_type: "crew_pdf_exported", description: `Crew labor schedule PDF exported — project: ${project.name ?? ""}` }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fio || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <HardHat className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">No Field Installation Order found</p>
        <p className="text-xs mt-1">Create an FIO first by clicking the foreman's name above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans text-[13px]">

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Crew Payment Sheet</h3>
        <Button onClick={exportPDF} variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Black header bar */}
      <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 rounded-sm">
        <span className="text-[18px] font-bold">Butler &amp; Associates Construction</span>
        <span className="text-[15px] font-bold text-[#C9A84C]">Crew Labor Schedule</span>
      </div>

      {/* Project / Date */}
      <div className="flex items-center justify-between border-b border-gray-300 pb-3">
        <span className="text-[#C9A84C] text-sm">Project: {project.name ?? "—"}</span>
        <span className="text-sm text-gray-600">
          Date: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* Scope */}
      <div>
        <h3 className="text-[14px] font-bold mb-3">Scope 1 — {project.name ?? "Labor Items"}</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#111111] text-white">
              <th className="py-2.5 px-3 text-left font-semibold">Scope Item</th>
              <th className="py-2.5 px-3 text-center font-semibold w-16">Unit</th>
              <th className="py-2.5 px-3 text-center font-semibold w-14">Qty</th>
              <th className="py-2.5 px-3 text-right font-semibold w-20">Rate</th>
              <th className="py-2.5 px-3 text-right font-semibold w-24">Crew Pay</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = parseFloat(item.quantity) || 0;
              const rate = parseFloat(item.labor_cost_per_unit) || 0;
              return (
                <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="py-2.5 px-3">{item.product_name}</td>
                  <td className="py-2.5 px-3 text-center">{item.unit}</td>
                  <td className="py-2.5 px-3 text-center">{qty.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right">{rate > 0 ? fmt(rate) : "—"}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{fmt(qty * rate)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={4} className="py-2.5 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">Subtotal</td>
              <td className="py-2.5 px-3 text-right text-[#C9A84C] font-bold border-t border-gray-200">{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Total payout bar */}
      <div className="flex items-center justify-between bg-[#111111] text-white px-6 py-4 rounded-sm">
        <span className="text-sm font-bold tracking-wide">TOTAL CREW PAYOUT</span>
        <span className="text-lg font-bold text-[#C9A84C]">{fmt(total)}</span>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-10 pt-4 border-t border-gray-300 mt-4">
        <div>
          <div className="text-xs mb-8">Butler &amp; Associates Construction</div>
          <div className="border-b border-gray-800 mb-1" />
          <div className="text-[11px] text-gray-500">Authorized Signature / Date</div>
        </div>
        <div>
          <div className="text-xs mb-8">Crew Lead / Subcontractor{project.foremanName ? ` — ${project.foremanName}` : ""}</div>
          <div className="border-b border-gray-800 mb-1" />
          <div className="text-[11px] text-gray-500">Signature / Date</div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
        Butler &amp; Associates Construction, Inc. — butlerconstruction.co — Huntsville, AL
      </div>
    </div>
  );
}
