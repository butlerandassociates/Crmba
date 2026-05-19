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

const A4_H = "29.7cm";

interface ModDisplayItem {
  name: string;
  action: "edit" | "delete";
  category: string | null;
  delta: number;
}

interface ChangeOrderExportProps {
  co: any;
  client: any;
  originalTotal?: number;
  newTotal?: number;
  modificationsDisplay?: ModDisplayItem[];
}

export function ChangeOrderExport({ co, client, originalTotal, newTotal, modificationsDisplay }: ChangeOrderExportProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v || 0);
  const fmtDate = (d: string) =>
    new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();
  const clientAddr = [
    client?.address,
    [client?.city, client?.state, client?.zip].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  const items: any[] = co?.items || [];
  const mods: ModDisplayItem[] = (modificationsDisplay ?? []).filter(m => !isNaN(m.delta));
  const hasMods = mods.length > 0;
  const hasNewItems = items.length > 0;
  const itemsSum: number = items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  // When snapshots exist, use true net impact (includes modifications to existing items)
  const costImpact: number = (originalTotal != null && newTotal != null)
    ? newTotal - originalTotal
    : itemsSum;
  const showScopeSubheaders = hasMods && hasNewItems;
  const hasReason   = !!co?.reason?.trim();
  const hasTimeline = !!co?.timeline_impact?.trim();

  // Group items by category (same pattern as proposal)
  type ItemGroup = { category: string | null; items: any[] };
  const groupedItems = (() => {
    const map: Record<string, ItemGroup> = {};
    const flat: ItemGroup = { category: null, items: [] };
    for (const item of items) {
      const cat = item.category ?? null;
      if (cat) {
        if (!map[cat]) map[cat] = { category: cat, items: [] };
        map[cat].items.push(item);
      } else {
        flat.items.push(item);
      }
    }
    const result: ItemGroup[] = Object.values(map);
    if (flat.items.length > 0) result.push(flat);
    return result;
  })();

  const PAGE1_MAX  = 6;
  const needsPage2 = items.length > PAGE1_MAX;
  const page1Groups = needsPage2 ? (() => {
    const out: ItemGroup[] = [];
    let count = 0;
    for (const g of groupedItems) {
      if (count >= PAGE1_MAX) break;
      const take = Math.min(g.items.length, PAGE1_MAX - count);
      out.push({ category: g.category, items: g.items.slice(0, take) });
      count += take;
    }
    return out;
  })() : groupedItems;
  const page2Groups = needsPage2 ? (() => {
    const out: ItemGroup[] = [];
    let count = 0;
    for (const g of groupedItems) {
      if (count + g.items.length <= PAGE1_MAX) { count += g.items.length; continue; }
      const skip = Math.max(0, PAGE1_MAX - count);
      out.push({ category: g.category, items: g.items.slice(skip) });
      count = PAGE1_MAX;
    }
    return out;
  })() : [];

  const Header = () => (
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
          CHANGE ORDER
        </p>
        <p style={{ fontFamily: B.lato, fontSize: 16, fontWeight: 500, color: "#fff", margin: 0, maxWidth: 200, textAlign: "right" as const }}>
          {co?.title || "—"}
        </p>
      </div>
    </div>
  );

  const Footer = () => (
    <div style={{ borderTop: `1px solid ${B.border}`, padding: "10px 40px", paddingBottom:"16px", textAlign: "center" as const, background: "#fff" }}>
      <p style={{ fontFamily: B.inter, fontSize: 10, color: "#717182", margin: 0, lineHeight: 1.5 }}>
        Thank you for considering Butler &amp; Associates Construction, Inc. for your project. We look forward to working with you.
      </p>
    </div>
  );

  const ModificationsSection = () => (
    <div style={{ marginBottom: 20 }}>
      {mods.map((mod, idx) => (
        <div key={idx} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: `1px solid #C8C4BC`, marginBottom: 10 }}>
            <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0 }}>
              {mod.category || (mod.action === "delete" ? "Removed" : "Modified")}
            </p>
            <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: mod.delta >= 0 ? B.gold : "#C0392B", margin: 0, fontVariantNumeric: "tabular-nums" }}>
              {mod.delta >= 0 ? "+" : ""}{fmt(mod.delta)}
            </p>
          </div>
          <div style={{ padding: "4px 0 4px 8px" }}>
            <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65 }}>
              {mod.name}{mod.action === "delete" ? " — Removed" : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const ScopeGroups = ({ groups }: { groups: ItemGroup[] }) => (
    <div style={{ marginBottom: 20 }}>
      {groups.length === 0 && (
        <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, opacity: 0.45, textAlign: "center" as const, margin: 0 }}>No line items</p>
      )}
      {groups.map((group, gIdx) => {
        if (group.category) {
          const catTotal = group.items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
          return (
            <div key={gIdx} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: `1px solid #C8C4BC`, marginBottom: 10 }}>
                <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0 }}>{group.category}</p>
                <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(catTotal)}</p>
              </div>
              {group.items.map((item: any, iIdx: number) => (
                <div key={iIdx} style={{ padding: "4px 0 4px 8px" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0, opacity: 0.65 }}>{item.description}</p>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={gIdx} style={{ marginBottom: 16 }}>
            {group.items.map((item: any, iIdx: number) => (
              <div key={iIdx} style={{ padding: "4px 0" }}>
                <p style={{ fontFamily: B.inter, fontSize: 12, color: B.black, margin: 0 }}>{item.description}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  const TotalsBlock = () => (
    <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: 300 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
          <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>Change Order Total</p>
          <p style={{ fontFamily: B.inter, fontSize: 13, fontWeight: 500, color: costImpact >= 0 ? B.gold : "#C0392B", margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {costImpact >= 0 ? "+" : ""}{fmt(costImpact)}
          </p>
        </div>
        {originalTotal != null && newTotal != null && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, opacity: 0.7 }}>Original Contract Total</p>
              <p style={{ fontFamily: B.inter, fontSize: 13, color: B.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(originalTotal)}</p>
            </div>
            <div style={{ borderTop: `1px solid ${B.border}`, marginTop: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
              <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 500, color: B.black, margin: 0 }}>Revised Contract Total</p>
              <p style={{ fontFamily: B.lato, fontSize: 15, fontWeight: 500, color: B.black, margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(newTotal)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const SignatureBlock = () => (
    <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 24, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 40 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 52, borderBottom: "1px solid #C8C4BC", marginBottom: 10 }} />
          <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: "0 0 20px 0" }}>Client Signature</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontFamily: B.inter, fontSize: 11, color: "#717182", whiteSpace: "nowrap" as const }}>Date:</span>
            <div style={{ width: 110, borderBottom: "1px solid #C8C4BC", marginBottom: -5, marginTop:25 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 52, borderBottom: "1px solid #C8C4BC", marginBottom: 10 }} />
          <p style={{ fontFamily: B.lato, fontSize: 14, fontWeight: 500, color: B.black, margin: "0 0 20px 0" }}>Contractor Signature</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontFamily: B.inter, fontSize: 11, color: "#717182", whiteSpace: "nowrap" as const }}>Date:</span>
            <div style={{ width: 110, borderBottom: "1px solid #C8C4BC", marginBottom: -5, marginTop:25 }} />
          </div>
        </div>
      </div>
    </div>
  );

  const pageBody = (groups: ItemGroup[], showTotals: boolean, showSig: boolean) => (
    <div style={{ padding: "28px 40px", flex: 1, display: "flex", flexDirection: "column" as const }}>

      {/* Client info + date — only on page 1 */}
      {showSig && groups === page1Groups && (
        <>
          <div style={{ display: "flex", gap: 40, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 4px 0" }}>Prepared For</p>
              <p style={{ fontFamily: B.lato, fontSize: 13, fontWeight: 500, color: B.black, margin: "0 0 6px 0" }}>{clientName || "—"}</p>
              {clientAddr && <p style={{ fontFamily: B.inter, fontSize: 11, color: B.text, margin: 0, opacity: 0.65, lineHeight: 1.6 }}>{clientAddr}</p>}
            </div>
            <div style={{ width: "auto" }}>
              <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#999", margin: "0 0 4px 0" }}>Change Order Details</p>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: B.inter, fontSize: 11, color: B.text, opacity: 0.65 }}>Date:</span>
                <span style={{ fontFamily: B.lato, fontSize: 11, fontWeight: 500, color: B.black }}>{co?.created_at ? fmtDate(co.created_at) : "—"}</span>
              </div>
            </div>
          </div>

          <div style={{ borderBottom: `1px solid ${B.border}`, marginBottom: 16 }} />

          {/* Reason + Timeline */}
          {(hasReason || hasTimeline) && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: B.rowAlt, border: `1px solid ${B.border}`, borderRadius: 4 }}>
              {hasReason && (
                <div style={{ marginBottom: hasTimeline ? 10 : 0 }}>
                  <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>Reason for Change</p>
                  <p style={{ fontFamily: B.inter, fontSize: 12, lineHeight: 1.65, color: B.text, margin: 0 }}>{co.reason}</p>
                </div>
              )}
              {hasTimeline && (
                <div style={{ marginTop: hasReason ? 10 : 0, paddingTop: hasReason ? 10 : 0, borderTop: hasReason ? `1px solid ${B.border}` : "none" }}>
                  <p style={{ fontFamily: B.inter, fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.gold, margin: "0 0 5px 0" }}>Timeline Impact</p>
                  <p style={{ fontFamily: B.inter, fontSize: 12, color: B.text, margin: 0 }}>{co.timeline_impact}</p>
                </div>
              )}
            </div>
          )}

          <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 10px 0" }}>
            Scope Changes
          </p>

          {showScopeSubheaders && hasNewItems && (
            <p style={{ fontFamily: B.inter, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: B.black, margin: "0 0 8px 0", opacity: 0.6 }}>
              Items Added
            </p>
          )}
        </>
      )}

      <ScopeGroups groups={groups} />

      {hasMods && showTotals && <ModificationsSection />}

      {showTotals && <TotalsBlock />}

      {showSig && (
        <div style={{ marginTop: "auto" }}>
          <SignatureBlock />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: B.inter, color: B.black, background: "#fff", width: "100%", fontSize: 13 }}>

      {/* PAGE 1 */}
      <div style={{ minHeight: A4_H, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>
        <Header />
        {pageBody(page1Groups, !needsPage2, !needsPage2)}
        <Footer />
      </div>

      {/* PAGE 2 — overflow items + totals + signature */}
      {needsPage2 && (
        <div style={{ minHeight: A4_H, boxSizing: "border-box" as const, display: "flex", flexDirection: "column" as const }}>
          <Header />
          {pageBody(page2Groups, true, true)}
          <Footer />
        </div>
      )}

    </div>
  );
}
