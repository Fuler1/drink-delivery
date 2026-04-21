import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

import { query, withTx } from "../db.js";
import {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from "../tokens.js";
import { authRequired } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  fullName: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  postalCode: z.string().max(20).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
});

// Klient rejestruje się samodzielnie. Kierowców tworzy admin.
authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [data.email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: "email_taken" });
    }
    const hash = await bcrypt.hash(data.password, 12);

    const user = await withTx(async (client) => {
      const { rows: uRows } = await client.query(
        `INSERT INTO users (email, password_hash, role, full_name, phone)
         VALUES ($1, $2, 'client', $3, $4)
         RETURNING id, email, role, full_name`,
        [data.email, hash, data.fullName, data.phone || null]
      );
      const user = uRows[0];
      await client.query(
        `INSERT INTO clients (user_id, company_name, address, city, postal_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user.id,
          data.companyName || null,
          data.address,
          data.city,
          data.postalCode || null,
        ]
      );
      return user;
    });

    const accessToken = signAccessToken(user);
    const { token: refreshToken } = await issueRefreshToken(user.id);
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation", issues: err.issues });
    }
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await query(
      `SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const accessToken = signAccessToken(user);
    const { token: refreshToken } = await issueRefreshToken(user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation", issues: err.issues });
    }
    next(err);
  }
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: "missing_refresh" });
  }
  try {
    const { tokenId, user } = await verifyRefreshToken(refreshToken);

    // Rotation: revoke old, issue new
    const { token: newRefresh } = await issueRefreshToken(user.id, tokenId);
    const accessToken = signAccessToken(user);
    res.json({
      accessToken,
      refreshToken: newRefresh,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(401).json({ error: err.message || "invalid_refresh" });
  }
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  res.json({ ok: true });
});

authRouter.get("/me", authRequired, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.full_name, u.phone,
            c.id AS client_id, c.company_name, c.address, c.city, c.postal_code
     FROM users u
     LEFT JOIN clients c ON c.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "not_found" });
  const u = rows[0];
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.full_name,
    phone: u.phone,
    client: u.client_id
      ? {
          id: u.client_id,
          companyName: u.company_name,
          address: u.address,
          city: u.city,
          postalCode: u.postal_code,
        }
      : null,
  });
});
