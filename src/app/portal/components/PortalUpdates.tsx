import type { PortalUpdate } from "../api/portal";

interface Props {
  updates: PortalUpdate[];
}

function fmtDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function PhotoGallery({ photos }: { photos: PortalUpdate["photos"] }) {
  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <img
        src={photos[0].public_url!}
        alt={photos[0].label ?? ""}
        style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }}
      />
    );
  }

  if (photos.length === 4) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0 }}>
        <img src={photos[0].public_url!} alt={photos[0].label ?? ""} style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }} />
        <div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 0 }}>
          {photos.slice(1, 4).map((p) => (
            <img key={p.id} src={p.public_url!} alt={p.label ?? ""} style={{ width: "100%", height: 93, objectFit: "cover", display: "block" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)`, gap: 0 }}>
      {photos.slice(0, 3).map((p) => (
        <img key={p.id} src={p.public_url!} alt={p.label ?? ""} style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
      ))}
    </div>
  );
}

function UpdateCard({ u }: { u: PortalUpdate }) {
  const pmName = u.posted_by_profile
    ? `${u.posted_by_profile.first_name} ${u.posted_by_profile.last_name}`
    : "Project Manager";

  return (
    <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, overflow: "hidden" }}>
      {u.photos.length > 0 && u.photos[0].public_url && (
        <PhotoGallery photos={u.photos} />
      )}

      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-green)" }}>
            {fmtDate(u.posted_at).toUpperCase()}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink3)" }}>
            {pmName}
          </div>
        </div>

        <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 20, fontWeight: 900, color: "var(--portal-ink)", lineHeight: 1.2, marginBottom: 10, letterSpacing: -0.3 }}>
          {u.title}
        </div>
        <div style={{ fontSize: 14, color: "var(--portal-ink2)", lineHeight: 1.65, marginBottom: 20 }}>
          {u.body}
        </div>

        {(u.completed_items.length > 0 || u.upcoming_items.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, borderTop: "1px solid var(--portal-line)", paddingTop: 20 }}>
            {u.completed_items.length > 0 && (
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-green)", marginBottom: 10 }}>
                  COMPLETED
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {u.completed_items.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: "var(--portal-green)", fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 13, color: "var(--portal-ink2)", lineHeight: 1.4 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {u.upcoming_items.length > 0 && (
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--portal-amber)", marginBottom: 10 }}>
                  COMING UP
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {u.upcoming_items.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: "var(--portal-amber)", fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ fontSize: 13, color: "var(--portal-ink2)", lineHeight: 1.4 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PortalUpdates({ updates }: Props) {
  return (
    <div style={{ padding: "32px 0" }}>
      <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, margin: "0 0 4px", letterSpacing: -0.4 }}>
        Field <span style={{ color: "var(--portal-gold)" }}>Updates.</span>
      </h2>
      <div style={{ fontSize: 13, color: "var(--portal-ink3)", marginBottom: 28 }}>
        From your project manager, posted from the field.
      </div>

      {updates.length === 0 ? (
        <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, padding: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--portal-ink4)", letterSpacing: 1 }}>
            NO UPDATES YET
          </div>
          <div style={{ fontSize: 13, color: "var(--portal-ink3)", marginTop: 8 }}>
            Your PM will post field updates as work progresses.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {updates.map((u) => <UpdateCard key={u.id} u={u} />)}
        </div>
      )}
    </div>
  );
}
