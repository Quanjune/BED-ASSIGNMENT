# Database Setup

Database engine: **Microsoft SQL Server**  ·  Database name: **HawkersDB**

## 1. Run these scripts in SSMS, in this order

| # | Script | What it creates |
|---|--------|-----------------|
| 1 | **`DB with Vendor logins.sql`** | **Master script.** Creates the database and all core tables (HawkerCenters, FoodStalls, Users, Products, CartItems, Orders, OrderItems, StallAgreements) with sample data — including 16 vendor accounts, each linked to their own stall. |
| 2 | `ProductOptions.sql` | Product customisation options (add-ons). |
| 3 | `promoCodes.sql` | Promotions / promo codes. |
| 4 | `feedback_complaints.sql` | Feedback and Complaints tables with sample data. |
| 5 | `Inspectionpage.sql` | Inspections and HygieneGrades tables (NEA officer feature). |

Scripts 2–5 are **additive** — they only add their own tables, so they are safe to run
after the master.

> **Note on step 5:** `Inspectionpage.sql` has no `USE HawkersDB;` line, so make sure the
> query window in SSMS is connected to **HawkersDB** before running it, or the tables will
> be created in the wrong database. It also has no DROP statements, so re-running it will
> error with "table already exists" — drop the two tables first if you need to re-run.

## 2. Do NOT run these after the master script

- `Homepage, add to cart, history & Product page.sql`
- `RealStallData.sql`

Both are **full-rebuild** scripts: they DROP and recreate the core tables, which wipes the
stall data and the vendor-to-stall links created by the master script. They are kept for
reference only. (The Feedback/Complaints tables they contained have been moved into
`feedback_complaints.sql`, which is safe to run.)

## 3. Test login accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@hawkers.sg` | `Admin123` | admin |
| `siti@test.com` | `Password123` | customer |
| `chickenrice@test.com` | `Password123` | vendor (owns stall 1) |

## 4. Before running the app

1. Copy `.env.example` (in the project root) to `.env` and fill in your SQL Server details.
2. Install dependencies: `npm install`
3. Start the server: `node backend/app.js`

The server runs at <http://localhost:3000/>.
