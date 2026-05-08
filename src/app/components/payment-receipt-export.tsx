import baLogoUrl from "@/assets/ba-logo.png";

interface PaymentStatementExportProps {
  payments: {
    id: string;
    label: string;
    amount: number;
    is_paid?: boolean;
    paid_date?: string | null;
    due_date?: string | null;
    payment_method?: string | null;
    notes?: string | null;
  }[];
  client: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  project: {
    name?: string | null;
    total_value?: number | null;
  } | null;
}

const C = {
  black:   "#0A0A0A",
  gold:    "#BB984D",
  bg:      "#F5F3EF",
  text:    "#3A3A38",
  border:  "#E8E4DC",
  green:   "#166534",
  greenBg: "#F0FDF4",
  red:     "#991B1B",
  redBg:   "#FEF2F2",
  amber:   "#92400E",
  amberBg: "#FFFBEB",
  inter:   "Inter, sans-serif",
  cg:      "'Cormorant Garamond', serif",
};

export function PaymentStatementExport({ payments, client, project }: PaymentStatementExportProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const fmtDate = (d?: string | null) =>
    d ? new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  const today = new Date();
  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || "—";
  const totalAmount = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalPaid   = payments.filter((p) => p.is_paid).reduce((s, p) => s + (p.amount ?? 0), 0);
  const totalDue    = totalAmount - totalPaid;
  const pct = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  const getStatus = (p: PaymentStatementExportProps["payments"][0]) => {
    if (p.is_paid) return { label: "PAID",    color: C.green, bg: C.greenBg, border: "#bbf7d0" };
    if (p.due_date && new Date(p.due_date) < today) return { label: "OVERDUE", color: C.red,   bg: C.redBg,   border: "#fecaca" };
    return                                                  { label: "PENDING", color: C.amber, bg: C.amberBg, border: "#fde68a" };
  };

  return (
    <div
      id="payment-receipt-export-content"
      style={{ width: 794, minHeight: 1122, background: C.bg, fontFamily: C.inter, color: C.text, display: "flex", flexDirection: "column", padding: 0 }}
    >
      {/* ── Header — centered logo + brand + title ── */}
      <div id="payment-stmt-header">
      <div style={{ background: C.black, padding: "28px 48px 24px", textAlign: "center" }}>
        <img
          src={baLogoUrl}
          alt="Butler & Associates"
          style={{ height: 46, width: "auto", display: "block", margin: "0 auto 10px auto" }}
        />
        <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>
          Butler &amp; Associates Construction, Inc.
        </div>
        <div style={{ fontFamily: C.cg, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: 2, marginBottom: 4 }}>
          INVESTMENT STATEMENT
        </div>
      </div>

      {/* Gold rule */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${C.gold}, #8A7040)` }} />
      </div>{/* end payment-stmt-header */}

      {/* ── Body ── */}
      <div id="payment-stmt-body">

      {/* ── Meta row ── */}
      <div style={{ background: "#fff", padding: "18px 48px", display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Date Issued</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(today.toISOString())}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Progress</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? C.green : C.amber }}>{pct}% Collected</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Prepared For</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{clientName}</div>
        </div>
      </div>

      {/* ── Client + Project ── */}
      <div style={{ padding: "22px 48px", display: "flex", gap: 48, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Client</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{clientName}</div>
          {client?.address && <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{client.address}</div>}
          {client?.phone   && <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{client.phone}</div>}
          {client?.email   && <div style={{ fontSize: 12, color: "#666" }}>{client.email}</div>}
        </div>
        {project?.name && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Project</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{project.name}</div>
            {project.total_value != null && (
              <div style={{ fontSize: 12, color: "#666" }}>Contract Value: {fmt(project.total_value)}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Milestones table ── */}
      <div style={{ padding: "22px 48px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead id="payment-stmt-thead">
            <tr style={{ background: C.black }}>
              <th style={{ padding: "9px 14px", textAlign: "left",   color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Description</th>
              <th style={{ padding: "9px 14px", textAlign: "left",   color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Due Date</th>
              <th style={{ padding: "9px 14px", textAlign: "left",   color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Paid Date</th>
              <th style={{ padding: "9px 14px", textAlign: "left",   color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Method</th>
              <th style={{ padding: "9px 14px", textAlign: "center", color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Status</th>
              <th style={{ padding: "9px 14px", textAlign: "right",  color: "#fff", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => {
              const st = getStatus(p);
              return (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafaf8", borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600 }}>{p.label}</td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#666" }}>{fmtDate(p.due_date)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#666" }}>{p.is_paid ? fmtDate(p.paid_date) : "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#666" }}>{p.is_paid && p.payment_method ? p.payment_method : "—"}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", paddingTop: 0, paddingBottom: 10, paddingLeft: 9, paddingRight: 9, borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, textAlign: "right", color: p.is_paid ? C.green : C.text }}>{fmt(p.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Totals block ── */}
      <div style={{ padding: "0 48px 24px" }}>
        <div style={{ borderTop: `2px solid ${C.gold}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: "#666" }}>Total Contract Value</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(project?.total_value ?? totalAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Total Received</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{fmt(totalPaid)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: totalDue > 0 ? C.red : C.green }}>Balance Due</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: totalDue > 0 ? C.red : C.green }}>{fmt(totalDue)}</span>
            </div>
          </div>
        </div>
      </div>

      </div>{/* end payment-stmt-body */}

      {/* Spacer — pushes footer to bottom */}
      <div style={{ flex: 1, background: C.bg }} />

      {/* ── Footer — always dark ── */}
      <div id="payment-stmt-footer">
      <div style={{ background: C.black, padding: "14px 48px", textAlign: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "1.4px", textTransform: "uppercase", color: C.gold, marginBottom: 3 }}>
          Butler &amp; Associates Construction, Inc.
        </div>
        <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>
          6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
        </div>
        <div style={{ fontSize: 10, color: "#555" }}>
          (256) 617-4691 · info@butlerconstruction.co
        </div>
      </div>
      </div>{/* end payment-stmt-footer */}
    </div>
  );
}
