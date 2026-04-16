import { Outlet, Link, useLocation, Navigate } from "react-router";
import { HardHat, Briefcase, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/auth-context";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const nav = [
  { name: "My Portal", href: "/foreman", icon: Briefcase },
];

export function ForemanLayout() {
  const location = useLocation();
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Non-foreman users should go to the main app
  if (user.profile?.role && user.profile.role !== "foreman") {
    return <Navigate to="/" replace />;
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
                    <span className="font-medium text-sm">{item.name}</span>
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
    </div>
  );
}
