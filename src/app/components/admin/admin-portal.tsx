import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { UserManagement } from "./user-management";
import { ForecastDashboard } from "./forecast-dashboard";
import { ProductManager } from "./product-manager";
import { PLReport } from "./pl-report";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Link } from "react-router";
import { FileText, List, Archive, Loader2, RotateCcw, FileBarChart2, Search } from "lucide-react";
import { Input } from "../ui/input";
import { supabase } from "@/lib/supabase";
import { activityLogAPI } from "../../utils/api";
import { toast } from "sonner";
import { SkeletonList } from "../ui/page-loader";

function DiscardedClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviving, setReviving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("clients")
        .update({ is_discarded: false, reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
        .eq("id", client.id);
      if (error) throw error;
      const revivedOnLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      activityLogAPI.create({ client_id: client.id, action_type: "status_changed", description: `Client revived on ${revivedOnLabel} — back in pipeline` }).catch(() => {});
      toast.success(`${client.first_name} ${client.last_name} revived and back in pipeline.`);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to revive client");
    } finally {
      setReviving(null);
    }
  };

  if (loading) return <SkeletonList rows={5} />;

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.discarded_reason ?? "").toLowerCase().includes(q)
    );
  });

  if (clients.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Archive className="h-10 w-10 mb-3 opacity-20" />
      <p className="text-sm font-medium">No discarded clients</p>
      <p className="text-xs mt-1">Clients you discard from the pipeline will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search discarded clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Archive className="h-8 w-8 mb-2 opacity-20" />
          <p className="text-sm font-medium">No clients match your search</p>
        </div>
      )}
      <div className="space-y-2">
      {filtered.map((client) => (
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
    </div>
  );
}

export function AdminPortal() {
  return (
    <div className="p-4 space-y-0">
      <Tabs defaultValue="products" className="w-full">
        {/* Sticky block: title + quick links + tabs */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur -mx-4 px-4 pt-4 -mt-4 pb-0">
          <div className="flex items-center justify-between pb-5">
            <div>
              <h1 className="text-2xl font-bold">Admin Portal</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage users, products, and forecasts</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/estimate-templates" className="flex items-center gap-1.5 no-underline">
                  <FileText className="h-4 w-4" />
                  Estimate Templates
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/list-management" className="flex items-center gap-1.5 no-underline">
                  <List className="h-4 w-4" />
                  List Management
                </Link>
              </Button>
            </div>
          </div>
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="products">Products & Pricing</TabsTrigger>
            <TabsTrigger value="forecast">Forecasting</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="reports">
              <FileBarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="discarded">
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Discarded
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="mt-0">
          <ProductManager />
        </TabsContent>

        <TabsContent value="forecast" className="mt-0">
          <ForecastDashboard />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UserManagement />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <PLReport />
        </TabsContent>

        <TabsContent value="discarded" className="mt-0">
          <DiscardedClients />
        </TabsContent>
      </Tabs>
    </div>
  );
}