import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "./ui/button";

export function GoogleCalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code received from Google.");
      return;
    }

    supabase.functions.invoke("google-calendar-callback", { body: { code } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setStatus("error");
          setErrorMsg(error?.message ?? data?.error ?? "Failed to connect Google Calendar.");
        } else {
          setStatus("success");
        }
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-6">
        {status === "loading" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Connecting Google Calendar...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Google Calendar Connected!</h2>
            <p className="text-muted-foreground text-sm">
              Appointments will now automatically sync to info@butlerconstruction.co
            </p>
            <Button onClick={() => navigate("/integrations")}>Back to Integrations</Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="text-xl font-semibold">Connection Failed</h2>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Button onClick={() => navigate("/integrations")}>Back to Integrations</Button>
          </>
        )}
      </div>
    </div>
  );
}
