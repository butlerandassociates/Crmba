import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Mail, Phone, Shield, CheckCircle, XCircle, Loader2, KeyRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";
import { SkeletonCards } from "../ui/page-loader";


function UserDetailModal({ user, onClose, onToggleActive, onResendInvite, resending, getRoleBadgeColor, getRoleLabel, getUserPermissions }: {
  user: any;
  onClose: () => void;
  onToggleActive: (u: any) => void;
  onResendInvite: (u: any) => void;
  resending: string | null;
  getRoleBadgeColor: (r: string) => string;
  getRoleLabel: (r: string) => string;
  getUserPermissions: (u: any) => string[];
}) {
  const perms = user ? getUserPermissions(user) : [];
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ maxWidth: 480 }}>
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {(user.first_name?.[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <div>{`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—"}</div>
                  <div className="mt-1">
                    <Badge className={`${getRoleBadgeColor(user.role)} text-white text-xs`}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contact</p>
                <div className="space-y-2 text-sm">
                  {user.email && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <a href={`mailto:${user.email}`} className="hover:text-primary truncate">{user.email}</a>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <a href={`tel:${user.phone}`} className="hover:text-primary">{user.phone}</a>
                    </div>
                  )}
                  {!user.email && !user.phone && (
                    <span className="text-muted-foreground text-sm">No contact info</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Status</p>
                <div className="flex items-center gap-2 text-sm">
                  {user.is_active
                    ? <><CheckCircle className="h-4 w-4 text-green-500" /><span className="font-medium">Active</span></>
                    : <><XCircle className="h-4 w-4 text-red-500" /><span className="font-medium text-red-500">Deactivated</span></>
                  }
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Permissions ({perms.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {perms.length > 0 ? perms.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs">
                      {perm.replace(/can_/g, "").replace(/_/g, " ")}
                    </Badge>
                  )) : (
                    <span className="text-sm text-muted-foreground">No permissions assigned</span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onResendInvite(user)} disabled={resending === user.id}>
                {resending === user.id
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <KeyRound className="h-4 w-4 mr-2" />}
                Reset Password
              </Button>
              <Button
                variant={user.is_active ? "destructive" : "default"}
                onClick={() => onToggleActive(user)}
              >
                {user.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [inviteTouched, setInviteTouched] = useState(false);
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
  useRealtimeRefetch(loadUsers, ["profiles"], "user-management");

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

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const inviteEmailErr = !formData.email.trim() ? "Email is required." : !isValidEmail(formData.email.trim()) ? "Enter a valid email address." : "";
  const inviteRoleErr  = !selectedRole ? "Role is required." : "";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteTouched(true);
    if (inviteEmailErr || inviteRoleErr) return;
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
            email:       formData.email,
            first_name:  formData.firstName,
            last_name:   formData.lastName,
            role:        selectedRole,
            permissions,
            redirect_to: `${window.location.origin}/set-password`,
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
      setInviteTouched(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite.");
    } finally {
      setCreating(false);
    }
  };

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [confirmUser, setConfirmUser] = useState<any | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const handleResendInvite = async (user: any) => {
    setResending(user.id);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email:       user.email,
            first_name:  user.first_name,
            last_name:   user.last_name,
            role:        user.role,
            permissions: user.permissions ?? {},
            redirect_to: `${window.location.origin}/set-password`,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to resend");
      toast.success(`Invite resent to ${user.email}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResending(null);
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
    <div className="space-y-4">
      <div className="sticky top-[128px] z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Team Members</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage user access and permissions</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setFormData({ firstName: "", lastName: "", email: "" }); setSelectedRole(""); setSelectedPermissions([]); setInviteTouched(false); } }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 gap-0">
            <form onSubmit={handleInvite} className="flex flex-col flex-1 min-h-0">
              {/* Fixed header */}
              <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    An invite email will be sent. They set their own password on first login.
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid gap-4">
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
                    <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                      className={inviteTouched && inviteEmailErr ? "border-red-500" : ""}
                    />
                    {inviteTouched && inviteEmailErr && <p className="text-xs text-red-500">{inviteEmailErr}</p>}
                  </div>

                  <div className="grid gap-2">
                    <Label>Role <span className="text-destructive">*</span></Label>
                    <Select value={selectedRole} onValueChange={handleRoleChange}>
                      <SelectTrigger className={inviteTouched && inviteRoleErr ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r: any) => (
                          <SelectItem key={r.id} value={r.name}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inviteTouched && inviteRoleErr && <p className="text-xs text-red-500">{inviteRoleErr}</p>}
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
              </div>

              {/* Fixed footer */}
              <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-2">
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
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <SkeletonCards count={6} />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No team members yet</p>
          <p className="text-xs mt-1">Use the Invite User button above to add your first team member.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => {
            const perms = getUserPermissions(user);
            return (
              <Card
                key={user.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedUser(user)}
              >
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
                          <span className="text-xs">No permissions</span>
                        )}
                        {perms.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{perms.length - 3} more</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => user.is_active ? setConfirmUser(user) : handleToggleActive(user)}
                    >
                      {user.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendInvite(user)}
                            disabled={resending === user.id}
                          >
                            {resending === user.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <KeyRound className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset Password</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{`${confirmUser?.first_name ?? ""} ${confirmUser?.last_name ?? ""}`.trim()}</strong>?
              They will lose access to the portal immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleToggleActive(confirmUser); setConfirmUser(null); }}
            >
              Yes, Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Profile Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onToggleActive={(u) => { if (u.is_active) { setSelectedUser(null); setConfirmUser(u); } else { handleToggleActive(u); setSelectedUser(null); } }}
        onResendInvite={(u) => { handleResendInvite(u); setSelectedUser(null); }}
        resending={resending}
        getRoleBadgeColor={getRoleBadgeColor}
        getRoleLabel={getRoleLabel}
        getUserPermissions={getUserPermissions}
      />
    </div>
  );
}
