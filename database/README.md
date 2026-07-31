# Database Setup

Database engine: **Microsoft SQL Server**  ·  Database name: **HawkersDB**

## 1. Run these scripts in SSMS, in this order

| # | Script | What it creates |
|---|--------|-----------------|
| 1 | **`qj and kishore masterdata.sql`** | **Master script.** Creates the database and all core tables (HawkerCenters, FoodStalls, Users, Products, CartItems, Orders, OrderItems, StallAgreements) plus the add-on tables (AddonGroups, AddonOptions, CartItemAddons), with sample data — 64 products with images, 16 vendor accounts each linked to a stall, the `Users.cardLast4` column, and ~640 sample orders. Self-contained: creates the database if missing and drops all tables first, so it is safe to re-run. It never drops the database. |
| 2 | `promoCodes.sql` | Promotions / promo codes. |
| 3 | `feedback_complaints.sql` | Feedback and Complaints tables with sample data. |
| 4 | `Inspectionpage.sql` | Inspections and HygieneGrades tables (NEA officer feature). |

Scripts 2–4 are **additive** — they only add their own tables, so they are safe to run
after the master.

> **Note on step 4:** `Inspectionpage.sql` has no `USE HawkersDB;` line, so make sure the
> query window in SSMS is connected to **HawkersDB** before running it, or the tables will
> be created in the wrong database. It also has no DROP statements of its own, so running it
> a second time on its own errors with "table already exists" — a full rebuild from the
> master (step 1) drops everything first, so re-running the whole set in order is fine.

> **Note:** `user_card.sql` is no longer needed — the `cardLast4` column is now built into
> the master script's `Users` table.

## 2. Test login accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@hawkers.sg` | `Admin123` | admin |
| `siti@test.com` | `Password123` | customer |
| `chickenrice@test.com` | `Password123` | vendor (owns stall 1) |

## 3. Before running the app

1. Copy `.env.example` (in the project root) to **`backend/.env`** and fill in your SQL
   Server details. (The app loads its environment from `backend/.env`, not the repo root.)
2. Install dependencies: `npm install`
3. Start the server: `node backend/app.js`

The server runs at <http://localhost:3000/>.
