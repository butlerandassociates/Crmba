import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface ViewAsContextType {
  viewAsRole: string | null;
  viewAsProfileId: string | null;
  viewAsProfileName: string | null;
  viewAsPermissions: Set<string>;
  setViewAsRole: (role: string | null) => Promise<void>;
  setViewAsProfile: (id: string | null, name: string | null) => void;
  clearViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextType>({
  viewAsRole: null,
  viewAsProfileId: null,
  viewAsProfileName: null,
  viewAsPermissions: new Set(),
  setViewAsRole: async () => {},
  setViewAsProfile: () => {},
  clearViewAs: () => {},
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsRole, setViewAsRoleState] = useState<string | null>(null);
  const [viewAsProfileId, setViewAsProfileId] = useState<string | null>(null);
  const [viewAsProfileName, setViewAsProfileName] = useState<string | null>(null);
  const [viewAsPermissions, setViewAsPermissions] = useState<Set<string>>(new Set());

  const setViewAsRole = useCallback(async (role: string | null) => {
    // Reset person when role changes
    setViewAsProfileId(null);
    setViewAsProfileName(null);

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

  const setViewAsProfile = useCallback((id: string | null, name: string | null) => {
    setViewAsProfileId(id);
    setViewAsProfileName(name);
  }, []);

  const clearViewAs = useCallback(() => {
    setViewAsRoleState(null);
    setViewAsProfileId(null);
    setViewAsProfileName(null);
    setViewAsPermissions(new Set());
  }, []);

  return (
    <ViewAsContext.Provider value={{ viewAsRole, viewAsProfileId, viewAsProfileName, viewAsPermissions, setViewAsRole, setViewAsProfile, clearViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
