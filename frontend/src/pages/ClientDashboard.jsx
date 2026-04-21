import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/api.js";
import TopBar from "../components/TopBar.jsx";

const CATEGORY_LABEL = {
  gazowane: "Napoje gazowane",
  niegazowane: "Napoje niegazowane",
  soki: "Soki",
  woda: "Woda",
};

const STATUS_LABEL = {
  pending: "Oczekuje",
  in_progress: "W realizacji",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
};

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ClientDashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [note, setNote] = useState("");
  const [qty, setQty] = useState({}); // productId -> { crates, bottles }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  async function refresh() {
    const [p, o] = await Promise.all([
      api.get("/api/products"),
      api.get("/api/orders/my"),
    ]);
    setProducts(p);
    setOrders(o);
  }

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    for (const p of products) {
      if (!g[p.category]) g[p.category] = [];
      g[p.category].push(p);
    }
    return g;
  }, [products]);

  function updateQty(id, field, value) {
    const v = Math.max(0, Number(value) || 0);
    setQty((q) => ({
      ...q,
      [id]: { crates: q[id]?.crates || 0, bottles: q[id]?.bottles || 0, [field]: v },
    }));
  }

  function clearOrder() {
    setQty({});
    setNote("");
  }

  async function submitOrder(e) {
    e.preventDefault();
    setMessage(null);
    const items = Object.entries(qty)
      .map(([productId, v]) => ({
        productId,
        crates: v.crates || 0,
        bottles: v.bottles || 0,
      }))
      .filter((it) => it.crates + it.bottles > 0);

    if (items.length === 0) {
      setMessage({ type: "error", text: "Dodaj co najmniej jedną pozycję." });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/orders", {
        deliveryDate,
        note: note || null,
        items,
      });
      setMessage({ type: "ok", text: "Zamówienie złożone." });
      clearOrder();
      await refresh();
    } catch (err) {
      setMessage({ type: "error", text: "Nie udało się złożyć zamówienia." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Panel klienta" />
        <div className="p-8 text-slate-500">Ładowanie…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Panel klienta" />
      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <form onSubmit={submitOrder} className="card space-y-4">
            <h2 className="text-lg font-semibold">Nowe zamówienie</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Data dostawy</label>
                <input
                  type="date"
                  className="input"
                  min={today()}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Uwagi (opcjonalnie)</label>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="np. dostawa do godz. 10:00"
                />
              </div>
            </div>

            {Object.keys(grouped).map((cat) => (
              <div key={cat}>
                <h3 className="font-semibold text-slate-700 mb-2">
                  {CATEGORY_LABEL[cat] || cat}
                </h3>
                <div className="rounded-md border border-slate-200 divide-y divide-slate-200">
                  {grouped[cat].map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center p-3"
                    >
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.volumeMl} ml · {p.bottlesPerCrate} szt./skrzynka
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600 w-16 sm:w-auto">Skrzynki</span>
                        <input
                          type="number"
                          min={0}
                          className="input w-24"
                          value={qty[p.id]?.crates ?? ""}
                          onChange={(e) => updateQty(p.id, "crates", e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600 w-16 sm:w-auto">Butelki</span>
                        <input
                          type="number"
                          min={0}
                          className="input w-24"
                          value={qty[p.id]?.bottles ?? ""}
                          onChange={(e) => updateQty(p.id, "bottles", e.target.value)}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {message && (
              <div
                className={
                  message.type === "ok"
                    ? "bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm"
                    : "bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm"
                }
              >
                {message.text}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Wysyłanie…" : "Złóż zamówienie"}
              </button>
              <button type="button" className="btn-secondary" onClick={clearOrder}>
                Wyczyść
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-semibold mb-2">Historia zamówień</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500">Brak zamówień.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <li key={o.id} className="border border-slate-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">Dostawa: {o.deliveryDate}</div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                    <ul className="text-sm text-slate-600 space-y-0.5">
                      {o.items.map((it, i) => (
                        <li key={i}>
                          {it.productName}:{" "}
                          {it.crates > 0 && <>{it.crates} skr.</>}
                          {it.crates > 0 && it.bottles > 0 && " + "}
                          {it.bottles > 0 && <>{it.bottles} szt.</>}
                        </li>
                      ))}
                    </ul>
                    {o.note && (
                      <div className="text-xs text-slate-500 mt-1">
                        Uwagi: {o.note}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </>
  );
}
