// vendorStallModel.js  (Kishore - Vendor Management)
// Two lookups: (1) which stall a user owns, (2) that stall's profile
// (name + hawker centre) for the "Your stall" header on the vendor pages.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

// Returns the stallId this user owns, or null.
async function getStallIdForUser(userId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("userId", sql.Int, userId)
    .query("SELECT stallId FROM Users WHERE userId = @userId");
  return r.recordset[0]?.stallId ?? null;
}

// Stall + its hawker centre, for the dashboard header.
async function getStallProfile(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query(`SELECT s.stallId, s.name AS stallName, s.imagePath,
                   c.name AS centerName, c.location
            FROM FoodStalls s
            JOIN HawkerCenters c ON c.centerId = s.centerId
            WHERE s.stallId = @stallId`);
  return r.recordset[0];
}

module.exports = { getStallIdForUser, getStallProfile };
