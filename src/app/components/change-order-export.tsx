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

// A4 at 96 dpi = 794 × 1123 px
const A4_H = "29.7cm";

interface ChangeOrderExportProps {
  co: any;
  client: any;
  originalTotal?: number;
  newTotal?: number;
}

export function ChangeOrderExport({ co, client, originalTotal, newTotal }: ChangeOrderExportProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);

  const fmtDate = (d: string) =>
    new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });

  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
  const items: any[] = co?.items || [];
  const costImpact: number = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);

  const hasReason   = !!co?.reason?.trim();
  const hasTimeline = !!co?.timeline_impact?.trim();

  // Split items across pages: first 6 on page 1, rest on page 2
  const PAGE1_MAX  = 6;
  const page1Items = items.slice(0, PAGE1_MAX);
  const page2Items = items.slice(PAGE1_MAX);
  const needsPage2 = page2Items.length > 0;

  const Header = () => (
    <div>
      <div style={{ background: B.black, padding: "22px 32px", textAlign: "center" as const }}>
        <img
          src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
          alt="Butler & Associates Construction"
          style={{ height: 48, width: "auto", display: "block", margin: "0 auto 10px auto" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
          Butler & Associates Construction, Inc.
        </p>
      </div>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${B.gold}, #8A7040)` }} />
    </div>
  );

  const Footer = () => (
    <div style={{ borderTop: `1px solid ${B.border}`, padding: "16px 40px 24px", textAlign: "center" as const, background: B.bg }}>
      <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.6, margin: "0 0 4px 0" }}>
        Questions?{" "}
        <a href="mailto:info@butlerconstruction.co" style={{ color: B.gold, textDecoration: "none" }}>info@butlerconstruction.co</a>
        {" · "}
        <a href="tel:2566174691" style={{ color: B.gold, textDecoration: "none" }}>(256) 617-4691</a>
      </p>
      <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
        Butler & Associates Construction, Inc.
      </p>
    </div>
  );

  const ItemRows = ({ rows }: { rows: any[] }) => (
    <>
      {rows.map((item: any, i: number) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 8, padding: "9px 20px", background: i % 2 === 1 ? B.rowAlt : "#fff", borderBottom: `1px solid ${B.bg}`, alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.black, margin: 0 }}>{item.description}</p>
            {item.category && (
              <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "1px 0 0 0", opacity: 0.55 }}>{item.category}</p>
            )}
          </div>
          <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, textAlign: "right" as const }}>{item.quantity}</p>
          <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(item.unit_price)}</p>
          <p style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 600, color: B.black, margin: 0, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(item.total)}</p>
        </div>
      ))}
    </>
  );

  const TableHeader = () => (
    <div style={{ background: B.black, padding: "9px 20px", display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", gap: 8 }}>
      {["Description", "Qty", "Unit Price", "Total"].map((h) => (
        <p key={h} style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: B.gold, margin: 0, textAlign: h !== "Description" ? "right" as const : "left" as const }}>
          {h}
        </p>
      ))}
    </div>
  );

  const TotalsBlock = () => (
    <div style={{ borderTop: `2px solid ${B.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", background: B.bg }}>
        <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 700, color: B.black, margin: 0 }}>Change Order Total</p>
        <p style={{ fontFamily: B.cg, fontSize: 26, fontWeight: 400, color: costImpact >= 0 ? B.gold : "#C0392B", margin: 0, fontVariantNumeric: "tabular-nums" }}>
          {costImpact >= 0 ? "+" : ""}{fmt(costImpact)}
        </p>
      </div>
      {originalTotal != null && newTotal != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", background: "#fff", borderTop: `1px solid ${B.border}` }}>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0 }}>Original Contract Total</p>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(originalTotal)}</p>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#F0EDE6" }}>
            <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 700, color: B.black, margin: 0 }}>Revised Contract Total</p>
            <p style={{ fontFamily: B.cg, fontSize: 22, fontWeight: 400, color: B.gold, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(newTotal)}</p>
          </div>
        </>
      )}
    </div>
  );

  const SignatureBlock = () => (
    <div style={{ paddingTop: 28, borderTop: `1px solid ${B.border}`, marginTop: 28 }}>
      <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 10px 0" }}>
        Authorization
      </p>
      <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "0 0 20px 0", lineHeight: 1.6 }}>
        By signing below, you authorize Butler & Associates Construction, Inc. to proceed with the changes outlined in this change order under the agreed terms.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <div style={{ borderBottom: `1px solid ${B.black}`, height: 36, marginBottom: 5 }} />
          <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, opacity: 0.65 }}>Client Signature</p>
        </div>
        <div>
          <div style={{ borderBottom: `1px solid ${B.black}`, height: 36, marginBottom: 5 }} />
          <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, opacity: 0.65 }}>Date</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: B.inter, color: B.black, background: B.bg, width: "100%", fontSize: 13 }}>

      {/* ══ PAGE 1 ══ */}
      <div style={{ minHeight: A4_H, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>
        <Header />

        <div style={{ padding: "28px 40px", flex: 1, display: "flex", flexDirection: "column" as const }}>

          {/* Client info + CO title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>
                Change Order Prepared For
              </p>
              <p style={{ fontFamily: B.cg, fontSize: 26, fontWeight: 300, color: B.black, margin: "0 0 3px 0", lineHeight: 1.2 }}>
                {clientName || "—"}
              </p>
              {client?.address && <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.address}</p>}
              {(client?.city || client?.state || client?.zip) && (
                <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "2px 0", opacity: 0.75 }}>
                  {[client?.city, client?.state, client?.zip].filter(Boolean).join(", ")}
                </p>
              )}
              {client?.phone && <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.phone}</p>}
              {client?.email && <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.email}</p>}
            </div>
            <div style={{ textAlign: "right" as const }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>Change Order</p>
              <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 700, color: B.black, margin: "0 0 8px 0" }}>{co?.title || "—"}</p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.text, margin: "0 0 2px 0", opacity: 0.65 }}>Date</p>
              <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0 }}>{co?.created_at ? fmtDate(co.created_at) : "—"}</p>
            </div>
          </div>

          {/* From */}
          <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 5 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>From</p>
            <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 13, color: B.black, margin: "0 0 2px 0" }}>Butler & Associates Construction, Inc.</p>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: "0 0 1px 0", opacity: 0.75 }}>6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</p>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.75 }}>Phone: (256) 617-4691 · info@butlerconstruction.co</p>
          </div>

          {/* Reason + Timeline — only rendered when content exists */}
          {(hasReason || hasTimeline) && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 5 }}>
              {hasReason && (
                <div style={{ marginBottom: hasTimeline ? 10 : 0 }}>
                  <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>
                    Reason for Change
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 12, lineHeight: 1.65, color: B.text, margin: 0 }}>{co.reason}</p>
                </div>
              )}
              {hasTimeline && (
                <div style={{ marginTop: hasReason ? 10 : 0, paddingTop: hasReason ? 10 : 0, borderTop: hasReason ? `1px solid ${B.border}` : "none" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>
                    Timeline Impact
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0 }}>{co.timeline_impact}</p>
                </div>
              )}
            </div>
          )}

          {/* Line items table */}
          <div style={{ background: "#fff", borderRadius: 5, overflow: "hidden", border: `1px solid ${B.border}` }}>
            <TableHeader />
            {items.length === 0 && (
              <div style={{ padding: "16px 20px", textAlign: "center" as const, color: B.text, opacity: 0.5, fontSize: 12 }}>No line items</div>
            )}
            <ItemRows rows={needsPage2 ? page1Items : items} />
            {/* Show totals on page 1 only if not splitting */}
            {!needsPage2 && <TotalsBlock />}
          </div>

          {/* Signature + Footer inline — only on single-page layout */}
          {!needsPage2 && (
            <div style={{ marginTop: "auto" }}>
              <SignatureBlock />
            </div>
          )}
        </div>

        {!needsPage2 && <Footer />}
      </div>

      {/* ══ PAGE 2 (overflow items + totals + signature) ══ */}
      {needsPage2 && (
        <div style={{ minHeight: A4_H, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>
          <Header />

          <div style={{ padding: "28px 40px", flex: 1, display: "flex", flexDirection: "column" as const }}>
            <div style={{ background: "#fff", borderRadius: 5, overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: 20 }}>
              <TableHeader />
              <ItemRows rows={page2Items} />
              <TotalsBlock />
            </div>

            <div style={{ marginTop: "auto" }}>
              <SignatureBlock />
            </div>
          </div>

          <Footer />
        </div>
      )}

    </div>
  );
}
