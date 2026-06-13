import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface ViewAsContextType {
  viewAsRole: string | null;
  setViewAsRole: (role: string | null) => Promise<void>;
  viewAsPermissions: Set<string>;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAsRole: null,
  setViewAsRole: async () => {},
  viewAsPermissions: new Set(),
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsRole, setViewAsRoleState] = useState<string | null>(null);
  const [viewAsPermissions, setViewAsPermissions] = useState<Set<string>>(new Set());

  const setViewAsRole = useCallback(async (role: string | null) => {
    if (!role) {
      setViewAsRoleState(null);
      setViewAsPermissions(new Set());
      return;
    }
    try {
      const { data: roleRow } = await supabase
        .from("roles")
        .select("id")
        .eq("name", role)
        .single();
      if (roleRow?.id) {
        const { data: rolePerms } = await supabase
          .from("role_permissions")
          .select("permission:permissions(key)")
          .eq("role_id", roleRow.id);
        const keys = (rolePerms ?? []).map((r: any) => r.permission?.key).filter(Boolean);
        setViewAsPermissions(new Set(keys));
      } else {
        setViewAsPermissions(new Set());
      }
    } catch {
      setViewAsPermissions(new Set());
    }
    setViewAsRoleState(role);
  }, []);

  return (
    <ViewAsContext.Provider value={{ viewAsRole, setViewAsRole, viewAsPermissions }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
