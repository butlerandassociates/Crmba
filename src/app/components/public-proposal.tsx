import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, XCircle, ThumbsUp, ThumbsDown } from "lucide-react";

export function PublicProposal() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

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
    }).eq("id", id);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F5F3EF", fontFamily: "Inter, sans-serif" }}>
        <p style={{ color: "#3A3A38" }}>Proposal not found.</p>
      </div>
    );
  }

  const clientName = client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "";

  return (
    <>
      {/* Load brand fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lato:wght@400;700&family=Inter:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div style={{ background: "#0A0A0A", padding: "0" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: "#BB984D", fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 6px 0" }}>
                Butler & Associates Construction, Inc.
              </p>
              <p style={{ color: "#FFFFFF", fontFamily: "Cormorant Garamond, serif", fontSize: 20, fontStyle: "italic", fontWeight: 300, margin: 0, lineHeight: 1.3 }}>
                Crafted with intention.<br />Built to last.
              </p>
            </div>
            <img
              src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo.png"
              alt="Butler & Associates Construction"
              style={{ height: 56, width: "auto", objectFit: "contain" }}
            />
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

          {/* Line items */}
          <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #e8e4dc", marginBottom: 28 }}>
            <div style={{ background: "#0A0A0A", padding: "14px 24px", display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: 0 }}>Scope of Work</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: "#BB984D", margin: 0 }}>Amount</p>
            </div>
            {(proposal.line_items || []).map((item: any, idx: number) => (
              <div key={item.id ?? idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: idx < proposal.line_items.length - 1 ? "1px solid #F5F3EF" : "none", background: idx % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#0A0A0A", margin: 0 }}>
                  {item.product_name || item.name}
                </p>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 500, color: "#0A0A0A", margin: 0 }}>
                  {formatCurrency(item.total_price ?? item.quantity * item.client_price)}
                </p>
              </div>
            ))}
            {/* Total row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", background: "#F5F3EF", borderTop: "2px solid #e8e4dc" }}>
              <p style={{ fontFamily: "Lato, sans-serif", fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Total Investment</p>
              <p style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, fontWeight: 400, color: "#BB984D", margin: 0 }}>
                {formatCurrency(proposal.total)}
              </p>
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

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e8e4dc", paddingTop: 24, textAlign: "center" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#3A3A38", opacity: 0.6, margin: "0 0 4px 0" }}>
              Questions? Contact us at{" "}
              <a href="mailto:jonathan@butlerconstruction.co" style={{ color: "#BB984D", textDecoration: "none" }}>
                jonathan@butlerconstruction.co
              </a>{" "}
              or call{" "}
              <a href="tel:2566174691" style={{ color: "#BB984D", textDecoration: "none" }}>
                (256) 617-4691
              </a>
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#BB984D", margin: "8px 0 0 0" }}>
              Butler & Associates Construction, Inc.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
