# Drink Delivery — System zamówień napojów

Aplikacja do obsługi lokalnej dostawy napojów. Trzy role: **klient**, **kierowca**, **admin**.

## Szybki start

```bash
cd drink-delivery
cp .env.example .env   # opcjonalnie, docker-compose.yml ma już wartości domyślne
docker compose up --build
```

Usługi:

- Frontend: http://localhost:5173
- API: http://localhost:4000
- Postgres: localhost:5432 (user: `drinks`, pass: `drinks`)

## Konto administratora (po seedzie)

```
email:    admin@dostawa.pl
hasło:    Admin1234!
```

## Struktura

```
drink-delivery/
├── docker-compose.yml
├── .env.example
├── backend/       Node 20 + Express + PostgreSQL
└── frontend/      React 18 + Vite + Tailwind
```

## Seed

Schema (`backend/schema.sql`) jest ładowana automatycznie przy pierwszym starcie kontenera `db`.
Produkty i konto admina są wstawiane przez serwer przy starcie (`backend/src/seed.js`) — idempotentnie.

## Przepływ JWT

- Access token: 15 min (w pamięci frontu).
- Refresh token: 30 dni, przechowywany po stronie DB z rotacją przy każdym `/refresh`.
- `src/lib/api.js` automatycznie odświeża access token po 401.
