import { useState } from "react";
import { Outlet } from "react-router";
import { ClientLogin } from "./client-login";

export function ClientPortalLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = (email: string, password: string) => {
    // Simple demo authentication - in production this would call an API
    console.log('Client logging in with:', email);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <ClientLogin onLogin={handleLogin} />;
  }

  return <Outlet />;
}
