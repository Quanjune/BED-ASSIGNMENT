# Database Setup

Database engine: **Microsoft SQL Server**  ·  Database name: **HawkersDB**

## 1. Run the one setup script in SSMS

Open **`FULL_SETUP.sql`** in SQL Server Management Studio and run the whole file (F5).

That single file rebuilds the entire database from scratch — every table and all sample
data — so there is nothing else to run and no order to get right. It:

- creates the `HawkersDB` database if it does not exist (it **never** drops the database),
- drops and recreates all tables, so it is safe to re-run any time,
- seeds the core data: 4 hawker centres, 16 food stalls, 64 products with images,
  the admin account, 16 vendor accounts (each linked to a stall), two NEA officer
  accounts, and the `Users.cardLast4` column,
- seeds the add-on menu options, promo codes, feedback (with vendor replies) and
  complaints,
- seeds 48 sample orders (3 per stall) so the order history and vendor performance
  pages have data,
- creates the inspections and hygiene-grade tables for the NEA officer feature.

At the end it runs a `SELECT *` on every table so you can eyeball the seeded data.

## 2. Test login accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@hawkers.sg` | `Admin123` | admin |
| `siti@test.com` | `Password123` | customer |
| `chickenrice@test.com` | `Password123` | vendor (owns stall 1) |
| `tan@nea.gov.sg` | `Password123` | officer (NEA) |
| `nurul@nea.gov.sg` | `Password123` | officer (NEA) |

## 3. Before running the app

1. Copy `.env.example` (in the project root) to **`backend/.env`** and fill in your SQL
   Server details. (The app loads its environment from `backend/.env`, not the repo root.)
2. Install dependencies: `npm install`
3. Start the server: `node backend/app.js`

The server runs at <http://localhost:3000/>.
