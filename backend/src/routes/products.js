import { Router } from "express";
import { query } from "../db.js";

export const productsRouter = Router();

// Publiczny listing produktów
productsRouter.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, category, volume_ml, bottles_per_crate, price_per_bottle, active
     FROM products
     WHERE active = TRUE
     ORDER BY category, name`
  );
  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      volumeMl: p.volume_ml,
      bottlesPerCrate: p.bottles_per_crate,
      pricePerBottle: Number(p.price_per_bottle),
      active: p.active,
    }))
  );
});
