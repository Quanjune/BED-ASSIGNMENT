# Hawkers — Singapore Hawker Centre Management System

Back-End Development (BED) assignment 

A Node.js + Express application backed by Microsoft SQL Server, exposing RESTful APIs to a
front-end for managing hawker centres, food stalls, menus, orders, customer feedback and
NEA inspections.

## Tech stack

| Layer | Technology |
|-------|------------|
| Back end | Node.js, Express 5 |
| Database | Microsoft SQL Server (`mssql`) |
| Authentication | JWT (`jsonwebtoken`) + password hashing (`bcryptjs`) |
| Validation | Joi |
| Front end | HTML, CSS, vanilla JavaScript (`fetch`) |

## Team and features

| Name | Role | Individual features |
|------|------|---------------------|
| **Aswin** | Administrator / User accounts | User account management (signup & login with bcrypt hashing and JWT); role-based access control (customer / vendor / admin); user profile CRUD; admin analytics *(in progress)* |
| **Quan Jun** | Customer — browsing & ordering | Homepage browsing of hawker centres, stalls and menu items; cart, product customisation options and checkout; order history |
| **Kishore** | Vendor — stall management | Menu management for the vendor's own stall; rental agreement tracking; stall performance dashboard |
| **Timely** | Customer — engagement | Feedback submission (ratings + comments); complaint submission linked to a stall; store ratings & reviews; promotions / promo codes |
| **Kadon** | NEA officer — compliance | Inspection scheduling; recording inspection scores, remarks and hygiene grades; historical hygiene grade tracking |

## Getting started

### Prerequisites

- Node.js
- Microsoft SQL Server + SQL Server Management Studio (SSMS)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` in the project root and fill in your own values:

```bash
DB_USER=your_sql_login
DB_PASSWORD=your_sql_password
DB_SERVER=localhost
DB_DATABASE=HawkersDB
ACCESS_TOKEN_SECRET=any_random_string
PORT=3000
```

`.env` is git-ignored — never commit real credentials.

### 3. Set up the database

See **[database/README.md](database/README.md)** for the SQL scripts and the order to run
them in. Running them out of order can wipe data, so follow that guide.

### 4. Start the server

```bash
node backend/app.js
```

The app runs at <http://localhost:3000/>.

## Project structure

```
BED-ASSIGNMENT/
├── backend/
│   ├── app.js              # entry point — middleware, route mounting, server start
│   ├── config/             # database connection config (reads .env)
│   ├── controllers/        # request handling and business logic
│   ├── models/             # SQL queries
│   ├── routes/             # API endpoint definitions
│   ├── middlewares/        # JWT authentication, validation
│   └── validators/         # Joi schemas
├── frontend/               # HTML pages, served statically
│   ├── scripts/            # page JavaScript (calls the APIs)
│   └── styles/             # CSS
├── database/               # SQL setup scripts + setup guide
├── media/                  # images and icons
├── .env.example            # template for your local .env
└── README.md
```

## API overview

| Route group | Owner | Purpose |
|-------------|-------|---------|
| `/api/auth` | Aswin | Signup, login, profile CRUD, admin user list |
| `/api/centers`, `/api/stalls`, `/api/products` | Quan Jun | Browse hawker centres, stalls and menu items |
| `/api/cart` | Quan Jun | Shopping cart |
| `/api/orders` | Quan Jun | Checkout and order history |
| `/api/feedback` | Timely | Customer feedback (ratings and comments) |
| `/api/complaints` | Timely | Complaints logged against a stall |
| `/api/promos` | Timely | Promotions and promo codes |
| `/api/vendors/menu` | Kishore | Vendor menu CRUD |
| `/api/vendors/agreements` | Kishore | Rental agreements |
| `/api/vendors/stall` | Kishore | The logged-in vendor's own stall |

### Authentication endpoints

| Method | Endpoint | Auth required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/auth/signup` | — | Create a customer or vendor account |
| `POST` | `/api/auth/login` | — | Log in; returns a JWT access token |
| `GET` | `/api/auth/me` | Bearer token | Get the logged-in user's profile |
| `PUT` | `/api/auth/me` | Bearer token | Update own name and email |
| `DELETE` | `/api/auth/me` | Bearer token | Delete own account |
| `GET` | `/api/auth/users` | Bearer token (admin) | List all users |

Protected routes return **401** if no token is supplied and **403** if the token is invalid
or the user's role is not permitted.

## Test accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@hawkers.sg` | `Admin123` | admin |
| `siti@test.com` | `Password123` | customer |
| `chickenrice@test.com` | `Password123` | vendor (owns stall 1) |

## Known limitations

### Vendor self-registration does not grant stall access

A vendor can create an account through the signup page, but that account will not be able
to open the vendor dashboard. This is intentional.

In the hawker centre scenario, a stall owner does not register online and instantly own a
stall — the **operator assigns a stall unit through a rental agreement**. In this system
that relationship is the `Users.stallId` column, which links a vendor account to exactly
one stall. That link is assigned by the operator (seeded in the database), not created at
signup.

So a self-registered vendor account is created successfully but has no stall linked to it.
The login flow checks this before redirecting and shows *"No stall is linked to this
account. Please contact your operator."* instead of sending the user to a dashboard with
no stall to manage.

Auto-creating a stall at signup was deliberately avoided: it would let anyone create a
stall in a hawker centre without a rental agreement or NEA approval, which does not
reflect the real process.

**Future work:** an operator/admin endpoint to assign a stall to an existing vendor
account, or a vendor application-and-approval flow.

To demonstrate the vendor features, use the seeded vendor account above
(`chickenrice@test.com`), which the master SQL script links to stall 1.
