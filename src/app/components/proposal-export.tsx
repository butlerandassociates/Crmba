interface ProposalExportProps {
  proposal: any;
  client: any;
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

export function ProposalExport({ proposal, client }: ProposalExportProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sentDate  = proposal?.sent_at || proposal?.created_at;
  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();

  // Group line items by category; uncategorized items rendered flat
  type LineGroup = {
    category: string | null;
    items: { name: string; qty: number; unit: string; lineTotal: number }[];
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
      if (cat) {
        if (!groups[cat]) groups[cat] = { category: cat, items: [] };
        groups[cat].items.push({ name, qty, unit, lineTotal });
      } else {
        uncategorized.items.push({ name, qty, unit, lineTotal });
      }
    });
    const result: LineGroup[] = Object.values(groups);
    if (uncategorized.items.length > 0) result.push(uncategorized);
    return result;
  })();

  const subtotal       = proposal?.subtotal ?? groupedItems.flatMap((g) => g.items).reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = proposal?.discount_amount ?? 0;
  const taxAmount      = proposal?.tax_amount ?? 0;
  const taxLabel       = proposal?.tax_label ?? "Tax";
  const total          = proposal?.total ?? subtotal + taxAmount - discountAmount;

  // Shared page header — black bar with logo + estimate number
  const PageHeader = () => (
    <div>
      <div style={{ background: B.black, padding: "22px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>
            Butler & Associates Construction, Inc.
          </p>
          <p style={{ fontFamily: B.cg, fontSize: 18, fontStyle: "italic", fontWeight: 300, color: "#fff", margin: 0, lineHeight: 1.3 }}>
            Crafted with intention. Built to last.
          </p>
        </div>
        <img
          src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
          alt="Butler & Associates Construction"
          style={{ height: 52, width: "auto", objectFit: "contain" as const }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      {/* Gold divider */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${B.gold}, #8A7040)` }} />
    </div>
  );

  return (
    <div style={{ fontFamily: B.inter, color: B.black, background: B.bg, maxWidth: 816, margin: "0 auto", fontSize: 13 }}>

      {/* ══ PAGE 1 ══ */}
      <div style={{ paddingBottom: 48 }}>
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
            <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: "0 0 2px 0", opacity: 0.75 }}>Phone: (256) 617-4691 &nbsp;·&nbsp; jonathan@butlerconstruction.co</p>
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
            <div style={{ background: B.black, padding: "12px 24px", display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
                Scope of Work
              </p>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: 0 }}>
                Amount
              </p>
            </div>

            {/* Line items */}
            {groupedItems.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center" as const, color: B.text, opacity: 0.5, fontSize: 13 }}>
                No line items
              </div>
            )}

            {(() => {
              let rowIndex = 0;
              return groupedItems.map((group, gIdx) => (
                <div key={gIdx}>
                  {/* Category header (if categorized) */}
                  {group.category && (
                    <div style={{ padding: "8px 24px", background: "#F0EDE6", borderTop: gIdx > 0 ? `1px solid ${B.border}` : "none" }}>
                      <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.text, margin: 0, opacity: 0.7 }}>
                        {group.category}
                      </p>
                    </div>
                  )}
                  {/* Items */}
                  {group.items.map((item, iIdx) => {
                    const isAlt = rowIndex++ % 2 === 1;
                    const isLast = gIdx === groupedItems.length - 1 && iIdx === group.items.length - 1;
                    return (
                      <div
                        key={iIdx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: group.category ? "12px 24px 12px 32px" : "14px 24px",
                          background: isAlt ? B.rowAlt : "#fff",
                          borderBottom: !isLast ? `1px solid ${B.bg}` : "none",
                        }}
                      >
                        <p style={{ fontFamily: B.inter, fontSize: 13, color: B.black, margin: 0 }}>{item.name}</p>
                        <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 500, color: B.black, margin: 0, whiteSpace: "nowrap" as const }}>
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}

            {/* Discount / Tax rows (if applicable) */}
            {(discountAmount > 0 || taxAmount > 0) && (
              <div style={{ borderTop: `1px solid ${B.border}` }}>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 24px", background: "#fff" }}>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>
                      Discount{proposal?.discount_pct ? ` (${proposal.discount_pct}%)` : ""}
                    </p>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>− {formatCurrency(discountAmount)}</p>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 24px", background: B.rowAlt }}>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{taxLabel}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0 }}>{formatCurrency(taxAmount)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Total Investment */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: B.bg, borderTop: `2px solid ${B.border}` }}>
              <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 700, color: B.black, margin: 0 }}>Total Investment</p>
              <p style={{ fontFamily: B.cg, fontSize: 26, fontWeight: 400, color: B.gold, margin: 0 }}>
                {formatCurrency(total)}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ══ PAGE 2 ══ Reviews + Signature */}
      <div style={{ pageBreakBefore: "always" as const }}>
        <PageHeader />

        <div style={{ padding: "36px 48px", minHeight: "9in", display: "flex", flexDirection: "column" as const }}>

          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 20px 0" }}>
            What Our Clients Say
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 40 }}>
            {[
              {
                name: "Dan Ordonez",
                text: "The crew and Jonathan, the general manager, did an amazing job! The patio is now much easier to reach, enhancing the backyard's appearance. Their prices are extremely competitive and the transparency of the quote were the main reason why I chose them for this project. Jonathan was flexible with all the changes and adjustments we had during the project. Communication throughout this process was excellent as well. Highly recommend.",
              },
              {
                name: 'Drew "Smith" Mills',
                text: "Jonathan and his team at Butler & Associates Construction are some of the most professional and friendly people I've had the pleasure of working with in this industry. Words can't describe how amazing this team is and how precisely they executed our project. They were thoughtful in their design and layout, making sure everything matched exactly what we were looking for.",
              },
              {
                name: "B Robey",
                text: "After years of water issues, I had a specific vision for my backyard and reached out to Butler & Associates for a free estimate. Jonathan was incredibly responsive; he returned my call immediately and performed a thorough walkthrough, listening to my ideas while providing expert recommendations. The follow-up was impressive — within a day, we were reviewing the invoice and tweaking the design. Highly recommend.",
              },
            ].map((r) => (
              <div key={r.name} style={{ background: "#fff", border: `1px solid ${B.border}`, borderRadius: 6, padding: "16px 18px" }}>
                <p style={{ fontFamily: B.lato, fontWeight: 700, fontSize: 13, color: B.black, margin: "0 0 3px 0" }}>{r.name}</p>
                <p style={{ color: B.gold, fontSize: 15, margin: "0 0 8px 0", lineHeight: 1 }}>★★★★★</p>
                <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.65, color: B.text, margin: 0, opacity: 0.85 }}>{r.text}</p>
              </div>
            ))}
          </div>

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
              <a href="mailto:jonathan@butlerconstruction.co" style={{ color: B.gold, textDecoration: "none" }}>
                jonathan@butlerconstruction.co
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
