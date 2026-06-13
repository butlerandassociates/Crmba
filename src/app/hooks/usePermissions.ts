import { useAuth } from "../contexts/auth-context";
import { useViewAs } from "../contexts/view-as-context";

export function usePermissions() {
  const { can, permissions, user } = useAuth();
  const { viewAsRole, viewAsPermissions } = useViewAs();

  const realRole = user?.profile?.role ?? null;
  const isAdmin = realRole === "admin";
  const effectiveRole = (isAdmin && viewAsRole) ? viewAsRole : realRole;

  const effectiveCan = (key: string): boolean => {
    if (isAdmin && viewAsRole) return viewAsPermissions.has(key);
    return can(key);
  };

  const effectivePermissions = (isAdmin && viewAsRole) ? viewAsPermissions : permissions;

  return { can: effectiveCan, permissions: effectivePermissions, role: effectiveRole };
}
