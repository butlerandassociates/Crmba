import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Mail, Shield, CheckCircle, XCircle } from "lucide-react";
import { mockUsers } from "../../data/mock-data";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";

const availablePermissions = [
  { id: 'view_clients', label: 'View Clients' },
  { id: 'edit_clients', label: 'Edit Clients' },
  { id: 'view_projects', label: 'View Projects' },
  { id: 'edit_projects', label: 'Edit Projects' },
  { id: 'create_proposals', label: 'Create Proposals' },
  { id: 'view_commissions', label: 'View Commissions' },
  { id: 'view_financials', label: 'View Financials' },
  { id: 'edit_financials', label: 'Edit Financials' },
  { id: 'view_team', label: 'View Team' },
  { id: 'manage_users', label: 'Manage Users' },
];

export function UserManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500";
      case "project_manager":
        return "bg-blue-500";
      case "sales_rep":
        return "bg-green-500";
      case "foreman":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "project_manager":
        return "Project Manager";
      case "sales_rep":
        return "Sales Rep";
      case "foreman":
        return "Foreman";
      default:
        return role;
    }
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    // Auto-populate permissions based on role
    switch (role) {
      case "admin":
        setSelectedPermissions(availablePermissions.map(p => p.id));
        break;
      case "project_manager":
        setSelectedPermissions(['view_clients', 'edit_clients', 'view_projects', 'edit_projects', 'view_commissions', 'view_team']);
        break;
      case "sales_rep":
        setSelectedPermissions(['view_clients', 'edit_clients', 'create_proposals', 'view_commissions', 'view_projects']);
        break;
      case "foreman":
        setSelectedPermissions(['view_projects']);
        break;
      default:
        setSelectedPermissions([]);
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      // Generate a temporary password for the user
      const tempPassword = `Butler${Math.random().toString(36).slice(2, 10)}!`;
      
      // Get auth token from session
      const session = sessionStorage.getItem("supabase.auth.token");
      const token = session ? JSON.parse(session).access_token : null;
      
      // Call backend signup endpoint to create user account
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-9d56a30d/auth/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || publicAnonKey}`,
          },
          body: JSON.stringify({
            email: formData.email,
            password: tempPassword,
            name: formData.name,
            role: selectedRole,
          }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }
      
      toast.success(
        `User created! Login: ${formData.email} | Password: ${tempPassword}`,
        { duration: 10000 }
      );
      
      setDialogOpen(false);
      setSelectedRole("");
      setSelectedPermissions([]);
      setFormData({
        name: "",
        email: "",
        phone: "",
      });
    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Members</h2>
          <p className="text-muted-foreground mt-1">Manage user access and permissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new team member and assign their role and permissions. They will receive login credentials via email.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@company.com"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={selectedRole} onValueChange={handleRoleChange} required>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="sales_rep">Sales Rep</SelectItem>
                      <SelectItem value="foreman">Foreman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3">
                  <Label>Permissions</Label>
                  <div className="border rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                    {availablePermissions.map((permission) => (
                      <div key={permission.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={() => handlePermissionToggle(permission.id)}
                        />
                        <label
                          htmlFor={permission.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {permission.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Permissions are pre-selected based on the role, but can be customized.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockUsers.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{user.name}</h3>
                  <Badge className={getRoleBadgeColor(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
                {user.isActive ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs font-medium mb-1">Permissions:</div>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.length > 0 ? (
                        user.permissions.slice(0, 3).map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm === 'all' ? 'All Access' : perm.replace(/_/g, ' ')}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs">No permissions</span>
                      )}
                      {user.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  {user.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}