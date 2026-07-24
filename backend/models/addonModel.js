// models/addonModel.js
// MODEL layer: reads a product's customisation options (addon groups + options).
// Used by the product page so the customer can choose e.g. Steamed/Roasted.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// Return all addon groups for a product, each with its options nested inside.
// Shape: [ { groupId, title, groupType, isRequired, options: [ {optionId,label,price} ] } ]
async function getAddonsByProduct(productId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("productId", sql.Int, productId);

  // One query pulls every group+option for the product; we nest them in JS.
  const result = await request.query(
    "SELECT g.groupId, g.title, g.groupType, g.isRequired, g.sortOrder AS gSort, " +
    "       o.optionId, o.label, o.price, o.sortOrder AS oSort " +
    "FROM AddonGroups g " +
    "JOIN AddonOptions o ON o.groupId = g.groupId " +
    "WHERE g.productId = @productId " +
    "ORDER BY g.sortOrder, o.sortOrder"
  );

  // Group the flat rows into nested groups.
  const groups = [];
  const byId = {};
  for (const row of result.recordset) {
    if (!byId[row.groupId]) {
      byId[row.groupId] = {
        groupId: row.groupId,
        title: row.title,
        groupType: row.groupType,   // 'radio' | 'checkbox'
        isRequired: !!row.isRequired,
        options: []
      };
      groups.push(byId[row.groupId]);
    }
    byId[row.groupId].options.push({
      optionId: row.optionId,
      label: row.label,
      price: Number(row.price)
    });
  }
  return groups;
}

// Given a list of chosen optionIds, return their real rows (id, label, price,
// and which group + product they belong to). Used server-side so the client
// can never invent a price or attach an option from another product.
async function getOptionsByIds(optionIds) {
  if (!optionIds || optionIds.length === 0) return [];
  const pool = await sql.connect(dbConfig);
  const request = pool.request();

  // Build a safe parameter list @o0, @o1, ... (still fully parameterized).
  const params = optionIds.map((id, i) => {
    request.input("o" + i, sql.Int, id);
    return "@o" + i;
  });

  const result = await request.query(
    "SELECT o.optionId, o.label, o.price, g.productId " +
    "FROM AddonOptions o " +
    "JOIN AddonGroups g ON g.groupId = o.groupId " +
    "WHERE o.optionId IN (" + params.join(",") + ")"
  );
  return result.recordset;
}

module.exports = { getAddonsByProduct, getOptionsByIds };
