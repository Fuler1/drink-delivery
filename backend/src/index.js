import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { runSeed } from "./seed.js";
import { pool } from "./db.js";

const app = express();

// --- CORS ---
// CORS_ORIGINS = lista origin-ow rozdzielonych przecinkami.
// Dodatkowo zawsze dopuszczamy LAN-owe (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, 127.0.0.1),
// co jest wygodne przy telefonie laczacym sie przez Wi-Fi i zmieniajacym IP.
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const LAN_ORIGIN_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

app.use(
  cors({
    origin(origin, cb) {
      // brak Origin = same-origin / curl / server-to-server — puszczamy
      if (!origin) return cb(null, true);
      if (corsOrigins.includes("*")) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      if (LAN_ORIGIN_RE.test(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/products", productsRouter);

// Fallthrough error handler
app.use((err, _req, res, _next) => {
  console.error("[api] error:", err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: err.code || "internal_error",
    message: err.message,
  });
});

const port = Number(process.env.PORT || 4000);

async function start() {
  // Wait a moment and retry — Postgres may still be warming up even after healthcheck
  const maxRetries = 15;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.log("[api] waiting for db…");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  try {
    await runSeed();
  } catch (err) {
    console.error("[api] seed failed:", err);
  }

  // 0.0.0.0 => nasluchuje na wszystkich interfejsach (localhost + LAN)
  app.listen(port, "0.0.0.0", () => {
    console.log(
      `[api] listening on :${port}, CORS origins: ${JSON.stringify(corsOrigins)} + LAN`
    );
  });
}

start().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
