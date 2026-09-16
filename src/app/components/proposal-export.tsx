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

// Our Process — fixed 6-step timeline, same for every proposal
const PROCESS_STEPS = [
  {
    number: "01",
    label: "AGREEMENT",
    title: "Proposal Acceptance & Contract Signing",
    body: "Once you're ready to move forward, you'll formally accept this proposal and sign the project agreement. This contract outlines every detail of the scope, timeline, and investment — giving you full clarity before a single shovel hits the ground.",
  },
  {
    number: "02",
    label: "SITE REVIEW",
    title: "Pre-Installation Walk Through",
    body: "Our General Manager, Project Manager, and Crew Foreman will meet you on-site for a dedicated walkthrough. Together we'll mark boundaries, confirm measurements, verify the final design, and coordinate staging logistics. This step ensures every member of the team — and you — is aligned before work begins.",
  },
  {
    number: "03",
    label: "COMMENCEMENT",
    title: "Project Scheduling",
    body: "With the walkthrough complete, we lock in your project start date. You'll receive a confirmed schedule so you can plan accordingly. Our team coordinates materials, equipment, and crew to keep the timeline moving without surprises.",
  },
  {
    number: "04",
    label: "BUILD PHASE",
    title: "Installation",
    body: "Our crew gets to work — skilled, professional, and committed to the craftsmanship this project deserves. We maintain a clean, organized job site throughout and keep you informed of progress every step of the way.",
  },
  {
    number: "05",
    label: "TRANSPARENCY",
    title: "Client Portal Access",
    body: "Throughout the project, you'll have access to our proprietary client portal — your centralized hub for everything related to your build. Track real-time progress, review and submit payments, access your signed contract, and manage any change orders if applicable. Full transparency, always at your fingertips.",
    highlight: true,
  },
  {
    number: "06",
    label: "COMPLETION",
    title: "Final Walk Through & Project Close Out",
    body: "Before we close out your project, we conduct a thorough final walk with you on-site. We review every element of the completed work together, address any remaining questions, and ensure you're completely satisfied with the result. Only then do we consider the project finished.",
  },
];

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
  const validUntilStr = validUntilDate ? validUntilDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  type LineGroup = {
    category: string | null;
    items: { name: string; description?: string; client_note?: string; qty: number; unit: string; lineTotal: number }[];
  };

  const categoryNotes: Record<string, string> = proposal?.category_notes ?? {};

  const groupedItems = (() => {
    const map: Record<string, LineGroup> = {};
    const flat: LineGroup = { category: null, items: [] };
    for (const item of (proposal?.line_items ?? [])) {
      const cat         = item.category ?? null;
      const name        = item.product_name ?? item.name ?? "Item";
      const description = item.description ?? undefined;
      const client_note = item.client_note ?? undefined;
      const qty         = Number(item.quantity || 1);
      const unit        = item.unit ?? "";
      const lineTotal   = item.total_price ?? qty * Number(item.client_price || item.price_per_unit || 0);
      if (cat) {
        if (!map[cat]) map[cat] = { category: cat, items: [] };
        map[cat].items.push({ name, description, client_note, qty, unit, lineTotal });
      } else {
        flat.items.push({ name, description, client_note, qty, unit, lineTotal });
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
  const stripeFeeAmt   = proposal?.stripe_fee_amount ?? 0;
  const total          = subtotal + badAmount + taxAmount - discountAmount + stripeFeeAmt;

  // "Taxes & Fees" sub-note on the investment box — lists whichever of tax/BAD/CC-fee actually apply
  const feesNoteParts = [
    taxAmount > 0 ? taxLabel : null,
    badAmount > 0 ? badLabel : null,
    stripeFeeAmt > 0 ? "CC Processing Fee" : null,
  ].filter(Boolean);
  const feesTotal = taxAmount + badAmount + stripeFeeAmt;

  // ── Shared blocks ──────────────────────────────────────────────────────────

  const pageHeader = (
    <div id={preview ? undefined : "proposal-page-header"}>
      <div style={{ background: "#fff", borderBottom: `1px solid ${B.bg}`, padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo-gold.jpg"
            alt="B&A"
            style={{ height: 52, width: "auto", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <p style={{ fontFamily: B.lato, fontSize: 18, fontWeight: 500, color: B.black, margin: "0 0 4px 0" }}>
              Butler &amp; Associates Construction, Inc.
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.65, margin: "0 0 2px 0" }}>
              6275 University Drive NW, Suite 37-314, Huntsville, AL 35806
            </p>
            <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.65, margin: 0 }}>
              (256) 617-4691 &nbsp;·&nbsp; info@butlerconstruction.co
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>
            PROPOSAL
          </p>
          <p style={{ fontFamily: B.lato, fontSize: 26, fontWeight: 500, color: B.black, margin: 0 }}>
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

  const sectionLabel = (text: string) => (
    <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 16px 0" }}>
      {text}
    </p>
  );

  // ── Section 1: Scope ─────────────────────────────────────────────────────────

  const body1 = (
    <div id={preview ? undefined : "proposal-page-body"} style={{ background: "#fff" }}>
      <div style={{ padding: "24px 40px" }}>

        {proposal?.title && (
          <h2 style={{ fontFamily: B.lato, fontSize: 22, fontWeight: 400, color: B.black, margin: "0 0 12px 0" }}>
            {proposal.title}
          </h2>
        )}

        {proposal?.description && (
          <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, lineHeight: 1.6, margin: "0 0 24px 0", opacity: 0.8, whiteSpace: "pre-wrap" as const }}>
            {proposal.description}
          </p>
        )}

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
                <p style={{ fontFamily: B.lato, fontSize: 12, fontWeight: 500, color: B.black, margin: 0 }}>{validUntilStr}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid #E0E0E0", marginBottom: 24 }} />

        {sectionLabel("Project Scope")}

        <div style={{ marginBottom: 8 }}>
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
                    <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0, width: 90, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>{fmt(catTotal)}</p>
                  </div>
                  {categoryNotes[group.category]?.trim() && (
                    <div style={{ margin: "0 0 12px 0", padding: "8px 12px", background: "#FAF8F3", borderLeft: "2px solid #BB984D", borderRadius: "0 4px 4px 0" }}>
                      <p style={{ fontFamily: B.inter, fontSize: 10.5, color: B.text, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" as const }}>{categoryNotes[group.category]}</p>
                    </div>
                  )}
                  {group.items.map((item, iIdx) => (
                    <div key={iIdx} data-group="true" style={{ display: "flex", alignItems: "flex-start", padding: "6px 0 6px 8px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65 }}>{item.name}</p>
                        {item.description && <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "2px 0 0 0", opacity: 0.45, lineHeight: 1.4 }}>{item.description}</p>}
                        {item.client_note?.trim() && <p style={{ fontFamily: B.inter, fontSize: 10, color: "#8A6D2F", margin: "3px 0 0 0", lineHeight: 1.4, whiteSpace: "pre-wrap" as const }}>{item.client_note}</p>}
                      </div>
                      <div style={{ width: 90 }} />
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div key={gIdx} data-group="true" style={{ marginBottom: 20 }}>
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} data-group="true" style={{ display: "flex", alignItems: "flex-start", padding: "4px 0" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: B.inter, fontSize: 12, color: B.black, margin: 0 }}>{item.name}</p>
                      {item.description && <p style={{ fontFamily: B.inter, fontSize: 10, color: B.text, margin: "2px 0 0 0", opacity: 0.5, lineHeight: 1.4 }}>{item.description}</p>}
                      {item.client_note?.trim() && <p style={{ fontFamily: B.inter, fontSize: 10, color: "#8A6D2F", margin: "3px 0 0 0", lineHeight: 1.4, whiteSpace: "pre-wrap" as const }}>{item.client_note}</p>}
                    </div>
                    <div style={{ width: 90 }} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );

  // ── Section 2: Pricing Summary (recap + investment box + terms + signatures) ─

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

  const pricingSummaryContent = (
    <div style={{ padding: "24px 40px", minHeight: 895, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>

      <div style={{ display: "flex", gap: 32, marginBottom: 24 }} data-group="true">
        {/* Left: scope recap */}
        <div style={{ flex: 1 }}>
          {sectionLabel("Scope Summary")}
          <p style={{ fontFamily: B.inter, fontSize: 11.5, color: B.text, lineHeight: 1.65, margin: "0 0 16px 0", opacity: 0.75 }}>
            The following work has been scoped and priced for the property at{" "}
            <span style={{ color: B.black, fontWeight: 500 }}>{clientAddr || "the address above"}</span>. Full line-item detail is provided on the preceding page.
          </p>
          <div>
            {groupedItems.map((group, i) => {
              const catTotal = group.items.reduce((s, it) => s + it.lineTotal, 0);
              const label = group.category ?? "Other Items";
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid #F0EEE8" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, margin: 0 }}>{label}</p>
                  <p style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, margin: 0, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(catTotal)}</p>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #0A0A0A", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65 }}>Subtotal</span>
            <span style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</span>
          </div>
        </div>

        {/* Right: investment box */}
        <div style={{ flex: 1 }}>
          {sectionLabel("Your Investment")}
          <div style={{ border: "1px solid #E0E0E0", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: B.black, padding: "16px 20px", textAlign: "center" as const }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.2em", color: B.gold, margin: "0 0 4px 0" }}>
                PROPOSAL #{proposal?.estimate_number ?? "—"}
              </p>
              <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.4 }}>
                Your {proposal?.title || "Project"} Investment
              </p>
            </div>
            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EEE8" }}>
                <span style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65 }}>Subtotal</span>
                <span style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, fontVariantNumeric: "tabular-nums" }}>{fmt(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EEE8" }}>
                  <span style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65 }}>
                    {discountLabel || (discountType === "percent" && discountPct > 0 ? `Discount (${discountPct}%)` : "Discount")}
                  </span>
                  <span style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, fontVariantNumeric: "tabular-nums" }}>− {fmt(discountAmount)}</span>
                </div>
              )}
              {feesTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #F0EEE8" }}>
                  <div style={{ paddingRight: 8 }}>
                    <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.65, margin: 0 }}>Taxes &amp; Fees</p>
                    {feesNoteParts.length > 0 && <p style={{ fontFamily: B.inter, fontSize: 9.5, color: "#999", margin: "2px 0 0 0" }}>{feesNoteParts.join(" + ")}</p>}
                  </div>
                  <span style={{ fontFamily: B.inter, fontSize: 12, fontWeight: 500, color: B.black, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(feesTotal)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0 4px 0", marginTop: 4, borderTop: `2px solid ${B.gold}` }}>
                <span style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black }}>Total</span>
                <span style={{ fontFamily: B.lato, fontSize: 22, fontWeight: 600, color: B.gold, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
              </div>
            </div>
          </div>
          <p style={{ fontFamily: B.inter, fontSize: 10, color: "#999", margin: "10px 0 0 0", lineHeight: 1.5 }}>
            Valid through <span style={{ color: "#666" }}>{validUntilStr}</span>. Pricing is subject to change if scope is modified after acceptance.
          </p>
        </div>
      </div>

      {/* Terms + deposit */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }} data-group="true">
        <div style={{ flex: 1, background: "#FAFAF8", border: "1px solid #F0EEE8", borderRadius: 4, padding: "14px 18px" }}>
          <p style={{ fontFamily: B.inter, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 8px 0" }}>Acceptance of Proposal</p>
          <p style={{ fontFamily: B.inter, fontSize: 10.5, color: B.text, opacity: 0.75, margin: 0, lineHeight: 1.6 }}>
            By signing below, the client authorizes Butler &amp; Associates Construction, Inc. to proceed with the scope of work described in this proposal under the terms of the project agreement. Butler &amp; Associates warrants all labor and craftsmanship per the Warranty Coverage section of this proposal.
          </p>
        </div>
        <div style={{ flex: 1, background: "#FEFCF7", border: `1px solid ${B.gold}`, borderRadius: 4, padding: "14px 18px" }}>
          <p style={{ fontFamily: B.inter, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 8px 0" }}>Deposit &amp; Payment Schedule</p>
          <p style={{ fontFamily: B.inter, fontSize: 10.5, color: B.text, opacity: 0.75, margin: 0, lineHeight: 1.6 }}>
            A deposit is required upon acceptance of this proposal and signing of the project agreement. A full progress payment schedule will be outlined and detailed within the Agreement.
          </p>
        </div>
      </div>

      <div data-group="true" style={{ marginTop: "auto" }}>
        {sigLinesJSX}
      </div>
    </div>
  );

  // ── Section 3: Our Process ────────────────────────────────────────────────────

  const processContent = (
    <div style={{ padding: "24px 40px", minHeight: 910, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const, justifyContent: "space-between" as const }}>
      <div data-group="true" style={{ marginBottom: 4 }}>
        <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 6px 0" }}>What Happens Next</p>
        <h2 style={{ fontFamily: B.lato, fontSize: 26, fontWeight: 400, color: B.black, margin: "0 0 12px 0" }}>Our Process</h2>
        <div style={{ width: 44, height: 2, background: B.gold, marginBottom: 8 }} />
        <p style={{ fontFamily: B.inter, fontSize: 11.5, color: B.text, opacity: 0.7, lineHeight: 1.5, margin: 0, maxWidth: 460 }}>
          From the moment you accept this proposal to the final handshake at project close out, here is exactly what you can expect working with Butler &amp; Associates.
        </p>
        <div style={{ borderBottom: "1px solid #E0E0E0", marginTop: 14 }} />
      </div>

      <div>
        {PROCESS_STEPS.map((step, i) => {
          const isLast = i === PROCESS_STEPS.length - 1;
          return (
            <div key={step.number} data-group="true" style={{ display: "flex", gap: 18, paddingBottom: isLast ? 0 : 16 }}>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", flexShrink: 0, width: 30 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: B.gold, flexShrink: 0, textAlign: "center" as const }}>
                  <span style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 600, color: "#fff", letterSpacing: "0.04em", lineHeight: "30px", display: "block", position: "relative" as const, top: -5 }}>{step.number}</span>
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 28, marginTop: 6, background: "#E8E0D0" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: B.inter, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.16em", color: B.gold, margin: "0 0 4px 0" }}>{step.label}</p>
                <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 500, color: B.black, margin: "0 0 6px 0" }}>{step.title}</p>
                {step.highlight ? (
                  <div style={{ background: "#FAFAF7", borderLeft: `2px solid ${B.gold}`, borderRadius: "0 4px 4px 0", padding: "12px 16px", marginTop: 16 }}>
                    <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.75, margin: 0, lineHeight: 1.6 }}>{step.body}</p>
                    <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.08em", color: B.gold, margin: "8px 0 0 0" }}>
                      ● PROPRIETARY CLIENT PORTAL — INCLUDED WITH EVERY PROJECT
                    </p>
                  </div>
                ) : (
                  <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.7, margin: 0, lineHeight: 1.4 }}>{step.body}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ paddingTop: 10, paddingBottom: 10, borderTop: "1px solid #E8E0D0", borderBottom: "1px solid #E8E0D0", display: "flex", gap: 20 }}>
        {[
          { icon: "📋", label: "Contract & Documents", text: "Your signed agreement and any change orders, always accessible." },
          { icon: "💳", label: "Payments", text: "View your payment schedule, submit payments, and track your balance." },
          { icon: "📊", label: "Live Progress", text: "Real-time project updates so you're never in the dark." },
        ].map((f) => (
          <div key={f.label} style={{ flex: 1, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 17, lineHeight: 1, marginTop: 1 }}>{f.icon}</span>
            <div>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 4px 0" }}>{f.label}</p>
              <p style={{ fontFamily: B.inter, fontSize: 10.5, color: B.text, opacity: 0.65, margin: 0, lineHeight: 1.5 }}>{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Section 4: Client Testimonials ──────────────────────────────────────────

  const displayedReviews = reviews.slice(0, 6);

  const testimonialsContent = displayedReviews.length > 0 ? (
    <div style={{ padding: "24px 40px" }}>
      {sectionLabel("What Our Clients Say")}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 12 }}>
        {displayedReviews.map((r) => (
          <div key={r.reviewer_name} data-group="true" style={{ flex: "1 1 calc(50% - 6px)", border: "1px solid #E0E0E0", borderRadius: 6, padding: "14px 16px", boxSizing: "border-box" as const }}>
            <p style={{ fontFamily: B.lato, fontWeight: 500, fontSize: 13, color: B.black, margin: "0 0 3px 0" }}>{r.reviewer_name}</p>
            <p style={{ color: B.gold, fontSize: 13, margin: "0 0 10px 0" }}>{"★".repeat(r.rating)}</p>
            <p style={{ fontFamily: B.inter, fontSize: 11, lineHeight: 1.7, color: B.text, margin: 0, opacity: 0.8 }}>{r.review_text}</p>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // ── Section 5: Warranty Coverage ────────────────────────────────────────────

  const warrantyContent = warrantySections.length > 0 ? (
    <div style={{ padding: "24px 40px" }}>
      {sectionLabel("Warranty Coverage")}
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
    </div>
  ) : null;

  const lastPageFooter = (
    <div style={{ borderTop: "1px solid #E0E0E0", padding: "10px 40px 16px 40px", textAlign: "center" as const, background: "#fff" }}>
      <p style={{ fontFamily: B.inter, fontSize: 10, color: "#717182", margin: 0, lineHeight: 1.5 }}>
        Thank you for considering Butler &amp; Associates Construction, Inc. for your project. We look forward to working with you.
      </p>
    </div>
  );

  // ── Preview mode (staff-facing, floating shadowed pages) ────────────────────
  if (preview) {
    const shadow = "0 2px 12px rgba(0,0,0,0.4)";
    const page = (content: React.ReactNode, key: string, fullHeight = false) => (
      <div key={key} style={{ background: "#fff", boxShadow: shadow, overflow: "hidden", display: "flex", flexDirection: "column" as const, minHeight: fullHeight ? "29.7cm" : undefined }}>
        {pageHeader}
        <div style={{ flex: 1 }}>{content}</div>
      </div>
    );
    return (
      <div style={{ fontFamily: B.inter, color: B.black, fontSize: 13, display: "flex", flexDirection: "column" as const, gap: 24 }}>
        {page(body1, "scope")}
        {page(<>{pricingSummaryContent}{lastPageFooter}</>, "pricing", true)}
        {page(<>{processContent}{!testimonialsContent && !warrantyContent && lastPageFooter}</>, "process", true)}
        {testimonialsContent && page(<>{testimonialsContent}{!warrantyContent && lastPageFooter}</>, "testimonials", true)}
        {warrantyContent && page(<>{warrantyContent}{lastPageFooter}</>, "warranty", true)}
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

      <div id="proposal-page-body-2" style={{ background: "#fff" }}>{pricingSummaryContent}</div>

      <div id="proposal-page-body-3" style={{ background: "#fff" }}>{processContent}</div>

      {testimonialsContent && <div id="proposal-page-body-4" style={{ background: "#fff" }}>{testimonialsContent}</div>}

      {warrantyContent && <div id="proposal-page-body-5" style={{ background: "#fff" }}>{warrantyContent}</div>}

      <div id="proposal-last-footer" style={{ borderTop: "1px solid #E0E0E0", background: "#fff", padding: "10px 40px", paddingBottom: "20px", textAlign: "center" as const }}>
        <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.55 }}>
          Thank you for considering Butler &amp; Associates Construction, Inc. for your project. We look forward to working with you.
        </p>
      </div>
    </div>
  );
}
