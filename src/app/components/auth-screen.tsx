import { useState } from "react";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
type Mode = "login" | "forgot";

export function AuthScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      await signIn(email, password);
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = session?.user
        ? await supabase.from("profiles").select("first_name").eq("id", session.user.id).single()
        : { data: null };
      toast.success(`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
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
          {mode === "forgot" ? "Reset Password" : "Sign in"}
        </h1>
        <p className="text-gray-500 mb-10 leading-relaxed">
          {mode === "forgot"
            ? "Enter your email and we'll send you a reset link."
            : "Welcome back to our internal workspace. Sign in below to access your clients, estimates, and jobs."}
        </p>

        {/* Forgot — success state */}
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
          /* Forgot — form */
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
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending...</span>
                : "Send Reset Link"}
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
          /* Login form */
          <form onSubmit={handleLogin} className="space-y-6">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold tracking-widest text-gray-700 uppercase">
                  Password
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
                autoComplete="current-password"
                className="w-full bg-transparent border border-gray-300 rounded-lg px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-600 transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !!emailError || !password}
              className="w-full text-white font-semibold tracking-widest uppercase text-sm py-4 rounded-lg transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#1a1a1a", borderBottom: "3px solid #B8960C" }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in...</span>
                : "Sign In"}
            </button>

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
