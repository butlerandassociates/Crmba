import { Navigate } from "react-router";
import { usePermissions } from "../hooks/usePermissions";

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  redirectTo?: string;
}

export function PermissionGuard({ permission, children, redirectTo = "/" }: PermissionGuardProps) {
  const { can } = usePermissions();
  if (!can(permission)) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
