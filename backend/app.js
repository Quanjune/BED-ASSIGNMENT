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
app.use(express.static(path.join(__dirname, "..", "frontend"), { index: false })); // serve front-end (no auto index.html at "/")
app.use("/media", express.static(path.join(__dirname, "..", "media"))); // serve icons/images

 
// Serve the LOGIN page at "/" (the landing page). Guests reach the home page
// (index.html) via the "Continue as guest" button; logged-in users are sent
// there by auth.js. Ordering stays blocked for guests by verifyToken on the
// cart/order routes.
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
 
// --- Kaden: NEA officer — regulatory & compliance ---
app.use("/api/inspections", require("./routes/inspectionRoutes"));
app.use("/api/hygiene-grades", require("./routes/hygieneGradeRoutes"));
 
// --- Kishore: vendor management ---
app.use("/api/vendors/menu", require("./routes/vendorRoutes"));                 
app.use("/api/vendors/agreements", require("./routes/vendorAgreementsRoutes")); 
app.use("/api/vendors/stall", require("./routes/vendorStallRoutes"));    
app.use("/api/vendors/performance", require("./routes/vendorPerformanceRoutes"));      
 
// ============================================================
// Error handling — must come AFTER all routes are mounted.
// Express matches middleware in order, so anything registered
// here only runs when no route above has already responded.
// ============================================================

// Unknown /api/* URL -> JSON 404 (not the static handler's HTML page).
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler. Four parameters (err first) is what tells
// Express this is an error handler rather than normal middleware.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

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