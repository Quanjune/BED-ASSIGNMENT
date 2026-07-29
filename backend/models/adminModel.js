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

    // Core numbers from tables that always exist (Users, FoodStalls,
    // Complaints, Feedback). Kept separate so a missing Orders table
    // can't blank these out.
    const core = (await connection.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Users)                                        AS totalUsers,
        (SELECT COUNT(*) FROM Users WHERE role = 'customer')                AS totalCustomers,
        (SELECT COUNT(*) FROM Users WHERE role = 'vendor')                  AS totalVendors,
        (SELECT COUNT(*) FROM FoodStalls)                                   AS totalStalls,
        (SELECT COUNT(*) FROM Complaints)                                   AS totalComplaints,
        (SELECT COUNT(*) FROM Feedback)                                     AS reviewCount,
        (SELECT ISNULL(AVG(CAST(rating AS DECIMAL(4,2))), 0) FROM Feedback) AS avgRating
    `)).recordset[0];

    // Order-based numbers. Orders/OrderItems may not be loaded in every
    // copy of the DB, so degrade gracefully instead of failing the whole card set.
    let totalOrders = 0, totalRevenue = 0, bestHawker = "N/A";
    try {
      const o = (await connection.request().query(`
        SELECT (SELECT COUNT(*) FROM Orders)             AS totalOrders,
               (SELECT ISNULL(SUM(total), 0) FROM Orders) AS totalRevenue
      `)).recordset[0];
      totalOrders = o.totalOrders;
      totalRevenue = o.totalRevenue;

      const best = (await connection.request().query(`
        SELECT TOP 1 hc.name AS centreName, SUM(o.total) AS revenue
        FROM Orders o
        JOIN HawkerCenters hc ON o.centerId = hc.centerId
        GROUP BY hc.name
        ORDER BY revenue DESC
      `)).recordset[0];
      if (best) bestHawker = best.centreName;
    } catch (e) {
      console.warn("Orders data unavailable for summary:", e.message);
    }

    return { ...core, totalOrders, totalRevenue, bestHawker };
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
    const stalls = (await connection.request().query(`
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
    `)).recordset;

    // Per-stall orders + revenue. OrderItems store the product by name, so we
    // map them back to a stall via Products.name -> Products.stallId.
    // Wrapped because Orders/OrderItems may not exist in every DB copy.
    try {
      const rev = (await connection.request().query(`
        SELECT p.stallId,
               COUNT(DISTINCT oi.orderId) AS orderCount,
               ISNULL(SUM(oi.itemTotal), 0) AS revenue
        FROM OrderItems oi
        JOIN Products p ON oi.productName = p.name
        GROUP BY p.stallId
      `)).recordset;

      const map = {};
      rev.forEach(r => { map[r.stallId] = r; });
      stalls.forEach(s => {
        s.orderCount = map[s.stallId] ? map[s.stallId].orderCount : 0;
        s.revenue    = map[s.stallId] ? map[s.stallId].revenue : 0;
      });
    } catch (e) {
      console.warn("Order data unavailable for top stalls:", e.message);
      stalls.forEach(s => { s.orderCount = 0; s.revenue = 0; });
    }

    return stalls;
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

// ---- User management (admin) ----

// Every user (with the stall a vendor owns, if any), without password hashes.
async function listUsers() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(`
      SELECT u.userId, u.name, u.email, u.role, u.createdAt, fs.name AS stallName
      FROM Users u
      LEFT JOIN FoodStalls fs ON u.stallId = fs.stallId
      ORDER BY u.userId
    `);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// Delete a user by id. Returns rows affected (0 = not found).
async function deleteUserById(userId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("userId", sql.Int, userId)
      .query(`DELETE FROM Users WHERE userId = @userId`);
    return result.rowsAffected[0];
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
  getAgreementsSummary,
  listUsers,
  deleteUserById
};
