import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode] = useState<"login" | "set-password">(
    location.state?.isInvite ? "set-password" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // After normal login, navigate to dashboard
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && mode === "login") {
        navigate("/", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password set successfully! Welcome to the team.");
      // Clear the hash so it doesn't trigger again
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Butler & Associates</h1>
          <p className="text-sm text-muted-foreground mt-1">Construction, Inc. — CRM Portal</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>
              {mode === "set-password" ? "Set Your Password" : "Sign In"}
            </CardTitle>
            <CardDescription>
              {mode === "set-password"
                ? "Welcome! Create a password to secure your account."
                : "Enter your credentials to access the portal."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === "set-password" ? handleSetPassword : handleLogin} className="space-y-4">
              {mode === "login" && (
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    autoComplete="email"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">
                  {mode === "set-password" ? "New Password" : "Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    autoComplete={mode === "set-password" ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "set-password" && (
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                )}
              </div>

              {mode === "set-password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {mode === "set-password" ? "Setting password..." : "Signing in..."}
                  </>
                ) : (
                  mode === "set-password" ? "Set Password & Continue" : "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
