/**
 * Klient HTTP z automatycznym odświeżaniem access tokenu.
 *
 * - Access token trzymamy w pamięci (getter/setter), refresh token w localStorage.
 * - Przy 401 próbujemy raz odświeżyć token i powtórzyć oryginalne żądanie.
 * - Równoległe żądania podczas odświeżania kolejkują się na wspólnym promise'ie.
 */
 
const ENV_URL = (import.meta.env.VITE_API_URL || "").trim();
const BASE_URL =
  ENV_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : "http://localhost:4000");
 
const ACCESS_KEY = "dd.accessToken";
const REFRESH_KEY = "dd.refreshToken";
const USER_KEY = "dd.user";
 
let inMemoryAccess = sessionStorage.getItem(ACCESS_KEY) || null;
 
export const tokens = {
  getAccess() {
    return inMemoryAccess;
  },
  getRefresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens({ accessToken, refreshToken } = {}) {
    if (accessToken !== undefined) {
      inMemoryAccess = accessToken || null;
      if (accessToken) {
        sessionStorage.setItem(ACCESS_KEY, accessToken);
      } else {
        sessionStorage.removeItem(ACCESS_KEY);
      }
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        localStorage.setItem(REFRESH_KEY, refreshToken);
      } else {
        localStorage.removeItem(REFRESH_KEY);
      }
    }
  },
  setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  },
  getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear() {
    inMemoryAccess = null;
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
 
let refreshPromise = null;
let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}
 
async function rawRequest(path, opts = {}, withAuth = true) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (withAuth && inMemoryAccess) {
    headers.Authorization = `Bearer ${inMemoryAccess}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res;
}
 
async function doRefresh() {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) throw new Error("no_refresh");
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new Error("refresh_failed");
  }
  const data = await res.json();
  tokens.setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  if (data.user) tokens.setUser({ ...tokens.getUser(), ...data.user });
  return data.accessToken;
}
 
export async function apiFetch(path, opts = {}) {
  let res = await rawRequest(path, opts, true);
 
  if (res.status === 401 && tokens.getRefresh()) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      res = await rawRequest(path, opts, true);
    } catch {
      tokens.clear();
      if (onUnauthorized) onUnauthorized();
      throw new Error("unauthorized");
    }
  }
 
  const text = await res.text();
  const data = text ? safeParse(text) : null;
 
  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
 
function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}
 
// Convenience
export const api = {
  get: (p) => apiFetch(p, { method: "GET" }),
  post: (p, body) => apiFetch(p, { method: "POST", body }),
  patch: (p, body) => apiFetch(p, { method: "PATCH", body }),
  del: (p) => apiFetch(p, { method: "DELETE" }),
};
 
// Auth-specific calls that bypass interceptor state
export async function loginRequest(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || "login_failed");
    err.data = data;
    throw err;
  }
  return res.json();
}
 
export async function registerRequest(payload) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || "register_failed");
    err.data = data;
    throw err;
  }
  return res.json();
}
 
export async function logoutRequest() {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) return;
  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // ignore
  }
}