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
 
// --- Routes  ---
app.use("/api/centers", require("./routes/centerRoutes"));   
app.use("/api/products", require("./routes/productRoutes")); 
app.use("/api/cart", require("./routes/cartRoutes"));       
app.use("/api/orders", require("./routes/orderRoutes"));     
app.use("/api/inspections", require("./routes/inspectionRoutes"));       
app.use("/api/hygiene-grades", require("./routes/hygieneGradeRoutes"));  
 
// --- Start server, connect to DB (Week 4 pattern) ---
app.listen(PORT, async () => {
  try {
    await sql.connect(dbConfig);
    console.log("Database connected.");
  } catch (err) {
    console.error("DB connection error:", err);
    process.exit(1); 
  }
  console.log(`Server running on port ${PORT}`);
});