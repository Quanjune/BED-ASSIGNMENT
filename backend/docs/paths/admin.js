// docs/paths/admin.js  (Aswin - admin dashboards)
// Admin-only analytics, revenue & orders, and user management.
// Every endpoint needs an admin Bearer token: 401 without one, 403 if not an admin.

const tag = {
  name: "Admin",
  description: "Admin-only dashboards: analytics, revenue & orders, and user management. (Aswin)",
};

// The three failure responses every admin route shares (spread into each below).
const adminErrors = {
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
  500: { $ref: "#/components/responses/ServerError" },
};

// Small helper: all the analytics/revenue endpoints are read-only GETs that
// return JSON and share the same auth errors, so this keeps them DRY.
const adminGet = (summary, okDescription) => ({
  get: {
    tags: ["Admin"],
    summary,
    responses: { 200: { description: okDescription }, ...adminErrors },
  },
});

const paths = {
  // --- Analytics & Reports ---
  "/api/admin/summary": adminGet(
    "Headline stats: users, complaints, average rating, best hawker centre",
    "Summary object with the headline numbers."
  ),
  "/api/admin/complaints-by-centre": adminGet(
    "Complaint counts per hawker centre (bar chart)",
    "Array of centre and count."
  ),
  "/api/admin/complaints-by-category": adminGet(
    "Complaint counts per category (doughnut chart)",
    "Array of category and count."
  ),
  "/api/admin/complaints-by-month": adminGet(
    "Complaints per month (trend line)",
    "Array of month and count."
  ),
  "/api/admin/top-stalls": adminGet(
    "Top stalls by average rating (with reviews, complaints, orders, revenue)",
    "Array of stall rows."
  ),
  "/api/admin/agreements-summary": adminGet(
    "Rental agreement stats (active, expiring within 30 days, total monthly rent)",
    "Agreement summary object."
  ),

  // --- Revenue & Orders ---
  "/api/admin/revenue-summary": adminGet(
    "Total revenue, total orders, average order value, best hawker by revenue",
    "Revenue summary object."
  ),
  "/api/admin/revenue-by-month": adminGet(
    "Revenue per month (trend line)",
    "Array of month and revenue."
  ),
  "/api/admin/orders-by-payment": adminGet(
    "Order counts per payment method (Cash / PayNow / Visa / Mastercard)",
    "Array of method and count."
  ),
  "/api/admin/revenue-by-centre": adminGet(
    "Revenue per hawker centre (bar chart)",
    "Array of centre and revenue."
  ),
  "/api/admin/top-stalls-by-revenue": adminGet(
    "Top stalls ranked by revenue (with order counts)",
    "Array of stall, centre, orderCount and revenue."
  ),

  // --- Third-party API (data.gov.sg) ---
  "/api/admin/nea/hawker-centres": {
    get: {
      tags: ["Admin"],
      summary: "Live NEA hawker-centre data (third-party API via data.gov.sg)",
      description:
        "The back-end fetches the official NEA 'Hawker Centres' dataset from " +
        "data.gov.sg, trims it to the fields we need, and returns it with a " +
        "summary. Cached ~10 minutes so we don't call the government API on every load.",
      responses: {
        200: { description: "Hawker-centre list plus a summary (totalCentres, totalStalls...)." },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        502: { description: "Could not reach data.gov.sg (upstream error or timeout)." },
      },
    },
  },

  // --- User management ---
  "/api/admin/users": adminGet(
    "List all users, each with the stall they own (if any)",
    "Array of users."
  ),
  "/api/admin/users/{id}": {
    delete: {
      tags: ["Admin"],
      summary: "Delete a user by id",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer" },
          example: 5,
          description: "The userId to delete.",
        },
      ],
      responses: {
        200: { description: "User deleted." },
        400: { description: "Invalid id, or you tried to delete your own account." },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        409: { description: "User still has related records (orders, reviews, etc.)." },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, paths };
