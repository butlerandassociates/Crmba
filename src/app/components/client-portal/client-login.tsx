import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Building2, Lock, Mail } from "lucide-react";

interface ClientLoginProps {
  onLogin: (email: string, password: string) => void;
}

export function ClientLogin({ onLogin }: ClientLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate authentication delay
    setTimeout(() => {
      onLogin(email, password);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">Client Portal</CardTitle>
            <CardDescription className="text-base mt-2">
              Access your project information and documents
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="client-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="client-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-primary hover:opacity-75">
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Access Portal"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Need access to the client portal?
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your project manager or call us at (555) 123-4567
            </p>
          </div>

          <div className="mt-6 pt-6 border-t text-center">
            <Button variant="outline" className="w-full" asChild>
              <a href="/">Internal Team Login</a>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t text-center space-y-2">
            <p className="text-sm font-semibold text-gray-900">
              Butler & Associates Construction, Inc.
            </p>
            <p className="text-xs text-muted-foreground">
              Building excellence, one project at a time.
            </p>
            <p className="text-xs text-muted-foreground">
              © 2024 Butler & Associates Construction. All rights reserved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
