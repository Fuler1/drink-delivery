import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";

import { api } from "../lib/api.js";
import TopBar from "../components/TopBar.jsx";

const STATUS_LABEL = {
  pending: "Oczekuje",
  in_progress: "W realizacji",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
};

function tabClass({ isActive }) {
  return [
    "px-3 py-1.5 rounded-md text-sm font-medium",
    isActive
      ? "bg-brand-600 text-white"
      : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

export default function AdminDashboard() {
  return (
    <>
      <TopBar title="Panel admina">
        <nav className="flex gap-1">
          <NavLink to="/admin" end className={tabClass}>Użytkownicy</NavLink>
          <NavLink to="/admin/orders" className={tabClass}>Zamówienia</NavLink>
          <NavLink to="/driver" className={tabClass}>Widok kierowcy</NavLink>
        </nav>
      </TopBar>
      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route index element={<UsersTab />} />
          <Route path="orders" element={<OrdersTab />} />
        </Routes>
      </main>
    </>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "driver",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const list = await api.get("/api/admin/users");
      setUsers(list);
    } catch {
      setError("Nie udało się wczytać użytkowników.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function createUser(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post("/api/admin/users", form);
      setForm({ email: "", password: "", fullName: "", phone: "", role: "driver" });
      await load();
    } catch (err) {
      if (err.message === "email_taken") {
        setFormError("Konto z tym emailem już istnieje.");
      } else {
        setFormError("Nie udało się utworzyć konta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function removeUser(id) {
    if (!confirm("Usunąć tego użytkownika?")) return;
    try {
      await api.del(`/api/admin/users/${id}`);
      await load();
    } catch {
      alert("Nie udało się usunąć użytkownika.");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 card">
        <h2 className="text-lg font-semibold mb-3">Użytkownicy</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Ładowanie…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Imię i nazwisko</th>
                  <th className="py-2 pr-3">Rola</th>
                  <th className="py-2 pr-3">Telefon</th>
                  <th className="py-2 pr-3">Adres</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3">{u.fullName}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{u.phone || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {u.address ? `${u.address}${u.city ? ", " + u.city : ""}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        className="text-red-600 hover:underline text-sm"
                        onClick={() => removeUser(u.id)}
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold mb-3">Nowe konto (kierowca/admin)</h2>
        <form onSubmit={createUser} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <label className="label">Hasło</label>
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
          <div>
            <label className="label">Rola</label>
            <select className="input" value={form.role} onChange={set("role")}>
              <option value="driver">Kierowca</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
              {formError}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Tworzenie…" : "Utwórz konto"}
          </button>
        </form>
      </section>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const list = await api.get("/api/orders");
      setOrders(list);
    } catch {
      setError("Nie udało się wczytać zamówień.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-3">Wszystkie zamówienia</h2>
      {loading ? (
        <p className="text-sm text-slate-500">Ładowanie…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500">Brak zamówień.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="border border-slate-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium">
                  {o.deliveryDate} — {o.client.companyName || o.client.fullName}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {STATUS_LABEL[o.status] || o.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-1">
                {o.client.fullName} · {o.client.email} · {o.client.address}
                {o.client.city && `, ${o.client.city}`}
              </div>
              <ul className="text-sm text-slate-700">
                {o.items.map((it, i) => (
                  <li key={i}>
                    • {it.productName}:{" "}
                    {it.crates > 0 && <>{it.crates} skr.</>}
                    {it.crates > 0 && it.bottles > 0 && " + "}
                    {it.bottles > 0 && <>{it.bottles} szt.</>}
                  </li>
                ))}
              </ul>
              {o.note && (
                <div className="text-xs text-slate-500 mt-1">Uwagi: {o.note}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
