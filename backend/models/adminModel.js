// adminModel.js  (Aswin - Admin analytics)
// Read-only aggregation queries across the whole platform. All admin-only.
// Uses COUNT / SUM / AVG / GROUP BY / JOIN over Users, Orders, Feedback,
// Complaints, FoodStalls, HawkerCenters and StallAgreements.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// Headline numbers for the top stat cards + best hawker centre.
async function getSummary() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);

    const totals = (await connection.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Users)                                       AS totalUsers,
        (SELECT COUNT(*) FROM Users WHERE role = 'customer')               AS totalCustomers,
        (SELECT COUNT(*) FROM Users WHERE role = 'vendor')                 AS totalVendors,
        (SELECT COUNT(*) FROM FoodStalls)                                  AS totalStalls,
        (SELECT COUNT(*) FROM Orders)                                      AS totalOrders,
        (SELECT ISNULL(SUM(total), 0) FROM Orders)                         AS totalRevenue,
        (SELECT COUNT(*) FROM Complaints)                                  AS totalComplaints,
        (SELECT COUNT(*) FROM Feedback)                                    AS reviewCount,
        (SELECT ISNULL(AVG(CAST(rating AS DECIMAL(4,2))), 0) FROM Feedback) AS avgRating
    `)).recordset[0];

    // best hawker centre by total order revenue
    const best = (await connection.request().query(`
      SELECT TOP 1 hc.name AS centreName, SUM(o.total) AS revenue
      FROM Orders o
      JOIN HawkerCenters hc ON o.centerId = hc.centerId
      GROUP BY hc.name
      ORDER BY revenue DESC
    `)).recordset[0];

    totals.bestHawker = best ? best.centreName : "N/A";
    return totals;
  } finally {
    if (connection) await connection.close();
  }
}

// Complaint counts per hawker centre (for the bar/polar chart).
async function getComplaintsByCentre() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT hc.name AS centre, COUNT(*) AS count
      FROM Complaints c
      JOIN FoodStalls fs ON c.stallId = fs.stallId
      JOIN HawkerCenters hc ON fs.centerId = hc.centerId
      GROUP BY hc.name
      ORDER BY count DESC
    `);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// Complaint counts per category (for the pie/doughnut chart).
async function getComplaintsByCategory() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT ISNULL(category, 'Others') AS category, COUNT(*) AS count
      FROM Complaints
      GROUP BY category
      ORDER BY count DESC
    `);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// Complaints per month (for the line/trend chart).
async function getComplaintsByMonth() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT FORMAT(createdAt, 'yyyy-MM') AS month, COUNT(*) AS count
      FROM Complaints
      GROUP BY FORMAT(createdAt, 'yyyy-MM')
      ORDER BY month
    `);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// Top stalls by average rating (+ review and complaint counts) for the table.
async function getTopStalls() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT TOP 10
        fs.stallId,
        fs.name AS stallName,
        hc.name AS centre,
        COUNT(f.feedbackId) AS reviewCount,
        ISNULL(AVG(CAST(f.rating AS DECIMAL(4,2))), 0) AS avgRating,
        (SELECT COUNT(*) FROM Complaints cx WHERE cx.stallId = fs.stallId) AS complaintCount
      FROM FoodStalls fs
      JOIN HawkerCenters hc ON fs.centerId = hc.centerId
      LEFT JOIN Feedback f ON f.stallId = fs.stallId
      GROUP BY fs.stallId, fs.name, hc.name
      ORDER BY avgRating DESC, reviewCount DESC
    `);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// Rental agreement stats: active count, expiring within 30 days, total monthly rent.
async function getAgreementsSummary() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT
        (SELECT COUNT(*) FROM StallAgreements WHERE status = 'Active') AS activeCount,
        (SELECT COUNT(*) FROM StallAgreements
           WHERE status = 'Active'
             AND expiryDate BETWEEN CAST(GETDATE() AS DATE)
                                AND DATEADD(day, 30, CAST(GETDATE() AS DATE))) AS expiringSoon,
        (SELECT ISNULL(SUM(monthlyRent), 0) FROM StallAgreements
           WHERE status = 'Active' AND agreementType = 'Rental') AS totalMonthlyRent
    `);
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getSummary,
  getComplaintsByCentre,
  getComplaintsByCategory,
  getComplaintsByMonth,
  getTopStalls,
  getAgreementsSummary
};
