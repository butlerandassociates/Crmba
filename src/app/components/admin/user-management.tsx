import { useState, useEffect } from "react";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Mail, Phone, Shield, CheckCircle, XCircle, Loader2, KeyRound, Pencil, UserX, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { usersAPI, rolesAPI, permissionsAPI } from "../../utils/api";
import { supabase } from "@/lib/supabase";
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


function UserDetailModal({ user, onClose, onToggleActive, onResendInvite, onUpdateUser, resending, updatingUser, getRoleBadgeColor, getRoleLabel, getUserPermissions, allPermissions, onUpdatePermissions, updatingPermissions }: {
  user: any;
  onClose: () => void;
  onToggleActive: (u: any) => void;
  onResendInvite: (u: any) => void;
  onUpdateUser: (u: any, changes: { first_name: string; last_name: string; email: string; phone: string; home_address: string }) => Promise<void>;
  resending: string | null;
  updatingUser: string | null;
  getRoleBadgeColor: (r: string) => string;
  getRoleLabel: (r: string) => string;
  getUserPermissions: (u: any) => string[];
  allPermissions: any[];
  onUpdatePermissions: (userId: string, perms: Record<string, boolean>) => Promise<void>;
  updatingPermissions: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editingPerms, setEditingPerms] = useState(false);
  const [draftPerms, setDraftPerms] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({ first_name: "", last_name: "", email: "", phone: "", home_address: "" });
  const perms = user ? getUserPermissions(user) : [];
  const showHomeAddress = user?.role === "project_manager" || user?.role === "sales_rep";

  useEffect(() => {
    setEditingPerms(false);
    setDraftPerms({});
  }, [user?.id]);

  const startEdit = () => {
    setDraft({
      first_name: user.first_name ?? "",
      last_name:  user.last_name  ?? "",
      email:      user.email      ?? "",
      phone:      user.phone      ?? "",
      home_address: user.home_address ?? "",
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    await onUpdateUser(user, draft);
    setEditing(false);
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => { if (!open) { cancelEdit(); onClose(); } }}>
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
              {editing ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Edit Contact Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">First Name</Label>
                      <Input value={draft.first_name} onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Last Name</Label>
                      <Input value={draft.last_name} onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
                  </div>
                  {showHomeAddress && (
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Home Address</Label>
                      <Input value={draft.home_address} onChange={(e) => setDraft((d) => ({ ...d, home_address: e.target.value }))} placeholder="123 Main St, City, ST" />
                      <p className="text-[11px] text-muted-foreground">Used to auto-suggest business vs. personal mileage trips (home → job site = business).</p>
                    </div>
                  )}
                  {draft.email && draft.email !== user.email && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      Email changed — a new invite will be sent to {draft.email}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contact</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5" onClick={startEdit}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    </div>
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
                      {showHomeAddress && user.home_address && (
                        <div className="flex items-start gap-2.5 text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="truncate" title={user.home_address}>{user.home_address}</span>
                        </div>
                      )}
                      {!user.email && !user.phone && !(showHomeAddress && user.home_address) && (
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                        Permissions ({perms.length})
                      </p>
                      {!editingPerms && (
                        <Button
                          variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5"
                          onClick={() => { setDraftPerms(user?.permissions ?? {}); setEditingPerms(true); }}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      )}
                    </div>
                    {editingPerms ? (
                      <div className="space-y-3">
                        <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
                          {Object.entries(
                            allPermissions.reduce((acc: Record<string, any[]>, p: any) => {
                              const cat = p.category || "Other";
                              if (!acc[cat]) acc[cat] = [];
                              acc[cat].push(p);
                              return acc;
                            }, {})
                          ).map(([category, catPerms]) => (
                            <div key={category}>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{category}</p>
                              <div className="space-y-1">
                                {(catPerms as any[]).map((p: any) => (
                                  <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-primary"
                                      checked={!!draftPerms[p.key]}
                                      onChange={e => setDraftPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                                    />
                                    {p.label || p.key.replace(/can_/g, "").replace(/_/g, " ")}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1 border-t">
                          <Button
                            size="sm" className="h-7 text-xs"
                            disabled={updatingPermissions === user?.id}
                            onClick={async () => { await onUpdatePermissions(user.id, draftPerms); setEditingPerms(false); }}
                          >
                            {updatingPermissions === user?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingPerms(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {perms.length > 0 ? perms.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm.replace(/can_/g, "").replace(/_/g, " ")}
                          </Badge>
                        )) : (
                          <span className="text-sm text-muted-foreground">No permissions assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                  <Button onClick={saveEdit} disabled={updatingUser === user.id}>
                    {updatingUser === user.id ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
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
      .getAll(true)
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

      const { data: { session: inviteSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${inviteSession?.access_token ?? publicAnonKey}`,
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
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
  const [updatingPermissions, setUpdatingPermissions] = useState<string | null>(null);

  // Sales Rep deactivation with lead reassignment
  const [salesRepDeactivateTarget, setSalesRepDeactivateTarget] = useState<any | null>(null);
  const [salesRepOpenLeads, setSalesRepOpenLeads] = useState<any[]>([]);
  const [salesRepReassignTo, setSalesRepReassignTo] = useState<string>("none");
  const [deactivating, setDeactivating] = useState(false);

  // PM deactivation with active-jobs warning
  const [pmDeactivateTarget, setPmDeactivateTarget] = useState<any | null>(null);
  const [pmActiveJobs, setPmActiveJobs] = useState<any[]>([]);
  const [pmDeactivating, setPmDeactivating] = useState(false);

  const handleResendInvite = async (user: any) => {
    setResending(user.id);
    try {
      const { data: { session: resendSession } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendSession?.access_token ?? publicAnonKey}`,
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

  const handleUpdateUser = async (user: any, changes: { first_name: string; last_name: string; email: string; phone: string; home_address: string }) => {
    setUpdatingEmail(user.id);
    try {
      const emailChanged = changes.email.trim() && changes.email.trim() !== user.email;

      // If email changed, update auth.users via edge function
      if (emailChanged) {
        const { data: { session: updateSession } } = await supabase.auth.getSession();
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/update-user-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${updateSession?.access_token ?? publicAnonKey}` },
            body: JSON.stringify({ user_id: user.id, new_email: changes.email.trim() }),
          }
        );
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to update email");
      }

      // Update profile fields (name, phone, and email if changed)
      await usersAPI.update(user.id, {
        first_name: changes.first_name.trim() || null,
        last_name:  changes.last_name.trim()  || null,
        email:      changes.email.trim()      || null,
        phone:      changes.phone.trim()      || null,
        home_address: changes.home_address.trim() || null,
      });

      // If email changed, resend invite to new address
      if (emailChanged) {
        const { data: { session: reinviteSession } } = await supabase.auth.getSession();
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/invite-user`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${reinviteSession?.access_token ?? publicAnonKey}` },
            body: JSON.stringify({
              email:       changes.email.trim(),
              first_name:  changes.first_name.trim(),
              last_name:   changes.last_name.trim(),
              role:        user.role,
              permissions: user.permissions ?? {},
              redirect_to: `${window.location.origin}/set-password`,
            }),
          }
        );
        toast.success(`Contact updated — invite sent to ${changes.email.trim()}`, { duration: 5000 });
      } else {
        toast.success("Contact info updated.");
      }

      loadUsers();
      setSelectedUser((prev: any) => prev ? { ...prev, ...changes } : prev);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingEmail(null);
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: Record<string, boolean>) => {
    setUpdatingPermissions(userId);
    try {
      await usersAPI.update(userId, { permissions });
      toast.success("Permissions updated.");
      loadUsers();
      setSelectedUser((prev: any) => prev ? { ...prev, permissions } : prev);
    } catch (err: any) {
      toast.error(err.message || "Failed to update permissions.");
    } finally {
      setUpdatingPermissions(null);
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

  const initPMDeactivate = async (user: any) => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status")
      .eq("project_manager_id", user.id)
      .in("status", ["sold", "active"]);
    setPmActiveJobs(data ?? []);
    setPmDeactivateTarget(user);
  };

  const confirmPMDeactivate = async () => {
    if (!pmDeactivateTarget) return;
    setPmDeactivating(true);
    try {
      await usersAPI.deactivate(pmDeactivateTarget.id);
      toast.success(`${pmDeactivateTarget.first_name} deactivated.`);
      setPmDeactivateTarget(null);
      setPmActiveJobs([]);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPmDeactivating(false);
    }
  };

  const initSalesRepDeactivate = async (user: any) => {
    const { data } = await supabase
      .from("clients")
      .select("id, first_name, last_name, company, status")
      .eq("sales_rep_id", user.id)
      .in("status", ["prospect", "scheduled", "selling"])
      .eq("is_discarded", false);
    setSalesRepOpenLeads(data ?? []);
    setSalesRepReassignTo("none");
    setSalesRepDeactivateTarget(user);
  };

  const confirmSalesRepDeactivate = async () => {
    if (!salesRepDeactivateTarget) return;
    setDeactivating(true);
    try {
      if (salesRepOpenLeads.length > 0) {
        const leadIds = salesRepOpenLeads.map((c) => c.id);
        await supabase
          .from("clients")
          .update({ sales_rep_id: salesRepReassignTo === "none" ? null : salesRepReassignTo })
          .in("id", leadIds);
      }
      await usersAPI.deactivate(salesRepDeactivateTarget.id);
      toast.success(`${salesRepDeactivateTarget.first_name} deactivated.`);
      setSalesRepDeactivateTarget(null);
      setSalesRepOpenLeads([]);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeactivating(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":           return "bg-green-500";
      case "project_manager": return "bg-blue-500";
      case "sales_rep":       return "bg-purple-500";
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
                      onClick={() => user.is_active
                      ? (user.role === "sales_rep" ? initSalesRepDeactivate(user) : user.role === "project_manager" ? initPMDeactivate(user) : setConfirmUser(user))
                      : handleToggleActive(user)}
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

      {/* Sales Rep Deactivation — Reassignment Modal */}
      <Dialog
        open={!!salesRepDeactivateTarget}
        onOpenChange={(open) => { if (!open) { setSalesRepDeactivateTarget(null); setSalesRepOpenLeads([]); } }}
      >
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Deactivate {salesRepDeactivateTarget
                ? `${salesRepDeactivateTarget.first_name ?? ""} ${salesRepDeactivateTarget.last_name ?? ""}`.trim()
                : ""}?
            </DialogTitle>
            <DialogDescription>
              {salesRepOpenLeads.length > 0
                ? `This rep has ${salesRepOpenLeads.length} open lead${salesRepOpenLeads.length > 1 ? "s" : ""}. Choose who to reassign them to before deactivating.`
                : "They will lose portal access immediately. This cannot be undone without reactivating."}
            </DialogDescription>
          </DialogHeader>

          {salesRepOpenLeads.length > 0 && (
            <div className="px-6 space-y-4">
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {salesRepOpenLeads.map((c) => (
                  <div key={c.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || "—"}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{c.status}</Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reassign open leads to</Label>
                <Select value={salesRepReassignTo} onValueChange={setSalesRepReassignTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Leave unassigned</SelectItem>
                    {users
                      .filter((u) => u.role === "sales_rep" && u.is_active && u.id !== salesRepDeactivateTarget?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSalesRepDeactivateTarget(null); setSalesRepOpenLeads([]); }} disabled={deactivating}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSalesRepDeactivate}
              disabled={deactivating}
              className="min-w-[120px]"
            >
              {deactivating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /><span>Deactivating…</span></>
                : "Yes, Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PM Deactivation — Active Jobs Warning */}
      <Dialog
        open={!!pmDeactivateTarget}
        onOpenChange={(open) => { if (!open) { setPmDeactivateTarget(null); setPmActiveJobs([]); } }}
      >
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Deactivate {pmDeactivateTarget
                ? `${pmDeactivateTarget.first_name ?? ""} ${pmDeactivateTarget.last_name ?? ""}`.trim()
                : ""}?
            </DialogTitle>
            <DialogDescription>
              {pmActiveJobs.length > 0
                ? `This PM has ${pmActiveJobs.length} active job${pmActiveJobs.length > 1 ? "s" : ""} still running. Jobs will remain assigned but flagged for reassignment.`
                : "They will lose portal access immediately."}
            </DialogDescription>
          </DialogHeader>

          {pmActiveJobs.length > 0 && (
            <div className="px-6">
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {pmActiveJobs.map((p) => (
                  <div key={p.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{p.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPmDeactivateTarget(null); setPmActiveJobs([]); }} disabled={pmDeactivating}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPMDeactivate}
              disabled={pmDeactivating}
              className="min-w-[140px]"
            >
              {pmDeactivating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /><span>Deactivating…</span></>
                : pmActiveJobs.length > 0 ? "Proceed Anyway" : "Yes, Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onToggleActive={(u) => {
          if (u.is_active) {
            setSelectedUser(null);
            if (u.role === "sales_rep") { initSalesRepDeactivate(u); } else if (u.role === "project_manager") { initPMDeactivate(u); } else { setConfirmUser(u); }
          } else {
            handleToggleActive(u);
            setSelectedUser(null);
          }
        }}
        onResendInvite={(u) => { handleResendInvite(u); setSelectedUser(null); }}
        onUpdateUser={handleUpdateUser}
        resending={resending}
        updatingUser={updatingEmail}
        getRoleBadgeColor={getRoleBadgeColor}
        getRoleLabel={getRoleLabel}
        getUserPermissions={getUserPermissions}
        allPermissions={allPermissions}
        onUpdatePermissions={handleUpdatePermissions}
        updatingPermissions={updatingPermissions}
      />
    </div>
  );
}
