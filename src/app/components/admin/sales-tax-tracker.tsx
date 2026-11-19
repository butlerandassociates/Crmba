import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Download, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Sales Tax Tracker (Admin Portal > Reports, below the Profit & Loss report). Jonathan, Nov 18 2026:
// "keep track of the sales tax I've sold on client projects ... report sales tax each month / quarter / year".
// Layout follows his Figma ("Add Sales Tax Tracker").
//
// Where the numbers come from (one row per signed proposal):
//   - tax collected  = estimates.tax_amount (9% / zip rate on MATERIALS only, labor is never taxed), minus the tax that
//                      approved change orders added later. That original tax counts in the month the client signed
//                      (estimates.accepted_at).
//   - change orders  = each merged change order is its OWN row, in the month it was approved (Jonathan, Nov 20 2026).
//                      Its tax is change_orders.tax_amount (migration 138, saved when the CO is merged; negative for a
//                      credit). Change orders merged before that estimate it from their items (qty x material cost x
//                      rate) and are marked "estimated".
//   - rate + place   = parsed from the proposal's tax label ("Sales Tax (10.5% on materials) — Harvest"); older proposals
//                      without a label fall back to the client's ZIP in zip_tax_rates, then to estimates.tax_rate
//   - taxable amount = tax collected / rate
// Discarded (canceled) clients are left out, as are proposals that collected no tax.

type Granularity = "Monthly" | "Quarterly" | "Yearly";

interface TaxRow {
  id: string;
  date: Date;
  client: string;
  jurisdiction: string;
  zip: string;
  taxable: number;
  rate: number;
  tax: number;
  note?: string; // e.g. "Change order: Added patio"
  estimated?: boolean;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const periodKey = (d: Date, g: Granularity) =>
  g === "Monthly" ? `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    : g === "Quarterly" ? `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
      : String(d.getFullYear());

// sort key so the newest period comes first
const periodSortValue = (d: Date, g: Granularity) =>
  g === "Monthly" ? d.getFullYear() * 12 + d.getMonth()
    : g === "Quarterly" ? d.getFullYear() * 4 + Math.floor(d.getMonth() / 3)
      : d.getFullYear();

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function SalesTaxTracker() {
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("Monthly");
  const [period, setPeriod] = useState("");
  const [city, setCity] = useState("All cities");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [estRes, zipRes, coRes] = await Promise.all([
          supabase
            .from("estimates")
            .select("id, client_id, tax_rate, tax_amount, tax_label, accepted_at, clients(first_name, last_name, zip, is_discarded)")
            .eq("status", "accepted")
            .not("accepted_at", "is", null),
          supabase.from("zip_tax_rates").select("zip_code, county, total_rate"),
          supabase
            .from("change_orders")
            .select("id, client_id, title, approved_at, updated_at, tax_amount, items:change_order_items(quantity, material_cost)")
            .eq("status", "merged"),
        ]);
        if (estRes.error) throw estRes.error;
        // change-order tax is optional: if the lookup fails, the proposal rows still show (CO tax stays inside them)
        const allCos: any[] = coRes.error ? [] : ((coRes.data ?? []) as any[]);
        const zipMap = new Map<string, { county: string; rate: number }>(
          (zipRes.data ?? []).map((z: any) => [String(z.zip_code).trim(), { county: String(z.county ?? ""), rate: Number(z.total_rate) || 0 }]),
        );
        const out: TaxRow[] = [];
        const ests = (estRes.data ?? []) as any[];
        // a client's change orders belong to their most recently signed proposal
        const latestEstForClient = new Map<string, any>();
        for (const e of ests) {
          const cur = latestEstForClient.get(e.client_id);
          if (!cur || new Date(e.accepted_at) > new Date(cur.accepted_at)) latestEstForClient.set(e.client_id, e);
        }
        for (const e of ests) {
          const client = Array.isArray(e.clients) ? e.clients[0] : e.clients;
          if (!client || client.is_discarded) continue;
          const zip = String(client.zip ?? "").trim();
          const label = String(e.tax_label ?? "");
          const m = label.match(/\((\d+(?:\.\d+)?)%/);
          const labelRate = m ? Number(m[1]) : 0;
          const labelPlace = label.includes("—") ? label.split("—").pop()!.trim() : "";
          const z = zipMap.get(zip);
          const rate = labelRate || z?.rate || Number(e.tax_rate) || 0;
          if (rate <= 0) continue;
          const clientName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Client";
          const jurisdiction = labelPlace || z?.county || "Alabama";
          const total = Number(e.tax_amount) || 0;

          // this proposal's approved change orders: one row each, in the month approved
          const cos = latestEstForClient.get(e.client_id) === e ? allCos.filter((c) => c.client_id === e.client_id) : [];
          let coTaxSum = 0;
          const coRows: TaxRow[] = [];
          for (const c of cos) {
            const stored = c.tax_amount != null;
            const delta = stored
              ? Number(c.tax_amount) || 0
              : Math.round(((c.items ?? []) as any[]).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.material_cost) || 0), 0) * (rate / 100) * 100) / 100;
            coTaxSum += delta;
            if (delta === 0) continue;
            coRows.push({
              id: `co-${c.id}`,
              date: new Date(c.approved_at || c.updated_at),
              client: clientName,
              jurisdiction,
              zip,
              taxable: Math.round((delta / (rate / 100)) * 100) / 100,
              rate,
              tax: delta,
              note: `Change order: ${c.title ?? "untitled"}`,
              estimated: !stored,
            });
          }

