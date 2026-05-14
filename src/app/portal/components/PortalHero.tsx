import type { PortalClient, PortalProject, PortalPayment } from "../api/portal";

interface Props {
  client: PortalClient;
  project: PortalProject | null;
  payments: PortalPayment[];
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function daysOut(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `${diff} days out`;
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PortalHero({ client, project, payments }: Props) {
  const clientName = `${client.first_name} ${client.last_name}`;
  const projectTitle = project?.project_type ?? "Your Project";
  const addressFull = [client.address, client.city, client.state].filter(Boolean).join(", ");

  const totalPaid = payments.filter((p) => p.is_paid).reduce((s, p) => s + p.amount, 0);
  const contractValue = project?.total_value ?? payments.reduce((s, p) => s + p.amount, 0);

  const progressPct = project ? Math.round(project.progress_pct) : 0;

  // Calculate days in/total from project start
  let daysIn: number | null = null;
  if (project?.start_date) {
    const start = new Date(project.start_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysIn = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1);
  }
  const daysTotal = project?.days_total ?? null;

  const statusLine =
    project?.progress_pct >= 100
      ? "COMPLETE"
      : daysIn !== null && daysTotal !== null
      ? `ACTIVE · DAY ${daysIn} OF ${daysTotal}`
      : "ACTIVE";

  const targetOut = daysOut(project?.target_date ?? null);

  const stats = [
    {
      k: "PROGRESS",
      v: `${progressPct}%`,
      sub: progressPct >= 100 ? "complete" : "on schedule",
    },
    {
      k: "PAID",
      v: fmt$(totalPaid),
      sub: `of ${fmt$(contractValue)}`,
    },
    {
      k: "TARGET",
      v: fmtDate(project?.target_date ?? null),
      sub: targetOut ?? "—",
    },
  ];

  return (
    <div style={{
      padding: "36px 48px 32px",
      background: "var(--portal-panel)",
      borderBottom: "1px solid var(--portal-line)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 3,
            color: "var(--portal-ink3)",
            marginBottom: 12,
          }}>
            {statusLine}
          </div>
          <h1 style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: 38,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -0.8,
            lineHeight: 1.05,
            color: "var(--portal-ink)",
          }}>
            The {clientName.split(" ").slice(-1)[0]}{" "}
            <span style={{ color: "var(--portal-gold)" }}>Residence.</span>
          </h1>
          {addressFull && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--portal-ink2)" }}>
              {addressFull}
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex",
          gap: 0,
          border: "1px solid var(--portal-line)",
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: "12px 18px",
              borderLeft: i > 0 ? "1px solid var(--portal-line)" : "none",
              background: "var(--portal-panel)",
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 1.4, color: "var(--portal-ink3)" }}>
                {s.k}
              </div>
              <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 20, fontWeight: 900, color: "var(--portal-ink)", marginTop: 2, letterSpacing: -0.4 }}>
                {s.v}
              </div>
              <div style={{ fontSize: 11, color: "var(--portal-ink3)", marginTop: 1 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
