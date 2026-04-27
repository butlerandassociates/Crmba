import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader2, Eye, EyeOff, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "set-password" | "forgot";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(
    location.state?.isInvite ? "set-password" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val && !EMAIL_RE.test(val)) setEmailError("Enter a valid email address");
    else setEmailError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || emailError || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", data.user.id).single();
      toast.success(`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}!`);
      navigate("/", { replace: true, state: {} });
    } catch (err: any) {
      toast.error(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/", { replace: true, state: { passwordSet: true } });
    } catch (err: any) {
      toast.error(err.message || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || emailError) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goBackToLogin = () => {
    setMode("login");
    setForgotSent(false);
    setEmailError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Butler & Associates</h1>
          <p className="text-sm text-muted-foreground mt-1">Construction, Inc. — CRM Portal</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>
              {mode === "set-password" ? "Set Your Password"
                : mode === "forgot" ? "Reset Password"
                : "Sign In"}
            </CardTitle>
            <CardDescription>
              {mode === "set-password"
                ? "Welcome! Create a password to secure your account."
                : mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Enter your credentials to access the portal."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* ── Forgot password — success state ── */}
            {mode === "forgot" && forgotSent ? (
              <div className="space-y-4 text-center">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium">Reset link sent!</p>
                  <p className="text-xs text-muted-foreground">
                    Check your inbox at <span className="font-medium">{email}</span> and click the link to reset your password.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={goBackToLogin}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : mode === "forgot" ? (
              /* ── Forgot password — form ── */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="you@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    autoComplete="email"
                    autoFocus
                  />
                  {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email.trim() || !!emailError}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                    : "Send Reset Link"}
                </Button>

                <button
                  type="button"
                  onClick={goBackToLogin}
                  className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 mt-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              </form>
            ) : (
              /* ── Login / Set-password ── */
              <form onSubmit={mode === "set-password" ? handleSetPassword : handleLogin} className="space-y-4">
                {mode === "login" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="you@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      autoComplete="email"
                    />
                    {emailError && <p className="text-xs text-red-500">{emailError}</p>}
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
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "set-password" ? "new-password" : "current-password"}
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
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    loading ||
                    (mode === "login"
                      ? !email.trim() || !!emailError || !password
                      : !password || !confirmPassword)
                  }
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {mode === "set-password" ? "Setting password..." : "Signing in..."}
                    </>
                  ) : (
                    mode === "set-password" ? "Set Password & Continue" : "Sign In"
                  )}
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setForgotSent(false); }}
                    className="w-full text-sm text-primary hover:underline text-center mt-1"
                  >
                    Forgot your password?
                  </button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
