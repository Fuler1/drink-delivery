import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth, defaultRouteFor } from "../lib/auth.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={defaultRouteFor(user.role)} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      navigate(defaultRouteFor(u.role), { replace: true });
    } catch (err) {
      setError(err.message === "invalid_credentials"
        ? "Nieprawidłowy email lub hasło."
        : "Nie udało się zalogować. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">Dostawa Napojów</h1>
          <p className="text-slate-500 text-sm mt-1">Zaloguj się, aby kontynuować</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Hasło</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Logowanie…" : "Zaloguj"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Nie masz konta?{" "}
            <Link to="/register" className="text-brand-600 hover:underline">
              Zarejestruj się
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
