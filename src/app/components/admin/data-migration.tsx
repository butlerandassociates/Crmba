/**
 * One-Time Data Migration Tool
 * Run this once to migrate mock data to Supabase
 */

import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Database, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { migrateData } from "../../utils/api";
import { mockClients, mockProjects, mockProducts, mockTeamMembers } from "../../data/mock-data";

export function DataMigration() {
  const [status, setStatus] = useState<"idle" | "migrating" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const handleMigrate = async () => {
    setStatus("migrating");
    setError("");
    
    try {
      console.log("Starting data migration to Supabase...");
      
      const response = await migrateData({
        clients: mockClients,
        projects: mockProjects,
        products: mockProducts,
        users: mockTeamMembers,
      });
      
      console.log("Migration completed:", response);
      setResult(response.migrated);
      setStatus("success");
    } catch (err: any) {
      console.error("Migration failed:", err);
      setError(err.message || "Migration failed");
      setStatus("error");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-7 w-7" />
        <div>
          <h1 className="text-3xl font-bold">Data Migration</h1>
          <p className="text-muted-foreground">Migrate mock data to Supabase database</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migrate Mock Data to Supabase
          </CardTitle>
          <CardDescription>
            One-time migration to transfer your mock data to the Supabase database.
            This is safe to run multiple times - it will update existing records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "idle" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-900 space-y-2">
                  <p className="font-semibold">What will be migrated:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{mockClients.length} clients</li>
                    <li>{mockProjects.length} projects</li>
                    <li>{mockProducts.length} products</li>
                    <li>{mockTeamMembers.length} team members</li>
                  </ul>
                </div>
              </div>
              
              <Button onClick={handleMigrate} className="w-full">
                <Database className="h-4 w-4 mr-2" />
                Start Migration
              </Button>
            </div>
          )}

          {status === "migrating" && (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Migrating data to Supabase...
                </p>
              </div>
            </div>
          )}

          {status === "success" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">Migration Successful!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Your data has been migrated to Supabase
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold mb-2">Migration Summary:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Clients:</span>
                    <span className="ml-2 font-semibold">{result.clients}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Projects:</span>
                    <span className="ml-2 font-semibold">{result.projects}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Products:</span>
                    <span className="ml-2 font-semibold">{result.products}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Users:</span>
                    <span className="ml-2 font-semibold">{result.users}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-900">
                  <strong>Next Steps:</strong>
                  <br />
                  1. Update your components to use the API instead of mock data
                  <br />
                  2. Test that data loads correctly from Supabase
                  <br />
                  3. You can view your data in the{" "}
                  <a 
                    href="https://supabase.com/dashboard/project/yohhdvwifjgarnaxrbev/database/tables"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    Supabase Dashboard
                  </a>
                </p>
              </div>
              
              <Button onClick={() => setStatus("idle")} variant="outline" className="w-full">
                Migrate Again (Update Records)
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Migration Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              
              <Button onClick={() => setStatus("idle")} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}