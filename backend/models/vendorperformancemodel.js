// vendorPerformanceModel.js  (Kishore - Vendor Management, Sprint 3)
// READ-ONLY aggregation for the Stall Performance dashboard.
// Nothing here writes. Every query is scoped to ONE stallId, which always
// comes from the token (via attachVendorStall) - never from the client.
//
// The hard part of this feature is that OrderItems does not (yet) store
// which stall a line belongs to. See getLinkMode() below: the model probes
// the live schema once and picks the best available way to link an order
// line back to a stall, so this page works today and gets more accurate
// automatically the moment QJ adds the column.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

// ===================================================================
// 1) SCHEMA PROBE
// Runs once per server start, then cached. Tells us (a) how to link an
// order line to a stall and (b) which teammates' tables actually exist
// in this database, so a missing table returns an empty section instead
// of crashing the dashboard.
// ===================================================================
let schemaPromise;
function getSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = await getPool();
      const t = await pool.request().query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
      );
      const c = await pool.request().query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OrderItems'"
      );

      const tables = new Set(t.recordset.map((r) => r.TABLE_NAME.toLowerCase()));
      const cols = new Set(c.recordset.map((r) => r.COLUMN_NAME.toLowerCase()));

      // Best -> worst way of answering "which stall sold this line?"
      let linkMode = "name";
      if (cols.has("stallid")) linkMode = "stallId";
      else if (cols.has("productid")) linkMode = "productId";

      return { tables, linkMode };
    })();
  }
  return schemaPromise;
}

function has(schema, table) {
  return schema.tables.has(table.toLowerCase());
}

// ===================================================================
// 2) THE SALES SOURCE
// One reusable FROM/WHERE fragment. EXISTS (not JOIN) is deliberate:
// it guarantees exactly one row per order line, so a name that happens
// to match two products can never double-count the money.
// ===================================================================
function salesSource(linkMode) {
  const base = `
    FROM OrderItems oi
    JOIN Orders o ON o.orderId = oi.orderId
    WHERE o.status <> 'cancelled'`;

  if (linkMode === "stallId") {
    // Best case: the checkout stamped the stall onto the line.
    return base + ` AND oi.stallId = @stallId`;
  }
  if (linkMode === "productId") {
    // Good case: the line remembers the product, product knows the stall.
    return (
      base +
      ` AND EXISTS (SELECT 1 FROM Products p
                    WHERE p.productId = oi.productId AND p.stallId = @stallId)`
    );
  }
  // Fallback: match on the stored text. OrderItems.productName is written
  // as "Chicken Rice (Roasted, Extra Rice)", so we accept the exact name
  // or the name followed by an add-on bracket.
  return (
    base +
    ` AND EXISTS (SELECT 1 FROM Products p
                  WHERE p.stallId = @stallId
                    AND (oi.productName = p.name OR oi.productName LIKE p.name + ' (%'))`
  );
}

// Strips the add-on bracket so "Laksa (Extra Cockles)" and "Laksa"
// roll up into one row on the Top Dishes table.
const BASE_NAME = `
  CASE WHEN CHARINDEX(' (', oi.productName) > 0
       THEN LEFT(oi.productName, CHARINDEX(' (', oi.productName) - 1)
       ELSE oi.productName END`;

// Date windows, computed in SQL so Node's timezone can never disagree
// with the database's.
const WINDOW_NOW = ` AND o.createdAt >= DATEADD(day, -(@days - 1), CAST(GETDATE() AS date))`;
const WINDOW_PREV = `
  AND o.createdAt >= DATEADD(day, -(2 * @days - 1), CAST(GETDATE() AS date))
  AND o.createdAt <  DATEADD(day, -(@days - 1), CAST(GETDATE() AS date))`;

function req(pool, stallId, days) {
  return pool.request().input("stallId", sql.Int, stallId).input("days", sql.Int, days);
}

// ===================================================================
// 3) SALES SECTIONS
// ===================================================================

// Headline numbers for the selected window.
async function salesTotals(pool, stallId, days, src, windowSql) {
  const r = await req(pool, stallId, days).query(`
    SELECT COUNT(DISTINCT o.orderId)   AS orderCount,
           ISNULL(SUM(oi.quantity), 0) AS itemsSold,
           ISNULL(SUM(oi.itemTotal), 0) AS revenue
    ${src}${windowSql}`);
  const row = r.recordset[0] || {};
  const revenue = Number(row.revenue || 0);
  const orderCount = Number(row.orderCount || 0);
  return {
    revenue: Number(revenue.toFixed(2)),
    orderCount,
    itemsSold: Number(row.itemsSold || 0),
    avgOrderValue: orderCount ? Number((revenue / orderCount).toFixed(2)) : 0,
  };
}

