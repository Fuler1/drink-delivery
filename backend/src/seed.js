import bcrypt from "bcrypt";
import { query, withTx } from "./db.js";

const ADMIN_EMAIL = "admin@dostawa.pl";
const ADMIN_PASSWORD = "Admin1234!";

const PRODUCTS = [
  // Gazowane
  { name: "Tonic", category: "gazowane" },
  { name: "Grejfrut", category: "gazowane" },
  { name: "Tropic", category: "gazowane" },
  { name: "Kiwi", category: "gazowane" },
  { name: "Lima", category: "gazowane" },
  { name: "Ananas", category: "gazowane" },
  { name: "Brzoskwinia", category: "gazowane" },
  { name: "Orange", category: "gazowane" },
  { name: "Lemon", category: "gazowane" },
  { name: "Cola", category: "gazowane" },
  { name: "Oranżada czerwona", category: "gazowane" },
  { name: "Oranżada biała", category: "gazowane" },
  { name: "Cytryna czarny bez", category: "gazowane" },
  { name: "Mojito", category: "gazowane" },

  // Niegazowane
  { name: "Jabłko pomarańcza", category: "niegazowane" },
  { name: "Jabłko owoce leśne", category: "niegazowane" },
  { name: "Jabłko porzeczka", category: "niegazowane" },
  { name: "Jabłko wiśnia", category: "niegazowane" },
  { name: "Jabłko winogrono", category: "niegazowane" },
  { name: "Jabłko brzoskwinia", category: "niegazowane" },
  { name: "Jabłko", category: "niegazowane" },
  { name: "Jabłko gruszka", category: "niegazowane" },
  { name: "Jabłko mięta", category: "niegazowane" },
  { name: "Wieloowocowy", category: "niegazowane" },
  { name: "Herbata brzoskwinia", category: "niegazowane" },
  { name: "Herbata lemon", category: "niegazowane" },
  { name: "Herbata zielona", category: "niegazowane" },

  // Soki
  { name: "Pomarańczowy", category: "soki" },
  { name: "Grejfrutowy", category: "soki" },
  { name: "Jabłkowy", category: "soki" },
  { name: "Pomidorowy", category: "soki" },
  { name: "Nektar czarna porzeczka", category: "soki" },

  // Woda
  { name: "Gazowana", category: "woda" },
  { name: "Średnio gazowana", category: "woda" },
  { name: "Niegazowana", category: "woda" },
];

export async function runSeed() {
  // Products
  await withTx(async (client) => {
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products (name, category, volume_ml, bottles_per_crate)
         VALUES ($1, $2, 330, 24)
         ON CONFLICT (name, category) DO NOTHING`,
        [p.name, p.category]
      );
    }
  });

  // Admin account
  const { rows } = await query(`SELECT id FROM users WHERE email = $1`, [ADMIN_EMAIL]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'admin', 'Administrator')`,
      [ADMIN_EMAIL, hash]
    );
    console.log(`[seed] Utworzono konto admina: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  const { rows: productCount } = await query(`SELECT COUNT(*)::int AS n FROM products`);
  console.log(`[seed] Produkty w bazie: ${productCount[0].n}`);
}
