// app.homepage-test.js
// Homepage-only test server. No database, no API routes.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in the frontend/ folder
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Load the homepage at the root URL "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

app.listen(PORT, () => {
  console.log(`Server running: open http://localhost:${PORT}/`);
});