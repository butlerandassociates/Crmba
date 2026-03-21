import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { projectId, publicAnonKey } from "utils/supabase/info";

export function DocuSignCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error("No authorization code received from DocuSign");
        }

        console.log("Received authorization code, exchanging for access token...");

        // Exchange code for access token
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/docusign/oauth/token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              code: code,
              redirectUri: `${window.location.origin}/docusign-callback`,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || error.error || "Failed to exchange code for token");
        }

        const data = await response.json();
        
        if (!data.success || !data.accessToken) {
          throw new Error("Failed to obtain access token");
        }

        console.log("Successfully obtained access token!");
        setAccessToken(data.accessToken);
        setMessage(`Access token obtained successfully! Valid for ${Math.floor(data.expiresIn / 3600)} hours.`);
        setStatus("success");

        // Close window after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);

      } catch (error: any) {
        console.error("OAuth callback error:", error);
        setMessage(error.message || "Failed to complete OAuth flow");
        setStatus("error");
      }
    };

    handleCallback();
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
            <div className="space-y-4">
              <p className="text-sm text-green-800">{message}</p>
              
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">
                  ⚠️ Important: Save Your Access Token
                </h4>
                <p className="text-sm text-yellow-800 mb-3">
                  Copy this access token and save it to your Supabase secrets as{" "}
                  <code className="bg-yellow-100 px-1 py-0.5 rounded font-mono text-xs">
                    DOCUSIGN_ACCESS_TOKEN
                  </code>
                </p>
                <div className="bg-white p-3 rounded border border-yellow-300">
                  <div className="text-xs font-mono break-all select-all">
                    {accessToken}
                  </div>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  Click on the token above to select all, then copy it (Cmd+C or Ctrl+C)
                </p>
              </div>

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
