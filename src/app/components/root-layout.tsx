import { Outlet, Link, useLocation, Navigate, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useRealtimeRefetch } from "../hooks/useRealtimeRefetch";
import { Loader2, Bell, AlertCircle, CheckCircle2, ClipboardCheck, FileSignature, XCircle, FileCheck2, FileX2, MailX } from "lucide-react";
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
  CalendarClock,
  Banknote,
  Receipt,
  Briefcase,
  Car,
  Menu,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { usePermissions } from "../hooks/usePermissions";
import { useViewAs } from "../contexts/view-as-context";
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

const ALL_NAVIGATION = [
  { name: "Dashboard", href: "/",                         icon: LayoutDashboard, permission: null, roles: null },
  { name: "Stats",     href: "/pipeline",                 icon: Workflow,        permission: "can_view_pipeline", roles: null },
  { name: "Prospect",  href: "/clients?stage=prospect",   icon: UserRoundSearch, permission: null, roles: ["admin"] },
  { name: "Scheduled", href: "/clients?stage=scheduled",  icon: CalendarClock,   permission: null, roles: ["admin", "sales_rep"] },
  { name: "Selling",   href: "/clients?stage=selling",    icon: UserRoundCog,    permission: null, roles: ["admin", "sales_rep"] },
  { name: "Sold",      href: "/clients?stage=sold",       icon: UserRoundCheck,  permission: null, roles: null },
  { name: "Active",    href: "/clients?stage=active",     icon: UserRoundPlus,   permission: null, roles: null },
  { name: "Completed", href: "/clients?stage=completed",  icon: UserCheck,       permission: null, roles: null },
  { name: "Mileage",   href: "/mileage",                  icon: Car,             permission: null, roles: ["admin", "project_manager", "sales_rep"] },
  { name: "Training",  href: "/onboarding",               icon: GraduationCap,   permission: null, roles: ["sales_rep", "project_manager"] },
  { name: "Onboarding", href: "/admin/onboarding",        icon: GraduationCap,   permission: "can_view_admin_portal", roles: ["admin"] },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  sales_rep: "Sales Rep",
  foreman: "Foreman",
};

