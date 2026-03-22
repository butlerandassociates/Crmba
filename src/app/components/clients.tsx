import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Plus, Search, Mail, Phone, MapPin, Loader2 } from "lucide-react";
import { Link } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { clientsAPI } from "../utils/api";

export function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
  });

  useEffect(() => {
    clientsAPI.getAll()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredClients = clients.filter((client) => {
    const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.toLowerCase();
    const q = searchQuery.toLowerCase();
    return (
      fullName.includes(q) ||
      (client.email ?? "").toLowerCase().includes(q) ||
      (client.phone ?? "").toLowerCase().includes(q) ||
      (client.address ?? "").toLowerCase().includes(q)
    );
  });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) { toast.error("First name is required."); return; }
    setSaving(true);
    try {
      const created = await clientsAPI.create(form);
      setClients((prev) => [created, ...prev]);
      toast.success("Client added successfully!");
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to add client.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client relationships</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleAddClient}>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Enter the client details below.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="John" required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Last Name</Label>
                    <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="TX" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>ZIP</Label>
                    <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="78701" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{filteredClients.length} clients</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => {
              const fullName = `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || "Unnamed Client";
              const addressLine = [client.address, client.city, client.state, client.zip].filter(Boolean).join(", ");
              const stageName  = client.pipeline_stage?.name ?? null;
              const stageColor = client.pipeline_stage?.color ?? null;
              return (
                <Link key={client.id} to={`/clients/${client.id}`} className="block">
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{fullName}</h3>
                        </div>
                        {stageName && (
                          <Badge style={stageColor ? { backgroundColor: stageColor } : undefined}>
                            {stageName}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        {client.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {addressLine && (
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{addressLine}</span>
                          </div>
                        )}
                      </div>

                      {client.lead_source?.name && (
                        <div className="pt-3 border-t text-xs text-muted-foreground">
                          Source: <span className="font-medium text-foreground">{client.lead_source.name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? "No clients found matching your search." : "No clients yet. Add your first client above."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
