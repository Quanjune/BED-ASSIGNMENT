// app.js
// Main entry point (assignment requires back-end code named app.js).
require("dotenv").config();
const express = require("express");
const path = require("path");
const sql = require("mssql");
const dbConfig = require("./config/dbConfig");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());                 // parse JSON bodies (Lecture 6)
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend"))); // serve front-end
app.use("/media", express.static(path.join(__dirname, "..", "media"))); // serve icons/images

// Serve the homepage at the root URL "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

// --- Routes (mounted under /api) ---
app.use("/api/centers", require("./routes/centerRoutes"));   // Homepage
app.use("/api/products", require("./routes/productRoutes")); // Product page
app.use("/api/cart", require("./routes/cartRoutes"));        // Add to order
app.use("/api/orders", require("./routes/orderRoutes"));     // History
app.use("/api/feedback", require("./routes/feedbackRoutes"));     // Customer   feedback
app.use("/api/complaints", require("./routes/complaintRoutes")); // Customer complaints

// --- Start server, connect to DB (Week 4 pattern) ---
app.listen(PORT, async () => {
  try {
    await sql.connect(dbConfig);
    console.log("Database connected.");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1); // exit on fatal error
  }
  console.log(`Server running on port ${PORT}`);
});