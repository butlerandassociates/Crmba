import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Mail, Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { usersAPI, rolesAPI, permissionsAPI } from "../../utils/api";
import { projectId, publicAnonKey } from "utils/supabase/info";
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


export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "" });

  const loadUsers = () => {
    setLoading(true);
    usersAPI
      .getAll()
      .then(setUsers)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
    rolesAPI.getAll().then(setRoles).catch(console.error);
    permissionsAPI.getAll().then(setAllPermissions).catch(console.error);
  }, []);

  const handleRoleChange = async (role: string) => {
    setSelectedRole(role);
    try {
      const defaults = await permissionsAPI.getDefaultsForRole(role);
      setSelectedPermissions(defaults);
    } catch {
      setSelectedPermissions([]);
    }
  };

  const handlePermissionToggle = (id: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !selectedRole) {
      toast.error("Email and role are required.");
      return;
    }
    setCreating(true);
    try {
      // Build permissions object
      const permissions: Record<string, boolean> = {};
      allPermissions.forEach((p: any) => {
        permissions[p.key] = selectedPermissions.includes(p.key);
      });

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email:      formData.email,
            first_name: formData.firstName,
            last_name:  formData.lastName,
            role:       selectedRole,
            permissions,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send invite");

      toast.success(`Invite sent to ${formData.email}! They will receive an email to set their password.`, { duration: 6000 });
      setDialogOpen(false);
      setFormData({ firstName: "", lastName: "", email: "" });
      setSelectedRole("");
      setSelectedPermissions([]);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      if (user.is_active) {
        await usersAPI.deactivate(user.id);
        toast.success(`${user.first_name} deactivated.`);
      } else {
        await usersAPI.update(user.id, { is_active: true });
        toast.success(`${user.first_name} reactivated.`);
      }
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":           return "bg-purple-500";
      case "project_manager": return "bg-blue-500";
      case "sales_rep":       return "bg-green-500";
      case "foreman":         return "bg-orange-500";
      default:                return "bg-gray-500";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":           return "Admin";
      case "project_manager": return "Project Manager";
      case "sales_rep":       return "Sales Rep";
      case "foreman":         return "Foreman";
      case "team_member":     return "Team Member";
      default:                return role;
    }
  };

  const getUserPermissions = (user: any): string[] => {
    if (!user.permissions) return [];
    return Object.entries(user.permissions)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
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
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  An invite email will be sent. They set their own password on first login.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Role *</Label>
                  <Select value={selectedRole} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.name}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Permissions</Label>
                  <div className="border rounded-lg p-4 space-y-3">
                    {allPermissions.map((permission: any) => (
                      <div key={permission.key} className="flex items-center gap-2">
                        <Checkbox
                          id={permission.key}
                          checked={selectedPermissions.includes(permission.key)}
                          onCheckedChange={() => handlePermissionToggle(permission.key)}
                        />
                        <label htmlFor={permission.key} className="text-sm cursor-pointer">
                          {permission.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pre-selected based on role. Customize as needed.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending Invite...</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Send Invite</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No team members yet. Invite someone to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => {
            const perms = getUserPermissions(user);
            return (
              <Card key={user.id}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">
                        {`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"}
                      </h3>
                      <Badge className={`${getRoleBadgeColor(user.role)} text-white text-xs`}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                    {user.is_active ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {perms.length > 0 ? (
                          perms.slice(0, 3).map((perm) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {perm.replace(/can_/g, "").replace(/_/g, " ")}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs">No extra permissions</span>
                        )}
                        {perms.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{perms.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
