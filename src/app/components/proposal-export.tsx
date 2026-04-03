interface ProposalExportProps {
  proposal: any;
  client: any;
}

export function ProposalExport({ proposal, client }: ProposalExportProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const sentDate = proposal?.sent_at || proposal?.created_at;
  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();

  // Group line items by category
  // - Items WITH a category: listed individually (name + qty + unit), no per-item price, category total shown at bottom
  // - Items WITHOUT a category (one-off): shown individually with qty + total
  type LineGroup = {
    category: string;
    items: { name: string; qty: number; unit: string }[];
    total: number;
    isUncategorized: boolean;
  };
  const groupedItems = (() => {
    const groups: Record<string, LineGroup> = {};
    const uncategorized: LineGroup = { category: "", items: [], total: 0, isUncategorized: true };
    (proposal?.line_items ?? []).forEach((item: any) => {
      const cat = item.category;
      const name = item.name ?? item.product_name ?? "Item";
      const qty = Number(item.quantity || 1);
      const unit = item.unit ?? "";
      const lineTotal = qty * Number(item.client_price || item.price_per_unit || 0);
      if (cat) {
        if (!groups[cat]) groups[cat] = { category: cat, items: [], total: 0, isUncategorized: false };
        groups[cat].items.push({ name, qty, unit });
        groups[cat].total += lineTotal;
      } else {
        uncategorized.items.push({ name, qty, unit });
        uncategorized.total += lineTotal;
      }
    });
    const result = Object.values(groups);
    if (uncategorized.items.length > 0) result.push(uncategorized);
    return result;
  })();

  const subtotal = proposal?.subtotal ?? groupedItems.reduce((s, g) => s + g.total, 0);
  const discountAmount = proposal?.discount_amount ?? 0;
  const taxAmount = proposal?.tax_amount ?? 0;
  const total = proposal?.total ?? subtotal + taxAmount - discountAmount;
  const taxLabel = proposal?.tax_label ?? "Tax";

  const GREEN = "#6B8C50";

  // Repeating page header — logo left, ESTIMATE # right — identical to Example.pdf
  const PageHeader = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <img
          src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/company-logo.jpg"
          alt="Butler & Associates Construction"
          style={{ height: 72, objectFit: "contain" as const }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ textAlign: "right" as const }}>
          <h1 style={{ fontSize: 26, fontWeight: "bold", margin: "0 0 4px 0", letterSpacing: 0.5 }}>
            ESTIMATE #{proposal?.estimate_number ?? "—"}
          </h1>
          <p style={{ margin: 0, fontSize: 11, fontWeight: "bold" as const }}>SENT ON:</p>
          <p style={{ margin: "2px 0 0 0", fontSize: 11 }}>{sentDate ? formatDate(sentDate) : "—"}</p>
        </div>
      </div>
      <hr style={{ border: "none", borderTop: "3px solid #6B8C50", margin: "0 0 28px 0" }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#111", background: "#fff", maxWidth: 816, margin: "0 auto", fontSize: 13 }}>

      {/* ══ PAGE 1 ══ RECIPIENT/SENDER + Project + Line Items + Totals */}
      <div style={{ padding: "36px 48px" }}>
        <PageHeader />

        {/* RECIPIENT + SENDER two-column */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: "bold", margin: "0 0 8px 0", letterSpacing: 0.5 }}>RECIPIENT:</p>
            <p style={{ fontSize: 14, fontWeight: "bold", margin: "0 0 3px 0" }}>{clientName || "—"}</p>
            {client?.address && <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>{client.address}</p>}
            {(client?.city || client?.state || client?.zip) && (
              <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>
                {[client?.city, client?.state, client?.zip].filter(Boolean).join(", ")}
              </p>
            )}
            {client?.phone && <p style={{ fontSize: 13, margin: 0 }}>Phone: {client.phone}</p>}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: "bold", margin: "0 0 8px 0", letterSpacing: 0.5 }}>SENDER:</p>
            <p style={{ fontSize: 14, fontWeight: "bold", margin: "0 0 3px 0" }}>Butler & Associates Construction, Inc</p>
            <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>6275 University Drive Northwest</p>
            <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>Suite 37-314</p>
            <p style={{ fontSize: 13, margin: "0 0 8px 0" }}>Huntsville, Alabama 35806</p>
            <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>Phone: (256) 617-4691</p>
            <p style={{ fontSize: 13, margin: "0 0 2px 0" }}>Email: jonathan@butlerconstruction.co</p>
            <p style={{ fontSize: 13, margin: 0 }}>Website: www.butlerconstruction.co</p>
          </div>
        </div>

        {/* Project title + description */}
        {(proposal?.title || proposal?.description) && (
          <div style={{ marginBottom: 24 }}>
            {proposal?.title && (
              <h2 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 8px 0" }}>{proposal.title}</h2>
            )}
            {proposal?.description && (
              <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "#374151" }}>{proposal.description}</p>
            )}
          </div>
        )}

        {/* Line items table — matches Example.pdf green header */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: GREEN }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontSize: 12, fontWeight: "bold", width: "22%" }}>
                Product/Service
              </th>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                Description
              </th>
              <th style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedItems.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  No line items
                </td>
              </tr>
            )}
            {groupedItems.map((group, gIdx) => (
              group.isUncategorized ? (
                // One-off items — show name + qty + total per line
                group.items.map((item, iIdx) => (
                  <tr key={`u-${iIdx}`} style={{ borderBottom: "1px solid #e5e7eb", background: (gIdx + iIdx) % 2 === 0 ? "#fff" : "#fafaf8" }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, verticalAlign: "top" }}>{item.name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#374151", verticalAlign: "top" }}>
                      {item.qty} {item.unit}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: "bold", textAlign: "right", verticalAlign: "top" }}>
                      {formatCurrency(group.total / group.items.length)}
                    </td>
                  </tr>
                ))
              ) : (
                // Categorized (wizard) items — category header + items with qty only + category total
                <>
                  {/* Category header */}
                  <tr key={`cat-${gIdx}`} style={{ background: "#f3f4f6" }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 11, fontWeight: "bold", letterSpacing: 0.8, color: "#374151", textTransform: "uppercase" as const }}>
                      {group.category}
                    </td>
                  </tr>
                  {/* Items — name + qty + unit, no price */}
                  {group.items.map((item, iIdx) => (
                    <tr key={`${gIdx}-${iIdx}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "7px 14px 7px 20px", fontSize: 12, verticalAlign: "top" }}>{item.name}</td>
                      <td style={{ padding: "7px 14px", fontSize: 12, color: "#6b7280", verticalAlign: "top" }}>
                        {item.qty} {item.unit}
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right", verticalAlign: "top" }} />
                    </tr>
                  ))}
                  {/* Category total */}
                  <tr key={`tot-${gIdx}`} style={{ borderBottom: "1px solid #e5e7eb", borderTop: "1px solid #e5e7eb" }}>
                    <td colSpan={2} style={{ padding: "8px 14px", fontSize: 12, fontWeight: "bold", textAlign: "right", color: "#374151" }}>
                      {group.category} Total
                    </td>
                    <td style={{ padding: "8px 14px", fontSize: 12, fontWeight: "bold", textAlign: "right", whiteSpace: "nowrap" as const }}>
                      {formatCurrency(group.total)}
                    </td>
                  </tr>
                </>
              )
            ))}
          </tbody>
        </table>

        {/* Totals — right-aligned table matching Example.pdf */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 0 }}>
          <table style={{ borderCollapse: "collapse", minWidth: 300, borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13, fontWeight: "bold", borderRight: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  Subtotal
                </td>
                <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13 }}>
                  {formatCurrency(subtotal)}
                </td>
              </tr>
              {discountAmount > 0 && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13, borderRight: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    Discount{proposal?.discount_pct ? ` (${proposal.discount_pct}%)` : ""}
                  </td>
                  <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13 }}>
                    - {formatCurrency(discountAmount)}
                  </td>
                </tr>
              )}
              {taxAmount > 0 && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13, fontWeight: "bold", borderRight: "1px solid #e5e7eb", background: "#f9fafb", whiteSpace: "nowrap" }}>
                    {taxLabel}
                  </td>
                  <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 13 }}>
                    {formatCurrency(taxAmount)}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 14, fontWeight: "bold", borderRight: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  Total
                </td>
                <td style={{ padding: "9px 16px", textAlign: "right", fontSize: 14, fontWeight: "bold" }}>
                  {formatCurrency(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* ══ PAGE 2 ══ Reviews + Signature */}
      <div style={{ padding: "36px 48px", pageBreakBefore: "always" as const, minHeight: "10.5in", display: "flex", flexDirection: "column" as const }}>
        <PageHeader />

        <h3 style={{ fontSize: 15, fontWeight: "bold", margin: "0 0 20px 0" }}>Reviews</h3>

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
            <div key={r.name}>
              <p style={{ fontWeight: "bold", margin: "0 0 4px 0", fontSize: 13 }}>{r.name}</p>
              <p style={{ color: "#F5A623", fontSize: 18, margin: "0 0 8px 0", lineHeight: 1 }}>★★★★★</p>
              <p style={{ fontSize: 12, lineHeight: 1.65, color: "#374151", margin: 0 }}>{r.text}</p>
            </div>
          ))}
        </div>

        {/* Spacer — pushes signature to bottom */}
        <div style={{ flex: 1 }} />

        {/* Signature — pinned to bottom of page */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 28 }}>
          <p style={{ fontSize: 13, margin: 0 }}>
            Signature: _____________________ &nbsp;&nbsp;&nbsp; Date: _____________
          </p>
        </div>

      </div>

    </div>
  );
}
