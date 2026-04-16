import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Loader2, Bell, AlertCircle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { notificationsAPI } from "../utils/api";
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
  Banknote,
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
  DialogBody,
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

  // Bell alerts — per-user dismissed state stored in Supabase
  type NavAlert = { id: string; clientId: string; clientName: string; label: string; description: string; severity: "red" | "amber" };
  const [navAlerts, setNavAlerts] = useState<NavAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // In-app notifications (crew pay submitted, etc.)
  const [crewNotifications, setCrewNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const data = await notificationsAPI.getUnread();
      setCrewNotifications(data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchNotifications(); }, [user?.profile?.id]);

  // Load dismissed alerts for current user
  useEffect(() => {
    if (!user?.profile?.id) return;
    supabase
      .from("user_dismissed_alerts")
      .select("alert_id")
      .eq("user_id", user.profile.id)
      .then(({ data }) => {
        if (data) setDismissedAlerts(new Set(data.map((r: any) => r.alert_id)));
      });
  }, [user?.profile?.id]);

  const markAsRead = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.profile?.id) return;
    setDismissedAlerts((prev) => new Set([...prev, id]));
    supabase.from("user_dismissed_alerts").insert({ user_id: user.profile.id, alert_id: id }).then(() => {});
  };

  const clearAllAlerts = (targetUserId?: string) => {
    // Admin override — pass targetUserId to clear specific user, omit to clear all
    const query = supabase.from("user_dismissed_alerts").delete();
    if (targetUserId) {
      query.eq("user_id", targetUserId).then(() => {});
    } else {
      query.neq("user_id", "00000000-0000-0000-0000-000000000000").then(() => {});
    }
    if (!targetUserId || targetUserId === user?.profile?.id) setDismissedAlerts(new Set());
  };

  const visibleAlerts = navAlerts.filter(a => !dismissedAlerts.has(a.id));

  const fetchAlerts = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const [clientsRes, estimatesRes, paymentsRes, apptRes, foremanRes] = await Promise.all([
        supabase.from("clients").select("id, first_name, last_name, status, expected_close_date").eq("is_discarded", false),
        supabase.from("estimates").select("client_id"),
        supabase.from("project_payments")
          .select("id, label, due_date, project:projects(id, client_id, client:clients(first_name, last_name, is_discarded))")
          .eq("is_paid", false).not("due_date", "is", null).lt("due_date", today),
        supabase.from("appointments")
          .select("id, title, appointment_date, is_met, client:clients!appointments_client_id_fkey(id, first_name, last_name, status, is_discarded)")
          .eq("is_met", false)
          .lte("appointment_date", cutoff24h),
        supabase.from("profiles")
          .select("id, first_name, last_name, insurance_expiration_date")
          .eq("role", "foreman")
          .not("insurance_expiration_date", "is", null),
      ]);
      const clients = clientsRes.data ?? [];
      const proposalClientIds = new Set((estimatesRes.data ?? []).map((e: any) => e.client_id));
      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
      const in30Days = new Date(todayDate); in30Days.setDate(in30Days.getDate() + 30);

      const alerts: NavAlert[] = [];

      // Foreman insurance expiration — alert when within 30 days
      (foremanRes.data ?? []).forEach((f: any) => {
        const expDate = new Date(f.insurance_expiration_date); expDate.setHours(0, 0, 0, 0);
        if (expDate <= in30Days) {
          const daysLeft = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          const name = `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "Foreman";
          alerts.push({
            id: `insurance-expiry-${f.id}`,
            clientId: "",
            clientName: name,
            label: "Insurance Expiring",
            description: daysLeft <= 0
              ? `${name}'s insurance has expired`
              : `${name}'s insurance expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
            severity: daysLeft <= 7 ? "red" : "amber",
          });
        }
      });

      clients.filter((c: any) => c.status === "selling" && !proposalClientIds.has(c.id)).forEach((c: any) => {
        alerts.push({
          id: `no-proposal-${c.id}`, clientId: c.id,
          clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          label: "No Proposal Sent", description: "In Selling stage with no proposal created",
          severity: "amber",
        });
      });

      clients.filter((c: any) => {
        if (c.status !== "selling" || !c.expected_close_date) return false;
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

      (paymentsRes.data ?? []).filter((p: any) => !p.project?.client?.is_discarded).forEach((p: any) => {
        const client = p.project?.client;
        alerts.push({
          id: `overdue-${p.id}`, clientId: p.project?.client_id ?? "",
          clientName: client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "—",
          label: "Payment Overdue",
          description: `${p.label ?? "Payment"} — due ${new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          severity: "red",
        });
      });

      // Appointment not followed up — past 24h, client still in prospect
      (apptRes.data ?? [])
        .filter((a: any) => a.client && !a.client.is_discarded && a.client.status === "prospect")
        .forEach((a: any) => {
          const c = a.client;
          const clientName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
          const apptDate = new Date(a.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          alerts.push({
            id: `appt-followup-${a.id}`,
            clientId: c.id,
            clientName,
            label: "Update Lead Status",
            description: `Appointment on ${apptDate} — still in Prospect. Move to Selling or update forecast.`,
            severity: "amber",
          });
        });

      setNavAlerts(alerts);

      // Prune dismissed rows whose underlying issue is now resolved
      // If an alert_id no longer exists in current active alerts, the dismiss record is stale — delete it
      // This ensures if the same condition returns later, it shows up again as a fresh alert
      if (user?.profile?.id && alerts.length >= 0) {
        const activeAlertIds = alerts.map((a) => a.id);
        supabase
          .from("user_dismissed_alerts")
          .select("alert_id")
          .eq("user_id", user.profile.id)
          .then(({ data }) => {
            const stale = (data ?? []).map((r: any) => r.alert_id).filter((id: string) => !activeAlertIds.includes(id));
            if (stale.length > 0) {
              supabase.from("user_dismissed_alerts").delete().eq("user_id", user.profile.id).in("alert_id", stale).then(() => {
                setDismissedAlerts((prev) => {
                  const updated = new Set(prev);
                  stale.forEach((id: string) => updated.delete(id));
                  return updated;
                });
              });
            }
          });
      }
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAlerts(); }, []);
  useRealtimeRefetch(fetchAlerts, ["clients", "project_payments", "estimates", "appointments"], "nav-alerts");
  useRealtimeRefetch(fetchNotifications, ["notifications"], "nav-notifications");

  // My Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileTouched, setProfileTouched] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

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
    setProfileTouched(false);
    setPasswordTouched(false);
    setProfileOpen(true);
  };

  const isValidPhone = (v: string) => v.replace(/\D/g, "").length >= 7;

  const profileFnErr    = !profileForm.first_name.trim() ? "First name is required." : profileForm.first_name.trim().length < 2 ? "Min 2 characters." : "";
  const profilePhoneErr = profileForm.phone.trim() && !isValidPhone(profileForm.phone) ? "Enter a valid phone number (min 7 digits)." : "";

  const newPassErr     = !newPassword ? "New password is required." : newPassword.length < 8 ? "Minimum 8 characters." : "";
  const confirmPassErr = !confirmPassword ? "Please confirm your password." : newPassword !== confirmPassword ? "Passwords do not match." : "";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileTouched(true);
    if (profileFnErr || profilePhoneErr) return;
    if (!user?.profile?.id) return;
    setSavingProfile(true);
    try {
      await usersAPI.update(user.profile.id, profileForm);
      await refreshProfile();
      toast.success("Profile updated.");
      setProfileOpen(false);
      setProfileTouched(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    if (newPassErr || confirmPassErr) return;
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTouched(false);
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

  // Foreman users get their own portal — not the main CRM
  if (user.profile?.role === "foreman") {
    return <Navigate to="/foreman" replace />;
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
                  {(visibleAlerts.length + crewNotifications.length) > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                      {(visibleAlerts.length + crewNotifications.length) > 9 ? "9+" : visibleAlerts.length + crewNotifications.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  {(visibleAlerts.length + crewNotifications.length) > 0 && (
                    <span className="text-xs text-muted-foreground">{visibleAlerts.length + crewNotifications.length} unread</span>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {visibleAlerts.length === 0 && crewNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <p className="text-sm font-medium text-green-700">All clear!</p>
                      <p className="text-xs text-muted-foreground">No pending actions</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {/* Crew payment notifications */}
                      {crewNotifications.map((n) => (
                        <Link
                          key={n.id}
                          to={n.link ?? "/payroll"}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors"
                          onClick={async () => {
                            await notificationsAPI.markRead(n.id);
                            setCrewNotifications((prev) => prev.filter((x) => x.id !== n.id));
                          }}
                        >
                          <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                {n.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </Link>
                      ))}
                      {/* Pipeline alerts */}
                      {visibleAlerts.map((alert) => (
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
                            <button
                              onClick={(e) => markAsRead(alert.id, e)}
                              className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t px-4 py-2.5">
                  <Link
                    to="/pipeline"
                    className="text-xs text-primary font-medium no-underline"
                    onClick={() => sessionStorage.setItem("pipeline_scroll", "tasks")}
                  >
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
                      <Link to="/payroll" className="cursor-pointer flex items-center">
                        <Banknote className="mr-2 h-4 w-4" />
                        Payroll
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
        <DialogContent className="sm:max-w-[460px]">
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

          <DialogBody className="space-y-6">
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
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className={profileTouched && profileFnErr ? "border-red-500" : ""}
                  />
                  {profileTouched && profileFnErr && <p className="text-xs text-red-500">{profileFnErr}</p>}
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
                  className={profileTouched && profilePhoneErr ? "border-red-500" : ""}
                />
                {profileTouched && profilePhoneErr && <p className="text-xs text-red-500">{profilePhoneErr}</p>}
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
                <Label>New Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={passwordTouched && newPassErr ? "border-red-500" : ""}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordTouched && newPassErr
                  ? <p className="text-xs text-red-500">{newPassErr}</p>
                  : <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                }
              </div>
              <div className="grid gap-1.5">
                <Label>Confirm Password <span className="text-destructive">*</span></Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={passwordTouched && confirmPassErr ? "border-red-500" : ""}
                />
                {passwordTouched && confirmPassErr && <p className="text-xs text-red-500">{confirmPassErr}</p>}
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
              </Button>
            </form>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setProfileOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
