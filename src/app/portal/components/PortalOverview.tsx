import { useState } from "react";
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

function PhaseBar({ phase, expanded, onToggle }: {
  phase: PortalPhase;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct = Number(phase.progress_pct);
  const complete = phase.status === "complete";
  const active = phase.status === "in-progress";
  const tasks = phase.tasks ?? [];
  const completedCount = tasks.filter(t => t.is_completed).length;
  const totalCount = tasks.length;

  const dateLabel = complete
    ? `Completed ${fmtDate(phase.completed_date)}`
    : `Est. ${fmtDate(phase.expected_date)}`;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Progress bar */}
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

      {/* Status label */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1, color: "var(--portal-ink3)", marginBottom: 3 }}>
        {complete ? "✓ COMPLETE" : active ? "◉ ACTIVE" : "○ UPCOMING"}
      </div>

      {/* Phase name */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--portal-ink)", lineHeight: 1.2 }}>
        {phase.label}
      </div>

      {/* Date */}
      <div style={{ fontSize: 10, color: "var(--portal-ink3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
        {dateLabel}
      </div>

      {/* Task count toggle — only shown when there are tasks */}
      {totalCount > 0 && (
        <button
          onClick={onToggle}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: 0.8,
            color: complete ? "var(--portal-green)" : active ? "var(--portal-green)" : "var(--portal-ink4)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {completedCount}/{totalCount} TASKS {expanded ? "▲" : "▼"}
        </button>
      )}

      {/* Task list — inline below phase bar when expanded */}
      {expanded && totalCount > 0 && (
        <div style={{
          marginTop: 8,
          background: "var(--portal-panel)",
          border: "1px solid var(--portal-line-soft)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {tasks.map((task, i) => (
            <div
              key={task.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "7px 10px",
                borderBottom: i < tasks.length - 1 ? "1px solid var(--portal-line-soft)" : "none",
              }}
            >
              {/* Checkbox indicator */}
              <div style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: `1.5px solid ${task.is_completed ? "var(--portal-green)" : "var(--portal-line)"}`,
                background: task.is_completed ? "var(--portal-green)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}>
                {task.is_completed && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Task label */}
              <span style={{
                fontSize: 11,
                lineHeight: 1.4,
                color: task.is_completed ? "var(--portal-ink3)" : "var(--portal-ink2)",
                textDecoration: task.is_completed ? "line-through" : "none",
                flexGrow: 1,
              }}>
                {task.task_label}
              </span>

              {/* Requirement badges */}
              <div style={{ display: "flex", gap: 3, flexShrink: 0, marginTop: 1 }}>
                {task.photo_required && (
                  <span style={{
                    fontSize: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0.5,
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: task.is_completed ? "var(--portal-green-soft)" : "rgba(59,130,246,0.08)",
                    color: task.is_completed ? "var(--portal-green)" : "#3b82f6",
                    border: `1px solid ${task.is_completed ? "var(--portal-green)" : "rgba(59,130,246,0.2)"}`,
                  }}>📷</span>
                )}
                {task.note_required && (
                  <span style={{
                    fontSize: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0.5,
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: task.is_completed ? "var(--portal-green-soft)" : "rgba(245,158,11,0.08)",
                    color: task.is_completed ? "var(--portal-green)" : "var(--portal-amber)",
                    border: `1px solid ${task.is_completed ? "var(--portal-green)" : "rgba(245,158,11,0.2)"}`,
                  }}>📝</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalOverview({ phases, payments, updates, startDate, targetDate }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

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
    <>
    {lightboxUrl && (
      <div
        onClick={() => setLightboxUrl(null)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      >
        <button
          onClick={() => setLightboxUrl(null)}
          style={{ position: "absolute", top: 16, right: 20, width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >×</button>
        <img
          src={lightboxUrl}
          alt="Field update photo"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 6 }}
        />
      </div>
    )}
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            {phases.map((ph) => (
              <PhaseBar
                key={ph.id}
                phase={ph}
                expanded={expandedPhase === ph.id}
                onToggle={() => setExpandedPhase(prev => prev === ph.id ? null : ph.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Two-column: payment card + latest update */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
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
              </div>
            );
          }

          if (payments.length === 0) {
            return (
              <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 24 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-ink3)", marginBottom: 8 }}>
                  PAYMENT SCHEDULE
                </div>
                <div style={{ fontSize: 13, color: "var(--portal-ink3)" }}>
                  Your payment schedule will be set up shortly.
                </div>
              </div>
            );
          }

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
                onClick={() => setLightboxUrl(latestUpdate.photos[0].public_url!)}
                style={{ width: "100%", height: 220, objectFit: "cover", display: "block", cursor: "pointer" }}
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
    </>
  );
}
