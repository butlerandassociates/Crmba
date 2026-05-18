import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { validatePortalToken, type PortalData } from "../api/portal";
import { ClientDashboardNew } from "../components/ClientDashboardNew";

type State = "loading" | "invalid" | "ready";

export function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "overview";
  const initialCoId = searchParams.get("co") ?? null;
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    validatePortalToken(token)
      .then((result) => {
        if (!result) {
          setState("invalid");
        } else {
          setData(result);
          setState("ready");
        }
      })
      .catch(() => setState("invalid"));
  }, [token]);

  if (state === "loading") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#FAFAFA",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40,
            height: 40,
            border: "3px solid #EAEAEA",
            borderTopColor: "#B8924B",
            borderRadius: "50%",
            animation: "portal-spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <style>{`@keyframes portal-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#9AA0A6", letterSpacing: 1.5 }}>
            LOADING YOUR PROJECT
          </div>
        </div>
      </div>
    );
  }

  if (state === "invalid" || !data) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#FAFAFA",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "0 24px" }}>
          <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 64, fontWeight: 900, color: "#EAEAEA", lineHeight: 1, marginBottom: 16 }}>
            404
          </div>
          <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 900, color: "#0B0C0E", marginBottom: 8 }}>
            This link has expired or is invalid.
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
            Your project link may have been revoked or changed. Contact{" "}
            <a href="mailto:info@butlerconstruction.co" style={{ color: "#B8924B" }}>
              Butler &amp; Associates
            </a>{" "}
            for a new link.
          </div>
        </div>
      </div>
    );
  }

  return <ClientDashboardNew data={data} token={token!} initialTab={initialTab} initialCoId={initialCoId} />;
}
