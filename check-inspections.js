// check-inspections.js   (temporary diagnostic - delete before submitting)
//
// Runs the exact queries the officer worklist uses and prints the result, or
// the real SQL Server error message, straight into the terminal. Use this when
// a page shows "Could not load..." and you want to know WHY without digging
// through the server log.
//
// HOW TO RUN
//   Put this file in the project root (next to package.json), then:
//       node check-inspections.js
//
// It connects using exactly the same backend/.env as the app, so if this can
// reach the database, so can the app.

const path = require("path");
const sql = require("mssql");
const dbConfig = require("./backend/config/dbConfig");

// Officer Tan Wei Ming is userId 20 in the seeded data. Change this if your
// officer has a different id (SELECT userId, name FROM Users WHERE role='officer').
const OFFICER_ID = 20;

function heading(text) {
  console.log("\n" + "=".repeat(60));
  console.log(text);
  console.log("=".repeat(60));
}

function explain(err) {
  console.log("  FAILED:", err.message);
  if (err.originalError) console.log("  SQL Server says:", err.originalError.message);
  if (err.code) console.log("  code:", err.code);
}

async function main() {
  heading("1. Connecting");
  console.log("  server  :", dbConfig.server);
  console.log("  database:", dbConfig.database);
  console.log("  user    :", dbConfig.user);

  if (!dbConfig.server) {
    console.log("\n  backend/.env is not being read - DB_SERVER is empty. Stop here and fix that.");
    return;
  }

  await sql.connect(dbConfig);
  console.log("  connected OK");

  // ----------------------------------------------------------
  heading("2. Which database am I actually in?");
  const whichDb = await new sql.Request().query("SELECT DB_NAME() AS currentDb");
  console.log("  ", whichDb.recordset[0].currentDb);
  if (whichDb.recordset[0].currentDb !== "HawkersDB") {
    console.log("  ^ this should say HawkersDB. Check DB_DATABASE in backend/.env.");
  }

  // ----------------------------------------------------------
  heading("3. Do the tables exist?");
  const tables = await new sql.Request().query(`
    SELECT name FROM sys.tables
    WHERE name IN ('Inspections','HygieneGrades','FoodStalls','HawkerCenters','Users')
    ORDER BY name`);
  console.log("  found:", tables.recordset.map((r) => r.name).join(", ") || "(none)");

  // ----------------------------------------------------------
  heading("4. Officer accounts");
  const officers = await new sql.Request().query(
    "SELECT userId, name, email FROM Users WHERE role = 'officer' ORDER BY userId");
  if (!officers.recordset.length) {
    console.log("  NO OFFICER ACCOUNTS. Re-run the master script.");
  } else {
    officers.recordset.forEach((o) => console.log(`  ${o.userId}  ${o.name}  <${o.email}>`));
  }

  // ----------------------------------------------------------
  heading(`5. The two worklist queries for officerId ${OFFICER_ID}`);

  const SELECT_INSPECTION = `
    SELECT i.inspectionId, i.stallId, f.name AS stallName, c.name AS centerName,
           i.officerId, u.name AS officerName, i.scheduledDate, i.status,
           i.completedDate, i.score, i.remarks, i.followUpOf, i.createdAt
    FROM Inspections i
    JOIN FoodStalls    f ON f.stallId  = i.stallId
    JOIN HawkerCenters c ON c.centerId = f.centerId
    JOIN Users         u ON u.userId   = i.officerId
  `;

  try {
    const open = await new sql.Request()
      .input("officerId", sql.Int, OFFICER_ID)
      .query(SELECT_INSPECTION + " WHERE i.officerId = @officerId AND i.status = 'Scheduled' ORDER BY i.scheduledDate ASC");
    console.log(`  open (Scheduled)   : ${open.recordset.length} rows`);
  } catch (err) {
    console.log("  open (Scheduled)");
    explain(err);
  }

  try {
    const done = await new sql.Request()
      .input("officerId", sql.Int, OFFICER_ID)
      .query(SELECT_INSPECTION + " WHERE i.officerId = @officerId AND i.status = 'Completed' ORDER BY i.completedDate DESC");
    console.log(`  completed          : ${done.recordset.length} rows`);
  } catch (err) {
    console.log("  completed");
    explain(err);
  }

  // ----------------------------------------------------------
  heading("6. The same two queries fired AT THE SAME TIME");
  console.log("  (this is what the old Promise.all version did)");
  try {
    const [a, b] = await Promise.all([
      new sql.Request().input("officerId", sql.Int, OFFICER_ID)
        .query(SELECT_INSPECTION + " WHERE i.officerId = @officerId AND i.status = 'Scheduled'"),
      new sql.Request().input("officerId", sql.Int, OFFICER_ID)
        .query(SELECT_INSPECTION + " WHERE i.officerId = @officerId AND i.status = 'Completed'"),
    ]);
    console.log(`  concurrent OK: ${a.recordset.length} + ${b.recordset.length} rows`);
    console.log("  -> concurrency was NOT the problem. Look at section 5 for a failing query.");
  } catch (err) {
    console.log("  concurrent run");
    explain(err);
    console.log("  -> THIS is the bug. The sequential version in the fixed controller avoids it.");
  }

  await sql.close();
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.log("\nUnexpected failure:");
  explain(err);
  process.exit(1);
});