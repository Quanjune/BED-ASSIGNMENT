// vendorAgreementsModel.js  (Kishore - Vendor Management, Sprint 2)
// Reads/writes the RentalAgreements table. Links to the shared
// FoodStalls table by stallId - the same stalls your menu items belong to.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

async function getAll() {
  const pool = await getPool();
  const r = await pool.request()
    .query("SELECT * FROM RentalAgreements ORDER BY agreementId DESC");
  return r.recordset;
}

async function getByStall(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT * FROM RentalAgreements WHERE stallId = @stallId ORDER BY agreementId DESC");
  return r.recordset;
}

async function getById(agreementId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("agreementId", sql.Int, agreementId)
    .query("SELECT * FROM RentalAgreements WHERE agreementId = @agreementId");
  return r.recordset[0];
}

// Reuse the shared FoodStalls table - do NOT make a new Stalls table.
async function stallExists(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return r.recordset.length > 0;
}

async function create(a) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, a.stallId)
    .input("vendorId", sql.NVarChar, a.vendorId || null)   // from session later (SBA-42)
    .input("startDate", sql.Date, a.startDate)
    .input("endDate", sql.Date, a.endDate)
    .input("monthlyRent", sql.Decimal(10, 2), a.monthlyRent)
    .input("deposit", sql.Decimal(10, 2), a.deposit || 0)
    .input("status", sql.NVarChar, a.status || "active")
    .query(`INSERT INTO RentalAgreements
              (stallId, vendorId, startDate, endDate, monthlyRent, deposit, status)
            OUTPUT INSERTED.*
            VALUES (@stallId, @vendorId, @startDate, @endDate, @monthlyRent, @deposit, @status)`);
  return r.recordset[0];
}

async function update(agreementId, a) {
  const pool = await getPool();
  const r = await pool.request()
    .input("agreementId", sql.Int, agreementId)
    .input("stallId", sql.Int, a.stallId)
    .input("startDate", sql.Date, a.startDate)
    .input("endDate", sql.Date, a.endDate)
    .input("monthlyRent", sql.Decimal(10, 2), a.monthlyRent)
    .input("deposit", sql.Decimal(10, 2), a.deposit || 0)
    .input("status", sql.NVarChar, a.status || "active")
    .query(`UPDATE RentalAgreements
            SET stallId=@stallId, startDate=@startDate, endDate=@endDate,
                monthlyRent=@monthlyRent, deposit=@deposit, status=@status
            OUTPUT INSERTED.*
            WHERE agreementId=@agreementId`);
  return r.recordset[0];
}

module.exports = { getAll, getByStall, getById, stallExists, create, update };