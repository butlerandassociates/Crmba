// Butler & Associates brand tokens — same as proposal-export
const B = {
  black:  "#0A0A0A",
  gold:   "#BB984D",
  bg:     "#F5F3EF",
  text:   "#3A3A38",
  border: "#E8E4DC",
  rowAlt: "#FAFAF8",
  inter:  "Inter, sans-serif",
  lato:   "Lato, sans-serif",
  cg:     "'Cormorant Garamond', serif",
};

interface ChangeOrderExportProps {
  co: any;         // change_order row (with .items)
  client: any;
  originalTotal?: number;
  newTotal?: number;
}

export function ChangeOrderExport({ co, client, originalTotal, newTotal }: ChangeOrderExportProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
  const items: any[] = co?.items || [];
  const costImpact: number = co?.cost_impact || 0;

  const PageHeader = () => (
    <div>
      <div style={{ background: B.black, padding: "28px 32px", textAlign: "center" as const }}>
        <img
          src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
          alt="Butler & Associates Construction"
          style={{ height: 56, width: "auto", display: "block", margin: "0 auto 14px auto" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
          Butler & Associates Construction, Inc.
        </p>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${B.gold}, #8A7040)` }} />
    </div>
  );

  return (
    <div style={{ fontFamily: B.inter, color: B.black, background: B.bg, width: "100%", fontSize: 13 }}>

      {/* ══ PAGE 1 ══ */}
      <div style={{ minHeight: "29.7cm", boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>
        <PageHeader />

        <div style={{ padding: "36px 48px", flex: 1, display: "flex", flexDirection: "column" as const }}>

          {/* Client info + CO# */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>
                Change Order Prepared For
              </p>
              <p style={{ fontFamily: B.cg, fontSize: 28, fontWeight: 300, color: B.black, margin: "0 0 4px 0", lineHeight: 1.2 }}>
                {clientName || "—"}
              </p>
              {client?.address && (
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.address}</p>
              )}
              {(client?.city || client?.state || client?.zip) && (
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>
                  {[client?.city, client?.state, client?.zip].filter(Boolean).join(", ")}
                </p>
              )}
              {client?.phone && (
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.phone}</p>
              )}
              {client?.email && (
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.email}</p>
              )}
            </div>
            <div style={{ textAlign: "right" as const }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>
                Change Order
              </p>
              <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 700, color: B.black, margin: "0 0 6px 0" }}>
                {co?.title || "—"}
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.text, margin: "0 0 3px 0", opacity: 0.7 }}>
                Date
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>
                {co?.created_at ? fmtDate(co.created_at) : "—"}
              </p>
            </div>
          </div>

          {/* From */}
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 8px 0" }}>
              From
            </p>
            <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 14, color: B.black, margin: "0 0 3px 0" }}>Butler & Associates Construction, Inc.</p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>Phone: (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co</p>
          </div>

          {/* Reason + Timeline */}
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6 }}>
            <div style={{ marginBottom: co?.timeline_impact ? 12 : 0 }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>
                Reason for Change
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 13, lineHeight: 1.7, color: B.text, margin: 0 }}>{co?.reason || "—"}</p>
            </div>
            {co?.timeline_impact && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${B.border}` }}>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>
                  Timeline Impact
                </p>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{co.timeline_impact}</p>
              </div>
            )}
          </div>

          {/* Line items table */}
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", border: `1px solid ${B.border}` }}>
            {/* Table header */}
            <div style={{ background: B.black, padding: "12px 24px", display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 8 }}>
              {["Description", "Qty", "Unit Price", "Total"].map((h) => (
                <p key={h} style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, textAlign: h !== "Description" ? "right" as const : "left" as const }}>
                  {h}
                </p>
              ))}
            </div>

            {items.length === 0 && (
              <div style={{ padding: 24, textAlign: "center" as const, color: B.text, opacity: 0.5 }}>No line items</div>
            )}

            {items.map((item: any, i: number) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 8, padding: "16px 24px", background: i % 2 === 1 ? B.rowAlt : "#fff", borderBottom: `1px solid ${B.bg}`, alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.black, margin: 0 }}>{item.description}</p>
                  {item.category && (
                    <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "2px 0 0 0", opacity: 0.6 }}>{item.category}</p>
                  )}
                </div>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, textAlign: "right" as const }}>{item.quantity}</p>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(item.unit_price)}</p>
                <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 600, color: B.black, margin: 0, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(item.total)}</p>
              </div>
            ))}

            {/* Cost impact + contract totals */}
            <div style={{ borderTop: `2px solid ${B.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 24px", background: B.bg, borderTop: `1px solid ${B.border}` }}>
                <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 700, color: B.black, margin: 0 }}>
                  Change Order Total
                </p>
                <p style={{ fontFamily: B.cg, fontSize: 28, fontWeight: 400, color: costImpact >= 0 ? B.gold : "#C0392B", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {costImpact >= 0 ? "+" : ""}{fmt(costImpact)}
                </p>
              </div>

              {originalTotal != null && newTotal != null && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>Original Contract Total</p>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(originalTotal)}</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "#F0EDE6" }}>
                    <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 700, color: B.black, margin: 0 }}>Revised Contract Total</p>
                    <p style={{ fontFamily: B.cg, fontSize: 24, fontWeight: 400, color: B.gold, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(newTotal)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Signature block — pinned to bottom */}
          <div style={{ marginTop: "auto", paddingTop: 40 }}>
            <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 28 }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 16px 0" }}>
                Authorization
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 20px 0" }}>
                By signing below, you authorize Butler & Associates Construction, Inc. to proceed with the changes outlined in this change order under the agreed terms.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div>
                  <div style={{ borderBottom: `1px solid ${B.black}`, height: 36, marginBottom: 6 }} />
                  <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.7 }}>Client Signature</p>
                </div>
                <div>
                  <div style={{ borderBottom: `1px solid ${B.black}`, height: 36, marginBottom: 6 }} />
                  <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.7 }}>Date</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, textAlign: "center" as const }}>
              <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.6, margin: "0 0 4px 0" }}>
                Questions? &nbsp;
                <a href="mailto:info@butlerconstruction.co" style={{ color: B.gold, textDecoration: "none" }}>info@butlerconstruction.co</a>
                &nbsp; · &nbsp;
                <a href="tel:2566174691" style={{ color: B.gold, textDecoration: "none" }}>(256) 617-4691</a>
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.gold, margin: "6px 0 0 0" }}>
                Butler & Associates Construction, Inc.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
