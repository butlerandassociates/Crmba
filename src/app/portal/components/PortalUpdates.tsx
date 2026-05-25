import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import type { PortalUpdate } from "../api/portal";

interface Props {
  updates: PortalUpdate[];
}

type Photo = PortalUpdate["photos"][0];

function fmtDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ photos, index, onClose, onNav }: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const photo = photos[index];
  const total = photos.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNav(index - 1);
      if (e.key === "ArrowRight" && index < total - 1) onNav(index + 1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [index, total, onClose, onNav]);

  const handleDownload = async () => {
    if (!photo.public_url) return;
    try {
      const res = await fetch(photo.public_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.label ?? `photo-${index + 1}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(photo.public_url, "_blank");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", zIndex: 9999,
      }}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
          {total > 1 ? `${index + 1} / ${total}` : "PHOTO"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 5,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent", color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              letterSpacing: 0.8, cursor: "pointer",
            }}
          >
            ↓ DOWNLOAD
          </button>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent", color: "rgba(255,255,255,0.85)",
              fontSize: 18, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Prev arrow */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(index - 1); }}
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.4)", color: "white",
            fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ‹
        </button>
      )}

      {/* Image */}
      <img
        src={photo.public_url!}
        alt={photo.label ?? ""}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "78vh",
          objectFit: "contain", borderRadius: 6,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      />

      {/* Label */}
      {photo.label && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 14, fontFamily: "'Lato', sans-serif",
            fontSize: 13, color: "rgba(255,255,255,0.6)",
          }}
        >
          {photo.label}
        </div>
      )}

      {/* Next arrow */}
      {index < total - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(index + 1); }}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.4)", color: "white",
            fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}

// ── Photo gallery grid ────────────────────────────────────────────────────────
function PhotoGallery({ photos, onPhotoClick }: {
  photos: PortalUpdate["photos"];
  onPhotoClick: (idx: number) => void;
}) {
  if (photos.length === 0) return null;

  const imgStyle = (h: number): CSSProperties => ({
    width: "100%", height: h, objectFit: "cover", display: "block",
    cursor: "pointer",
  });

  if (photos.length === 1) {
    return (
      <img
        src={photos[0].public_url!}
        alt={photos[0].label ?? ""}
        style={imgStyle(320)}
        onClick={() => onPhotoClick(0)}
      />
    );
  }

  if (photos.length === 4) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0 }}>
        <img src={photos[0].public_url!} alt={photos[0].label ?? ""} style={imgStyle(280)} onClick={() => onPhotoClick(0)} />
        <div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 0 }}>
          {photos.slice(1, 4).map((p, i) => (
            <img key={p.id} src={p.public_url!} alt={p.label ?? ""} style={imgStyle(93)} onClick={() => onPhotoClick(i + 1)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)`, gap: 0 }}>
      {photos.slice(0, 3).map((p, i) => (
        <img key={p.id} src={p.public_url!} alt={p.label ?? ""} style={imgStyle(240)} onClick={() => onPhotoClick(i)} />
      ))}
    </div>
  );
}

// ── Update card ───────────────────────────────────────────────────────────────
function UpdateCard({ u, onPhotoClick }: {
  u: PortalUpdate;
  onPhotoClick: (photos: Photo[], idx: number) => void;
}) {
  const pmName = u.posted_by_profile
    ? `${u.posted_by_profile.first_name} ${u.posted_by_profile.last_name}`
    : "Project Manager";

  return (
    <div style={{ background: "var(--portal-panel)", border: "1px solid var(--portal-line)", borderRadius: 8, overflow: "hidden" }}>
      {u.photos.length > 0 && u.photos[0].public_url && (
        <PhotoGallery
          photos={u.photos}
          onPhotoClick={(idx) => onPhotoClick(u.photos, idx)}
        />
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

        {u.phase_label && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", marginBottom: 8 }}>
            {u.phase_label}
          </div>
        )}
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

// ── Main export ───────────────────────────────────────────────────────────────
export function PortalUpdates({ updates }: Props) {
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);

  const openLightbox = useCallback((photos: Photo[], index: number) => {
    setLightbox({ photos, index });
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const navLightbox = useCallback((index: number) => setLightbox((prev) => prev ? { ...prev, index } : null), []);

  return (
    <>
      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={closeLightbox}
          onNav={navLightbox}
        />
      )}

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
            {updates.map((u) => (
              <UpdateCard key={u.id} u={u} onPhotoClick={openLightbox} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
