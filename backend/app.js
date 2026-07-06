require('dotenv').config();
const express = require('express');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());            // lets the app read JSON request bodies
app.use('/api/auth', userRoutes);   // every auth route sits under /api/auth

app.get('/', (req, res) => res.send('Hawkers API is running'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});