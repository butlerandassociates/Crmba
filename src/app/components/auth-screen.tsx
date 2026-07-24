import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
      const { data: profile } = session?.user ? await supabase.from("profiles").select("first_name").eq("id", session.user.id).single() : { data: null };
      toast.success(`Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}!`);
    } catch (error: any) {
      console.error("Login error:", error);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-logo-gold.jpg"
            alt="Butler & Associates Construction"
            className="h-20 w-auto mx-auto mb-4 object-contain mix-blend-multiply"
          />
          <h1 className="text-3xl font-bold">Butler & Associates Construction</h1>
          <p className="text-muted-foreground mt-2">Premier Design + Build Experts</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "forgot" ? "Reset Password" : "Sign In"}</CardTitle>
            <CardDescription>
              {mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Enter your credentials to access the CRM"}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="you@butlerconstruction.co"
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
                  className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="you@butlerconstruction.co"
                    value={email}
                    onChange={handleEmailChange}
                    autoComplete="email"
                    disabled={loading}
                    autoFocus
                  />
                  {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !email.trim() || !!emailError || !password}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setForgotSent(false); }}
                  className="w-full text-sm text-primary hover:underline text-center"
                >
                  Forgot your password?
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
