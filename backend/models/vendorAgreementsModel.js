// vendorAgreementsModel.js  (Kishore - Vendor Management, Sprint 2 rework)
// Reads/writes the StallAgreements table: every legal document a stall
// holds (rental agreement, store licence, food safety, fire safety...).
// Same ownership rule as the menu: stallId always comes from the token.
//
// 'displayStatus' and 'daysToExpiry' are COMPUTED by SQL at query time
// from expiryDate, so a licence flips to 'Expired' automatically the day
// it lapses - nothing stored can go stale.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

// Shared SELECT so every read returns the same computed columns.
const SELECT_WITH_STATUS = `
  SELECT agreementId, stallId, name, agreementType, startDate, expiryDate,
         monthlyRent, status,
         DATEDIFF(day, CAST(GETDATE() AS date), expiryDate) AS daysToExpiry,
         CASE
           WHEN status = 'Terminated' THEN 'Terminated'
           WHEN expiryDate < CAST(GETDATE() AS date) THEN 'Expired'
           WHEN DATEDIFF(day, CAST(GETDATE() AS date), expiryDate) <= 30 THEN 'Expiring Soon'
           ELSE 'Active'
         END AS displayStatus
  FROM StallAgreements`;

// All documents for one stall, soonest expiry first (problems float to the top).
async function getByStall(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query(`${SELECT_WITH_STATUS} WHERE stallId = @stallId ORDER BY expiryDate ASC`);
  return r.recordset;
}

// One document - only if it belongs to this stall.
async function getByIdForStall(agreementId, stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("agreementId", sql.Int, agreementId)
    .input("stallId", sql.Int, stallId)
    .query(`${SELECT_WITH_STATUS} WHERE agreementId = @agreementId AND stallId = @stallId`);
  return r.recordset[0];
}

// Insert, then re-read so the response includes the computed columns.
async function create(stallId, a) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .input("name", sql.NVarChar, a.name)
    .input("agreementType", sql.NVarChar, a.agreementType)
    .input("startDate", sql.Date, a.startDate)
    .input("expiryDate", sql.Date, a.expiryDate)
    .input("monthlyRent", sql.Decimal(10, 2), a.monthlyRent ?? null)
    .input("status", sql.NVarChar, a.status || "Active")
    .query(`INSERT INTO StallAgreements
              (stallId, name, agreementType, startDate, expiryDate, monthlyRent, status)
            OUTPUT INSERTED.agreementId
            VALUES (@stallId, @name, @agreementType, @startDate, @expiryDate, @monthlyRent, @status)`);
  return getByIdForStall(r.recordset[0].agreementId, stallId);
}

// Update - ownership enforced in the WHERE. Returns undefined if not yours.
async function update(agreementId, stallId, a) {
  const pool = await getPool();
  const r = await pool.request()
    .input("agreementId", sql.Int, agreementId)
    .input("stallId", sql.Int, stallId)
    .input("name", sql.NVarChar, a.name)
    .input("agreementType", sql.NVarChar, a.agreementType)
    .input("startDate", sql.Date, a.startDate)
    .input("expiryDate", sql.Date, a.expiryDate)
    .input("monthlyRent", sql.Decimal(10, 2), a.monthlyRent ?? null)
    .input("status", sql.NVarChar, a.status || "Active")
    .query(`UPDATE StallAgreements
            SET name=@name, agreementType=@agreementType, startDate=@startDate,
                expiryDate=@expiryDate, monthlyRent=@monthlyRent, status=@status
            WHERE agreementId=@agreementId AND stallId=@stallId`);
  if (r.rowsAffected[0] === 0) return undefined;
  return getByIdForStall(agreementId, stallId);
}

// Delete - same ownership rule.
async function remove(agreementId, stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("agreementId", sql.Int, agreementId)
    .input("stallId", sql.Int, stallId)
    .query(`DELETE FROM StallAgreements
            OUTPUT DELETED.agreementId
            WHERE agreementId=@agreementId AND stallId=@stallId`);
  return r.recordset[0];
}

module.exports = { getByStall, getByIdForStall, create, update, remove };
