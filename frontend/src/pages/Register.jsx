import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth, defaultRouteFor } from "../lib/auth.jsx";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    companyName: "",
    address: "",
    city: "",
    postalCode: "",
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={defaultRouteFor(user.role)} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await register(form);
      navigate(defaultRouteFor(u.role), { replace: true });
    } catch (err) {
      if (err.message === "email_taken") {
        setError("Konto z tym adresem email już istnieje.");
      } else if (err.data?.error === "validation") {
        setError("Sprawdź wprowadzone dane. Hasło musi mieć co najmniej 8 znaków.");
      } else {
        setError("Rejestracja nie powiodła się. Spróbuj ponownie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">Rejestracja klienta</h1>
          <p className="text-slate-500 text-sm mt-1">Załóż konto, aby składać zamówienia</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={set("email")} required />
            </div>
            <div>
              <label className="label">Hasło (min. 8 znaków)</label>
              <input type="password" className="input" value={form.password} onChange={set("password")} required minLength={8} />
            </div>
            <div>
              <label className="label">Imię i nazwisko</label>
              <input className="input" value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.phone} onChange={set("phone")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Firma (opcjonalnie)</label>
              <input className="input" value={form.companyName} onChange={set("companyName")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Adres dostawy</label>
              <input className="input" value={form.address} onChange={set("address")} required />
            </div>
            <div>
              <label className="label">Miasto</label>
              <input className="input" value={form.city} onChange={set("city")} required />
            </div>
            <div>
              <label className="label">Kod pocztowy</label>
              <input className="input" value={form.postalCode} onChange={set("postalCode")} />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Rejestracja…" : "Utwórz konto"}
          </button>
          <p className="text-center text-sm text-slate-500">
            Masz już konto?{" "}
            <Link to="/login" className="text-brand-600 hover:underline">Zaloguj się</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
