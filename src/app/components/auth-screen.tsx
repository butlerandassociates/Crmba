import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Building2, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "utils/supabase/info";

export function AuthScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    alert("Login button clicked! Email: " + email + ", Password length: " + password.length);
    
    setLoading(true);

    try {
      alert("About to call signIn function...");
      await signIn(email, password);
      alert("signIn completed successfully!");
      toast.success("Welcome back!");
    } catch (error: any) {
      console.error("Login error:", error);
      alert("Login ERROR: " + error.message);
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
      alert("Login process finished");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    alert("Signup button clicked! Email: " + email);
    
    if (password !== confirmPassword) {
      alert("Passwords don't match");
      toast.error("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      alert("Password too short");
      toast.error("Password must be at least 6 characters");
      return;
    }

    alert("About to call API...");
    setLoading(true);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/auth/signup`;
      alert("URL: " + url);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          name,
          role: "admin",
        }),
      });

      alert("Response status: " + response.status);
      
      const data = await response.json();
      alert("Response: " + JSON.stringify(data));

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      toast.success("Account created! Signing you in...");
      alert("Success!");
      
      // Automatically sign in after successful signup
      setTimeout(async () => {
        try {
          await signIn(email, password);
        } catch (error: any) {
          toast.error("Please sign in manually");
          setShowSignup(false);
        }
      }, 1000);
    } catch (error: any) {
      console.error("Signup error:", error);
      alert("ERROR: " + error.message);
      toast.error(error.message || "Failed to create account");
      setLoading(false);
    }
  };

  if (showSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Butler & Associates Construction</h1>
            <p className="text-muted-foreground mt-2">Create Your Admin Account</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>First Admin Account</CardTitle>
              <CardDescription>
                This will be your main administrator account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jonathan Butler"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jonathan@butlerconstruction.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Admin Account"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowSignup(false)}
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Butler & Associates Construction</h1>
          <p className="text-muted-foreground mt-2">Premier Design + Build Experts</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@butlerconstruction.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowSignup(true)}
              >
                Create First Admin Account
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  );
}