// Revenue per day, with zero-days filled in by SQL (day spine CTE) so the
// chart never has gaps and always spans the full window.
async function dailySeries(pool, stallId, days, src) {
  const r = await req(pool, stallId, days).query(`
    WITH dayspine AS (
      SELECT CAST(DATEADD(day, -(@days - 1), CAST(GETDATE() AS date)) AS date) AS d
      UNION ALL
      SELECT DATEADD(day, 1, d) FROM dayspine WHERE d < CAST(GETDATE() AS date)
    ),
    sales AS (
      SELECT CAST(o.createdAt AS date) AS d, o.orderId, oi.itemTotal
      ${src}${WINDOW_NOW}
    )
    SELECT ds.d AS day,
           ISNULL(SUM(s.itemTotal), 0)  AS revenue,
           COUNT(DISTINCT s.orderId)    AS orders
    FROM dayspine ds
    LEFT JOIN sales s ON s.d = ds.d
    GROUP BY ds.d
    ORDER BY ds.d
    OPTION (MAXRECURSION 0)`);

  return r.recordset.map((x) => ({
    day: x.day instanceof Date ? x.day.toISOString().slice(0, 10) : String(x.day).slice(0, 10),
    revenue: Number(Number(x.revenue).toFixed(2)),
    orders: Number(x.orders),
  }));
}

// Best sellers by revenue, add-on variants rolled up.
async function topDishes(pool, stallId, days, src) {
  const r = await req(pool, stallId, days).query(`
    SELECT TOP 5 ${BASE_NAME}          AS name,
           SUM(oi.quantity)            AS qty,
           SUM(oi.itemTotal)           AS revenue
    ${src}${WINDOW_NOW}
    GROUP BY ${BASE_NAME}
    ORDER BY SUM(oi.itemTotal) DESC`);

  return r.recordset.map((x) => ({
    name: x.name,
    qty: Number(x.qty),
    revenue: Number(Number(x.revenue).toFixed(2)),
  }));
}

// Which hours of the day actually make money (assignment: "peak hours").
async function peakHours(pool, stallId, days, src) {
  const r = await req(pool, stallId, days).query(`
    SELECT DATEPART(hour, o.createdAt) AS hour,
           COUNT(DISTINCT o.orderId)   AS orders,
           SUM(oi.itemTotal)           AS revenue
    ${src}${WINDOW_NOW}
    GROUP BY DATEPART(hour, o.createdAt)
    ORDER BY DATEPART(hour, o.createdAt)`);

  return r.recordset.map((x) => ({
    hour: Number(x.hour),
    orders: Number(x.orders),
    revenue: Number(Number(x.revenue).toFixed(2)),
  }));
}

// ===================================================================
// 4) NON-SALES SECTIONS (no dependency on QJ's schema change)
// ===================================================================

// Average rating + the 1-5 star breakdown, from T's Feedback table.
async function ratings(pool, stallId, schema) {
  if (!has(schema, "Feedback")) return null;
  const r = await pool.request().input("stallId", sql.Int, stallId).query(`
    SELECT COUNT(*) AS total,
           AVG(CAST(rating AS FLOAT)) AS avgRating,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS s5,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS s4,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS s3,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS s2,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS s1
    FROM Feedback WHERE stallId = @stallId`);
  const x = r.recordset[0] || {};
  return {
    total: Number(x.total || 0),
    avgRating: x.avgRating == null ? null : Number(Number(x.avgRating).toFixed(2)),
    breakdown: {
      5: Number(x.s5 || 0), 4: Number(x.s4 || 0), 3: Number(x.s3 || 0),
      2: Number(x.s2 || 0), 1: Number(x.s1 || 0),
    },
  };
}

// The 4 newest reviews, so the owner sees what people are actually saying.
async function recentReviews(pool, stallId, schema) {
  if (!has(schema, "Feedback")) return [];
  const r = await pool.request().input("stallId", sql.Int, stallId).query(`
    SELECT TOP 4 feedbackId, rating, comment, createdAt
    FROM Feedback WHERE stallId = @stallId ORDER BY createdAt DESC`);
  return r.recordset;
}

