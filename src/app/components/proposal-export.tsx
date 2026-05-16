import type { WarrantySection } from "../api/warranty";

interface ProposalExportProps {
  proposal: any;
  client: any;
  reviews?: { reviewer_name: string; rating: number; review_text: string }[];
  warrantySections?: WarrantySection[];
  warrantyDisclaimer?: string;
  preview?: boolean;
}

export const B = {
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

export function ProposalExport({ proposal, client, reviews = [], warrantySections = [], warrantyDisclaimer = "", preview = false }: ProposalExportProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
  const fmtDate = (d: string) =>
    new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sentDate   = proposal?.sent_at || proposal?.created_at;
  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
  const clientAddr = [
    client?.address,
    [client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  const validUntilDate = sentDate
    ? new Date(new Date(sentDate.includes("T") ? sentDate : `${sentDate}T00:00:00`).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  type LineGroup = {
    category: string | null;
    items: { name: string; description?: string; qty: number; unit: string; lineTotal: number }[];
  };

  const groupedItems = (() => {
    const map: Record<string, LineGroup> = {};
    const flat: LineGroup = { category: null, items: [] };
    for (const item of (proposal?.line_items ?? [])) {
      const cat         = item.category ?? null;
      const name        = item.product_name ?? item.name ?? "Item";
      const description = item.description ?? undefined;
      const qty         = Number(item.quantity || 1);
      const unit        = item.unit ?? "";
      const lineTotal   = item.total_price ?? qty * Number(item.client_price || item.price_per_unit || 0);
      if (cat) {
        if (!map[cat]) map[cat] = { category: cat, items: [] };
        map[cat].items.push({ name, description, qty, unit, lineTotal });
      } else {
        flat.items.push({ name, description, qty, unit, lineTotal });
      }
    }
    const result: LineGroup[] = Object.values(map);
    if (flat.items.length > 0) result.push(flat);
    return result;
  })();

  const subtotal       = proposal?.subtotal ?? groupedItems.flatMap(g => g.items).reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = proposal?.discount_amount ?? 0;
  const discountPct    = proposal?.discount_percentage ?? 0;
  const discountLabel  = proposal?.discount_label ?? null;
  const discountType   = proposal?.discount_type ?? "percent";
  const badAmount      = proposal?.bad_amount ?? 0;
  const badLabel       = proposal?.bad_label ?? "Base, Aggregate & Disposal";
  const taxAmount      = proposal?.tax_amount ?? 0;
  const taxLabel       = "Sales Tax";
  const taxRate        = proposal?.tax_rate ?? 0;
  const stripeFeeAmt   = proposal?.stripe_fee_amount ?? 0;
  const total          = subtotal + badAmount + taxAmount - discountAmount + stripeFeeAmt;

  // ── Shared blocks ──────────────────────────────────────────────────────────

  const pageHeader = (
    <div id={preview ? undefined : "proposal-page-header"}>
      <div style={{ background: B.black, padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
            alt="B&A"
            style={{ height: 52, width: "auto", flexShrink: 0 }}
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
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>
            PROPOSAL
          </p>
          <p style={{ fontFamily: B.lato, fontSize: 26, fontWeight: 500, color: "#fff", margin: 0 }}>
            #{proposal?.estimate_number ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );

  // kept for PDF generator — must exist with this id, renders as invisible 1px strip
  const colHeader = (
    <div id={preview ? undefined : "proposal-col-header"} style={{ height: 1, overflow: "hidden", background: "#fff" }} />
  );

  const pageFooter = (
    <div id={preview ? undefined : "proposal-page-footer"}>
      <div style={{ background: B.black, padding: "8px 40px", textAlign: "center" as const }}>
        <p style={{ fontFamily: B.inter, fontSize: 9, color: "rgba(255,255,255,0.5)", margin: 0, letterSpacing: "0.06em" }}>
          Butler &amp; Associates Construction, Inc. &nbsp;·&nbsp; (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co
        </p>
      </div>
    </div>
  );

  // ── Page 1: Scope ─────────────────────────────────────────────────────────

  const body1 = (
    <div id={preview ? undefined : "proposal-page-body"} style={{ background: "#fff" }}>
      <div style={{ padding: "24px 40px" }}>

        {/* Project title */}
        {proposal?.title && (
          <h2 style={{ fontFamily: B.lato, fontSize: 22, fontWeight: 400, color: B.black, margin: "0 0 24px 0" }}>
            {proposal.title}
          </h2>
        )}

        {/* 2-col: Prepared For + Proposal Details */}
        <div style={{ display: "flex", gap: 40, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 8px 0" }}>Prepared For</p>
            <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: "0 0 6px 0" }}>{clientName || "—"}</p>
            {clientAddr && <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65, lineHeight: 1.6 }}>{clientAddr}</p>}
          </div>
          <div style={{ width: "auto", textAlign: "right"as const }}>
            <p style={{ paddingRight:"30px" ,fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 8px 0" }}>Proposal Details</p>
            <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" as const }}>
              <div style={{ textAlign: "left" as const }}>
                <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65, margin: "0 0 4px 0" }}>Date:</p>
                <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65, margin: 0 }}>Valid Until:</p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                <p style={{ fontFamily: B.lato, fontSize: 12, fontWeight: 500, color: B.black, margin: "0 0 4px 0" }}>{sentDate ? fmtDate(sentDate) : "—"}</p>
                <p style={{ fontFamily: B.lato, fontSize: 12, fontWeight: 500, color: B.black, margin: 0 }}>
                  {validUntilDate ? validUntilDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #E0E0E0", marginBottom: 24 }} />

        {/* Project Scope heading */}
        <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 20px 0" }}>
          Project Scope
        </p>

        {/* Categories */}
        <div style={{ marginBottom: 28 }}>
          {groupedItems.length === 0 && (
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, opacity: 0.45, textAlign: "center" as const, margin: 0 }}>No line items</p>
          )}
          {groupedItems.map((group, gIdx) => {
            if (group.category) {
              const catTotal = group.items.reduce((s, i) => s + i.lineTotal, 0);
              return (
                <div key={gIdx} data-group="true" style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", padding: "8px 0 12px 0", borderBottom: "1px solid #C8C4BC", marginBottom: 12 }}>
                    <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0, flex: 1 }}>{group.category}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#999", margin: 0, width: 110, textAlign: "center" as const }}>QTY</p>
                    <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0, width: 90, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(catTotal)}</p>
                  </div>
                  {group.items.map((item, iIdx) => (
                    <div key={iIdx} style={{ display: "flex", alignItems: "flex-start", padding: "6px 0 6px 8px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65 }}>{item.name}</p>
                        {item.description && <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "2px 0 0 0", opacity: 0.45, lineHeight: 1.4 }}>{item.description}</p>}
                      </div>
                      <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65, width: 110, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>
                        {item.qty}{item.unit ? ` ${item.unit}` : ""}
                      </p>
                      <div style={{ width: 90 }} />
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div key={gIdx} data-group="true" style={{ marginBottom: 20 }}>
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} style={{ display: "flex", alignItems: "flex-start", padding: "4px 0" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: B.inter, fontSize: 12, color: B.black, margin: 0 }}>{item.name}</p>
                      {item.description && <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "2px 0 0 0", opacity: 0.5, lineHeight: 1.4 }}>{item.description}</p>}
                    </div>
                    <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65, width: 110, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>
                      {item.qty}{item.unit ? ` ${item.unit}` : ""}
                    </p>
                    <div style={{ width: 90 }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div data-group="true">
          <div style={{ borderTop: "1px solid #E0E0E0", paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 300 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>Subtotal</p>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</p>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>
                    {discountLabel || (discountType === "percent" && discountPct > 0 ? `Discount (${discountPct}%)` : "Discount")}
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>− {fmt(discountAmount)}</p>
                </div>
              )}
              {badAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>{badLabel}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(badAmount)}</p>
                </div>
              )}
              {taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>
                    {taxLabel}
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(taxAmount)}</p>
                </div>
              )}
              {stripeFeeAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>CC Processing Fee (2.9% + $0.30)</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(stripeFeeAmt)}</p>
                </div>
              )}
              <div style={{ borderTop: "1px solid #E0E0E0", marginTop: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 500, color: B.black, margin: 0 }}>Total</p>
                <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 500, color: B.black, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // ── Signature lines only (used in preview content) ────────────────────────

  const sigLinesJSX = (
    <div style={{ borderTop: "1px solid #E0E0E0", paddingTop: 24 }}>
      <div style={{ display: "flex", gap: 40 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 52, borderBottom: "1px solid #C8C4BC", marginBottom: 10 }} />
          <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: "0 0 20px 0" }}>Client Signature</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontFamily: B.inter, fontSize: 11, color: "#717182", whiteSpace: "nowrap" as const }}>Date:</span>
            <div style={{ width: 110, borderBottom: "1px solid #C8C4BC", marginBottom: -5, marginTop: 25 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 52, borderBottom: "1px solid #C8C4BC", marginBottom: 10 }} />
          <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: "0 0 20px 0" }}>Contractor Signature</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontFamily: B.inter, fontSize: 11, color: "#717182", whiteSpace: "nowrap" as const }}>Date:</span>
            <div style={{ width: 110, borderBottom: "1px solid #C8C4BC", marginBottom: -5, marginTop: 25 }} />
          </div>
        </div>
      </div>
    </div>
  );

  // ── Full sig block for PDF capture (sig lines + thank you) ─────────────────

  const sigJSX = (
    <>
      {sigLinesJSX}
      
    </>
  );

  // ── Last-page footer: thank you note — white background, like change order ──

  const lastPageFooter = (
    <div style={{ borderTop: "1px solid #E0E0E0", padding: "10px 40px 16px 40px", textAlign: "center" as const, background: "#fff" }}>
      <p style={{ fontFamily: B.inter, fontSize: 10, color: "#717182", margin: 0, lineHeight: 1.5 }}>
        Thank you for considering Butler &amp; Associates Construction, Inc. for your project. We look forward to working with you.
      </p>
    </div>
  );

  // ── Page 2: Warranty + Reviews (no signature — sig drawn separately in PDF) ─

  const warrantyReviews = (
    <>
      {/* Warranty */}
      {warrantySections.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 6px 0" }}>
            Warranty Coverage
          </p>
          <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.75, color: B.text, margin: "0 0 20px 0", opacity: 0.8 }}>
            Butler &amp; Associates Construction, Inc. warrants all labor and craftsmanship for the periods specified below, measured from the project completion date. Material defects are addressed through manufacturer warranties.
          </p>
          <div style={{ border: "1px solid #E0E0E0", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ background: B.black, display: "flex", padding: "9px 16px" }}>
              <p style={{ paddingBottom: 10, fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "25%", flexShrink: 0 }}>Scope Item</p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "50%", flexShrink: 0 }}>Craftsmanship &amp; Labor</p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "25%", flexShrink: 0 }}>Material Defects</p>
            </div>
            {warrantySections.map((section) => (
              <div key={section.id}>
                <div style={{ background: "#F5F5F5", padding: "0 16px",paddingBottom: 10, borderTop: "1px solid #E0E0E0" }}>
                  <span style={{ fontFamily: B.inter, fontSize: 8, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold }}>{section.title}</span>
                </div>
                {section.items.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", padding: "9px 16px", background: idx % 2 === 0 ? "#fff" : "#F9F9F9", borderTop: "1px solid #E0E0E0" }}>
                    <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, color: B.black, margin: 0, width: "25%", flexShrink: 0, paddingRight: 8 }}>{item.scope_item}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, lineHeight: 1.65, width: "50%", flexShrink: 0, paddingRight: 8 }}>{item.labor_text}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, opacity: 0.6, fontStyle: "italic", width: "25%", flexShrink: 0 }}>{item.material_note}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {warrantyDisclaimer && (
            <div data-group="true" style={{ padding: "12px 16px", background: "#F9F9F9", border: "1px solid #E0E0E0", borderRadius: 4 }}>
              <p style={{ fontFamily: B.inter, fontSize: 10, lineHeight: 1.75, color: B.text, margin: 0, fontStyle: "italic", opacity: 0.7 }}>
                {warrantyDisclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 16px 0" }}>
            What Our Clients Say
          </p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12 }}>
            {reviews.map((r) => (
              <div key={r.reviewer_name} style={{ flex: "1 1 calc(50% - 6px)", border: "1px solid #E0E0E0", borderRadius: 6, padding: "14px 16px", boxSizing: "border-box" as const }}>
                <p style={{ fontFamily: B.lato, fontWeight: 500, fontSize: 13, color: B.black, margin: "0 0 3px 0" }}>{r.reviewer_name}</p>
                <p style={{ color: B.gold, fontSize: 13, margin: "0 0 10px 0" }}>{"★".repeat(r.rating)}</p>
                <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.8 }}>{r.review_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // ── Preview mode ───────────────────────────────────────────────────────────
  if (preview) {
    const shadow = "0 2px 12px rgba(0,0,0,0.4)";
    return (
      <div style={{ fontFamily: B.inter, color: B.black, fontSize: 13, display: "flex", flexDirection: "column" as const, gap: 24 }}>
        <div style={{ background: "#fff", boxShadow: shadow, overflow: "hidden" }}>
          {pageHeader}
          {body1}
          {pageFooter}
        </div>
        {/* Page 2: minHeight so it fills A4 but never clips */}
        <div style={{ background: "#fff", boxShadow: shadow, overflow: "hidden", display: "flex", flexDirection: "column" as const, minHeight: "29.7cm" }}>
          {pageHeader}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, background: "#fff" }}>
            <div style={{ padding: "24px 40px", flex: 1, display: "flex", flexDirection: "column" as const }}>
              {warrantyReviews}
              <div style={{ marginTop: "auto" }}>{sigLinesJSX}</div>
            </div>
          </div>
          {lastPageFooter}
        </div>
      </div>
    );
  }

  // ── PDF capture mode ───────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: B.inter, color: B.black, width: "100%", background: "#fff", fontSize: 13 }}>
      {pageHeader}
      {colHeader}
      {body1}
      {pageFooter}
      <div style={{ height: 16, background: "#525659" }} className="screen-only" />

      {/* body-2: warranty only — conditional, skipped entirely if no warranty */}
      {warrantySections.length > 0 && (
        <div id="proposal-page-body-2" style={{ background: "#fff" }}>
          <div style={{ padding: "16px 40px 24px 40px" }}>
            <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 6px 0" }}>
              Warranty Coverage
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.75, color: B.text, margin: "0 0 20px 0", opacity: 0.8 }}>
              Butler &amp; Associates Construction, Inc. warrants all labor and craftsmanship for the periods specified below, measured from the project completion date. Material defects are addressed through manufacturer warranties.
            </p>
            <div style={{ border: "1px solid #E0E0E0", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ background: B.black, display: "flex", padding: "9px 16px" }}>
                <p style={{ paddingBottom: 10, fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "25%", flexShrink: 0 }}>Scope Item</p>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "50%", flexShrink: 0 }}>Craftsmanship &amp; Labor</p>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, color: B.gold, margin: 0, letterSpacing: "0.08em", width: "25%", flexShrink: 0 }}>Material Defects</p>
              </div>
              {warrantySections.map((section) => (
                <div key={section.id} data-group="true">
                  <div style={{ background: "#F5F5F5", padding: "0 16px", paddingBottom: 10, borderTop: "1px solid #E0E0E0" }}>
                    <span style={{ fontFamily: B.inter, fontSize: 8, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold }}>{section.title}</span>
                  </div>
                  {section.items.map((item, idx) => (
                    <div key={item.id} style={{ display: "flex", padding: "9px 16px", background: idx % 2 === 0 ? "#fff" : "#F9F9F9", borderTop: "1px solid #E0E0E0" }}>
                      <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, color: B.black, margin: 0, width: "25%", flexShrink: 0, paddingRight: 8 }}>{item.scope_item}</p>
                      <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, lineHeight: 1.65, width: "50%", flexShrink: 0, paddingRight: 8 }}>{item.labor_text}</p>
                      <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, opacity: 0.6, fontStyle: "italic", width: "25%", flexShrink: 0 }}>{item.material_note}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {warrantyDisclaimer && (
              <div data-group="true" style={{ padding: "12px 16px", background: "#F9F9F9", border: "1px solid #E0E0E0", borderRadius: 4 }}>
                <p style={{ fontFamily: B.inter, fontSize: 10, lineHeight: 1.75, color: B.text, margin: 0, fontStyle: "italic", opacity: 0.7 }}>
                  {warrantyDisclaimer}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* body-3: reviews + sig — always renders, always starts on a fresh page */}
      <div id="proposal-page-body-3" style={{ background: "#fff" }}>
        <div style={{ padding: "24px 40px" }}>
          {reviews.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 16px 0" }}>
                What Our Clients Say
              </p>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12 }}>
                {reviews.map((r) => (
                  <div key={r.reviewer_name} data-group="true" style={{ flex: "1 1 calc(50% - 6px)", border: "1px solid #E0E0E0", borderRadius: 6, padding: "14px 16px", boxSizing: "border-box" as const }}>
                    <p style={{ fontFamily: B.lato, fontWeight: 500, fontSize: 13, color: B.black, margin: "0 0 3px 0" }}>{r.reviewer_name}</p>
                    <p style={{ color: B.gold, fontSize: 13, margin: "0 0 10px 0" }}>{"★".repeat(r.rating)}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.8 }}>{r.review_text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sigJSX}
        </div>
      </div>

      <div id="proposal-last-footer" style={{ borderTop: "1px solid #E0E0E0", background: "#fff", padding: "10px 40px", paddingBottom: "20px", textAlign: "center" as const }}>
        <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.55 }}>
          Thank you for considering Butler &amp; Associates Construction, Inc. for your project. We look forward to working with you.
        </p>
      </div>
    </div>
  );
}
