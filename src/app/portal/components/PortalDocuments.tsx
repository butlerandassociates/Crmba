import type { PortalFile } from "../api/portal";

interface Props {
  files: PortalFile[];
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Map file category to "kind" label shown in the table
const KIND_LABELS: Record<string, string> = {
  Contract:      "Contract",
  Proposal:      "Proposal",
  "Change Order": "Change Order",
  Invoice:       "Invoice",
  Permit:        "Permit",
  Specs:         "Specs",
  Photo:         "Photo",
  Other:         "Other",
};

// Badge color per category
function categoryColor(cat: string): { fg: string; label: string } {
  const map: Record<string, { fg: string; label: string }> = {
    Contract:       { fg: "var(--portal-green)",  label: "SIGNED" },
    Proposal:       { fg: "var(--portal-green)",  label: "APPROVED" },
    "Change Order": { fg: "var(--portal-amber)",  label: "CHANGE ORDER" },
    Invoice:        { fg: "var(--portal-ink3)",   label: "INVOICE" },
    Permit:         { fg: "var(--portal-ink3)",   label: "PERMIT" },
    Specs:          { fg: "var(--portal-ink3)",   label: "REFERENCE" },
    Photo:          { fg: "var(--portal-ink3)",   label: "PHOTO" },
    Other:          { fg: "var(--portal-ink3)",   label: "DOCUMENT" },
  };
  return map[cat] ?? { fg: "var(--portal-ink3)", label: cat.toUpperCase() };
}

export function PortalDocuments({ files }: Props) {
  if (files.length === 0) {
    return (
      <div style={{ padding: "32px 0" }}>
        <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, margin: "0 0 24px", letterSpacing: -0.4 }}>
          Documents
        </h2>
        <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", letterSpacing: 1 }}>
            NO DOCUMENTS YET
          </div>
          <div style={{ fontSize: 13, color: "var(--portal-ink3)", marginTop: 8 }}>
            Your contracts, change orders, and specs will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: -0.4 }}>
          Documents
        </h2>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--portal-ink3)" }}>
          {files.length} FILE{files.length !== 1 ? "S" : ""}
        </span>
      </div>

      <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr 160px 130px 90px",
          padding: "10px 18px",
          background: "var(--portal-panel2)",
          borderBottom: "1px solid var(--portal-line)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: 1.2,
          color: "var(--portal-ink3)",
        }}>
          <span>TYPE</span>
          <span>FILE</span>
          <span>STATUS</span>
          <span>DATE</span>
          <span style={{ textAlign: "right" }}>ACTION</span>
        </div>

        {/* File rows */}
        {files.map((f, i) => {
          const sc = categoryColor(f.category);
          const kind = KIND_LABELS[f.category] ?? f.category;

          return (
            <div key={f.id} style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 160px 130px 90px",
              padding: "14px 18px",
              alignItems: "center",
              borderBottom: i < files.length - 1 ? "1px solid var(--portal-line-soft)" : "none",
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1, color: "var(--portal-ink2)" }}>
                {kind.toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--portal-ink)", lineHeight: 1.2 }}>
                  {f.file_name}
                </div>
                {f.file_size && (
                  <div style={{ fontSize: 11, color: "var(--portal-ink3)", marginTop: 2 }}>
                    {fmtSize(f.file_size)}
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: sc.fg }}>
                ● {sc.label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--portal-ink3)" }}>
                {fmtDate(f.created_at)}
              </span>
              <div style={{ textAlign: "right" }}>
                {f.file_url ? (
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 30,
                      padding: "0 12px",
                      border: "1px solid var(--portal-line)",
                      borderRadius: 4,
                      background: "transparent",
                      color: "var(--portal-ink)",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: 0.5,
                      textDecoration: "none",
                    }}
                  >
                    VIEW
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
