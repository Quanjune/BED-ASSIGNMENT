// Load backend/.env by ABSOLUTE path (this file lives in backend/config/, so
// ../.env is backend/.env). Without the explicit path, dotenv looks in the
// current working directory - so `npm start` from the repo root would silently
// load nothing, leaving DB_SERVER undefined and every query failing with a
// 500 "Internal Server Error". Loading by path makes it work from any folder.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

module.exports = config;