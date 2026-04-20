interface ProposalExportProps {
  proposal: any;
  client: any;
  reviews?: { reviewer_name: string; rating: number; review_text: string }[];
}

// Butler & Associates brand tokens
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
  // Squarespace CDN logos — confirm with Jonathan before switching
  // logoWhite: "https://images.squarespace-cdn.com/content/v1/67a6462842d3287ac4bbd645/da21fa34-e667-4e7e-bf6f-f9e8670503c6/Primary+Logo+WHITE.png",
  // logoDark:  "https://images.squarespace-cdn.com/content/v1/67a6462842d3287ac4bbd645/0254c327-02ce-4d04-a883-0d6f2e3b9e15/butler+%26+associates+construction%2C+inc-5+copy.png",
};

export function ProposalExport({ proposal, client, reviews = [] }: ProposalExportProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sentDate  = proposal?.sent_at || proposal?.created_at;
  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();

  // Group line items by category; uncategorized items rendered flat
  type LineGroup = {
    category: string | null;
    items: { name: string; qty: number; unit: string; lineTotal: number; description?: string }[];
  };

  const groupedItems = (() => {
    const groups: Record<string, LineGroup> = {};
    const uncategorized: LineGroup = { category: null, items: [] };
    (proposal?.line_items ?? []).forEach((item: any) => {
      const cat = item.category ?? null;
      const name = item.product_name ?? item.name ?? "Item";
      const qty  = Number(item.quantity || 1);
      const unit = item.unit ?? "";
      const lineTotal = item.total_price ?? (qty * Number(item.client_price || item.price_per_unit || 0));
      const description = item.description ?? "";
      if (cat) {
        if (!groups[cat]) groups[cat] = { category: cat, items: [] };
        groups[cat].items.push({ name, qty, unit, lineTotal, description });
      } else {
        uncategorized.items.push({ name, qty, unit, lineTotal, description });
      }
    });
    const result: LineGroup[] = Object.values(groups);
    if (uncategorized.items.length > 0) result.push(uncategorized);
    return result;
  })();

  const subtotal       = proposal?.subtotal ?? groupedItems.flatMap((g) => g.items).reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = proposal?.discount_amount ?? 0;
  const badAmount      = proposal?.bad_amount ?? 0;
  const badLabel       = proposal?.bad_label ?? "Base, Aggregate & Disposal";
  const taxAmount      = proposal?.tax_amount ?? 0;
  const taxLabel       = proposal?.tax_label ?? "Tax";
  const total          = subtotal + badAmount + taxAmount - discountAmount;

  // Shared page header — black bar with logo + estimate number
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
      <div style={{ paddingBottom: 48, minHeight: "29.7cm", boxSizing: "border-box" as const }}>
        <PageHeader />

        <div style={{ padding: "36px 48px" }}>

          {/* Estimate # + sent date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 6px 0" }}>
                Proposal Prepared For
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
                Estimate
              </p>
              <p style={{ fontFamily: B.lato, fontSize: 22, fontWeight: 700, color: B.black, margin: "0 0 6px 0" }}>
                #{proposal?.estimate_number ?? "—"}
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.text, margin: "0 0 3px 0", opacity: 0.7 }}>
                Sent On
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>
                {sentDate ? formatDate(sentDate) : "—"}
              </p>
            </div>
          </div>

          {/* From */}
          <div style={{ marginBottom: 32, padding: "16px 20px", background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 8px 0" }}>
              From
            </p>
            <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 14, color: B.black, margin: "0 0 3px 0" }}>Butler & Associates Construction, Inc.</p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>6275 University Drive NW, Suite 37-314, Huntsville, AL 35806</p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>Phone: (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co</p>
          </div>

          {/* Project title + description */}
          {(proposal?.title || proposal?.description) && (
            <div style={{ marginBottom: 28 }}>
              {proposal?.title && (
                <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 700, color: B.black, margin: "0 0 6px 0" }}>{proposal.title}</p>
              )}
              {proposal?.description && (
                <p style={{ fontFamily: B.inter, fontSize: 13, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.8 }}>{proposal.description}</p>
              )}
            </div>
          )}

          {/* Scope of Work table */}
          <div style={{ background: "#fff", borderRadius: 6, overflow: "hidden", border: `1px solid ${B.border}` }}>
            {/* Table header */}
            <div style={{ background: B.black, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, flex: 1 }}>
                Scope of Work
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, width: 100, textAlign: "center" as const }}>
                Qty
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0, width: 90, textAlign: "right" as const }}>
                Total
              </p>
            </div>

            {/* Line items */}
            {groupedItems.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center" as const, color: B.text, opacity: 0.5, fontSize: 13 }}>
                No line items
              </div>
            )}

            {(() => {
              // Client-meaningful units only — anything else shows no qty on primary line
              const MEANINGFUL_UNITS = ["sf", "sq ft", "lf", "cy"];
              const unitPriority = (unit: string) => {
                const u = (unit ?? "").toLowerCase();
                if (u === "sf" || u === "sq ft") return 0;
                if (u === "lf") return 1;
                if (u === "cy") return 2;
                return 99;
              };
              const getPrimaryQtyLabel = (items: { name: string; qty: number; unit: string; lineTotal: number }[]) => {
                const meaningful = items.filter(i => MEANINGFUL_UNITS.includes((i.unit ?? "").toLowerCase()));
                if (meaningful.length === 0) return null;
                const best = [...meaningful].sort((a, b) => unitPriority(a.unit) - unitPriority(b.unit))[0];
                return `${best.qty} ${best.unit}`;
              };

              let rowIndex = 0;
              return groupedItems.map((group, gIdx) => {
                const rowBg = gIdx % 2 === 0 ? "#fff" : B.rowAlt;
                const borderTop = gIdx > 0 ? `1px solid ${B.border}` : "none";

                if (group.category) {
                  const categoryTotal = group.items.reduce((s, i) => s + i.lineTotal, 0);
                  const qtyLabel = getPrimaryQtyLabel(group.items);
                  return (
                    <div key={gIdx}>
                      {/* Primary line — category name + qty/unit + category total */}
                      <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", background: rowBg, borderTop }}>
                        <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 600, color: B.black, margin: 0, flex: 1 }}>
                          {group.category}
                        </p>
                        <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, width: 100, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>
                          {qtyLabel ?? ""}
                        </p>
                        <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 700, color: B.black, margin: 0, width: 90, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(categoryTotal)}
                        </p>
                      </div>
                      {/* Sub-items — name + description, indented */}
                      {group.items.map((item, iIdx) => (
                        <div key={iIdx} style={{
                          padding: "10px 24px 10px 36px",
                          background: rowBg,
                          borderTop: `1px solid ${B.bg}`,
                        }}>
                          <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.6 }}>
                            · {item.name}
                          </p>
                          {item.description ? (
                            <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "3px 0 0 10px", opacity: 0.45, lineHeight: 1.5 }}>
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                }

                // Uncategorized — name + qty + unit, no price
                return (
                  <div key={gIdx}>
                    {group.items.map((item, iIdx) => {
                      const isAlt = rowIndex++ % 2 === 1;
                      return (
                        <div key={iIdx} style={{
                          display: "flex", alignItems: "center",
                          padding: "20px 24px",
                          background: isAlt ? B.rowAlt : "#fff",
                          borderBottom: `1px solid ${B.bg}`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.black, margin: 0 }}>{item.name}</p>
                            {item.description ? (
                              <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: "3px 0 0 0", opacity: 0.5, lineHeight: 1.5 }}>{item.description}</p>
                            ) : null}
                          </div>
                          <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, width: 100, textAlign: "center" as const, whiteSpace: "nowrap" as const }}>
                            {item.qty}{item.unit ? " " + item.unit : ""}
                          </p>
                          <div style={{ width: 90 }} />
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {/* Subtotal / Discount / Tax / Total block */}
            <div style={{ borderTop: `2px solid ${B.border}` }}>
              {/* Subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>Subtotal</p>
                <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(subtotal)}</p>
              </div>
              {/* Discount */}
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: B.rowAlt }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>
                    Discount{proposal?.discount_pct ? ` (${proposal.discount_pct}%)` : ""}
                  </p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>− {formatCurrency(discountAmount)}</p>
                </div>
              )}
              {/* Base, Aggregate & Disposal */}
              {badAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: B.rowAlt }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{badLabel}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(badAmount)}</p>
                </div>
              )}
              {/* Tax */}
              {taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{taxLabel}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(taxAmount)}</p>
                </div>
              )}
              {/* Total Investment */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 24px", background: B.bg, borderTop: `1px solid ${B.border}` }}>
                <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 700, color: B.black, margin: 0 }}>
                  Total Investment{taxAmount > 0 ? " + Tax" : ""}
                </p>
                <p style={{ fontFamily: B.cg, fontSize: 28, fontWeight: 400, color: B.gold, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Page gap — visible in preview, invisible in print/PDF */}
      <div style={{ height: 16, background: "#525659" }} className="screen-only" />

      {/* ══ PAGE 2 ══ Reviews + Signature */}
      <div style={{ pageBreakBefore: "always" as const, minHeight: "29.7cm", boxSizing: "border-box" as const }}>
        <PageHeader />

        <div style={{ padding: "36px 48px", minHeight: "9in", display: "flex", flexDirection: "column" as const }}>

          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 20px 0" }}>
            What Our Clients Say
          </p>

          {/* Horizontal review cards — live from DB via Admin → Proposal Reviews */}
          {reviews.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginBottom: 40 }}>
              {reviews.map((r) => (
                <div key={r.reviewer_name} style={{ background: "#fff", border: `1px solid ${B.border}`, borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "flex-start", gap: 20 }}>
                  {/* Left — name + stars */}
                  <div style={{ minWidth: 130, flexShrink: 0, borderRight: `1px solid ${B.border}`, paddingRight: 20 }}>
                    <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 12, color: B.black, margin: "0 0 4px 0" }}>{r.reviewer_name}</p>
                    <p style={{ color: B.gold, fontSize: 12, margin: 0, lineHeight: 1 }}>{"★".repeat(r.rating)}</p>
                  </div>
                  {/* Right — review text */}
                  <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.85, flex: 1 }}>{r.review_text}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Signature block */}
          <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 28 }}>
            <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 16px 0" }}>
              Authorization
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 20px 0" }}>
              By signing below, you authorize Butler & Associates Construction, Inc. to proceed with the scope of work outlined in this proposal under the agreed terms.
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

          {/* Footer */}
          <div style={{ marginTop: 32, textAlign: "center" as const }}>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.6, margin: "0 0 4px 0" }}>
              Questions? &nbsp;
              <a href="mailto:info@butlerconstruction.co" style={{ color: B.gold, textDecoration: "none" }}>
                info@butlerconstruction.co
              </a>
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
  );
}
