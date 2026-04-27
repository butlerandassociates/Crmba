import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function DocuSignCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    const code = urlParams.get("code");

    if (error) {
      setMessage(`DocuSign error: ${error}`);
      setStatus("error");
      return;
    }

    if (code) {
      // JWT mode — consent was granted. No code exchange needed.
      // The server uses the RSA private key directly for all API calls.
      setMessage("DocuSign access has been granted. You can close this window.");
      setStatus("success");
      setTimeout(() => window.close(), 3000);
      return;
    }

    setMessage("No response received from DocuSign.");
    setStatus("error");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "loading" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                Connecting to DocuSign...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Connection Successful!
              </>
            )}
            {status === "error" && (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                Connection Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <p className="text-sm text-muted-foreground">
              Please wait while we complete the authentication...
            </p>
          )}

          {status === "success" && (
            <div className="space-y-3">
              <p className="text-sm text-green-800">{message}</p>
              <p className="text-xs text-muted-foreground text-center">
                This window will close automatically in 3 seconds...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-red-800">{message}</p>
              <p className="text-xs text-muted-foreground">
                Please close this window and try again from the Settings page.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
