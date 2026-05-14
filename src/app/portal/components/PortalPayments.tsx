import { useState } from "react";
import type { PortalPayment } from "../api/portal";

interface Props {
  payments: PortalPayment[];
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PayRow({ p, defaultOpen }: { p: PortalPayment; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const isPastDue = !p.is_paid && p.due_date
    ? new Date(p.due_date + "T00:00:00") < new Date()
    : false;

  const stateColor = p.is_paid
    ? "var(--portal-green)"
    : isPastDue
    ? "var(--portal-red)"
    : p.due_date
    ? "var(--portal-amber)"
    : "var(--portal-ink4)";

  const stateLabel = p.is_paid
    ? "PAID"
    : isPastDue
    ? "PAST DUE"
    : p.due_date
    ? "DUE"
    : "UPCOMING";

  const dateLabel = p.is_paid
    ? `Paid ${fmtDate(p.paid_date)}`
    : isPastDue && p.due_date
    ? `Was due ${fmtDateShort(p.due_date)}`
    : p.due_date
    ? `Due ${fmtDateShort(p.due_date)}`
    : "Upcoming";

  const pct = p.percentage != null ? Math.round(Number(p.percentage)) : null;

  return (
    <div style={{
      background: "var(--portal-panel)",
      border: `1px solid ${isPastDue ? "var(--portal-red)" : "var(--portal-line)"}`,
      borderRadius: 8,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "18px 22px",
          border: "none",
          background: "transparent",
          display: "grid",
          gridTemplateColumns: "120px 1fr 160px 160px 24px",
          alignItems: "center",
          cursor: "pointer",
          textAlign: "left",
          gap: 16,
          color: "var(--portal-ink)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: stateColor, flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: stateColor }}>
            {stateLabel}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--portal-ink)", lineHeight: 1.2 }}>
            {p.label}
          </div>
          {p.is_paid && p.payment_method && (
            <div style={{ fontSize: 11, color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
              {p.payment_method}
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--portal-ink2)" }}>
          {dateLabel}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, color: "var(--portal-ink)", letterSpacing: -0.5 }}>
            {fmt$(p.amount)}
          </div>
          {pct != null && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)" }}>
              {pct}%
            </div>
          )}
        </div>
        <span style={{ color: "var(--portal-ink3)" }}>
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 22px 22px", borderTop: "1px solid var(--portal-line-soft)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-ink3)", padding: "14px 0 8px" }}>
            BREAKDOWN
          </div>
          {p.breakdown && p.breakdown.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {p.breakdown.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--portal-line-soft)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", width: 24 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--portal-ink2)", flex: 1 }}>{b.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--portal-ink)" }}>
                    {fmt$(b.amount)}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", padding: "12px 0 0", borderTop: "2px solid var(--portal-line)" }}>
                <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1.2, color: "var(--portal-ink3)" }}>
                  TOTAL
                </span>
                <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 18, fontWeight: 900, color: "var(--portal-ink)" }}>
                  {fmt$(p.amount)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--portal-ink3)", fontStyle: "italic" }}>
              Breakdown not available yet.
            </div>
          )}

          {p.is_paid && p.confirmation_code && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--portal-green-soft)", borderRadius: 6, fontSize: 11, color: "var(--portal-green)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
              ✓ CONFIRMATION {p.confirmation_code.toUpperCase()}
            </div>
          )}

          {!p.is_paid && (
            <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--portal-panel2)", borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "var(--portal-ink2)", marginBottom: 4 }}>
                To make a payment, contact your project manager:
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--portal-ink3)", letterSpacing: 0.5 }}>
                CARD · ACH · WIRE
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalPayments({ payments }: Props) {
  const totalPaid = payments.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const duePayment = payments.find((p) => !p.is_paid && p.due_date);
  const upcomingPayment = payments.find((p) => !p.is_paid && !p.due_date);
  const pastDue = duePayment?.due_date
    ? new Date(duePayment.due_date + "T00:00:00") < new Date()
    : false;

  if (payments.length === 0) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", letterSpacing: 1 }}>
          NO PAYMENT SCHEDULE
        </div>
        <div style={{ fontSize: 13, color: "var(--portal-ink3)", marginTop: 8 }}>
          Your payment schedule will appear here once set up.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 0" }}>
      <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, margin: "0 0 4px", letterSpacing: -0.4 }}>
        Payment <span style={{ color: "var(--portal-gold)" }}>Schedule.</span>
      </h2>
      <div style={{ fontSize: 13, color: "var(--portal-ink3)", marginBottom: 24 }}>
        {payments.length} progress draw{payments.length !== 1 ? "s" : ""} over the contract term.
      </div>

      {/* Summary row */}
      {total > 0 && (
        <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 18 }}>
            {[
              { k: "PAID",     v: fmt$(totalPaid),                         pct: total > 0 ? totalPaid / total : 0,                        color: "var(--portal-green)" },
              { k: "DUE",      v: duePayment ? fmt$(duePayment.amount) : "$0", pct: duePayment && total > 0 ? duePayment.amount / total : 0, color: pastDue ? "var(--portal-red)" : "var(--portal-amber)" },
              { k: "UPCOMING", v: upcomingPayment ? fmt$(upcomingPayment.amount) : "$0", pct: upcomingPayment && total > 0 ? upcomingPayment.amount / total : 0, color: "var(--portal-ink4)" },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1,
                paddingRight: i < 2 ? 18 : 0,
                paddingLeft: i > 0 ? 18 : 0,
                borderRight: i < 2 ? "1px solid var(--portal-line)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.2, color: "var(--portal-ink3)" }}>{s.k}</span>
                </div>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 26, fontWeight: 900, color: "var(--portal-ink)", letterSpacing: -0.6 }}>{s.v}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--portal-ink3)", marginTop: 2 }}>
                  {Math.round(s.pct * 100)}% OF TOTAL
                </div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div style={{ display: "flex", gap: 4, height: 8 }}>
            {payments.map((p) => {
              const isPastDue = !p.is_paid && p.due_date
                ? new Date(p.due_date + "T00:00:00") < new Date()
                : false;
              return (
                <div key={p.id} style={{
                  flex: p.amount,
                  background: p.is_paid
                    ? "var(--portal-green)"
                    : isPastDue
                    ? "var(--portal-red)"
                    : p.due_date
                    ? "var(--portal-amber)"
                    : "var(--portal-line-soft)",
                  borderRadius: 2,
                }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Per draw */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {payments.map((p, i) => (
          <PayRow key={p.id} p={p} defaultOpen={!p.is_paid && i === payments.findIndex((x) => !x.is_paid)} />
        ))}
      </div>
    </div>
  );
}
