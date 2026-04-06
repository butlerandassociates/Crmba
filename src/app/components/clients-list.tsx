import { useState, useEffect, useRef } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Link, useLocation } from "react-router";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Plus, Search, Mail, Phone, Loader2, CalendarCheck, Calendar } from "lucide-react";
import { clientsAPI, leadSourcesAPI, pipelineStagesAPI } from "../utils/api";
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
  const location = useLocation();
  const stageFilter = new URLSearchParams(location.search).get("stage");

  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const EMPTY_CLIENT = {
    first_name: "", last_name: "",
    email: "", phone: "",
    address: "", city: "", state: "", zip: "",
    status: "prospect", lead_source_id: "",
  };

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddressInput = (value: string) => {
    setField("address", value);
    setAddressSuggestions([]);
    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    if (value.length < 4) return;
    addressDebounce.current = setTimeout(async () => {
      try {
        setAddressLoading(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(value)}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setAddressSuggestions(data);
      } catch { /* silent */ } finally {
        setAddressLoading(false);
      }
    }, 400);
  };

  const selectAddress = (place: any) => {
    const a = place.address;
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    setNewClient((p) => ({
      ...p,
      address: street || place.display_name.split(",")[0],
      city: a.city || a.town || a.village || a.county || "",
      state: a.state || "",
      zip: a.postcode || "",
    }));
    setAddressSuggestions([]);
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
    pipelineStagesAPI.getAll().then(setPipelineStages).catch(console.error);
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

  useRealtimeRefetch(fetchClients, ["clients"], "clients-list");

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
      // Auto-assign the first pipeline stage ("New") sorted by order_index
      const newStage = pipelineStages.slice().sort((a, b) => a.order_index - b.order_index)[0];
      await clientsAPI.create({
        first_name: newClient.first_name.trim(),
        last_name:  newClient.last_name.trim(),
        email:      newClient.email.trim() || null,
        phone:      newClient.phone.trim() || null,
        address:    newClient.address.trim() || null,
        city:       newClient.city.trim() || null,
        state:      newClient.state.trim() || null,
        zip:        newClient.zip.trim() || null,
        status:     newClient.status,
        lead_source_id: newClient.lead_source_id || null,
        pipeline_stage_id: newStage?.id ?? null,
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

  const stageClients = stageFilter
    ? clients.filter((c) => c.status === stageFilter)
    : clients;

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

  const formatDateTime = (startStr: string, endStr?: string | null) => {
    const s = new Date(startStr);
    const datePart = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const startTime = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (endStr) {
      const endTime = new Date(endStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${datePart} · ${startTime} – ${endTime}`;
    }
    return `${datePart} · ${startTime}`;
  };

  const clientProjectTotal = (client: any) => client.project_total ?? 0;

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
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Appointment</th>
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
                    {client.appointment_met ? (
                      <div className="flex items-center gap-1.5">
                        <CalendarCheck className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Met</span>
                      </div>
                    ) : client.appointment_scheduled && client.appointment_date ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700">Scheduled</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(client.appointment_date, client.appointment_end_date)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {(() => {
                      const total = clientProjectTotal(client);
                      if (total > 0) {
                        return <div className="text-sm font-medium">{formatCurrency(total)}</div>;
                      }
                      if (client.projected_value) {
                        return (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-muted-foreground">{formatCurrency(client.projected_value)}</div>
                            {client.closing_probability && (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${client.closing_probability}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{client.closing_probability}%</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <span className="text-xs text-muted-foreground">—</span>;
                    })()}
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
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {stageFilter
              ? `${stageClients.length} client${stageClients.length !== 1 ? "s" : ""} in ${stageFilter.charAt(0).toUpperCase() + stageFilter.slice(1)}`
              : `${clients.length} client${clients.length !== 1 ? "s" : ""} total`}
          </p>
          <ClientTable list={stageClients} />
        </div>
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
              <div className="space-y-1.5 relative">
                <Label htmlFor="address">Street Address</Label>
                <div className="relative">
                  <Input
                    id="address"
                    placeholder="123 Main St"
                    value={newClient.address}
                    onChange={(e) => handleAddressInput(e.target.value)}
                    autoComplete="off"
                  />
                  {addressLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {addressSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {addressSuggestions.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() => selectAddress(place)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-0"
                      >
                        {place.display_name}
                      </button>
                    ))}
                  </div>
                )}
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