          // the proposal's own tax = what is on it now minus what its change orders added
          const baseTax = Math.max(0, Math.round((total - coTaxSum) * 100) / 100);
          if (baseTax > 0) {
            out.push({
              id: e.id,
              date: new Date(e.accepted_at),
              client: clientName,
              jurisdiction,
              zip,
              taxable: Math.round((baseTax / (rate / 100)) * 100) / 100,
              rate,
              tax: baseTax,
            });
          }
          out.push(...coRows);
        }
        // the same place is spelled "Harvest" on some proposals and "Harvest County" on others: use the short name
        // whenever both spellings exist ("Madison County" stays, there is no plain "Madison")
        const names = new Set(out.map((r) => r.jurisdiction));
        for (const r of out) {
          const short = r.jurisdiction.replace(/\s+County$/i, "");
          if (short !== r.jurisdiction && names.has(short)) r.jurisdiction = short;
        }
        out.sort((a, b) => b.date.getTime() - a.date.getTime());
        if (!cancelled) setRows(out);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message ?? "Could not load sales tax data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // periods that have sales, newest first; always offer the current period so an empty month can be viewed
  const periodOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(periodKey(r.date, granularity), periodSortValue(r.date, granularity));
    const now = new Date();
    map.set(periodKey(now, granularity), periodSortValue(now, granularity));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [rows, granularity]);

  // keep the selected period valid when the granularity changes / data arrives
  useEffect(() => {
    if (!periodOptions.includes(period)) setPeriod(periodOptions[0] ?? "");
  }, [periodOptions, period]);

  const cityOptions = useMemo(() => ["All cities", ...Array.from(new Set(rows.map((r) => r.jurisdiction))).sort()], [rows]);

  const filtered = useMemo(
    () => rows.filter((r) => periodKey(r.date, granularity) === period && (city === "All cities" || r.jurisdiction === city)),
    [rows, granularity, period, city],
  );
  const taxable = filtered.reduce((s, r) => s + r.taxable, 0);
  const taxDue = filtered.reduce((s, r) => s + r.tax, 0);
  const avgRate = taxable > 0 ? (taxDue / taxable) * 100 : 0; // weighted by taxable amount

  const handleExportPdf = () => {
    const body = filtered
      .map((r) => `<tr><td>${fmtDate(r.date)}</td><td><b>${escapeHtml(r.client)}</b>${r.note ? `<br><small>${escapeHtml(r.note)}${r.estimated ? " (estimated)" : ""}</small>` : ""}</td><td>${escapeHtml(r.jurisdiction)}, AL ${escapeHtml(r.zip)}</td><td>${money(r.taxable)}</td><td>${r.rate.toFixed(2)}%</td><td><b>${money(r.tax)}</b></td></tr>`)
      .join("");
    const popup = window.open("", "_blank", "width=1000,height=760");
    if (!popup) { toast.error("Allow pop-ups to export the PDF"); return; }
    popup.document.write(`<!doctype html><html><head><title>Sales Tax Report — ${escapeHtml(period)}</title><style>
      body{font-family:Arial,sans-serif;color:#16151d;padding:40px}header{border-top:24px solid #000;padding-top:22px}h1{font-size:22px;margin:0}p{color:#747386}.summary{display:flex;gap:16px;margin:28px 0}.card{border:1px solid #dedee3;border-radius:8px;padding:16px 20px;min-width:180px}.card small{display:block;color:#777687;margin-bottom:6px}.card b{font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f1f4;text-align:left;padding:10px}td{border-bottom:1px solid #e5e5e9;padding:12px 10px}tfoot td{font-weight:700;background:#f7f7f8}footer{font-size:10px;color:#777687;margin-top:26px}</style></head>
      <body><header><h1>BUTLER &amp; ASSOCIATES CONSTRUCTION, INC.</h1><p>Alabama Sales Tax Liability · ${granularity} · ${escapeHtml(period)} · ${escapeHtml(city)}</p></header>
      <div class="summary"><div class="card"><small>Taxable goods &amp; materials sold</small><b>${money(taxable)}</b></div><div class="card"><small>Sales tax due</small><b>${money(taxDue)}</b></div></div>
      <table><thead><tr><th>Date</th><th>Client</th><th>Jurisdiction</th><th>Taxable Materials</th><th>Rate</th><th>Tax Due</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3">TOTAL FOR ${escapeHtml(period.toUpperCase())}</td><td>${money(taxable)}</td><td></td><td>${money(taxDue)}</td></tr></tfoot></table>
      <footer>Includes taxable goods and materials sold only. Labor and other non-material charges are excluded. Prepared for reference when filing through the Alabama My Taxes portal.</footer><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const selectCls = "h-9 min-w-[175px] rounded-md border border-[#d9d9de] bg-white px-3 text-sm";

  return (
    <section className="mt-6 border-t border-[#e4e4e8] pt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[17px] font-bold">Sales Tax Tracker</h2>
          <p className="mt-1 text-[13px] text-[#747386]">Track tax collected only on taxable goods and materials sold to each client.</p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={loading || filtered.length === 0}
          className="inline-flex h-10 items-center gap-2 self-start rounded-lg border border-[#dedee3] bg-white px-4 text-sm font-semibold hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-end gap-3.5 rounded-t-[13px] border border-[#dedee3] bg-[#fafafa] px-4 py-3.5">
        <div className="mr-auto flex w-full self-center rounded-[9px] bg-[#ececef] p-[3px] sm:w-auto">
          {(["Monthly", "Quarterly", "Yearly"] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={`h-8 flex-1 rounded-[7px] px-[18px] text-xs font-semibold sm:flex-none ${granularity === g ? "bg-white text-[#17161d] shadow-[0_1px_4px_#00000012]" : "text-[#6f6e7e]"}`}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="min-w-[180px] flex-1 sm:flex-none">
          <span className="mb-2 block text-[11px] font-semibold text-[#777687]">FILING PERIOD</span>
          <select className={`${selectCls} w-full`} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 sm:flex-none">
          <span className="mb-2 block text-[11px] font-semibold text-[#777687]">CITY / JURISDICTION</span>
          <select className={`${selectCls} w-full`} value={city} onChange={(e) => setCity(e.target.value)}>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {/* summary */}
      <div className="grid grid-cols-1 border border-t-0 border-[#dedee3] sm:grid-cols-3">
        <div className="flex min-h-[110px] flex-col justify-center border-b border-[#e3e3e7] px-6 sm:border-b-0 sm:border-r">
          <span className="text-[10px] font-bold tracking-[0.6px] text-[#777687]">TAXABLE GOODS &amp; MATERIALS SOLD</span>
          <strong className="mb-[3px] mt-1.5 text-[23px] tracking-[-0.6px]">{money(taxable)}</strong>
          <small className="text-[11px] text-[#82818f]">{filtered.length} {filtered.length === 1 ? "sale" : "sales / change orders"}</small>
        </div>
        <div className="flex min-h-[110px] flex-col justify-center border-b border-[#e3e3e7] px-6 sm:border-b-0 sm:border-r">
          <span className="text-[10px] font-bold tracking-[0.6px] text-[#777687]">AVERAGE TAX RATE</span>
          <strong className="mb-[3px] mt-1.5 text-[23px] tracking-[-0.6px]">{avgRate.toFixed(2)}%</strong>
          <small className="text-[11px] text-[#82818f]">Based on client ZIP code</small>
        </div>
        <div className="flex min-h-[110px] flex-col justify-center bg-[#0b0a17] px-6 text-white">
          <span className="text-[10px] font-bold tracking-[0.6px] text-[#c1c0ca]">SALES TAX DUE</span>
          <strong className="mb-[3px] mt-1.5 text-[23px] tracking-[-0.6px]">{money(taxDue)}</strong>
          <small className="text-[11px] text-[#c1c0ca]">For {period || "—"}</small>
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-b-[13px] border border-t-0 border-[#dedee3]">
        <div className="flex min-h-[67px] items-center justify-between px-[19px]">
          <div>
            <h3 className="text-[13px] font-semibold">Tax collected by client</h3>
            <p className="mt-1 text-[10px] text-[#7c7b89]">Taxable goods and materials only · {granularity} breakdown for {period || "—"}</p>
          </div>
          <span className="rounded-xl bg-[#eeeef1] px-[9px] py-[5px] text-[10px] font-semibold text-[#575663]">Ready to file</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-[11px]">
            <thead>
              <tr>
                {["Date", "Client", "Tax Jurisdiction", "Taxable Materials", "Rate", "Tax Collected"].map((h) => (
                  <th key={h} className="h-[37px] bg-[#f1f1f4] px-[18px] text-left text-[9px] font-semibold uppercase tracking-[0.4px] text-[#747381]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-[18px] py-10 text-center text-sm text-[#7c7b89]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading sales tax…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="border-t border-[#ececef] px-[18px] py-10 text-center text-sm text-[#7c7b89]">No taxable sales in {period || "this period"}.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id}>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] text-[#55545f]">{fmtDate(r.date)}</td>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] font-semibold text-[#222127]">
                    {r.client}
                    {r.note && <small className="mt-[3px] block text-[9px] font-normal text-[#898895]">{r.note}{r.estimated ? " (estimated)" : ""}</small>}
                  </td>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] text-[#55545f]">
                    <div className="flex items-center gap-[7px]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <div>{r.jurisdiction}, AL{r.zip && <small className="mt-[3px] block text-[9px] text-[#898895]">{r.zip}</small>}</div>
                    </div>
                  </td>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] text-[#55545f]">{money(r.taxable)}</td>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] text-[#55545f]">{r.rate.toFixed(2)}%</td>
                  <td className="border-t border-[#ececef] px-[18px] py-[13px] font-semibold text-[#222127]">{money(r.tax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="border-t border-[#ececef] bg-[#f7f7f8] px-[18px] py-[13px] text-[9px] font-bold tracking-[0.4px] text-[#656471]">TOTAL FOR {(period || "—").toUpperCase()}</td>
                <td className="border-t border-[#ececef] bg-[#f7f7f8] px-[18px] py-[13px] font-bold text-[#222127]">{money(taxable)}</td>
                <td className="border-t border-[#ececef] bg-[#f7f7f8]" />
                <td className="border-t border-[#ececef] bg-[#f7f7f8] px-[18px] py-[13px] font-bold text-[#222127]">{money(taxDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="m-[13px] flex min-h-[64px] flex-wrap items-center justify-between gap-[18px] rounded-[9px] bg-[#f1f1f4] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              <strong className="block text-[11px]">Your materials sales tax summary is ready</strong>
              <small className="mt-[3px] block text-[9px] text-[#747381]">Labor and non-material charges are excluded. Use the PDF as a reference in the Alabama My Taxes portal.</small>
            </span>
          </div>
          <button type="button" onClick={handleExportPdf} disabled={loading || filtered.length === 0} className="hidden items-center gap-1.5 text-[10px] font-bold text-[#24232a] disabled:opacity-50 sm:flex">
            Download filing summary <Download className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </section>
  );
}
