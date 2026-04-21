import { useEffect, useState } from "react";

import { api } from "../lib/api.js";
import TopBar from "../components/TopBar.jsx";

const CATEGORY_LABEL = {
  gazowane: "Napoje gazowane",
  niegazowane: "Napoje niegazowane",
  soki: "Soki",
  woda: "Woda",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Oczekuje" },
  { value: "in_progress", label: "W realizacji" },
  { value: "delivered", label: "Dostarczone" },
  { value: "cancelled", label: "Anulowane" },
];

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DriverDashboard() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load(d) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/orders/daily?date=${d}`);
      setData(res);
    } catch {
      setError("Nie udało się wczytać danych.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(date); }, [date]);

  async function changeStatus(orderId, status) {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status });
      await load(date);
    } catch {
      setError("Nie udało się zmienić statusu.");
    }
  }

  // Grupuj agregaty po kategorii
  const grouped = {};
  if (data?.aggregates) {
    for (const a of data.aggregates) {
      if (!grouped[a.category]) grouped[a.category] = [];
      grouped[a.category].push(a);
    }
  }

  return (
    <>
      <TopBar title="Panel kierowcy" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="card flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="label">Data dostawy</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={() => load(date)}>
            Odśwież
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {loading && <div className="text-slate-500 text-sm">Ładowanie…</div>}

        {!loading && data && (
          <>
            <section className="card">
              <h2 className="text-lg font-semibold mb-3">
                Zapotrzebowanie na {date}
              </h2>
              {data.aggregates.length === 0 ? (
                <p className="text-sm text-slate-500">Brak zamówień na ten dzień.</p>
              ) : (
                <div className="space-y-4">
                  {Object.keys(grouped).map((cat) => (
                    <div key={cat}>
                      <h3 className="font-semibold text-slate-700 mb-1">
                        {CATEGORY_LABEL[cat] || cat}
                      </h3>
                      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                        {grouped[cat].map((a) => (
                          <li
                            key={a.productId}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <span className="font-medium">{a.name}</span>
                            <span className="text-sm text-slate-700 tabular-nums">
                              {a.totalCrates > 0 && <><strong>{a.totalCrates}</strong> skr.</>}
                              {a.totalCrates > 0 && a.totalBottles > 0 && " + "}
                              {a.totalBottles > 0 && <><strong>{a.totalBottles}</strong> szt.</>}
                              {a.totalCrates === 0 && a.totalBottles === 0 && "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="text-lg font-semibold mb-3">
                Lista dostaw ({data.deliveries.length})
              </h2>
              {data.deliveries.length === 0 ? (
                <p className="text-sm text-slate-500">Brak dostaw.</p>
              ) : (
                <ul className="space-y-3">
                  {data.deliveries.map((d) => (
                    <li key={d.id} className="border border-slate-200 rounded-md p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {d.client.companyName || d.client.fullName}
                          </div>
                          <div className="text-sm text-slate-600">
                            {d.client.address}
                            {d.client.city && `, ${d.client.city}`}
                            {d.client.postalCode && ` (${d.client.postalCode})`}
                          </div>
                          <div className="text-xs text-slate-500">
                            {d.client.fullName}
                            {d.client.phone && ` · ${d.client.phone}`}
                          </div>
                        </div>
                        <select
                          value={d.status}
                          onChange={(e) => changeStatus(d.id, e.target.value)}
                          className="input max-w-[160px]"
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <ul className="text-sm text-slate-700 space-y-0.5">
                        {d.items.map((it, i) => (
                          <li key={i}>
                            • {it.productName}:{" "}
                            {it.crates > 0 && <>{it.crates} skr.</>}
                            {it.crates > 0 && it.bottles > 0 && " + "}
                            {it.bottles > 0 && <>{it.bottles} szt.</>}
                          </li>
                        ))}
                      </ul>
                      {d.note && (
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                          Uwagi: {d.note}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
