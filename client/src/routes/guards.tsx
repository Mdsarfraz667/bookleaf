import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../lib/types";

/** Where each role goes by default. */
export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/books";
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">{children}</div>;
}

/** Require any authenticated user; wait for bootstrap before deciding. */
export function RequireAuth() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Require a specific role; send mismatched users to their own home. */
export function RequireRole({ role }: { role: Role }) {
  const { role: currentRole, loading } = useAuth();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!currentRole) return <Navigate to="/login" replace />;
  if (currentRole !== role) return <Navigate to={homePathFor(currentRole)} replace />;
  return <Outlet />;
}

/** Keep authenticated users off the login page. */
export function PublicOnly() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (isAuthenticated && role) return <Navigate to={homePathFor(role)} replace />;
  return <Outlet />;
}

/** Redirect "/" to the right home per role. */
export function HomeRedirect() {
  const { role, loading } = useAuth();
  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(role)} replace />;
}
