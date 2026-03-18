import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Plus, Search, Mail, Phone, Calendar, Loader2 } from "lucide-react";
import { clientsAPI } from "../utils/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for new client
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    status: "prospect",
    leadSource: "",
  });

  // Fetch clients from API on mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await clientsAPI.getAll();
      setClients(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch clients:", err);
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Generate a unique ID for the new client
      const maxId = clients.reduce((max, c) => Math.max(max, parseInt(c.id) || 0), 0);
      const newId = (maxId + 1).toString();
      
      const clientData = {
        ...newClient,
        id: newId,
        createdAt: new Date().toISOString(),
        totalRevenue: 0,
        projectsCount: 0,
        appointmentScheduled: false,
        appointmentMet: false,
        docusignStatus: "not_sent",
      };

      await clientsAPI.create(clientData);
      
      toast.success("Client added successfully!");
      setAddDialogOpen(false);
      
      // Reset form
      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        status: "prospect",
        leadSource: "",
      });
      
      // Refresh the clients list
      fetchClients();
    } catch (err: any) {
      console.error("Failed to create client:", err);
      toast.error(err.message || "Failed to add client");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewClient((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewClient((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Clients that need scheduling (new leads without appointment met)
  const needsScheduling = clients.filter(
    (client) => !client.appointmentMet
  );

  // Clients met (prospects that have had appointments)
  const clientsMet = clients.filter(
    (client) => client.appointmentMet
  );

  const filterClients = (clientsList: typeof clients) => {
    return clientsList.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "sold":
        return "bg-orange-500";
      case "prospect":
        return "bg-blue-500";
      case "completed":
        return "bg-purple-500";
      case "inactive":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading clients from database...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <Tabs defaultValue="needsScheduling">
          <TabsList className="w-full">
            <TabsTrigger value="needsScheduling">Needs Scheduling</TabsTrigger>
            <TabsTrigger value="clientsMet">Clients Met</TabsTrigger>
          </TabsList>
          <TabsContent value="needsScheduling">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Projects</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Forecast</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filterClients(needsScheduling).map((client) => (
                        <tr key={client.id} className="hover:bg-accent/50 transition-colors">
                          <td className="p-3">
                            <Badge className={`${getStatusColor(client.status)} text-xs`}>
                              {client.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Link
                              to={`/clients/${client.id}`}
                              className="font-semibold text-sm hover:text-primary"
                            >
                              {client.name}
                            </Link>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{client.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{client.phone}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm font-medium">{client.projectsCount}</span>
                          </td>
                          <td className="p-3">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(client.totalRevenue)}
                            </div>
                          </td>
                          <td className="p-3">
                            {client.projectedValue && client.closingProbability ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium">
                                  {formatCurrency(client.projectedValue)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{ width: `${client.closingProbability}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {client.closingProbability}%
                                  </span>
                                </div>
                                {client.expectedCloseDate && (
                                  <div className="text-xs text-muted-foreground">
                                    Est: {formatDate(client.expectedCloseDate)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
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
                {filterClients(needsScheduling).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No clients found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="clientsMet">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Client</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Projects</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Forecast</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filterClients(clientsMet).map((client) => (
                        <tr key={client.id} className="hover:bg-accent/50 transition-colors">
                          <td className="p-3">
                            <Badge className={`${getStatusColor(client.status)} text-xs`}>
                              {client.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Link
                              to={`/clients/${client.id}`}
                              className="font-semibold text-sm hover:text-primary"
                            >
                              {client.name}
                            </Link>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{client.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{client.phone}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm font-medium">{client.projectsCount}</span>
                          </td>
                          <td className="p-3">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(client.totalRevenue)}
                            </div>
                          </td>
                          <td className="p-3">
                            {client.projectedValue && client.closingProbability ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium">
                                  {formatCurrency(client.projectedValue)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500"
                                      style={{ width: `${client.closingProbability}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {client.closingProbability}%
                                  </span>
                                </div>
                                {client.expectedCloseDate && (
                                  <div className="text-xs text-muted-foreground">
                                    Est: {formatDate(client.expectedCloseDate)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
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
                {filterClients(clientsMet).length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No clients found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      
      {/* Add Client Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>
              Add a new client to your database.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  value={newClient.name}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  placeholder="john.doe@example.com"
                  value={newClient.email}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(123) 456-7890"
                  value={newClient.phone}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="123 Main St, Anytown, USA"
                  value={newClient.address}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newClient.status}
                  onValueChange={(value) => setNewClient(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="leadSource">Lead Source</Label>
                <Input
                  id="leadSource"
                  name="leadSource"
                  placeholder="Referral"
                  value={newClient.leadSource}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding..." : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}