import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Plus, Search, Mail, Phone, MapPin, Loader2, Users } from "lucide-react";
import { Link } from "react-router";
import {
  Dialog,
  DialogBody,
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

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 7;

export function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
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

  // Computed validation errors
  const fnErr    = !form.first_name.trim() ? "First name is required." : form.first_name.trim().length < 2 ? "Min 2 characters." : "";
  const emailErr = form.email.trim() && !isValidEmail(form.email.trim()) ? "Enter a valid email address." : "";
  const phoneErr = form.phone.trim() && !isValidPhone(form.phone) ? "Enter a valid phone number (min 7 digits)." : "";
  const zipErr   = form.zip.trim() && form.zip.trim().length < 4 ? "ZIP must be at least 4 characters." : "";
  const hasErrors = !!fnErr || !!emailErr || !!phoneErr || !!zipErr;

  const resetForm = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" });
    setTouched(false);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const created = await clientsAPI.create(form);
      setClients((prev) => [created, ...prev]);
      toast.success("Client added successfully!");
      setDialogOpen(false);
      resetForm();
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
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleAddClient} className="flex flex-col flex-1 min-h-0">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Enter the client details below.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      placeholder="John"
                      className={touched && fnErr ? "border-red-500" : ""}
                    />
                    {touched && fnErr && <p className="text-xs text-red-500">{fnErr}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@example.com"
                    className={touched && emailErr ? "border-red-500" : ""}
                  />
                  {touched && emailErr && <p className="text-xs text-red-500">{emailErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className={touched && phoneErr ? "border-red-500" : ""}
                  />
                  {touched && phoneErr && <p className="text-xs text-red-500">{phoneErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="TX" maxLength={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ZIP</Label>
                    <Input
                      value={form.zip}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      placeholder="78701"
                      className={touched && zipErr ? "border-red-500" : ""}
                    />
                    {touched && zipErr && <p className="text-xs text-red-500">{zipErr}</p>}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
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
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">
                {searchQuery ? "No clients match your search" : "No clients yet"}
              </p>
              <p className="text-xs mt-1">
                {searchQuery ? "Try a different name, email, or phone number." : "Add your first client to get started."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
