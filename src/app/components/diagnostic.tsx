import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { projectId, publicAnonKey } from "/utils/supabase/info";

export function Diagnostic() {
  const [result, setResult] = useState<string>("");
  const [email, setEmail] = useState("test@butlerconstruction.co");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Test User");

  const testHealthCheck = async () => {
    setResult("Testing health check...\n");
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/health`;
      setResult((prev) => prev + `URL: ${url}\n`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      setResult((prev) => prev + `Response: ${JSON.stringify(data, null, 2)}\n`);
      setResult((prev) => prev + `✅ Health check passed!\n`);
    } catch (error: any) {
      setResult((prev) => prev + `❌ Error: ${error.message}\n`);
    }
  };

  const testSignup = async () => {
    setResult("Testing signup...\n");
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/auth/signup`;
      setResult((prev) => prev + `URL: ${url}\n`);
      setResult((prev) => prev + `Email: ${email}\n`);
      setResult((prev) => prev + `Password: ${password}\n`);
      setResult((prev) => prev + `Name: ${name}\n`);
      
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

      setResult((prev) => prev + `Status: ${response.status}\n`);
      
      const data = await response.json();
      setResult((prev) => prev + `Response: ${JSON.stringify(data, null, 2)}\n`);
      
      if (response.ok) {
        setResult((prev) => prev + `✅ Signup successful!\n`);
      } else {
        setResult((prev) => prev + `❌ Signup failed\n`);
      }
    } catch (error: any) {
      setResult((prev) => prev + `❌ Error: ${error.message}\n`);
    }
  };

  const testLogin = async () => {
    setResult("Testing login...\n");
    try {
      const { createClient } = await import("@supabase/supabase-js");
      
      setResult((prev) => prev + `Creating Supabase client...\n`);
      setResult((prev) => prev + `Project ID: ${projectId}\n`);
      setResult((prev) => prev + `Email: ${email}\n`);
      
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );

      setResult((prev) => prev + `Attempting sign in...\n`);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setResult((prev) => prev + `❌ Login error: ${error.message}\n`);
      } else if (data.session) {
        setResult((prev) => prev + `✅ Login successful!\n`);
        setResult((prev) => prev + `Access Token: ${data.session.access_token.substring(0, 20)}...\n`);
        setResult((prev) => prev + `User: ${JSON.stringify(data.user, null, 2)}\n`);
      }
    } catch (error: any) {
      setResult((prev) => prev + `❌ Error: ${error.message}\n`);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🔧 Authentication Diagnostic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={testHealthCheck}>1. Test Health Check</Button>
              <Button onClick={testSignup}>2. Test Signup</Button>
              <Button onClick={testLogin}>3. Test Login</Button>
            </div>

            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-auto">
              <pre>{result || "Click a button to run diagnostics..."}</pre>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Instructions:</strong></p>
              <p>1. Click "Test Health Check" - should return status: ok</p>
              <p>2. Click "Test Signup" - creates a user account</p>
              <p>3. Click "Test Login" - tries to log in with the account</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
