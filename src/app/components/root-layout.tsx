import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { Loader2, Bell, AlertCircle, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  DollarSign,
  Settings as SettingsIcon,
  ShieldCheck,
  Workflow,
  Plug,
  LogOut,
  ChevronDown,
  UserCircle,
  Eye,
  EyeOff,
  UserRoundSearch,
  UserRoundCog,
  UserRoundCheck,
  UserRoundPlus,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { usersAPI } from "../utils/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Stats", href: "/pipeline", icon: Workflow },
  { name: "Prospect", href: "/clients?stage=prospect", icon: UserRoundSearch },
  { name: "Selling", href: "/clients?stage=selling", icon: UserRoundCog },
  { name: "Sold", href: "/clients?stage=sold", icon: UserRoundCheck },
  { name: "Active", href: "/clients?stage=active", icon: UserRoundPlus },
  { name: "Completed", href: "/clients?stage=completed", icon: UserCheck },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  sales_rep: "Sales Rep",
  foreman: "Foreman",
};

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, isInviteFlow, signOut, refreshProfile } = useAuth();

  // Bell alerts
  type NavAlert = { id: string; clientId: string; clientName: string; label: string; description: string; severity: "red" | "amber" };
  const [navAlerts, setNavAlerts] = useState<NavAlert[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [clientsRes, estimatesRes, paymentsRes] = await Promise.all([
          supabase.from("clients").select("id, first_name, last_name, status, expected_close_date").eq("is_discarded", false),
          supabase.from("estimates").select("client_id"),
          supabase.from("project_payments")
            .select("id, label, due_date, project:projects(id, client_id, client:clients(first_name, last_name))")
            .eq("is_paid", false).not("due_date", "is", null).lt("due_date", today),
        ]);
        const clients = clientsRes.data ?? [];
        const proposalClientIds = new Set((estimatesRes.data ?? []).map((e: any) => e.client_id));
        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);

        const alerts: NavAlert[] = [];

        clients.filter((c: any) => c.status === "selling" && !proposalClientIds.has(c.id)).forEach((c: any) => {
          alerts.push({
            id: `no-proposal-${c.id}`, clientId: c.id,
            clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
            label: "No Proposal Sent", description: "In Selling stage with no proposal created",
            severity: "amber",
          });
        });

        clients.filter((c: any) => {
          if (!["prospect", "selling"].includes(c.status) || !c.expected_close_date) return false;
          const d = new Date(c.expected_close_date); d.setHours(0, 0, 0, 0);
          return d < todayDate;
        }).forEach((c: any) => {
          alerts.push({
            id: `stale-${c.id}`, clientId: c.id,
            clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
            label: "Close Date Passed",
            description: `Expected by ${new Date(c.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
            severity: "amber",
          });
        });

        (paymentsRes.data ?? []).forEach((p: any) => {
          const client = p.project?.client;
          alerts.push({
            id: `overdue-${p.id}`, clientId: p.project?.client_id ?? "",
            clientName: client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "—",
            label: "Payment Overdue",
            description: `${p.label ?? "Payment"} — due ${new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            severity: "red",
          });
        });

        setNavAlerts(alerts);
      } catch { /* silent */ }
    };
    fetchAlerts();
  }, []);

  // My Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Show login success toast once after redirect from login
  useEffect(() => {
    if (location.state?.loginSuccess) {
      // toast handled in login-page.tsx with user's first name
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (location.state?.passwordSet) {
      toast.success("Password set successfully! Welcome to the team.");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  const openProfile = () => {
    setProfileForm({
      first_name: user?.profile?.first_name ?? "",
      last_name:  user?.profile?.last_name  ?? "",
      phone:      user?.profile?.phone      ?? "",
    });
    setNewPassword("");
    setConfirmPassword("");
    setProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.profile?.id) return;
    setSavingProfile(true);
    try {
      await usersAPI.update(user.profile.id, profileForm);
      await refreshProfile();
      toast.success("Profile updated.");
      setProfileOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || isInviteFlow) {
    return <Navigate to="/login" replace state={{ isInvite: isInviteFlow }} />;
  }

  const displayName = user.profile
    ? `${user.profile.first_name ?? ""} ${user.profile.last_name ?? ""}`.trim() || user.email
    : user.email;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Business name bar */}
      <div className="bg-black px-6 py-1.5">
        <p className="text-white text-xs font-medium tracking-widest uppercase text-center">
          Butler & Associates Construction, Inc.
        </p>
      </div>

      {/* Horizontal Top Navigation */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-2">
              {navigation.map((item) => {
                const isActive = item.href === "/"
                  ? location.pathname === "/"
                  : location.pathname + location.search === item.href ||
                    (item.href.includes("?") ? false : location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-1 rounded-md hover:bg-accent transition-colors">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {navAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                      {navAlerts.length > 9 ? "9+" : navAlerts.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">Alerts</span>
                  {navAlerts.length > 0 && (
                    <span className="text-xs text-muted-foreground">{navAlerts.length} active</span>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {navAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <p className="text-sm font-medium text-green-700">All clear!</p>
                      <p className="text-xs text-muted-foreground">No issues in your pipeline</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {navAlerts.map((alert) => (
                        <Link
                          key={alert.id}
                          to={alert.clientId ? `/clients/${alert.clientId}` : "/pipeline"}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors"
                        >
                          <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.severity === "red" ? "text-red-500" : "text-amber-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${alert.severity === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {alert.label}
                              </span>
                              <span className="text-xs font-medium truncate">{alert.clientName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t px-4 py-2.5">
                  <Link to="/pipeline" className="text-xs text-primary font-medium">
                    View all alerts in Stats →
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-sm">{displayName}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={openProfile}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/financials" className="cursor-pointer flex items-center">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Financials
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/integrations" className="cursor-pointer flex items-center">
                    <Plug className="mr-2 h-4 w-4" />
                    Integrations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer flex items-center">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {user.profile?.role === "admin" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/team" className="cursor-pointer flex items-center">
                        <UsersRound className="mr-2 h-4 w-4" />
                        Team
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer flex items-center">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Admin Portal
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* My Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {(user.profile?.first_name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <div>{displayName}</div>
                <div className="mt-1">
                  <Badge className="text-xs">
                    {ROLE_LABELS[user.profile?.role ?? ""] ?? user.profile?.role ?? "—"}
                  </Badge>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-6 py-2 pr-1">
            {/* Account info (read-only) */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Account</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            {/* Edit profile */}
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Personal Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>First Name</Label>
                  <Input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Last Name</Label>
                  <Input
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
              <Button type="submit" size="sm" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </form>

            <div className="border-t" />

            {/* Change password */}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Change Password</p>
              <div className="grid gap-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Confirm Password</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
              </Button>
            </form>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
