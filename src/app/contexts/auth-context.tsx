import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, type Profile } from "@/lib/supabase";
import { toast } from "sonner";

interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isInviteFlow: boolean;
  permissions: Set<string>;
  can: (key: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isInviteFlow, setIsInviteFlow] = useState(
    () => window.location.hash.includes("type=invite") || window.location.hash.includes("type=recovery")
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "USER_UPDATED") setIsInviteFlow(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user.id, session.user.email!);
      } else {
        setUser(null);
        setPermissions(new Set());
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async (id: string, email: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setPermissions(new Set());
        toast.error("Your account has been deactivated. Please contact your administrator.");
        return;
      }

      setUser({ id, email, profile: profile ?? null });


      // Load permissions — per-user JSONB overrides role defaults
      if (profile?.role === "admin") {
        // Admin gets everything
        const { data: allPerms } = await supabase.from("permissions").select("key");
        setPermissions(new Set((allPerms ?? []).map((p: any) => p.key)));
      } else if (profile?.permissions && Object.keys(profile.permissions as object).length > 0) {
        // Per-user permissions stored on profile (set by invite flow and editable in user management)
        const keys = Object.entries(profile.permissions as Record<string, boolean>)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        setPermissions(new Set(keys));
      } else if (profile?.role) {
        // Fallback: load role-level defaults from role_permissions table
        const { data: rolePerms } = await supabase
          .from("role_permissions")
          .select("permission:permissions(key)")
          .eq("role_id",
            (await supabase.from("roles").select("id").eq("name", profile.role).single()).data?.id
          );
        const keys = (rolePerms ?? []).map((r: any) => r.permission?.key).filter(Boolean);
        setPermissions(new Set(keys));
      }
    } catch {
      setUser({ id, email, profile: null });
      setPermissions(new Set());
    } finally {
      setLoading(false);
    }
  };

  const can = (key: string): boolean => {
    if (user?.profile?.role === "admin") return true;
    return permissions.has(key);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      supabase.functions.invoke("log-failed-login", { body: { email } }).catch(() => {});
      throw new Error(error.message);
    }
    supabase.functions.invoke("log-login").catch(() => {});
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPermissions(new Set());
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadUser(user.id, user.email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isInviteFlow, permissions, can, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
