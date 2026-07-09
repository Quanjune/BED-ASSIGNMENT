// app.js
// Main entry point (assignment requires back-end code named app.js).
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
app.use(express.static(path.join(__dirname, "..", "frontend"))); // serve front-end
app.use("/media", express.static(path.join(__dirname, "..", "media"))); // serve icons/images

// Serve the homepage at the root URL "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// --- Routes (mounted under /api) ---
// Product page flow (centres -> stalls -> products -> detail) + product CRUD.
// This one router handles /api/centers, /api/stalls, and /api/products.
app.use("/api", require("./routes/productRoutes"));

// NOTE: cart and order routes will be added here when those features are built:
// app.use("/api/cart", require("./routes/cartRoutes"));
// app.use("/api/orders", require("./routes/orderRoutes"));

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