import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, TOKEN_KEY, USER_KEY } from "../lib/api";
import type { Role, User } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [loading, setLoading] = useState(true);

  // Bootstrap: if we have a token, confirm it against /api/auth/me.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ user: User }>("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        setUser(res.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      loading,
      login,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
