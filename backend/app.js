// app.js
// Main entry point (assignment requires back-end code named app.js).

// IMPORTANT: .env lives at the repo root, but this file runs from /backend.
// The explicit path makes dotenv find it no matter which folder `node` is run from.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const path = require("path");
const sql = require("mssql");
const dbConfig = require("./config/dbConfig");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());                 // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));        // serve front-end
app.use("/media", express.static(path.join(__dirname, "..", "media"))); // serve icons/images

// Serve the homepage at the root URL "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// ============================================================
// KISHORE — Vendor Management (LIVE on this branch)
// ============================================================
app.use("/api/vendors/menu", require("./routes/vendorRoutes"));                 // menu CRUD
app.use("/api/vendors/agreements", require("./routes/vendorAgreementsRoutes")); // rental agreements
app.use("/api/vendors/stall", require("./routes/vendorStallRoutes"));           // my stall profile

// ============================================================
// TEAMMATE ROUTES — commented out locally because the files
// don't exist on the vendor branch yet. UNCOMMENT BEFORE PUSH.
// (Uncommenting a line whose file is missing crashes startup
//  with "Cannot find module".)
// ============================================================
// app.use("/api/centers", require("./routes/centerRoutes"));        // Homepage
// app.use("/api/products", require("./routes/productRoutes"));      // Product page
// app.use("/api/cart", require("./routes/cartRoutes"));             // Add to order
// app.use("/api/orders", require("./routes/orderRoutes"));          // Order history
// app.use("/api/feedback", require("./routes/feedbackRoutes"));     // Customer feedback
// app.use("/api/complaints", require("./routes/complaintRoutes"));  // Customer complaints
app.use("/api/auth", require("./routes/userRoutes"));             // Aswin — login/signup


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