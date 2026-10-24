import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { Health } from "../lib/types";

const authorLinks = [
  { to: "/books", label: "My Books" },
  { to: "/submit", label: "Submit Query" },
  { to: "/tickets", label: "My Tickets" },
];
const adminLinks = [{ to: "/admin", label: "Ticket Queue" }];

export function Layout() {
  const { user, role, logout } = useAuth();
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Health>("/api/health")
      .then((res) => {
        if (!cancelled) setAiEnabled(res.data.ai.enabled);
      })
      .catch(() => {
        if (!cancelled) setAiEnabled(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const links = role === "ADMIN" ? adminLinks : authorLinks;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              <span className="tracking-tight">BookLeaf</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user?.name} ·{" "}
              <span className="font-medium text-slate-700">{role === "ADMIN" ? "Admin" : "Author"}</span>
            </span>
            <button onClick={logout} className="btn-secondary px-3 py-1.5">
              Log out
            </button>
          </div>
        </div>
        {aiEnabled === false && (
          <div className="flex items-center justify-center gap-1.5 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            AI manual mode — automated drafting is disabled; responses are written manually.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl animate-fade-in px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
