import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
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
      const res = await fetch(
        "https://yohhdvwifjgarnaxrbev.supabase.co/functions/v1/authenticate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      await supabase.auth.setSession(body.session);
      const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", body.user.id).single();
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
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#FAF7F2" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-10">
          <img src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo-gold.jpg" alt="Butler & Associates" className="h-24 w-auto object-contain mix-blend-multiply" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          {mode === "set-password" ? "Set Your Password"
            : mode === "forgot" ? "Reset Password"
            : "Sign in"}
        </h1>
        <p className="text-gray-500 mb-10 leading-relaxed">
          {mode === "set-password"
            ? "Welcome! Create a password to secure your account."
            : mode === "forgot"
            ? "Enter your email and we'll send you a reset link."
            : "Welcome back to our internal workspace. Sign in below to access your clients, estimates, and jobs."}
        </p>

        {/* ── Forgot password — success state ── */}
        {mode === "forgot" && forgotSent ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">Reset link sent!</p>
              <p className="text-sm text-gray-500 text-center">
                Check your inbox at <span className="font-medium text-gray-900">{email}</span> and click the link to reset your password.
              </p>
            </div>
            <button
              type="button"
              onClick={goBackToLogin}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </div>

        ) : mode === "forgot" ? (
          /* ── Forgot password — form ── */
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold tracking-widest text-gray-700 uppercase">
                Email
              </label>
              <input
                id="email"
                type="text"
                placeholder="you@butlerconstruction.co"
                value={email}
                onChange={handleEmailChange}
                autoComplete="email"
                autoFocus
                className="w-full bg-transparent border border-gray-300 rounded-lg px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors text-sm"
              />
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !!emailError}
              className="w-full text-white font-semibold tracking-widest uppercase text-sm py-4 rounded-lg transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#1a1a1a", borderBottom: "3px solid #B8960C" }}
            >
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending...</span> : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={goBackToLogin}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </form>

        ) : (
          /* ── Login / Set-password ── */
          <form onSubmit={mode === "set-password" ? handleSetPassword : handleLogin} className="space-y-6">
            {mode === "login" && (
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-semibold tracking-widest text-gray-700 uppercase">
                  Email
                </label>
                <input
                  id="email"
                  type="text"
                  placeholder="you@butlerconstruction.co"
                  value={email}
                  onChange={handleEmailChange}
                  autoComplete="email"
                  className="w-full bg-transparent border border-gray-300 rounded-lg px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors text-sm"
                />
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold tracking-widest text-gray-700 uppercase">
                  {mode === "set-password" ? "New Password" : "Password"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs font-semibold tracking-widest uppercase transition-colors"
                  style={{ color: "#B8960C" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "set-password" ? "new-password" : "current-password"}
                className="w-full bg-transparent border border-gray-300 rounded-lg px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors text-sm"
              />
              {mode === "set-password" && (
                <p className="text-xs text-gray-400">Minimum 8 characters</p>
              )}
            </div>

            {mode === "set-password" && (
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-xs font-semibold tracking-widest text-gray-700 uppercase">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-transparent border border-gray-300 rounded-lg px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                (mode === "login"
                  ? !email.trim() || !!emailError || !password
                  : !password || !confirmPassword)
              }
              className="w-full text-white font-semibold tracking-widest uppercase text-sm py-4 rounded-lg transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#1a1a1a", borderBottom: "3px solid #B8960C" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "set-password" ? "Setting password..." : "Signing in..."}
                </span>
              ) : (
                mode === "set-password" ? "Set Password & Continue" : "Sign In"
              )}
            </button>

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setForgotSent(false); }}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Forgot your password?
                </button>
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Get help
                </button>
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="mt-16">
          <div className="border-t border-gray-300 pt-6">
            <p className="text-center text-xs tracking-widest text-gray-400 uppercase">The Butler Standard</p>
          </div>
        </div>

      </div>
    </div>
  );
}
