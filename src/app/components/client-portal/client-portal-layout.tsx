import { useState } from "react";
import { Outlet } from "react-router";
import { ClientLogin } from "./client-login";

export function ClientPortalLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (_email: string, _password: string) => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <ClientLogin onLogin={handleLogin} />;
  }

  return <Outlet />;
}
