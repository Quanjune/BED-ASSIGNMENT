// app.homepage-test.js — homepage-only test server
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// serve the frontend folder (html, css, js)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ALSO serve the media folder at /media  <-- this is the fix
app.use("/media", express.static(path.join(__dirname, "..", "media")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "home.html"));
});

app.listen(PORT, () => {
  console.log(`Server running: open http://localhost:${PORT}/`);
});