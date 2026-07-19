// app.js
// Main entry point (assignment requires back-end code named app.js).

// IMPORTANT: .env lives at the repo root, but this file runs from /backend.
// The explicit path makes dotenv find it no matter which folder `node` is run from.
// (Plain `require("dotenv").config()` only checks the current working directory
// and silently loads 0 variables, which breaks the DB connection.)
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const path = require("path");
const sql = require("mssql"); 
const dbConfig = require("./config/dbConfig");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend"))); // serve front-end
app.use("/media", express.static(path.join(__dirname, "..", "media"))); // serve icons/images

// Serve the LOGIN page at the root URL "/" (login is the landing page).
// After a successful login, auth.js redirects the user on to home.html.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "login.html"));
});

// ============================================================
// Routes (mounted under /api)
// NOTE: only mount a route once its file actually exists in
// backend/routes, otherwise the server crashes on startup with
// "Cannot find module".
// ============================================================

// --- Aswin: authentication (signup / login / JWT) ---
app.use("/api/auth", require("./routes/userRoutes"));

// --- Quan Jun: product page flow + product CRUD ---
// This one router handles /api/centers, /api/stalls and /api/products.
app.use("/api", require("./routes/productRoutes"));

// --- Quan Jun: add to cart ---
app.use("/api/cart", require("./routes/cartRoutes"));

// --- Quan Jun: product customisation options (addons) ---
app.use("/api/products", require("./routes/addonRoutes"));

// --- Quan Jun: checkout + order history ---
app.use("/api/orders", require("./routes/orderRoutes"));

// --- Timely: feedback, complaints & promo codes ---
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/complaints", require("./routes/complaintRoutes"));
app.use("/api/promos", require("./routes/promoRoutes"));

// --- Kishore: vendor management ---
app.use("/api/vendors/menu", require("./routes/vendorRoutes"));                 // menu CRUD
app.use("/api/vendors/agreements", require("./routes/vendorAgreementsRoutes")); // rental agreements
app.use("/api/vendors/stall", require("./routes/vendorStallRoutes"));           // my stall profile

// Homepage centres are already served by productRoutes above (/api/centers),
// so a separate centerRoutes file is not needed on this branch.
// app.use("/api/centers", require("./routes/centerRoutes"));

// --- Start server, connect to DB ---
app.listen(PORT, async () => {
  try {
    await sql.connect(dbConfig);
    console.log("Database connected.");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1);
  }
  console.log(`Server running on http://localhost:${PORT}/`);
});