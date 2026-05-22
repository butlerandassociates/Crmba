const B = {
  black:  "#0A0A0A",
  gold:   "#BB984D",
  bg:     "#F5F3EF",
  text:   "#3A3A38",
  border: "#E8E4DC",
  rowAlt: "#FAFAF8",
  inter:  "Inter, sans-serif",
  lato:   "Lato, sans-serif",
};

interface ReceiptPayment {
  id: string;
  label: string;
  amount: number;
  paid_date: string | null;
  payment_method: string | null;
  confirmation_code: string | null;
  stripe_fee_amount: number | null;
}

interface Props {
  payment: ReceiptPayment;
  clientName: string;
  clientAddress: string;
}

export function PortalPaymentReceiptExport({ payment, clientName, clientAddress }: Props) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const date = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const feeAmount = payment.stripe_fee_amount ?? 0;
  const baseAmount = feeAmount > 0 ? payment.amount - feeAmount : payment.amount;

  const rows: { label: string; value: string; gold?: boolean }[] = [
    { label: "Milestone", value: payment.label },
  ];
  if (feeAmount > 0) {
    rows.push({ label: "Base Amount", value: fmt(baseAmount) });
    rows.push({ label: "Credit Card Processing Fee (2.3% + $0.30)", value: fmt(feeAmount) });
  }
  if (payment.payment_method) rows.push({ label: "Payment Method", value: payment.payment_method });
  if (payment.paid_date) rows.push({ label: "Date Paid", value: fmtDate(payment.paid_date) });
  if (payment.confirmation_code) rows.push({ label: "Confirmation Code", value: payment.confirmation_code });

  return (
    <div
      id="portal-receipt-export"
      style={{
        fontFamily: B.inter,
        color: B.black,
        background: "#fff",
        width: 794,
        fontSize: 13,
        boxSizing: "border-box",
        minHeight: "29.7cm",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header ── */}
      <div style={{ background: B.black, padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
            alt="B&A"
            style={{ height: 52, width: "auto", flexShrink: 0 }}
            crossOrigin="anonymous"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <p style={{ fontFamily: B.lato, fontSize: 18, fontWeight: 500, color: "#fff", margin: "0 0 4px 0" }}>
              Butler &amp; Associates Construction, Inc.
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "0 0 2px 0" }}>
              6275 University Drive NW, Suite 37-314, Huntsville, AL 35806
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0 }}>
              (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: B.gold, margin: "0 0 4px 0" }}>
            PAYMENT RECEIPT
          </p>
          <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 500, color: "#fff", margin: 0, maxWidth: 200, textAlign: "right" }}>
            {payment.label}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "28px 40px", flex: 1 }}>

        {/* Client + Date row */}
        <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#999", margin: "0 0 4px 0" }}>
              Prepared For
            </p>
            <p style={{ fontFamily: B.lato, fontSize: 13, fontWeight: 500, color: B.black, margin: "0 0 4px 0" }}>{clientName || "—"}</p>
            {clientAddress && (
              <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.65, lineHeight: 1.6 }}>{clientAddress}</p>
            )}
          </div>
          <div>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#999", margin: "0 0 4px 0" }}>
              Date Paid
            </p>
            <p style={{ fontFamily: B.lato, fontSize: 13, fontWeight: 500, color: B.black, margin: 0 }}>
              {fmtDate(payment.paid_date)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderBottom: `1px solid ${B.border}`, marginBottom: 20 }} />

        {/* Section label */}
        <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: B.black, margin: "0 0 14px 0" }}>
          Payment Details
        </p>

        {/* Detail rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "10px 14px",
              background: i % 2 === 0 ? B.rowAlt : "#fff",
              border: `1px solid ${B.border}`,
              borderTop: i === 0 ? `1px solid ${B.border}` : "none",
            }}
          >
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.75 }}>{row.label}</p>
            <p style={{ fontFamily: B.lato, fontSize: 12, fontWeight: 500, color: B.black, margin: 0, fontVariantNumeric: "tabular-nums" }}>{row.value}</p>
          </div>
        ))}

        {/* Amount Paid total row */}
        <div style={{ borderTop: `1px solid ${B.border}`, marginTop: 20, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
              <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 500, color: B.black, margin: 0 }}>Amount Paid</p>
              <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 500, color: B.gold, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                {fmt(payment.amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${B.border}`, padding: "10px 40px 16px", textAlign: "center", background: "#fff" }}>
        <p style={{ fontFamily: B.inter, fontSize: 10, color: "#717182", margin: 0, lineHeight: 1.5 }}>
          Thank you for choosing Butler &amp; Associates Construction, Inc. We appreciate your business.
        </p>
      </div>
    </div>
  );
}
