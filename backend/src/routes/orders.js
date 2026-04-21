import { Router } from "express";
import { z } from "zod";

import { query, withTx } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  note: z.string().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        crates: z.number().int().min(0).default(0),
        bottles: z.number().int().min(0).default(0),
      })
    )
    .min(1),
});

// Klient składa zamówienie
ordersRouter.post("/", authRequired, requireRole("client"), async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);

    // Pobierz client_id z tokenu -> users -> clients
    const { rows: cRows } = await query(
      `SELECT id FROM clients WHERE user_id = $1`,
      [req.user.id]
    );
    if (cRows.length === 0) {
      return res.status(400).json({ error: "client_profile_missing" });
    }
    const clientId = cRows[0].id;

    // Walidacja: każda pozycja musi mieć crates>0 lub bottles>0
    for (const it of data.items) {
      if (it.crates + it.bottles <= 0) {
        return res.status(400).json({ error: "empty_line_item" });
      }
    }

    const order = await withTx(async (client) => {
      const { rows: oRows } = await client.query(
        `INSERT INTO orders (client_id, delivery_date, note)
         VALUES ($1, $2, $3)
         RETURNING id, client_id, delivery_date, status, note, created_at`,
        [clientId, data.deliveryDate, data.note || null]
      );
      const order = oRows[0];
      for (const it of data.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, crates, bottles)
           VALUES ($1, $2, $3, $4)`,
          [order.id, it.productId, it.crates, it.bottles]
        );
      }
      return order;
    });

    res.status(201).json({
      id: order.id,
      deliveryDate: order.delivery_date,
      status: order.status,
      note: order.note,
      createdAt: order.created_at,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation", issues: err.issues });
    }
    if (err.code === "23503") {
      // FK violation → nieprawidłowe productId
      return res.status(400).json({ error: "invalid_product" });
    }
    next(err);
  }
});

// Historia zamówień zalogowanego klienta
ordersRouter.get("/my", authRequired, requireRole("client"), async (req, res) => {
  const { rows: cRows } = await query(
    `SELECT id FROM clients WHERE user_id = $1`,
    [req.user.id]
  );
  if (cRows.length === 0) return res.json([]);
  const clientId = cRows[0].id;

  const { rows } = await query(
    `SELECT o.id, o.delivery_date, o.status, o.note, o.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', p.id,
                  'productName', p.name,
                  'category', p.category,
                  'crates', oi.crates,
                  'bottles', oi.bottles
                ) ORDER BY p.category, p.name
              ) FILTER (WHERE oi.id IS NOT NULL),
              '[]'
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.client_id = $1
     GROUP BY o.id
     ORDER BY o.delivery_date DESC, o.created_at DESC`,
    [clientId]
  );

  res.json(
    rows.map((o) => ({
      id: o.id,
      deliveryDate: o.delivery_date,
      status: o.status,
      note: o.note,
      createdAt: o.created_at,
      items: o.items,
    }))
  );
});

// Panel kierowcy/admina — agregaty + lista dostaw na dany dzień
ordersRouter.get(
  "/daily",
  authRequired,
  requireRole("driver", "admin"),
  async (req, res) => {
    const date = (req.query.date || "").toString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "invalid_date" });
    }

    // Agregaty per produkt: suma skrzynek + luzem butelek
    const { rows: aggRows } = await query(
      `SELECT p.id AS product_id, p.name, p.category,
              p.bottles_per_crate,
              SUM(oi.crates)::int AS total_crates,
              SUM(oi.bottles)::int AS total_bottles
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.delivery_date = $1
         AND o.status <> 'cancelled'
       GROUP BY p.id, p.name, p.category, p.bottles_per_crate
       ORDER BY p.category, p.name`,
      [date]
    );

    // Lista adresów z pozycjami
    const { rows: orderRows } = await query(
      `SELECT o.id, o.status, o.note, o.created_at,
              c.id AS client_id, c.company_name, c.address, c.city, c.postal_code,
              u.full_name, u.phone, u.email,
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', p.id,
                    'productName', p.name,
                    'category', p.category,
                    'crates', oi.crates,
                    'bottles', oi.bottles
                  ) ORDER BY p.category, p.name
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.delivery_date = $1
       GROUP BY o.id, c.id, u.id
       ORDER BY o.status, c.city, c.address`,
      [date]
    );

    res.json({
      date,
      aggregates: aggRows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        category: r.category,
        bottlesPerCrate: r.bottles_per_crate,
        totalCrates: r.total_crates || 0,
        totalBottles: r.total_bottles || 0,
      })),
      deliveries: orderRows.map((o) => ({
        id: o.id,
        status: o.status,
        note: o.note,
        createdAt: o.created_at,
        client: {
          id: o.client_id,
          companyName: o.company_name,
          address: o.address,
          city: o.city,
          postalCode: o.postal_code,
          fullName: o.full_name,
          phone: o.phone,
          email: o.email,
        },
        items: o.items,
      })),
    });
  }
);

// Admin — lista wszystkich zamówień
ordersRouter.get(
  "/",
  authRequired,
  requireRole("admin"),
  async (_req, res) => {
    const { rows } = await query(
      `SELECT o.id, o.delivery_date, o.status, o.note, o.created_at,
              c.company_name, c.address, c.city,
              u.full_name, u.email,
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', p.id,
                    'productName', p.name,
                    'category', p.category,
                    'crates', oi.crates,
                    'bottles', oi.bottles
                  ) ORDER BY p.category, p.name
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       GROUP BY o.id, c.id, u.id
       ORDER BY o.delivery_date DESC, o.created_at DESC`
    );
    res.json(
      rows.map((o) => ({
        id: o.id,
        deliveryDate: o.delivery_date,
        status: o.status,
        note: o.note,
        createdAt: o.created_at,
        client: {
          companyName: o.company_name,
          address: o.address,
          city: o.city,
          fullName: o.full_name,
          email: o.email,
        },
        items: o.items,
      }))
    );
  }
);

const statusSchema = z.object({
  status: z.enum(["pending", "in_progress", "delivered", "cancelled"]),
});

ordersRouter.patch(
  "/:id/status",
  authRequired,
  requireRole("driver", "admin"),
  async (req, res, next) => {
    try {
      const { status } = statusSchema.parse(req.body);
      const { rows } = await query(
        `UPDATE orders SET status = $1 WHERE id = $2
         RETURNING id, delivery_date, status`,
        [status, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: "not_found" });
      res.json({
        id: rows[0].id,
        deliveryDate: rows[0].delivery_date,
        status: rows[0].status,
      });
    } catch (err) {
      if (err.name === "ZodError") {
        return res.status(400).json({ error: "validation", issues: err.issues });
      }
      next(err);
    }
  }
);
