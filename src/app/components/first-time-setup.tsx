import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Loader2, Building2, ShieldCheck } from "lucide-react";
import { projectId, publicAnonKey } from "utils/supabase/info";

export function FirstTimeSetup({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const nameErr     = !formData.name.trim() ? "Name is required." : formData.name.trim().length < 2 ? "Min 2 characters." : "";
  const emailErr    = !formData.email.trim() ? "Email is required." : !isValidEmail(formData.email.trim()) ? "Enter a valid email address." : "";
  const passErr     = !formData.password ? "Password is required." : formData.password.length < 6 ? "Minimum 6 characters." : "";
  const confirmErr  = !formData.confirmPassword ? "Please confirm your password." : formData.password !== formData.confirmPassword ? "Passwords don't match." : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || emailErr || passErr || confirmErr) return;
    setLoading(true);

    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/auth/signup`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: "admin",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create admin account");
      }

      toast.success("Admin account created! Please sign in now.");
      
      // Wait 2 seconds then call onComplete
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error: any) {
      console.error("Setup error:", error);
      toast.error(error.message || "Failed to create admin account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Butler & Associates Construction, Inc</h1>
          <p className="text-muted-foreground mt-2">
            Premier Design + Build Experts
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>First-Time Setup</CardTitle>
            </div>
            <CardDescription>
              Create your admin account to get started with the CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={loading}
                  className={touched && nameErr ? "border-red-500" : ""}
                />
                {touched && nameErr && <p className="text-xs text-red-500">{nameErr}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@butlerconstruction.co"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                  className={touched && emailErr ? "border-red-500" : ""}
                />
                {touched && emailErr && <p className="text-xs text-red-500">{emailErr}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={loading}
                  className={touched && passErr ? "border-red-500" : ""}
                />
                {touched && passErr
                  ? <p className="text-xs text-red-500">{passErr}</p>
                  : <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                }
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={loading}
                  className={touched && confirmErr ? "border-red-500" : ""}
                />
                {touched && confirmErr && <p className="text-xs text-red-500">{confirmErr}</p>}
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
            </form>
            
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-center text-muted-foreground">
                This setup only needs to be done once. After creating your account, you'll be able to sign in normally.
              </p>
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