import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(authRequired, requireRole("admin"));

adminRouter.get("/users", async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.full_name, u.phone, u.created_at,
            c.address, c.city, c.company_name
     FROM users u
     LEFT JOIN clients c ON c.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  res.json(
    rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.full_name,
      phone: u.phone,
      createdAt: u.created_at,
      address: u.address,
      city: u.city,
      companyName: u.company_name,
    }))
  );
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["driver", "admin"]),
  fullName: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [data.email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: "email_taken" });
    }
    const hash = await bcrypt.hash(data.password, 12);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, role, full_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, full_name, phone, created_at`,
      [data.email, hash, data.role, data.fullName, data.phone || null]
    );
    const u = rows[0];
    res.status(201).json({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.full_name,
      phone: u.phone,
      createdAt: u.created_at,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation", issues: err.issues });
    }
    next(err);
  }
});

adminRouter.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "cannot_delete_self" });
  }
  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});
