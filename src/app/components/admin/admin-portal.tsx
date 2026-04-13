import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserManagement } from "./user-management";
import { ForecastDashboard } from "./forecast-dashboard";
import { ProductManager } from "./product-manager";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Link } from "react-router";
import { FileText, List, Archive, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function DiscardedClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviving, setReviving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, status, discarded_at, discarded_reason")
      .eq("is_discarded", true)
      .order("discarded_at", { ascending: false });
    if (error) toast.error("Failed to load discarded clients");
    else setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeRefetch(load, ["clients"], "admin-portal");

  const handleRevive = async (client: any) => {
    setReviving(client.id);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_discarded: false, discarded_at: null, discarded_reason: null })
        .eq("id", client.id);
      if (error) throw error;
      toast.success(`${client.first_name} ${client.last_name} revived and back in pipeline.`);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to revive client");
    } finally {
      setReviving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (clients.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Archive className="h-10 w-10 mb-3 opacity-20" />
      <p className="text-sm font-medium">No discarded clients</p>
      <p className="text-xs mt-1">Clients you discard from the pipeline will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <div key={client.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-card">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/clients/${client.id}`}
                className="font-semibold text-sm hover:opacity-75"
              >
                {client.first_name} {client.last_name}
              </Link>
              {client.status && (
                <Badge variant="outline" className="text-xs capitalize">{client.status}</Badge>
              )}
            </div>
            {client.email && <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>}
            {client.discarded_reason && (
              <p className="text-xs text-muted-foreground mt-0.5 italic">"{client.discarded_reason}"</p>
            )}
            {client.discarded_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Discarded {new Date(client.discarded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRevive(client)}
            disabled={reviving === client.id}
            className="ml-4 shrink-0"
          >
            {reviving === client.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Revive
          </Button>
        </div>
      ))}
    </div>
  );
}

export function AdminPortal() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Admin Portal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, products, and forecasts</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/estimate-templates">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Estimate Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage estimate workflows
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/list-management">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                List Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage dropdown lists — categories, lead sources, and more
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="products">Products & Pricing</TabsTrigger>
          <TabsTrigger value="forecast">Forecasting</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="discarded">
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Discarded
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductManager />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ForecastDashboard />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="discarded" className="mt-4">
          <DiscardedClients />
        </TabsContent>
      </Tabs>
    </div>
  );
}