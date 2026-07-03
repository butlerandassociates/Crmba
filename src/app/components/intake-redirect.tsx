import { useEffect } from "react";
import { useParams } from "react-router";

const INTAKE_FORM_BASE = "https://docs.google.com/forms/d/e/1FAIpQLSed6YY4dNn7yn_U7IakCfyTdQpNowwi48e1p3S9vgU7iKR7Rg/viewform";

export function IntakeRedirect() {
  const { clientId } = useParams<{ clientId: string }>();

  useEffect(() => {
    if (clientId) {
      window.location.replace(
        `${INTAKE_FORM_BASE}?entry.1284149011=${encodeURIComponent(clientId)}`
      );
    }
  }, [clientId]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Redirecting to intake form...</p>
      </div>
    </div>
  );
}
