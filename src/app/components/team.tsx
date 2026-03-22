import { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Plus, Mail, Phone, FolderKanban, Loader2, X } from "lucide-react";
import { usersAPI, projectsAPI } from "../utils/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  sales_rep:       { label: "Sales Rep",       color: "bg-orange-500" },
  project_manager: { label: "Project Manager", color: "bg-blue-500"   },
  foreman:         { label: "Foreman",         color: "bg-green-500"  },
};

// Sections shown on the team page in priority order (excludes admin)
const TEAM_ROLES = ["project_manager", "foreman", "sales_rep"];

export function Team() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  // View projects modal
  const [viewMember, setViewMember] = useState<any | null>(null);
  const [memberProjects, setMemberProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => { fetchTeamMembers(); }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const data = await usersAPI.getAll();
      setTeamMembers(data.filter((m: any) => m.role !== "admin"));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (member: any) => {
    setEditMember(member);
    setEditForm({ first_name: member.first_name ?? "", last_name: member.last_name ?? "", phone: member.phone ?? "" });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    try {
      await usersAPI.update(editMember.id, editForm);
      toast.success("Team member updated.");
      setEditMember(null);
      fetchTeamMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const openViewProjects = async (member: any) => {
    setViewMember(member);
    setLoadingProjects(true);
    try {
      const all = await projectsAPI.getAll();
      setMemberProjects(all.filter((p: any) =>
        p.project_manager_id === member.id ||
        p.foreman_id === member.id ||
        p.sales_rep_id === member.id
      ));
    } catch {
      setMemberProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // const handleAddMember = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!newMember.name || !newMember.role || !newMember.email || !newMember.phone) {
  //     toast.error("Please fill in all fields");
  //     return;
  //   }
  //   try {
  //     setSaving(true);
  //     const nameParts = newMember.name.trim().split(" ");
  //     const first_name = nameParts[0] ?? "";
  //     const last_name = nameParts.slice(1).join(" ") || "";
  //     await usersAPI.create({
  //       first_name, last_name,
  //       role: newMember.role,
  //       phone: newMember.phone,
  //     } as Record<string, unknown>);
  //     toast.success("Team member added successfully!");
  //     setDialogOpen(false);
  //     setNewMember({ name: "", role: "", email: "", phone: "" });
  //     fetchTeamMembers();
  //   } catch (err: any) {
  //     toast.error(err.message || "Failed to add team member");
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground mt-1">Manage your sales reps, project managers and crew</p>
        </div>
        {/* TODO: confirm with client — remove this button once invite-only flow is approved */}
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Team members are added via the Admin Portal. They'll receive an email invite to set their password and log in.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground">
              Go to <strong>Admin Portal → Users → Invite User</strong> to add a new team member.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button asChild>
                <a href="/admin">Go to Admin Portal</a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {TEAM_ROLES.map((role) => {
            const config = ROLE_CONFIG[role];
            const members = teamMembers.filter((m) => m.role === role);
            return (
              <div key={role}>
                <h2 className="text-xl font-semibold mb-4">
                  {config.label}s
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({members.length})</span>
                </h2>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No {config.label.toLowerCase()}s added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map((member) => (
                      <Card key={member.id}>
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
                              </h3>
                              <Badge className={config.color}>{config.label}</Badge>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            {member.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <a href={`mailto:${member.email}`} className="hover:text-primary truncate">
                                  {member.email}
                                </a>
                              </div>
                            )}
                            {member.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <a href={`tel:${member.phone}`} className="hover:text-primary">
                                  {member.phone}
                                </a>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <FolderKanban className="h-4 w-4" />
                              <span>{member.activeProjects ?? 0} active projects</span>
                            </div>
                          </div>

                          <div className="pt-4 border-t flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openViewProjects(member)}>
                              View Projects
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(member)}>
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Member Modal */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
              <DialogDescription>Update contact details for this team member.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>First Name</Label>
                  <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Last Name</Label>
                  <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(555) 123-4567" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Projects Modal */}
      <Dialog open={!!viewMember} onOpenChange={(open) => !open && setViewMember(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Projects — {viewMember ? [viewMember.first_name, viewMember.last_name].filter(Boolean).join(" ") : ""}
            </DialogTitle>
            <DialogDescription>All projects assigned to this team member.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-2">
            {loadingProjects ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : memberProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No projects assigned.</p>
            ) : (
              <div className="space-y-2">
                {memberProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{p.name || p.title || "Unnamed Project"}</p>
                      <p className="text-muted-foreground text-xs capitalize">{p.status ?? "—"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{p.status ?? "—"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMember(null)}>
              <X className="h-4 w-4 mr-2" />Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
