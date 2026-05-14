import type { PortalPhase, PortalPayment, PortalUpdate } from "../api/portal";

interface Props {
  phases: PortalPhase[];
  payments: PortalPayment[];
  updates: PortalUpdate[];
  startDate: string | null;
  targetDate: string | null;
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function fmtDate(d: string | null): string {
  if (!d) return "TBD";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtPostedAt(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PhaseBar({ phase }: { phase: PortalPhase }) {
  const pct = Number(phase.progress_pct);
  const complete = phase.status === "complete";
  const active = phase.status === "in-progress";

  const dateLabel = complete
    ? `Completed ${fmtDate(phase.completed_date)}`
    : active
    ? `Est. ${fmtDate(phase.expected_date)}`
    : `Est. ${fmtDate(phase.expected_date)}`;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        height: 6,
        borderRadius: 2,
        marginBottom: 10,
        background: complete
          ? "var(--portal-green)"
          : active
          ? `linear-gradient(to right, var(--portal-green) ${pct}%, var(--portal-line-soft) ${pct}%)`
          : "var(--portal-line-soft)",
      }} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, color: "var(--portal-ink3)", marginBottom: 3 }}>
        {complete ? "✓ COMPLETE" : active ? "◉ ACTIVE" : "○ UPCOMING"}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--portal-ink)", lineHeight: 1.2 }}>
        {phase.label}
      </div>
      <div style={{ fontSize: 10, color: "var(--portal-ink3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
        {dateLabel}
      </div>
    </div>
  );
}

export function PortalOverview({ phases, payments, updates, startDate, targetDate }: Props) {
  const duePayment = payments.find((p) => !p.is_paid);
  const pastDue = duePayment?.due_date
    ? new Date(duePayment.due_date + "T00:00:00") < new Date()
    : false;
  const latestUpdate = updates[0] ?? null;

  const dateRange =
    startDate && targetDate
      ? `${fmtDate(startDate).toUpperCase()} → ${fmtDate(targetDate).toUpperCase()}`
      : "";

  return (
    <div style={{ padding: "32px 0" }}>
      {/* Phase Timeline */}
      {phases.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: -0.4 }}>
              Project Timeline
            </h2>
            {dateRange && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--portal-ink3)" }}>
                {dateRange}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {phases.map((ph) => <PhaseBar key={ph.id} phase={ph} />)}
          </div>
        </div>
      )}

      {/* Two-column: payment card + latest update */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
        {/* Payment card — due, past due, all paid, or upcoming */}
        {(() => {
          const allPaid = payments.length > 0 && payments.every((p) => p.is_paid);
          const totalPaid = payments.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0);
          const total = payments.reduce((s, p) => s + p.amount, 0);

          if (allPaid && payments.length > 0) {
            return (
              <div style={{ background: "var(--portal-green-soft)", border: "1px solid var(--portal-green)", borderRadius: 8, padding: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-green)", marginBottom: 8 }}>
                  ✓ ALL PAYMENTS COMPLETE
                </div>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 36, fontWeight: 900, color: "var(--portal-ink)", lineHeight: 1, letterSpacing: -0.8 }}>
                  {fmt$(totalPaid)}
                </div>
                <div style={{ fontSize: 13, color: "var(--portal-ink2)", marginTop: 8 }}>
                  {payments.length} draw{payments.length !== 1 ? "s" : ""} · contract paid in full
                </div>
                <div style={{ fontSize: 11, color: "var(--portal-green)", fontFamily: "'JetBrains Mono', monospace", marginTop: 16, letterSpacing: 0.5 }}>
                  Thank you for your business.
                </div>
              </div>
            );
          }

          if (duePayment) {
            return (
              <div style={{
                background: pastDue ? "var(--portal-red-soft)" : "var(--portal-panel)",
                border: `1px solid ${pastDue ? "var(--portal-red)" : "var(--portal-line)"}`,
                borderRadius: 8,
                padding: 24,
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: pastDue ? "var(--portal-red)" : "var(--portal-amber)", marginBottom: 8 }}>
                  {pastDue ? "◉ PAST DUE" : "◉ NEXT DRAW DUE"}
                </div>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 36, fontWeight: 900, color: "var(--portal-ink)", lineHeight: 1, letterSpacing: -0.8 }}>
                  {fmt$(duePayment.amount)}
                </div>
                <div style={{ fontSize: 13, color: "var(--portal-ink2)", marginTop: 8 }}>{duePayment.label}</div>
                {duePayment.due_date && (
                  <div style={{ fontSize: 11, color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                    {pastDue ? `WAS DUE ${fmtDate(duePayment.due_date).toUpperCase()}` : `DUE ${fmtDate(duePayment.due_date).toUpperCase()}`}
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}>
                  CONTACT YOUR PM TO ARRANGE PAYMENT
                </div>
              </div>
            );
          }

          // No payments yet
          if (payments.length === 0) {
            return (
              <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-ink3)", marginBottom: 8 }}>
                  PAYMENT SCHEDULE
                </div>
                <div style={{ fontSize: 13, color: "var(--portal-ink3)" }}>
                  Your payment schedule will be set up shortly. Contact your project manager with any questions.
                </div>
              </div>
            );
          }

          // Upcoming (first payment not due yet)
          const nextPayment = payments.find((p) => !p.is_paid);
          return (
            <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 24 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-ink3)", marginBottom: 8 }}>
                UPCOMING PAYMENT
              </div>
              <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 36, fontWeight: 900, color: "var(--portal-ink)", lineHeight: 1, letterSpacing: -0.8 }}>
                {nextPayment ? fmt$(nextPayment.amount) : "$0"}
              </div>
              <div style={{ fontSize: 13, color: "var(--portal-ink2)", marginTop: 8 }}>{nextPayment?.label ?? ""}</div>
              {nextPayment?.due_date && (
                <div style={{ fontSize: 11, color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                  DUE {fmtDate(nextPayment.due_date).toUpperCase()}
                </div>
              )}
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--portal-line-soft)", borderRadius: 6, fontSize: 11, color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt$(totalPaid)} OF {fmt$(total)} PAID
              </div>
            </div>
          );
        })()}

        {/* Latest field update OR placeholder */}
        {latestUpdate ? (
          <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, overflow: "hidden" }}>
            {latestUpdate.photos.length > 0 && latestUpdate.photos[0].public_url ? (
              <img
                src={latestUpdate.photos[0].public_url}
                alt={latestUpdate.photos[0].label ?? "Update photo"}
                style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: 100, background: "var(--portal-line-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", letterSpacing: 1 }}>FIELD UPDATE</span>
              </div>
            )}
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-green)", marginBottom: 6 }}>
                FIELD UPDATE · {fmtPostedAt(latestUpdate.posted_at).toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 18, fontWeight: 900, color: "var(--portal-ink)", lineHeight: 1.25, marginBottom: 8, letterSpacing: -0.3 }}>
                {latestUpdate.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--portal-ink2)", lineHeight: 1.6 }}>
                {latestUpdate.body}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--portal-panel)", border: "1px dashed var(--portal-line)", borderRadius: 8, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", letterSpacing: 1.4, marginBottom: 8 }}>
              FIELD UPDATES
            </div>
            <div style={{ fontSize: 13, color: "var(--portal-ink3)", lineHeight: 1.6 }}>
              Your project manager will post progress updates here as work gets underway.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
