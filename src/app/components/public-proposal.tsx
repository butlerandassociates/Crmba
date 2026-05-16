import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, XCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { warrantyAPI } from "../api/warranty";
import type { WarrantySection } from "../api/warranty";

export function PublicProposal() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [warrantySections, setWarrantySections] = useState<WarrantySection[]>([]);
  const [warrantyDisclaimer, setWarrantyDisclaimer] = useState("");

  useEffect(() => {
    warrantyAPI.getAll()
      .then(({ sections, disclaimer }) => { setWarrantySections(sections); setWarrantyDisclaimer(disclaimer); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("estimates")
      .select(`*, client:clients(first_name, last_name, email, phone, address, city, state), line_items:estimate_line_items(*)`)
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProposal(data);
          setClient(data.client);
          if (data.status === "accepted") setDone("accepted");
          if (data.status === "declined") setDone("declined");
        }
        setLoading(false);
      });
  }, [id]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

  const handleAccept = async () => {
    setSubmitting(true);
    await supabase.from("estimates").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    }).eq("id", id);
    // Auto-void all draft/sent proposals for this client — only client-declined stays as "declined"
    if (proposal?.client_id) {
      supabase.from("estimates")
        .update({ status: "voided", voided_at: new Date().toISOString() })
        .eq("client_id", proposal.client_id)
        .neq("id", id)
        .in("status", ["draft", "sent"])
        .select("id, title, estimate_number")
        .then(({ data: voidedProposals }) => {
          (voidedProposals ?? []).forEach((vp: any) => {
            supabase.from("activity_log").insert({
              client_id: proposal.client_id,
              action_type: "status_changed",
              description: `Proposal ${vp.title} — voided by accepted proposal ${proposal.title}`,
              created_at: new Date().toISOString(),
            }).then(() => {});
          });
        });
    }
    const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "Client";
    supabase.from("notifications").insert({
      type: "proposal_accepted",
      title: "Proposal Accepted",
      message: `Accepted the proposal${proposal?.title ? ` "${proposal.title}"` : ""}.`,
      link: `/proposals/${id}`,
      is_read: false,
      created_by: null,
      metadata: { proposal_id: id, client_id: proposal?.client_id, client_name: clientName },
    }).then(() => {});
    if (proposal?.client_id) {
      supabase.from("activity_log").insert({
        client_id: proposal.client_id,
        action_type: "proposal_accepted",
        description: `Client accepted proposal: "${proposal.title}"`,
        created_at: new Date().toISOString(),
      }).then(() => {});
    }
    setDone("accepted");
    setSubmitting(false);
    setAction(null);
  };

  const handleDecline = async () => {
    setSubmitting(true);
    await supabase.from("estimates").update({
      status: "declined",
      declined_at: new Date().toISOString(),
      decline_reason: declineReason.trim() || null,
      declined_by: null,
    }).eq("id", id);
    const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "Client";
    supabase.from("notifications").insert({
      type: "proposal_declined",
      title: "Proposal Declined",
      message: `Declined the proposal${proposal?.title ? ` "${proposal.title}"` : ""}${declineReason.trim() ? ` — "${declineReason.trim()}"` : ""}.`,
      link: `/proposals/${id}`,
      is_read: false,
      created_by: null,
      metadata: { proposal_id: id, client_id: proposal?.client_id, client_name: clientName },
    }).then(() => {});
    if (proposal?.client_id) {
      supabase.from("activity_log").insert({
        client_id: proposal.client_id,
        action_type: "proposal_rejected",
        description: `Client declined proposal: "${proposal.title}"${declineReason.trim() ? ` — "${declineReason.trim()}"` : ""}`,
        created_at: new Date().toISOString(),
      }).then(() => {});
    }
    setDone("declined");
    setSubmitting(false);
    setAction(null);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F5F3EF" }}>
        <Loader2 style={{ width: 24, height: 24, color: "#BB984D" }} className="animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
        <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "Inter, sans-serif" }}>
          <div style={{ background: "#0A0A0A" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 32px", textAlign: "center" }}>
              <img
                src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
                alt="Butler & Associates Construction"
                style={{ height: 56, width: "auto", display: "block", margin: "0 auto 14px auto" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p style={{ color: "#BB984D", fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
                Butler & Associates Construction, Inc.
              </p>
            </div>
          </div>
          <div style={{ height: 2, background: "linear-gradient(90deg, #BB984D, #8A7040)" }} />
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "80px 32px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: "1px solid #e8e4dc", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px auto" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#BB984D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="11" y2="17"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: "#0A0A0A", margin: "0 0 10px 0" }}>Proposal Not Found</h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#3A3A38", opacity: 0.65, lineHeight: 1.7, margin: "0 0 32px 0" }}>
              This proposal link may have expired or is no longer available.<br />Please contact us if you believe this is an error.
            </p>
            <div style={{ borderTop: "1px solid #e8e4dc", paddingTop: 24 }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", opacity: 0.6, margin: "0 0 4px 0" }}>
                Questions? Reach us at{" "}
                <a href="mailto:info@butlerconstruction.co" style={{ color: "#BB984D", textDecoration: "none" }}>info@butlerconstruction.co</a>
                {" "}or{" "}
                <a href="tel:2566174691" style={{ color: "#BB984D", textDecoration: "none" }}>(256) 617-4691</a>
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#3A3A38", opacity: 0.4, margin: "4px 0 0 0" }}>
                6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";

  // Group line items by category (same pattern as proposal PDF)
  type LineGroup = { category: string | null; items: any[] };
  const groupedItems = (() => {
    const map: Record<string, LineGroup> = {};
    const flat: LineGroup = { category: null, items: [] };
    for (const item of (proposal?.line_items ?? [])) {
      const cat = item.category ?? null;
      if (cat) {
        if (!map[cat]) map[cat] = { category: cat, items: [] };
        map[cat].items.push(item);
      } else {
        flat.items.push(item);
      }
    }
    const result: LineGroup[] = Object.values(map);
    if (flat.items.length > 0) result.push(flat);
    return result;
  })();

  const subtotal       = proposal?.subtotal ?? (proposal?.line_items ?? []).reduce((s: number, i: any) => s + (i.total_price ?? (Number(i.quantity || 1) * Number(i.client_price || i.price_per_unit || 0))), 0);
  const discountAmount = proposal?.discount_amount ?? 0;
  const badAmount      = proposal?.bad_amount ?? 0;
  const badLabel       = proposal?.bad_label ?? "Base, Aggregate & Disposal";
  const taxAmount      = proposal?.tax_amount ?? 0;
  const taxLabel       = "Sales Tax";
  const total          = subtotal + badAmount + taxAmount - discountAmount;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "Inter, sans-serif" }}>

        {/* Header — centered logo + company name, matching proposal PDF */}
        <div style={{ background: "#0A0A0A" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 32px", textAlign: "center" }}>
            <img
              src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
              alt="Butler & Associates Construction"
              style={{ height: 56, width: "auto", display: "block", margin: "0 auto 14px auto" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <p style={{ color: "#BB984D", fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
              Butler & Associates Construction, Inc.
            </p>
          </div>
        </div>

        {/* Gold divider */}
        <div style={{ height: 2, background: "linear-gradient(90deg, #BB984D, #8A7040)" }} />

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 32px" }}>

          {/* Proposal title block */}
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: "0 0 10px 0" }}>
              Proposal Prepared For
            </p>
            <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 38, fontWeight: 300, color: "#0A0A0A", margin: "0 0 8px 0", lineHeight: 1.2 }}>
              {clientName}
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              {client?.address && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, opacity: 0.7 }}>
                  {client.address}{client.city ? `, ${client.city}` : ""}{client.state ? `, ${client.state}` : ""}
                </p>
              )}
              {client?.phone && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, opacity: 0.7 }}>
                  {client.phone}
                </p>
              )}
              {client?.email && (
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, opacity: 0.7 }}>
                  {client.email}
                </p>
              )}
            </div>
            <p style={{ fontFamily: "Lato, sans-serif", fontSize: 16, color: "#3A3A38", margin: 0 }}>
              {proposal.title}
            </p>
            {proposal.description && (
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#3A3A38", lineHeight: 1.7, margin: "12px 0 0 0", opacity: 0.75 }}>
                {proposal.description}
              </p>
            )}
          </div>

          {/* Status banners */}
          {done === "accepted" && (
            <div style={{ background: "#fff", border: "1px solid #BB984D", borderLeft: "4px solid #BB984D", borderRadius: 8, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2 style={{ width: 20, height: 20, color: "#BB984D", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: "Lato, sans-serif", fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: 0 }}>Proposal Accepted</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: "3px 0 0 0" }}>Thank you. We will be in touch shortly to begin your project.</p>
              </div>
            </div>
          )}
          {done === "declined" && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: "4px solid #3A3A38", borderRadius: 8, padding: "16px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
              <XCircle style={{ width: 20, height: 20, color: "#3A3A38", flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: "Lato, sans-serif", fontWeight: 700, fontSize: 14, color: "#0A0A0A", margin: 0 }}>Proposal Declined</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: "3px 0 0 0" }}>We appreciate your time and consideration. Feel free to reach out if anything changes.</p>
              </div>
            </div>
          )}

          {/* Line items — grouped by category */}
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e8e4dc", marginBottom: 28 }}>
            {/* Column header */}
            <div style={{ background: "#0A0A0A", padding: "12px 24px", display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: 0 }}>Scope of Work</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: 0 }}>Amount</p>
            </div>

            {groupedItems.map((group, gIdx) => {
              const borderTop = gIdx > 0 ? "1px solid #E8E4DC" : "none";
              if (group.category) {
                const catTotal = group.items.reduce((s: number, i: any) => s + (i.total_price ?? (Number(i.quantity || 1) * Number(i.client_price || i.price_per_unit || 0))), 0);
                return (
                  <div key={gIdx}>
                    {/* Category row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "#fff", borderTop }}>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{group.category}</p>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{formatCurrency(catTotal)}</p>
                    </div>
                    {/* Sub-items */}
                    {group.items.map((item: any, iIdx: number) => (
                      <div key={iIdx} style={{ padding: "8px 24px 8px 36px", background: "#fff", borderTop: "1px solid #F5F3EF" }}>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#3A3A38", margin: 0, opacity: 0.6 }}>· {item.product_name ?? item.name}</p>
                        {item.description && (
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#3A3A38", margin: "2px 0 0 10px", opacity: 0.45, lineHeight: 1.5 }}>{item.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              }
              // No category — show items flat with amount
              return (
                <div key={gIdx}>
                  {group.items.map((item: any, iIdx: number) => {
                    const lineTotal = item.total_price ?? (Number(item.quantity || 1) * Number(item.client_price || item.price_per_unit || 0));
                    return (
                      <div key={iIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 24px", background: "#fff", borderTop: "1px solid #F5F3EF" }}>
                        <div>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#0A0A0A", margin: 0 }}>{item.product_name ?? item.name}</p>
                          {item.description && (
                            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#3A3A38", margin: "3px 0 0 0", opacity: 0.5, lineHeight: 1.5 }}>{item.description}</p>
                          )}
                        </div>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 500, color: "#0A0A0A", margin: 0, flexShrink: 0, paddingLeft: 16 }}>{formatCurrency(lineTotal)}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Totals breakdown */}
            <div style={{ borderTop: "2px solid #e8e4dc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0 }}>Subtotal</p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(subtotal)}</p>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0 }}>Discount{proposal?.discount_pct ? ` (${proposal.discount_pct}%)` : ""}</p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, fontVariantNumeric: "tabular-nums" }}>− {formatCurrency(discountAmount)}</p>
                </div>
              )}
              {badAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0 }}>{badLabel}</p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(badAmount)}</p>
                </div>
              )}
              {taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fff" }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0 }}>{taxLabel}</p>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(taxAmount)}</p>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "#F5F3EF", borderTop: "1px solid #e8e4dc" }}>
                <p style={{ fontFamily: "Lato, sans-serif", fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Total Investment{taxAmount > 0 ? " + Tax" : ""}</p>
                <p style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, fontWeight: 400, color: "#BB984D", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!done && action === null && (
            <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
              <button
                onClick={() => setAction("accept")}
                style={{ flex: 1, padding: "16px 24px", background: "#0A0A0A", color: "#BB984D", border: "none", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.08em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <ThumbsUp style={{ width: 16, height: 16 }} />
                Accept Proposal
              </button>
              <button
                onClick={() => setAction("decline")}
                style={{ flex: 1, padding: "16px 24px", background: "#fff", color: "#3A3A38", border: "1px solid #e8e4dc", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: "0.08em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <ThumbsDown style={{ width: 16, height: 16 }} />
                Decline Proposal
              </button>
            </div>
          )}

          {/* Accept confirmation */}
          {!done && action === "accept" && (
            <div style={{ background: "#fff", border: "1px solid #BB984D", borderRadius: 10, padding: "24px", marginBottom: 28 }}>
              <p style={{ fontFamily: "Lato, sans-serif", fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 6px 0" }}>Confirm acceptance of this proposal?</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", lineHeight: 1.6, margin: "0 0 20px 0" }}>
                By confirming, you agree to move forward with this project under the Butler & Associates Construction Inc.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setAction(null)} disabled={submitting} style={{ padding: "10px 20px", background: "#fff", color: "#3A3A38", border: "1px solid #e8e4dc", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleAccept} disabled={submitting} style={{ padding: "10px 24px", background: "#0A0A0A", color: "#BB984D", border: "none", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {submitting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <CheckCircle2 style={{ width: 14, height: 14 }} />}
                  Yes, Accept
                </button>
              </div>
            </div>
          )}

          {/* Decline form */}
          {!done && action === "decline" && (
            <div style={{ background: "#fff", border: "1px solid #e8e4dc", borderRadius: 10, padding: "24px", marginBottom: 28 }}>
              <p style={{ fontFamily: "Lato, sans-serif", fontWeight: 700, fontSize: 15, color: "#0A0A0A", margin: "0 0 6px 0" }}>We're sorry to hear that.</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#3A3A38", margin: "0 0 14px 0" }}>Would you mind sharing why? (Optional)</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Budget constraints, timing, went with another contractor..."
                rows={3}
                style={{ width: "100%", padding: "10px 14px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#0A0A0A", border: "1px solid #e8e4dc", borderRadius: 6, resize: "vertical", outline: "none", marginBottom: 16, boxSizing: "border-box", background: "#F5F3EF" }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setAction(null)} disabled={submitting} style={{ padding: "10px 20px", background: "#fff", color: "#3A3A38", border: "1px solid #e8e4dc", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleDecline} disabled={submitting} style={{ padding: "10px 24px", background: "#3A3A38", color: "#fff", border: "none", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {submitting ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <XCircle style={{ width: 14, height: 14 }} />}
                  Decline Proposal
                </button>
              </div>
            </div>
          )}

          {/* Warranty Coverage */}
          {warrantySections.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <p style={{ fontFamily: "Lato, sans-serif", fontSize: 18, fontWeight: 700, color: "#0A0A0A", margin: "0 0 6px 0", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Warranty Coverage
                </p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: 0 }}>
                  Butler & Associates Construction, Inc.
                </p>
              </div>
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #BB984D, transparent)", marginBottom: 18 }} />
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, lineHeight: 1.75, color: "#3A3A38", margin: "0 0 24px 0", opacity: 0.85 }}>
                Butler & Associates Construction, Inc. warrants all labor and craftsmanship for the periods specified below, measured from the project completion date. This warranty applies exclusively to workmanship — material defects are addressed solely through manufacturer warranties.
              </p>
              {warrantySections.map((section) => (
                <div key={section.id} style={{ marginBottom: 20 }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: "0 0 10px 0" }}>
                    {section.title}
                  </p>
                  <div style={{ border: "1px solid #e8e4dc", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#0A0A0A", display: "grid", gridTemplateColumns: "1fr 2fr 1fr", padding: "10px 16px", gap: 12 }}>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 600, color: "#BB984D", margin: 0 }}>Scope Item</p>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 600, color: "#BB984D", margin: 0 }}>Craftsmanship & Labor</p>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 600, color: "#BB984D", margin: 0 }}>Material Defects</p>
                    </div>
                    {section.items.map((item, idx) => (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", padding: "10px 16px", gap: 12, background: idx % 2 === 0 ? "#fff" : "#FAFAF8", borderTop: "1px solid #e8e4dc" }}>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{item.scope_item}</p>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#3A3A38", margin: 0, lineHeight: 1.65 }}>{item.labor_text}</p>
                        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#3A3A38", margin: 0, opacity: 0.65, fontStyle: "italic" }}>{item.material_note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {warrantyDisclaimer && (
                <div style={{ padding: "14px 18px", background: "#fff", border: "1px solid #e8e4dc", borderRadius: 8 }}>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, lineHeight: 1.75, color: "#3A3A38", margin: 0, fontStyle: "italic", opacity: 0.72 }}>
                    {warrantyDisclaimer}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer — address + contact only, no repeated company name */}
          <div style={{ borderTop: "1px solid #e8e4dc", paddingTop: 24, textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#3A3A38", opacity: 0.6, margin: "0 0 4px 0" }}>
              Questions? Contact us at{" "}
              <a href="mailto:info@butlerconstruction.co" style={{ color: "#BB984D", textDecoration: "none" }}>
                info@butlerconstruction.co
              </a>{" "}
              or call{" "}
              <a href="tel:2566174691" style={{ color: "#BB984D", textDecoration: "none" }}>
                (256) 617-4691
              </a>
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#3A3A38", opacity: 0.45, margin: "4px 0 0 0" }}>
              6275 University Drive NW, Suite 37-314 · Huntsville, AL 35806
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
