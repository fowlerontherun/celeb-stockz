import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth-client";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <NeonAuthUIProvider
    authClient={authClient}
    defaultTheme="dark"
    navigate={(href) => navigate(href)}
    replace={(href) => navigate(href, { replace: true })}
    Link={({ href, ...props }) => <Link to={href} {...props} />}
  >
    {children}
  </NeonAuthUIProvider>;
}