// Open vs resolved complaints (T's Complaints table).
async function complaints(pool, stallId, schema) {
  if (!has(schema, "Complaints")) return null;
  const r = await pool.request().input("stallId", sql.Int, stallId).query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open,
           SUM(CASE WHEN status <> 'Open' THEN 1 ELSE 0 END) AS resolved
    FROM Complaints WHERE stallId = @stallId`);
  const x = r.recordset[0] || {};
  return {
    total: Number(x.total || 0),
    open: Number(x.open || 0),
    resolved: Number(x.resolved || 0),
  };
}

// Snapshot of my own menu - this is Sprint 1 data coming back to be useful.
async function menuSnapshot(pool, stallId) {
  const r = await pool.request().input("stallId", sql.Int, stallId).query(`
    SELECT COUNT(*) AS itemCount,
           ISNULL(AVG(basePrice), 0) AS avgPrice,
           ISNULL(SUM(likes), 0)     AS totalLikes
    FROM Products WHERE stallId = @stallId`);
  const top = await pool.request().input("stallId", sql.Int, stallId).query(`
    SELECT TOP 1 name, likes FROM Products
    WHERE stallId = @stallId ORDER BY likes DESC, name ASC`);
  const x = r.recordset[0] || {};
  return {
    itemCount: Number(x.itemCount || 0),
    avgPrice: Number(Number(x.avgPrice || 0).toFixed(2)),
    totalLikes: Number(x.totalLikes || 0),
    mostLiked: top.recordset[0] || null,
  };
}

// Hygiene grade + last inspection score (Kaden's tables) and the next
// document about to expire (my own Sprint 2 table).
async function compliance(pool, stallId, schema) {
  const out = { grade: null, lastInspection: null, nextExpiry: null, expiringCount: 0 };

  if (has(schema, "HygieneGrades")) {
    const g = await pool.request().input("stallId", sql.Int, stallId).query(`
      SELECT TOP 1 grade, validFrom, validTo FROM HygieneGrades
      WHERE stallId = @stallId ORDER BY validFrom DESC`);
    out.grade = g.recordset[0] || null;
  }

  if (has(schema, "Inspections")) {
    const i = await pool.request().input("stallId", sql.Int, stallId).query(`
      SELECT TOP 1 score, completedDate, remarks FROM Inspections
      WHERE stallId = @stallId AND completedDate IS NOT NULL
      ORDER BY completedDate DESC`);
    out.lastInspection = i.recordset[0] || null;
  }

  if (has(schema, "StallAgreements")) {
    const a = await pool.request().input("stallId", sql.Int, stallId).query(`
      SELECT TOP 1 name, agreementType, expiryDate,
             DATEDIFF(day, CAST(GETDATE() AS date), expiryDate) AS daysToExpiry
      FROM StallAgreements
      WHERE stallId = @stallId AND status <> 'Terminated'
      ORDER BY expiryDate ASC`);
    out.nextExpiry = a.recordset[0] || null;

    const c = await pool.request().input("stallId", sql.Int, stallId).query(`
      SELECT COUNT(*) AS n FROM StallAgreements
      WHERE stallId = @stallId AND status <> 'Terminated'
        AND DATEDIFF(day, CAST(GETDATE() AS date), expiryDate) <= 30`);
    out.expiringCount = Number(c.recordset[0]?.n || 0);
  }

  return out;
}

// ===================================================================
// 5) THE ONE CALL THE CONTROLLER USES
// Everything runs in parallel - one round trip's worth of waiting.
// ===================================================================
async function getDashboard(stallId, days) {
  const pool = await getPool();
  const schema = await getSchema();
  const src = salesSource(schema.linkMode);

  const [current, previous, series, dishes, hours, rating, reviews, comp, menu, compl] =
    await Promise.all([
      salesTotals(pool, stallId, days, src, WINDOW_NOW),
      salesTotals(pool, stallId, days, src, WINDOW_PREV),
      dailySeries(pool, stallId, days, src),
      topDishes(pool, stallId, days, src),
      peakHours(pool, stallId, days, src),
      ratings(pool, stallId, schema),
      recentReviews(pool, stallId, schema),
      complaints(pool, stallId, schema),
      menuSnapshot(pool, stallId),
      compliance(pool, stallId, schema),
    ]);

  // Percent change vs the equally long window before this one.
  const pct = (now, before) => {
    if (!before) return now ? 100 : 0;
    return Number((((now - before) / before) * 100).toFixed(1));
  };

  return {
    stallId,
    windowDays: days,
    // Honest label for the UI: how confident are we that these sales
    // numbers belong to this stall?
    salesLink: {
      mode: schema.linkMode,
      exact: schema.linkMode !== "name",
      note:
        schema.linkMode === "name"
          ? "Sales are matched by product name because OrderItems has no stallId/productId column. Figures are indicative."
          : "Sales are linked directly to this stall.",
    },
    sales: {
      ...current,
      change: {
        revenue: pct(current.revenue, previous.revenue),
        orders: pct(current.orderCount, previous.orderCount),
        items: pct(current.itemsSold, previous.itemsSold),
      },
      previous,
    },
    series,
    topDishes: dishes,
    peakHours: hours,
    ratings: rating,
    recentReviews: reviews,
    complaints: comp,
    menu,
    compliance: compl,
  };
}

module.exports = { getDashboard, getSchema };