import type { PortalClient, PortalProject, PortalPayment } from "../api/portal";

type Tab = "overview" | "documents" | "payments" | "updates";

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  client: PortalClient;
  project: PortalProject | null;
  payments: PortalPayment[];
}

const NAV_ITEMS: { id: Tab; label: string; num: string }[] = [
  { id: "overview",   label: "Overview",      num: "01" },
  { id: "documents",  label: "Documents",     num: "02" },
  { id: "payments",   label: "Payments",      num: "03" },
  { id: "updates",    label: "Field Updates", num: "04" },
];

export function PortalSidebar({ tab, setTab, client, project, payments }: Props) {
  const pmName = project?.project_manager
    ? `${project.project_manager.first_name} ${project.project_manager.last_name}`.trim()
    : null;
  const pmInitials = pmName
    ? pmName.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()
    : "BA";
  const pmPhone = project?.project_manager?.phone ?? null;

  const duePayment = payments.find((p) => !p.is_paid && p.due_date);
  const pastDue = duePayment
    ? new Date(duePayment.due_date! + "T00:00:00") < new Date()
    : false;

  const clientName = `${client.first_name} ${client.last_name}`;
  const siteLine1 = [client.address].filter(Boolean).join("");
  const siteLine2 = [client.city, client.state].filter(Boolean).join(", ");
  const projectLabel = project?.project_type ?? "Your Project";

  return (
    <div className="portal-sidebar">
      {/* Branding */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Lato', sans-serif",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: -0.1,
          color: "var(--portal-ink)",
          lineHeight: 1.25,
        }}>
          Butler &amp; Associates<br />
          Construction, <span style={{ color: "var(--portal-gold)" }}>Inc.</span>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--portal-ink3)",
          marginTop: 12,
          letterSpacing: 2.4,
          textTransform: "uppercase",
        }}>
          {projectLabel}
        </div>
      </div>

      {/* Nav */}
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)", letterSpacing: 1.4, marginBottom: 12 }}>
        SECTIONS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const active = item.id === tab;
          let tag: string | null = null;
          if (item.id === "payments" && duePayment) {
            tag = pastDue ? "Past due" : duePayment.due_date
              ? `Due ${new Date(duePayment.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : null;
          }
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: active ? "var(--portal-panel2)" : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "left",
                color: active ? "var(--portal-ink)" : "var(--portal-ink2)",
                fontFamily: "'Inter', sans-serif",
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                width: "100%",
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", width: 20, flexShrink: 0 }}>
                {item.num}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {tag && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 4,
                  background: pastDue ? "var(--portal-red-soft)" : "var(--portal-amber-soft)",
                  color: pastDue ? "var(--portal-red)" : "var(--portal-amber)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.3,
                }}>
                  {tag}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Site */}
      {(siteLine1 || siteLine2) && (
        <div style={{ padding: "16px 0", borderTop: "1px solid var(--portal-line)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)", letterSpacing: 1.4, marginBottom: 8 }}>
            SITE
          </div>
          <div style={{ fontSize: 11, color: "var(--portal-ink2)", lineHeight: 1.55 }}>
            {siteLine1 && <>{siteLine1}<br /></>}
            {siteLine2}
          </div>
        </div>
      )}

      {/* Client */}
      <div style={{ padding: "14px 0", borderTop: "1px solid var(--portal-line)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)", letterSpacing: 1.4, marginBottom: 8 }}>
          CLIENT
        </div>
        <div style={{ fontSize: 12, color: "var(--portal-ink)", fontWeight: 600, lineHeight: 1.3 }}>
          {clientName}
        </div>
        {client.phone && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)", marginTop: 4 }}>
            {client.phone}
          </div>
        )}
      </div>

      {/* PM */}
      <div style={{ padding: "14px 0 0", borderTop: "1px solid var(--portal-line)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)", letterSpacing: 1.4, marginBottom: 8 }}>
          PROJECT MANAGER
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 4,
            background: "var(--portal-ink)",
            color: "var(--portal-panel)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {pmInitials}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--portal-ink)", fontSize: 12 }}>
              {pmName ?? "Butler & Associates"}
            </div>
            {pmPhone && (
              <div style={{ color: "var(--portal-ink3)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{pmPhone}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
