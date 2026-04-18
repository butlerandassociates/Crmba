import { useAuth } from "../contexts/auth-context";

export function usePermissions() {
  const { can, permissions, user } = useAuth();
  return { can, permissions, role: user?.profile?.role ?? null };
}
