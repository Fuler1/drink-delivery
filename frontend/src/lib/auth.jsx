import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  api,
  loginRequest,
  registerRequest,
  logoutRequest,
  tokens,
  setOnUnauthorized,
} from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokens.getUser());
  const [loading, setLoading] = useState(Boolean(tokens.getRefresh()));

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
    });
  }, []);

  // On mount, if we have a refresh token but no user (or stale), try /me
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!tokens.getRefresh()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get("/api/auth/me");
        if (!cancelled) {
          setUser(me);
          tokens.setUser(me);
        }
      } catch {
        if (!cancelled) {
          tokens.clear();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    tokens.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    tokens.setUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerRequest(payload);
    tokens.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    tokens.setUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    tokens.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Ładowanie…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteFor(user.role)} replace />;
  }
  return children;
}

export function defaultRouteFor(role) {
  switch (role) {
    case "admin": return "/admin";
    case "driver": return "/driver";
    case "client": return "/client";
    default: return "/login";
  }
}
