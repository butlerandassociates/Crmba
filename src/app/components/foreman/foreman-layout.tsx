import { Outlet, Link, useLocation, Navigate } from "react-router";
import { useState } from "react";
import { HardHat, Briefcase, LogOut, ChevronDown, UserCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

const nav = [
  { name: "My Portal", href: "/foreman", icon: Briefcase },
];

export function ForemanLayout() {
  const location = useLocation();
  const { user, loading, signOut } = useAuth();

  // Profile modal state
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.profile?.role && user.profile.role !== "foreman") {
    return <Navigate to="/" replace />;
  }

  const displayName = user.profile
    ? `${user.profile.first_name ?? ""} ${user.profile.last_name ?? ""}`.trim() || user.email
    : user.email;

  const openProfile = () => {
    setProfileForm({
      first_name: user?.profile?.first_name ?? "",
      last_name:  user?.profile?.last_name  ?? "",
      phone:      (user?.profile as any)?.phone ?? "",
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
  const newPassErr      = !newPassword ? "New password is required." : newPassword.length < 8 ? "Minimum 8 characters." : "";
  const confirmPassErr  = !confirmPassword ? "Please confirm your password." : newPassword !== confirmPassword ? "Passwords do not match." : "";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileTouched(true);
    if (profileFnErr || profilePhoneErr) return;
    if (!user?.profile?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profileForm.first_name.trim(),
          last_name:  profileForm.last_name.trim(),
          phone:      profileForm.phone.trim(),
        })
        .eq("id", user.profile.id);
      if (error) throw error;
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

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Business name bar */}
      <div className="bg-black px-6 py-1.5">
        <p className="text-white text-xs font-medium tracking-widest uppercase text-center">
          Butler & Associates Construction, Inc.
        </p>
      </div>

      {/* Top Nav */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            <nav className="flex items-center gap-2 ml-4">
              {nav.map((item) => {
                const isActive =
                  item.href === "/foreman"
                    ? location.pathname === "/foreman"
                    : location.pathname.startsWith(item.href);
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
                    <span className="font-medium text-sm no-underline">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <HardHat className="h-4 w-4" />
                <span className="font-medium text-sm">{displayName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">Foreman</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={openProfile}>
                <UserCircle className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600" onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
                  <Badge className="text-xs">Foreman</Badge>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Account</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

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
