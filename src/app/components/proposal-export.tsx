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

  type LineGroup = {
    category: string | null;
    items: { name: string; qty: number; unit: string; lineTotal: number; description?: string }[];
  };

  const groupedItems = (() => {
    const map: Record<string, LineGroup> = {};
    const flat: LineGroup = { category: null, items: [] };
    for (const item of (proposal?.line_items ?? [])) {
      const cat         = item.category ?? null;
      const name        = item.product_name ?? item.name ?? "Item";
      const qty         = Number(item.quantity || 1);
      const unit        = item.unit ?? "";
      const lineTotal   = item.total_price ?? qty * Number(item.client_price || item.price_per_unit || 0);
      const description = item.description ?? "";
      if (cat) {
        if (!map[cat]) map[cat] = { category: cat, items: [] };
        map[cat].items.push({ name, qty, unit, lineTotal, description });
      } else {
        flat.items.push({ name, qty, unit, lineTotal, description });
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
  const taxLabel       = proposal?.tax_label ?? "Tax";
  const stripeFeeAmt   = proposal?.stripe_fee_amount ?? 0;
  const total          = subtotal + badAmount + taxAmount - discountAmount + stripeFeeAmt;


  // ── Shared JSX blocks ──────────────────────────────────────────────────────

  const pageHeader = (
    <div id={preview ? undefined : "proposal-page-header"}>
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


  const body1 = (
    <div id={preview ? undefined : "proposal-page-body"} style={{ background: B.bg }}>
      <div style={{ padding: "36px 48px" }}>

        {/* Estimate # + client */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>Proposal Prepared For</p>
            <p style={{ fontFamily: B.cg, fontSize: 28, fontWeight: 300, color: B.black, margin: "0 0 4px 0", lineHeight: 1.2 }}>{clientName || "—"}</p>
            {client?.address && <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.address}</p>}
            {(client?.city || client?.state || client?.zip) && (
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{[client?.city, client?.state, client?.zip].filter(Boolean).join(", ")}</p>
            )}
            {client?.phone && <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.phone}</p>}
            {client?.email && <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "2px 0", opacity: 0.75 }}>{client.email}</p>}
          </div>
          <div style={{ textAlign: "right" as const }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>Estimate</p>
            <p style={{ fontFamily: B.lato, fontSize: 22, fontWeight: 700, color: B.black, margin: "0 0 6px 0" }}>#{proposal?.estimate_number ?? "—"}</p>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.text, margin: "0 0 3px 0", opacity: 0.7 }}>Sent On</p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{sentDate ? fmtDate(sentDate) : "—"}</p>
          </div>
        </div>

        {/* From */}
        <div style={{ marginBottom: 32, padding: "16px 20px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6 }}>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 8px 0" }}>From</p>
          <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 14, color: B.black, margin: "0 0 3px 0" }}>Butler & Associates Construction, Inc.</p>
          <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</p>
          <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.75 }}>Phone: (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co</p>
        </div>

        {/* Project title + description */}
        {(proposal?.title || proposal?.description) && (
          <div style={{ marginBottom: 28 }}>
            {proposal?.title && <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 700, color: B.black, margin: "0 0 6px 0" }}>{proposal.title}</p>}
            {proposal?.description && <p style={{ fontFamily: B.inter, fontSize: 13, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.8 }}>{proposal.description}</p>}
          </div>
        )}

        {/* Scope of Work table */}
        <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", border: `1px solid ${B.border}` }}>

          {/* Column header */}
          <div id={preview ? undefined : "proposal-col-header"} style={{ background: B.black, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, flex: 1 }}>Scope of Work</p>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, width: 90, textAlign: "right" as const }}>Total</p>
          </div>

          {groupedItems.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center" as const, color: B.text, opacity: 0.5, fontSize: 13 }}>No line items</div>
          )}

          {groupedItems.map((group, gIdx) => {
            const borderTop = gIdx > 0 ? `1px solid ${B.border}` : "none";
            if (group.category) {
              const catTotal = group.items.reduce((s, i) => s + i.lineTotal, 0);
              return (
                <div key={gIdx} data-group="true">
                  <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", background: "#fff", borderTop }}>
                    <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 600, color: B.black, margin: 0, flex: 1 }}>{group.category}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 700, color: B.black, margin: 0, width: 90, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(catTotal)}</p>
                  </div>
                  {group.items.map((item, iIdx) => (
                    <div key={iIdx} style={{ padding: "10px 24px 10px 36px", background: "#fff" }}>
                      <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.6 }}>· {item.name}</p>
                      {item.description ? <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "3px 0 0 10px", opacity: 0.45, lineHeight: 1.5 }}>{item.description}</p> : null}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div key={gIdx} data-group="true">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} style={{ display: "flex", alignItems: "center", padding: "20px 24px", background: "#fff" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: B.inter, fontSize: 13, color: B.black, margin: 0 }}>{item.name}</p>
                      {item.description ? <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: "3px 0 0 0", opacity: 0.5, lineHeight: 1.5 }}>{item.description}</p> : null}
                    </div>
                    <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 700, color: B.black, margin: 0, width: 90, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(item.lineTotal)}</p>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Totals */}
          <div data-groups-end="true" style={{ borderTop: `2px solid ${B.border}` }}>
            {/* All totals in one group — page-break never orphans Subtotal from the adjustments below */}
            <div data-group="true">
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>Subtotal</p>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</p>
            </div>
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>
                    {discountLabel || (discountType === "percent" && discountPct > 0 ? `Discount (${discountPct}%)` : "Discount")}
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>− {fmt(discountAmount)}</p>
                </div>
              )}
              {stripeFeeAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>CC Processing Fee (2.9% + $0.30)</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(stripeFeeAmt)}</p>
                </div>
              )}
              {badAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{badLabel}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(badAmount)}</p>
                </div>
              )}
              {taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{taxLabel}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(taxAmount)}</p>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 24px", background: B.bg, borderTop: `1px solid ${B.border}` }}>
                <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 700, color: B.black, margin: 0 }}>Total Investment{taxAmount > 0 ? " + Tax" : ""}</p>
                <p style={{ fontFamily: B.cg, fontSize: 28, fontWeight: 400, color: B.gold, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  const body2 = (
    <div id={preview ? undefined : "proposal-page-body-2"} style={{ background: B.bg }}>
      <div style={{ padding: "36px 48px" }}>
        <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 20px 0" }}>
          What Our Clients Say
        </p>
        {reviews.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginBottom: 40 }}>
            {reviews.map((r) => (
              <div key={r.reviewer_name} style={{ background: "#fff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "flex-start", gap: 20 }}>
                <div style={{ minWidth: 130, flexShrink: 0, borderRight: `1px solid ${B.border}`, paddingRight: 20 }}>
                  <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 12, color: B.black, margin: "0 0 4px 0" }}>{r.reviewer_name}</p>
                  <p style={{ color: B.gold, fontSize: 12, margin: 0, lineHeight: 1 }}>{"★".repeat(r.rating)}</p>
                </div>
                <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.85, flex: 1 }}>{r.review_text}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 28, marginTop: 40 }}>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 16px 0" }}>Authorization</p>
          <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 20px 0" }}>
            By signing below, you authorize Butler & Associates Construction, Inc. to proceed with the scope of work outlined in this proposal under the agreed terms.
          </p>
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ borderBottom: "1px solid rgba(0,0,0,0.45)", height: 36, marginBottom: 6 }} />
              <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.7 }}>Client Signature</p>
            </div>
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <div style={{ borderBottom: "1px solid rgba(0,0,0,0.45)", height: 36, marginBottom: 6 }} />
              <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.7 }}>Date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const body3 = warrantySections.length > 0 ? (
    <div id={preview ? undefined : "proposal-page-body-3"} style={{ background: B.bg }}>
      <div style={{ padding: "36px 48px" }}>
        {/* Title */}
        <div style={{ textAlign: "center" as const, marginBottom: 24 }}>
          <p style={{ fontFamily: B.lato, fontSize: 20, fontWeight: 700, color: B.black, margin: "0 0 6px 0", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
            Warranty Coverage
          </p>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
            Butler & Associates Construction, Inc.
          </p>
        </div>
        <div style={{ height: 1, background: B.gold, opacity: 0.35, marginBottom: 22 }} />
        {/* Intro */}
        <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.75, color: B.text, margin: "0 0 28px 0", opacity: 0.85 }}>
          Butler & Associates Construction, Inc. warrants all labor and craftsmanship for the periods specified below, measured from the project completion date. This warranty applies exclusively to workmanship — material defects are addressed solely through manufacturer warranties.
        </p>
        {/* Sections */}
        {warrantySections.map((section) => (
          <div key={section.id} data-group="true" style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 10px 0" }}>
              {section.title}
            </p>
            <div style={{ border: `1px solid ${B.border}`, borderRadius: 6, overflow: "hidden" }}>
              {/* Header row — flexbox, explicit widths so html2canvas doesn't hang on fr units */}
              <div style={{ background: B.black, display: "flex", padding: "10px 16px" }}>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 600, color: B.gold, margin: 0, letterSpacing: "0.05em", width: "25%", flexShrink: 0 }}>Scope Item</p>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 600, color: B.gold, margin: 0, letterSpacing: "0.05em", width: "50%", flexShrink: 0 }}>Craftsmanship & Labor</p>
                <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 600, color: B.gold, margin: 0, letterSpacing: "0.05em", width: "25%", flexShrink: 0 }}>Material Defects</p>
              </div>
              {section.items.map((item, idx) => (
                <div key={item.id} style={{ display: "flex", padding: "10px 16px", background: idx % 2 === 0 ? "#fff" : B.rowAlt, borderTop: `1px solid ${B.border}` }}>
                  <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 600, color: B.black, margin: 0, width: "25%", flexShrink: 0, paddingRight: 8 }}>{item.scope_item}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, lineHeight: 1.65, width: "50%", flexShrink: 0, paddingRight: 8 }}>{item.labor_text}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: 0, opacity: 0.65, fontStyle: "italic", width: "25%", flexShrink: 0 }}>{item.material_note}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Disclaimer */}
        {warrantyDisclaimer && (
          <div style={{ marginTop: 8, padding: "14px 18px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6 }}>
            <p style={{ fontFamily: B.inter, fontSize: 10, lineHeight: 1.75, color: B.text, margin: 0, fontStyle: "italic", opacity: 0.72 }}>
              {warrantyDisclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ── Preview mode: page-by-page view matching PDF layout ───────────────────
  if (preview) {
    const pageShadow = "0 2px 12px rgba(0,0,0,0.4)";
    return (
      <div style={{ fontFamily: B.inter, color: B.black, fontSize: 13, display: "flex", flexDirection: "column" as const, gap: 24 }}>
        <div style={{ background: B.bg, boxShadow: pageShadow, overflow: "hidden" }}>
          {pageHeader}
          {body1}
        </div>
        <div style={{ background: B.bg, boxShadow: pageShadow, overflow: "hidden" }}>
          {pageHeader}
          {body2}
        </div>
        {body3 && (
          <div style={{ background: B.bg, boxShadow: pageShadow, overflow: "hidden" }}>
            {pageHeader}
            {body3}
          </div>
        )}
      </div>
    );
  }

  // ── PDF capture mode: flat structure with named IDs ───────────────────────
  return (
    <div style={{ fontFamily: B.inter, color: B.black, width: "100%", background: B.bg, fontSize: 13 }}>
      {pageHeader}
      {body1}
      <div style={{ height: 16, background: "#525659" }} className="screen-only" />
      {body2}
      {body3 && (
        <>
          <div style={{ height: 16, background: "#525659" }} className="screen-only" />
          {body3}
        </>
      )}
    </div>
  );
}
