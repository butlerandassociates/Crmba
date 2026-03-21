import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Plus, Search, Mail, Phone, Loader2 } from "lucide-react";
import { clientsAPI, leadSourcesAPI } from "../utils/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";

export function ClientsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const EMPTY_CLIENT = {
    first_name: "", last_name: "", company: "",
    email: "", phone: "",
    address: "", city: "", state: "", zip: "",
    status: "prospect", lead_source_id: "",
  };
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const setField = (field: string, value: string) => {
    setNewClient((p) => ({ ...p, [field]: value }));
    setFormErrors((e) => { const next = { ...e }; delete next[field]; return next; });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newClient.first_name.trim()) errors.first_name = "First name is required.";
    else if (newClient.first_name.trim().length < 2) errors.first_name = "First name must be at least 2 characters.";
    if (newClient.email.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(newClient.email.trim())) errors.email = "Enter a valid email address.";
    }
    if (newClient.phone.trim()) {
      const digits = newClient.phone.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) errors.phone = "Phone must be 7–15 digits.";
    }
    if (newClient.zip.trim()) {
      if (!/^[A-Za-z0-9\s\-]{3,10}$/.test(newClient.zip.trim())) errors.zip = "Enter a valid postal code.";
    }
    return errors;
  };

  useEffect(() => {
    fetchClients();
    fetchLeadSources();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await clientsAPI.getAll();
      setClients(data ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadSources = async () => {
    try {
      const data = await leadSourcesAPI.getAll();
      setLeadSources(data ?? []);
    } catch {
      // non-critical
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    try {
      setSaving(true);
      await clientsAPI.create({
        first_name: newClient.first_name.trim(),
        last_name:  newClient.last_name.trim(),
        company:    newClient.company.trim() || null,
        email:      newClient.email.trim() || null,
        phone:      newClient.phone.trim() || null,
        address:    newClient.address.trim() || null,
        city:       newClient.city.trim() || null,
        state:      newClient.state.trim() || null,
        zip:        newClient.zip.trim() || null,
        status:     newClient.status,
        lead_source_id: newClient.lead_source_id || null,
        appointment_met: false,
        appointment_scheduled: false,
        docusign_status: "not_sent",
      });
      toast.success("Client added successfully!");
      setAddDialogOpen(false);
      setNewClient(EMPTY_CLIENT);
      setFormErrors({});
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to add client");
    } finally {
      setSaving(false);
    }
  };

  const needsScheduling = clients.filter((c) => !c.appointment_met);
  const clientsMet = clients.filter((c) => c.appointment_met);

  const filterClients = (list: any[]) =>
    list.filter((c) => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || (c.email ?? "").toLowerCase().includes(term);
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":     return "bg-green-500";
      case "sold":       return "bg-orange-500";
      case "prospect":   return "bg-blue-500";
      case "selling":    return "bg-yellow-500";
      case "completed":  return "bg-purple-500";
      default:           return "bg-gray-500";
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const ClientTable = ({ list }: { list: any[] }) => (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Lead Source</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Forecast</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filterClients(list).map((client) => (
                <tr key={client.id} className="hover:bg-accent/50 transition-colors">
                  <td className="p-3">
                    <Badge className={`${getStatusColor(client.status)} text-xs text-white`}>
                      {client.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Link to={`/clients/${client.id}`} className="font-semibold text-sm hover:text-primary">
                      {client.first_name} {client.last_name}
                    </Link>
                    {client.company && (
                      <div className="text-xs text-muted-foreground">{client.company}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-muted-foreground">
                      {client.lead_source?.name ?? "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    {client.projected_value && client.closing_probability ? (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{formatCurrency(client.projected_value)}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${client.closing_probability}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{client.closing_probability}%</span>
                        </div>
                        {client.expected_close_date && (
                          <div className="text-xs text-muted-foreground">Est: {formatDate(client.expected_close_date)}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Link to={`/clients/${client.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filterClients(list).length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No clients found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your client relationships</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {!loading && !error && (
        <Tabs defaultValue="needsScheduling">
          <TabsList className="w-full">
            <TabsTrigger value="needsScheduling">
              Needs Scheduling ({needsScheduling.length})
            </TabsTrigger>
            <TabsTrigger value="clientsMet">
              Clients Met ({clientsMet.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="needsScheduling">
            <ClientTable list={needsScheduling} />
          </TabsContent>
          <TabsContent value="clientsMet">
            <ClientTable list={clientsMet} />
          </TabsContent>
        </Tabs>
      )}

      {/* Add Client Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) { setNewClient(EMPTY_CLIENT); setFormErrors({}); } }}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Add a new lead to your pipeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="flex flex-col min-h-0 flex-1">
            <div className="grid gap-4 py-4 overflow-y-auto flex-1 px-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    value={newClient.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    className={formErrors.first_name ? "border-red-500" : ""}
                  />
                  {formErrors.first_name && <p className="text-xs text-red-500">{formErrors.first_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    value={newClient.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  placeholder="Acme Corporation"
                  value={newClient.company}
                  onChange={(e) => setField("company", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={newClient.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={formErrors.email ? "border-red-500" : ""}
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 (256) 555-0100"
                  value={newClient.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={formErrors.phone ? "border-red-500" : ""}
                />
                {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={newClient.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Huntsville"
                    value={newClient.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="state">State / Region</Label>
                  <Input
                    id="state"
                    placeholder="AL"
                    value={newClient.state}
                    onChange={(e) => setField("state", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="zip">ZIP / Postal</Label>
                  <Input
                    id="zip"
                    placeholder="35801"
                    value={newClient.zip}
                    onChange={(e) => setField("zip", e.target.value)}
                    className={formErrors.zip ? "border-red-500" : ""}
                  />
                  {formErrors.zip && <p className="text-xs text-red-500">{formErrors.zip}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={newClient.status}
                    onValueChange={(v) => setNewClient((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="selling">Selling</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lead Source</Label>
                  <Select
                    value={newClient.lead_source_id}
                    onValueChange={(v) => setNewClient((p) => ({ ...p, lead_source_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadSources.map((src) => (
                        <SelectItem key={src.id} value={src.id}>
                          {src.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