export function RootLayout() {
  const location = useLocation();
  const { can, role } = usePermissions();
  const { viewAsRole, viewAsProfileId, viewAsProfileName, setViewAsRole, setViewAsProfile, clearViewAs } = useViewAs();
  const [viewAsMembers, setViewAsMembers] = useState<{ id: string; name: string }[]>([]);
  const navigation = ALL_NAVIGATION.filter(item =>
    (!item.permission || can(item.permission)) &&
    (!item.roles || item.roles.includes(role ?? ""))
  );
  const navigate = useNavigate();
  const { user, loading, isInviteFlow, signOut, refreshProfile } = useAuth();
  // ≤1024px (all iPad portraits incl. Pro 12.9", + phones) use a hamburger menu;
  // ≥1025px (desktop/laptops + iPad landscape) keep the full horizontal nav — unchanged.
  const isNarrow = useMediaQuery("(max-width: 1024px)");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const dismissNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await notificationsAPI.markRead(id);
    setCrewNotifications((prev) => prev.filter((x) => x.id !== id));
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

  const visibleAlerts = navAlerts.filter(a => a.id.startsWith("overdue-") || !dismissedAlerts.has(a.id));

  const fetchAlerts = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const cutoff3days = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const in3DaysStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // For PM/Sales Rep: fetch only their assigned client IDs so alerts are scoped
      let scopedClientIds: Set<string> | null = null;
      if ((role === "project_manager" || role === "sales_rep") && user?.profile?.id) {
        const field = role === "project_manager" ? "project_manager_id" : "sales_rep_id";
        const { data: assigned } = await supabase
          .from("projects")
          .select("client_id")
          .eq(field, user.profile.id)
          .not("client_id", "is", null);
        scopedClientIds = new Set((assigned ?? []).map((p: any) => p.client_id));
      }

      const [clientsRes, estimatesRes, paymentsRes, apptRes, foremanRes, docusignRes, budgetRes, startDateRes, fioProjectsRes, ghostPmRes, commissionPendingRes] = await Promise.all([
        supabase.from("clients").select("id, first_name, last_name, status, expected_close_date, created_at, appointment_scheduled").eq("is_discarded", false),
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
        // DocuSign sent but not signed after 3 days
        supabase.from("clients")
          .select("id, first_name, last_name, docusign_sent_date")
          .in("docusign_status", ["preparing", "sent_to_client"])
          .not("docusign_sent_date", "is", null)
          .lt("docusign_sent_date", cutoff3days)
          .eq("is_discarded", false),
        // Job costs >= 75% of contract value
        supabase.from("projects")
          .select("id, client_id, name, total_value, client:clients!projects_client_id_fkey(first_name, last_name, is_discarded), line_items:estimate_line_items(labor_cost, material_cost, quantity)")
          .in("status", ["active", "sold"])
          .not("total_value", "is", null)
          .gt("total_value", 0),
        // Projects with start_date within next 3 days (for FIO reminder)
        supabase.from("projects")
          .select("id, client_id, name, start_date, client:clients!projects_client_id_fkey(first_name, last_name, is_discarded)")
          .in("status", ["sold", "active"])
          .not("start_date", "is", null)
          .gte("start_date", today)
          .lte("start_date", in3DaysStr),
        // All FIO project_ids to detect which upcoming projects already have one
        supabase.from("field_installation_orders").select("project_id"),
        // Active projects with an inactive PM assigned
        supabase.from("projects")
          .select("id, client_id, client:clients!projects_client_id_fkey(first_name, last_name, is_discarded), pm:profiles!projects_project_manager_id_fkey(first_name, last_name, is_active)")
          .in("status", ["sold", "active"])
          .not("project_manager_id", "is", null),
        // Pending commission payments grouped by rep (admin only — who needs to be paid)
        supabase.from("commission_payments")
          .select("profile_id, amount, profile:profiles!commission_payments_profile_id_fkey(first_name, last_name)")
          .eq("status", "pending"),
      ]);
      const clients = clientsRes.data ?? [];
      const proposalClientIds = new Set((estimatesRes.data ?? []).map((e: any) => e.client_id));
      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
      const in30Days = new Date(todayDate); in30Days.setDate(in30Days.getDate() + 30);

      const alerts: NavAlert[] = [];

      // Foreman insurance expiration — alert when within 30 days
      (foremanRes.data ?? []).forEach((f: any) => {
        const expDate = new Date(f.insurance_expiration_date + "T00:00:00"); expDate.setHours(0, 0, 0, 0);
        if (expDate <= in30Days) {
          const daysLeft = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          const name = `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "Foreman";
          alerts.push({
            id: `insurance-expiry-${f.id}-${today}`,
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

      // Only alert if appointment was 24h+ ago (or no appointment scheduled at all)
      const apptPastClientIds = new Set(
        (apptRes.data ?? []).map((a: any) => a.client?.id).filter(Boolean)
      );
      clients.filter((c: any) =>
        c.status === "selling" &&
        !proposalClientIds.has(c.id) &&
        (!c.appointment_scheduled || apptPastClientIds.has(c.id))
      ).forEach((c: any) => {
        alerts.push({
          id: `no-proposal-${c.id}`, clientId: c.id,
          clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          label: "No Proposal Sent", description: "In Selling stage with no proposal created",
          severity: "amber",
        });
      });

      clients.filter((c: any) => {
        if (c.status !== "selling" || !c.expected_close_date) return false;
        const d = new Date(c.expected_close_date + "T00:00:00"); d.setHours(0, 0, 0, 0);
        return d < todayDate;
      }).forEach((c: any) => {
        alerts.push({
          id: `stale-${c.id}`, clientId: c.id,
          clientName: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
          label: "Close Date Passed",
          description: `Expected by ${new Date(c.expected_close_date.includes("T") ? c.expected_close_date : `${c.expected_close_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          severity: "amber",
        });
      });

      (paymentsRes.data ?? []).filter((p: any) => !p.project?.client?.is_discarded).forEach((p: any) => {
        const client = p.project?.client;
        alerts.push({
          id: `overdue-${p.id}-${today}`, clientId: p.project?.client_id ?? "",
          clientName: client ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() : "—",
          label: "Payment Overdue",
          description: `${p.label ?? "Payment"} — due ${new Date(p.due_date.includes("T") ? p.due_date : `${p.due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          severity: "red",
        });
      });

      // Appointment not followed up — past 24h, client still in prospect
      (apptRes.data ?? [])
        .filter((a: any) => a.client && !a.client.is_discarded && a.client.status === "prospect")
        .forEach((a: any) => {
          const c = a.client;
          const clientName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
          const apptDate = new Date(a.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          alerts.push({
            id: `appt-followup-${a.id}-${today}`,
            clientId: c.id,
            clientName,
            label: "Update Lead Status",
            description: `Appointment on ${apptDate} — still in Prospect. Move to Selling or update forecast.`,
            severity: "amber",
          });
        });

      // Appointment passed 24h+ ago, client still in Scheduled — needs follow up
      (apptRes.data ?? [])
        .filter((a: any) => a.client && !a.client.is_discarded && a.client.status === "scheduled")
        .forEach((a: any) => {
          const c = a.client;
          const clientName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
          const apptDate = new Date(a.appointment_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          alerts.push({
            id: `appt-scheduled-followup-${a.id}-${today}`,
            clientId: c.id,
            clientName,
            label: "Follow Up After Visit",
            description: `Appointment on ${apptDate} — still in Scheduled. Move to Selling or discard.`,
            severity: "amber",
          });
        });

      // DocuSign sent but not signed after 3 days
      // Prospect with no appointment booked after 24h — admin only
      if (role === "admin") {
        clients
          .filter((c: any) => {
            if (c.status !== "prospect" || c.appointment_scheduled) return false;
            return new Date(c.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
          })
          .forEach((c: any) => {
            const clientName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
            const daysIn = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
            alerts.push({
              id: `no-appt-prospect-${c.id}-${today}`,
              clientId: c.id,
              clientName,
              label: "No Appointment Booked",
              description: `In Prospect for ${daysIn} day${daysIn === 1 ? "" : "s"} — no appointment scheduled yet`,
              severity: "amber",
            });
          });
      }

      (docusignRes.data ?? []).forEach((c: any) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        const sentDate = new Date(c.docusign_sent_date.includes("T") ? c.docusign_sent_date : `${c.docusign_sent_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        alerts.push({
          id: `docusign-unsigned-${c.id}`,
          clientId: c.id,
          clientName: name,
          label: "Contract Not Signed",
          description: `DocuSign sent ${sentDate} — awaiting client signature`,
          severity: "amber",
        });
      });

      // Job costs at 75%+ of budget
      (budgetRes.data ?? [])
        .filter((p: any) => !p.client?.is_discarded)
        .forEach((p: any) => {
          const items = (p.line_items ?? []) as any[];
          const totalCost = items.reduce((sum: number, li: any) => sum + ((Number(li.labor_cost) + Number(li.material_cost)) * (Number(li.quantity) || 1)), 0);
          const ratio = totalCost / Number(p.total_value);
          if (ratio >= 0.75) {
            const clientName = p.client ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() : "—";
            const pct = Math.round(ratio * 100);
            alerts.push({
              id: `budget-threshold-${p.id}`,
              clientId: p.client_id ?? "",
              clientName,
              label: pct >= 100 ? "Over Budget" : "Budget Alert",
              description: `${pct}% of budget used${p.name ? ` — ${p.name}` : ""}`,
              severity: pct >= 100 ? "red" : "amber",
            });
          }
        });

      // Alert D: start date within 3 days with no FIO created yet
      const fioProjectIds = new Set((fioProjectsRes.data ?? []).map((f: any) => f.project_id));
      (startDateRes.data ?? [])
        .filter((p: any) => !p.client?.is_discarded && !fioProjectIds.has(p.id))
        .forEach((p: any) => {
          const clientName = p.client ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() : "—";
          const daysUntil = Math.ceil((new Date(p.start_date + "T00:00:00").getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: `start-date-no-fio-${p.id}`,
            clientId: p.client_id ?? "",
            clientName,
            label: "FIO Not Created",
            description: `Start date ${daysUntil <= 0 ? "today" : `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`} — no Field Installation Order yet`,
            severity: daysUntil <= 1 ? "red" : "amber",
          });
        });

      // Ghost PM alert: sold/active project with deactivated PM — admin only
      if (role === "admin") {
        (ghostPmRes.data ?? [])
          .filter((p: any) => !p.client?.is_discarded && p.pm?.is_active === false)
          .forEach((p: any) => {
            const clientName = p.client ? `${p.client.first_name ?? ""} ${p.client.last_name ?? ""}`.trim() : "—";
            const pmName = `${p.pm.first_name ?? ""} ${p.pm.last_name ?? ""}`.trim() || "PM";
            alerts.push({
              id: `ghost-pm-${p.id}`,
              clientId: p.client_id ?? "",
              clientName,
              label: "Inactive PM Assigned",
              description: `${pmName} is deactivated — reassign a PM to this job`,
              severity: "red",
            });
          });
      }

      // Pending commission reminder: alert admin when any rep has unpaid pending commission
      if (role === "admin") {
        const commissionByRep = new Map<string, { name: string; total: number }>();
        (commissionPendingRes.data ?? []).forEach((cp: any) => {
          if (!cp.profile_id) return;
          const existing = commissionByRep.get(cp.profile_id);
          const name = cp.profile ? `${cp.profile.first_name ?? ""} ${cp.profile.last_name ?? ""}`.trim() : "Team Member";
          commissionByRep.set(cp.profile_id, {
            name,
            total: (existing?.total ?? 0) + (Number(cp.amount) || 0),
          });
        });
        const fmtComm = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
        commissionByRep.forEach((data, profileId) => {
          if (data.total > 0) {
            alerts.push({
              id: `pending-commission-${profileId}`,
              clientId: "",
              clientName: data.name,
              label: "Pending Commission",
              description: `${data.name} has ${fmtComm(data.total)} in pending commission`,
              severity: "amber",
            });
          }
        });
      }

      // Scope alerts to assigned clients for PM and Sales Rep
      const finalAlerts = scopedClientIds
        ? alerts.filter((a) => a.clientId && scopedClientIds!.has(a.clientId))
        : alerts;

      setNavAlerts(finalAlerts);

      // Dismissed alerts stay dismissed permanently — no pruning.
      // Overdue payment alerts (overdue-*) are always visible regardless of dismissed state.
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAlerts(); }, []);
  useRealtimeRefetch(fetchAlerts, ["clients", "project_payments", "estimates", "appointments", "projects", "estimate_line_items", "field_installation_orders", "profiles", "commission_payments"], "nav-alerts");
  useRealtimeRefetch(fetchNotifications, ["notifications"], "nav-notifications");
  // Polling fallback so the bell updates even if realtime doesn't deliver (RLS) — every 30s while visible
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) fetchNotifications(); }, 30000);
    return () => clearInterval(id);
  }, []);

  // When View As Foreman activates, navigate to the foreman portal
  useEffect(() => {
    if (viewAsRole === "foreman") navigate("/foreman");
  }, [viewAsRole]);

  // When a View As role is selected, fetch members of that role for the banner picker
  useEffect(() => {
    if (!viewAsRole || viewAsRole === "foreman") { setViewAsMembers([]); return; }
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("role", viewAsRole)
      .order("first_name")
      .then(({ data }) => {
        setViewAsMembers((data ?? []).map((p: any) => ({
          id: p.id,
          name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        })));
      });
  }, [viewAsRole]);

  // My Profile modal state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", home_address: "" });
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
      home_address: (user?.profile as any)?.home_address ?? "",
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
      // Home address only applies to PMs/Sales Reps (mileage). Don't touch it for other roles.
      const isMileageRole = role === "project_manager" || role === "sales_rep";
      const payload: Record<string, unknown> = {
        first_name: profileForm.first_name,
        last_name:  profileForm.last_name,
        phone:      profileForm.phone,
      };
      if (isMileageRole) payload.home_address = profileForm.home_address.trim() || null;
      await usersAPI.update(user.profile.id, payload);
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
            {/* iPad portrait / phone (≤860px): hamburger → slide-out nav */}
            {isNarrow ? (
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <button aria-label="Open menu" className="p-2 -ml-2 rounded-md hover:bg-accent transition-colors">
                    <Menu className="h-6 w-6 text-foreground" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0 [&>button]:text-white [&>button]:opacity-100">
                  {/* Black company bar — matches the app's top business-name bar */}
                  <SheetTitle className="bg-black px-5 py-3 text-white text-xs font-medium tracking-widest uppercase text-left">
                    Butler &amp; Associates Construction, Inc.
                  </SheetTitle>
                  <nav className="flex flex-col gap-1 px-3 py-4">
                    {navigation.map((item) => {
                      const isActive = item.href === "/"
                        ? location.pathname === "/"
                        : location.pathname + location.search === item.href ||
                          (item.href.includes("?") ? false : location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors no-underline ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-accent"
                          }`}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            ) : (
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
            )}
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
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={async () => {
                        await notificationsAPI.markAllRead();
                        setCrewNotifications([]);
                        const allIds = navAlerts.map((a: any) => a.id ?? a.key ?? "").filter((id: string) => id && !id.startsWith("overdue-"));
                        setDismissedAlerts(prev => new Set([...prev, ...allIds]));
                        if (user?.profile?.id && allIds.length > 0) {
                          supabase.from("user_dismissed_alerts").insert(
                            allIds.map((alert_id: string) => ({ user_id: user.profile.id, alert_id }))
                          ).then(() => {});
                        }
                      }}
                    >
                      Mark all as read
                    </button>
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
                          {n.type === "proposal_accepted" || n.type === "change_order_approved" || n.type === "mileage_approved"
                            ? <FileCheck2 className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                            : n.type === "mileage_paid"
                            ? <FileCheck2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                            : n.type === "proposal_declined" || n.type === "change_order_rejected" || n.type === "mileage_denied"
                            ? <FileX2 className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                            : n.type === "docusign_completed" || n.type === "cert_docusign_completed"
                            ? <FileSignature className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                            : n.type === "mileage_deadline"
                            ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                            : n.type === "mileage_submitted"
                            ? <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                            : n.type === "email_bounced"
                            ? <MailX className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                            : <ClipboardCheck className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                n.type === "proposal_accepted" || n.type === "docusign_completed" || n.type === "cert_docusign_completed" || n.type === "change_order_approved" || n.type === "mileage_approved" ? "bg-green-100 text-green-700"
                                : n.type === "proposal_declined" || n.type === "change_order_rejected" || n.type === "mileage_denied" || n.type === "email_bounced" ? "bg-red-100 text-red-700"
                                : n.type === "mileage_deadline" || n.type === "mileage_submitted" ? "bg-amber-100 text-amber-700"
                                : n.type === "mileage_paid" ? "bg-blue-100 text-blue-700"
                                : "bg-blue-100 text-blue-700"
                              }`}>
                                {n.title}
                              </span>
                              {n.metadata?.client_name && (
                                <span className="text-xs font-medium truncate">{n.metadata.client_name}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <button
                                onClick={(e) => dismissNotification(n.id, e)}
                                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
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
                            {!alert.id.startsWith("overdue-") && (
                              <div className="flex items-center justify-end mt-0.5">
                                <button
                                  onClick={(e) => markAsRead(alert.id, e)}
                                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
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
                {(role === "project_manager" || role === "sales_rep") && (
                  <DropdownMenuItem className="cursor-pointer no-underline" onClick={() => navigate("/my-portal")}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    My Portal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {can("can_view_financials") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/financials")}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Financials
                  </DropdownMenuItem>
                )}
                {can("can_view_integrations") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/integrations")}>
                    <Plug className="mr-2 h-4 w-4" />
                    Integrations
                  </DropdownMenuItem>
                )}
                {can("can_manage_settings") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                )}
                {can("can_manage_team") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/team")}>
                    <UsersRound className="mr-2 h-4 w-4" />
                    Team
                  </DropdownMenuItem>
                )}
                {can("can_view_payroll") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/payroll")}>
                    <Banknote className="mr-2 h-4 w-4" />
                    Payroll
                  </DropdownMenuItem>
                )}
                {can("can_view_cost_attributions") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/cost-attributions")}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Cost Attributions
                  </DropdownMenuItem>
                )}
                {can("can_view_admin_portal") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/admin")}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Admin Portal
                  </DropdownMenuItem>
                )}
                {user?.profile?.role === "admin" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel><span className="text-xs text-muted-foreground font-normal">View As</span></DropdownMenuLabel>
                    {(["sales_rep", "project_manager", "foreman"] as const).map((r) => (
                      <DropdownMenuItem
                        key={r}
                        className="cursor-pointer"
                        onClick={() => setViewAsRole(r)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {viewAsRole === r && <span className="mr-1 text-primary font-bold">✓</span>}
                        {ROLE_LABELS[r]}
                      </DropdownMenuItem>
                    ))}
                    {viewAsRole && (
                      <DropdownMenuItem className="cursor-pointer text-amber-700 focus:text-amber-700" onClick={() => clearViewAs()}>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Exit View As
                      </DropdownMenuItem>
                    )}
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

      {/* View As banner */}
      {viewAsRole && (
        <div className="bg-amber-400 px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-900 shrink-0" />
            <span className="text-sm font-semibold text-amber-900">
              Viewing as {ROLE_LABELS[viewAsRole] ?? viewAsRole}
            </span>
            {viewAsMembers.length > 0 && (
              <select
                value={viewAsProfileId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const m = viewAsMembers.find((x) => x.id === id);
                  setViewAsProfile(id, m?.name ?? null);
                }}
                className="text-xs font-medium bg-amber-300 border border-amber-500 text-amber-900 rounded px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="">Select person...</option>
                {viewAsMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            {viewAsProfileName && (
              <span className="text-xs text-amber-800">— preview only, no data is changed</span>
            )}
          </div>
          <button onClick={() => clearViewAs()} className="text-xs font-bold text-amber-900 hover:text-amber-700 transition-colors">
            Exit View
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${location.pathname === "/cost-attributions" ? "overflow-hidden" : "overflow-auto"}`}>
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
              {(role === "project_manager" || role === "sales_rep") && (
                <div className="grid gap-1.5">
                  <Label>Home Address</Label>
                  <Input
                    placeholder="123 Main St, City, ST"
                    value={profileForm.home_address}
                    onChange={(e) => setProfileForm({ ...profileForm, home_address: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">Used to auto-suggest business vs. personal mileage trips (home → job site = business).</p>
                </div>
              )}
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
