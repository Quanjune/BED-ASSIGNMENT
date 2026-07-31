// docs/paths/vendors.js  (Kishore - vendor management)
// Mounted at /api/vendors/menu, /agreements, /stall and /performance.
//
// This file is self-contained: it declares its own tag, its own schemas and
// its own paths, and index.js picks all three up automatically. See
// ../README.md for the contract if you are adding your own feature file.
//
// The one rule that shapes all of these: THERE IS NO stallId IN ANY URL OR
// BODY. The requireVendor chain (token -> role 'vendor' -> look up the stall
// that account owns) attaches req.stallId, and every handler uses that. A
// vendor therefore cannot reach another stall's data by editing a request.
//
// That also explains the 403 below: a vendor account with no stall assigned
// yet is logged in and has the right role, but has nothing to manage.

// --- The group this feature appears under in Swagger UI -------------------
const tag = {
  name: "Vendor",
  description:
    "Vendor Management (Kishore): the logged-in vendor's own stall, menu, " +
    "rental agreements and performance dashboard.",
};

// --- Object shapes owned by this feature ----------------------------------
// Merged into components.schemas, so they are referenced as
// "#/components/schemas/MenuItem" from the operations below.
const schemas = {
  MenuItem: {
    type: "object",
    description: "A dish on the vendor's own menu. Stored in the Products table.",
    properties: {
      productId: { type: "integer", example: 7 },
      stallId: {
        type: "integer",
        description: "Always the caller's own stall - it is set from the token, not the request.",
        example: 1,
      },
      name: { type: "string", example: "Hainanese Chicken Rice" },
      description: { type: "string", nullable: true },
      imagePath: { type: "string", nullable: true, example: "/media/chicken-rice.jpg" },
      basePrice: { type: "number", format: "double", example: 5.5 },
      likes: { type: "integer", example: 12 },
    },
  },

  MenuItemRequest: {
    type: "object",
    required: ["name", "basePrice"],
    description:
      "No stallId: the server takes it from the login token, so a vendor can only " +
      "ever change their own menu. Sending stallId is rejected as an unknown field.",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100, example: "Chicken Rice Set" },
      description: { type: "string", nullable: true, maxLength: 500 },
      imagePath: { type: "string", nullable: true, maxLength: 300, example: "/media/set.jpg" },
      basePrice: { type: "number", format: "double", exclusiveMinimum: 0, example: 6.5 },
    },
  },

  Agreement: {
    type: "object",
    properties: {
      agreementId: { type: "integer", example: 2 },
      stallId: { type: "integer", example: 1 },
      name: { type: "string", example: "Stall 01-32 rental" },
      agreementType: {
        type: "string",
        enum: ["Rental", "Store Licence", "Food Safety", "Fire Safety", "Other"],
        example: "Rental",
      },
      startDate: { type: "string", format: "date", example: "2026-01-01" },
      expiryDate: { type: "string", format: "date", example: "2026-12-31" },
      monthlyRent: { type: "number", format: "double", nullable: true, example: 1800 },
      status: {
        type: "string",
        description:
          "Active or Terminated are set by the vendor. 'Expiring Soon' and 'Expired' " +
          "are computed by the backend from expiryDate, so they cannot be faked.",
        example: "Active",
      },
    },
  },

  AgreementRequest: {
    type: "object",
    required: ["name", "agreementType", "startDate", "expiryDate"],
    description: "No stallId: it comes from the login token, same as the menu.",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150, example: "Stall 01-32 rental" },
      agreementType: {
        type: "string",
        enum: ["Rental", "Store Licence", "Food Safety", "Fire Safety", "Other"],
        example: "Rental",
      },
      startDate: { type: "string", format: "date", example: "2026-01-01" },
      expiryDate: {
        type: "string",
        format: "date",
        description: "Must be after startDate.",
        example: "2026-12-31",
      },
      monthlyRent: {
        type: "number",
        format: "double",
        nullable: true,
        description: "Required when agreementType is 'Rental', optional otherwise.",
        example: 1800,
      },
      status: { type: "string", enum: ["Active", "Terminated"], default: "Active", example: "Active" },
    },
  },
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
  example: 5,
};

// Every route in this file goes through requireVendor, so they all share
// these three failure cases.
const vendorAuthResponses = {
  401: { $ref: "#/components/responses/Unauthorized" },
  403: {
    description: "Not a vendor, or a vendor account with no stall assigned yet.",
    content: {
      "application/json": {
        schema: { type: "object", properties: { error: { type: "string" } } },
        example: { error: "This vendor account has no stall assigned yet." },
      },
    },
  },
  500: {
    description: "Unexpected server or database error.",
    content: {
      "application/json": {
        schema: { type: "object", properties: { error: { type: "string" } } },
        example: { error: "Internal Server Error" },
      },
    },
  },
};

// --- The endpoints ---------------------------------------------------------
const paths = {
  // ----------------------------------------------------------------
  // My stall
  // ----------------------------------------------------------------
  "/api/vendors/stall": {
    get: {
      tags: ["Vendor"],
      summary: "Which stall am I?",
      description:
        "Called right after login so the dashboard can show " +
        "\"Your stall: Tian Tian Chicken Rice - Maxwell Food Centre\".",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "The caller's stall.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  stallId: { type: "integer", example: 1 },
                  stallName: { type: "string", example: "Tian Tian Chicken Rice" },
                  imagePath: { type: "string", nullable: true },
                  centerName: { type: "string", example: "Maxwell Food Centre" },
                  location: { type: "string", nullable: true, example: "1 Kadayanallur St" },
                },
              },
            },
          },
        },
        404: {
          description: "The linked stall row no longer exists.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { error: { type: "string" } } },
              example: { error: "Stall not found" },
            },
          },
        },
        ...vendorAuthResponses,
      },
    },
  },

  // ----------------------------------------------------------------
  // My menu
  // ----------------------------------------------------------------
  "/api/vendors/menu": {
    get: {
      tags: ["Vendor"],
      summary: "List my menu items",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Products belonging to the caller's stall.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/MenuItem" } },
            },
          },
        },
        ...vendorAuthResponses,
      },
    },

    post: {
      tags: ["Vendor"],
      summary: "Add an item to my menu",
      description: "The stall is taken from the token. Sending a stallId is rejected by Joi.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/MenuItemRequest" } },
        },
      },
      responses: {
        201: {
          description: "Item created.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/MenuItem" } } },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        ...vendorAuthResponses,
      },
    },
  },

  "/api/vendors/menu/{id}": {
    get: {
      tags: ["Vendor"],
      summary: "Get one of my menu items",
      description: "404 rather than 403 for another stall's item - the row simply is not in scope.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        200: {
          description: "The menu item.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/MenuItem" } } },
        },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },

    put: {
      tags: ["Vendor"],
      summary: "Edit one of my menu items",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/MenuItemRequest" } },
        },
      },
      responses: {
        200: {
          description: "Item updated.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/MenuItem" } } },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },

    delete: {
      tags: ["Vendor"],
      summary: "Remove one of my menu items",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        200: {
          description: "Item deleted.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Menu item deleted." },
            },
          },
        },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },
  },

  // ----------------------------------------------------------------
  // My agreements
  // ----------------------------------------------------------------
  "/api/vendors/agreements": {
    get: {
      tags: ["Vendor"],
      summary: "List my rental and licence agreements",
      description:
        "`status` comes back as Active or Terminated as stored, or as 'Expiring Soon' " +
        "/ 'Expired' when the backend works that out from expiryDate.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Agreements for the caller's stall.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Agreement" } },
            },
          },
        },
        ...vendorAuthResponses,
      },
    },

    post: {
      tags: ["Vendor"],
      summary: "Add an agreement",
      description:
        "Two rules produce a 400: expiryDate must be after startDate, and monthlyRent " +
        "is required when agreementType is 'Rental'.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/AgreementRequest" } },
        },
      },
      responses: {
        201: {
          description: "Agreement created.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Agreement" } } },
        },
        400: {
          description: "Validation failed.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationError" },
              examples: {
                dates: {
                  summary: "Bad dates",
                  value: { message: "expiryDate must be after startDate", field: "expiryDate" },
                },
                rent: {
                  summary: "Rental with no rent",
                  value: {
                    message: "monthlyRent is required for Rental agreements",
                    field: "monthlyRent",
                  },
                },
              },
            },
          },
        },
        ...vendorAuthResponses,
      },
    },
  },

  "/api/vendors/agreements/{id}": {
    get: {
      tags: ["Vendor"],
      summary: "Get one of my agreements",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        200: {
          description: "The agreement.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Agreement" } } },
        },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },

    put: {
      tags: ["Vendor"],
      summary: "Edit one of my agreements",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/AgreementRequest" } },
        },
      },
      responses: {
        200: {
          description: "Agreement updated.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Agreement" } } },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },

    delete: {
      tags: ["Vendor"],
      summary: "Delete one of my agreements",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        200: {
          description: "Agreement deleted.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Agreement deleted." },
            },
          },
        },
        404: { $ref: "#/components/responses/NotFound" },
        ...vendorAuthResponses,
      },
    },
  },

  // ----------------------------------------------------------------
  // My performance dashboard
  // ----------------------------------------------------------------
  "/api/vendors/performance": {
    get: {
      tags: ["Vendor"],
      summary: "My stall's performance dashboard",
      description:
        "Everything the dashboard page needs in one call: sales for the window and " +
        "how they compare with the previous window of the same length, a daily " +
        "revenue series, best sellers, peak hours, ratings, complaints, a menu " +
        "snapshot and compliance status.\n\n" +
        "A brand new stall is not an error - the sections come back zeroed so the " +
        "page can show an empty state.\n\n" +
        "Note `salesLink`: when OrderItems cannot be linked to a stall by id, sales " +
        "are matched by product name instead and the figures are only indicative. " +
        "That flag is there so the UI can say so honestly.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "days",
          in: "query",
          required: false,
          schema: { type: "integer", enum: [7, 14, 30, 90], default: 30 },
          description:
            "Size of the window. Any other value is a 400 rather than being silently " +
            "rounded, so a typo shows up instead of producing wrong data.",
          example: 30,
        },
      ],
      responses: {
        200: {
          description: "The dashboard payload.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  stallId: { type: "integer", example: 1 },
                  windowDays: { type: "integer", example: 30 },
                  salesLink: {
                    type: "object",
                    description: "How confident the backend is that these sales belong to this stall.",
                    properties: {
                      mode: { type: "string", example: "stallId" },
                      exact: { type: "boolean", example: true },
                      note: { type: "string", example: "Sales are linked directly to this stall." },
                    },
                  },
                  sales: {
                    type: "object",
                    properties: {
                      revenue: { type: "number", format: "double", example: 1840.5 },
                      orderCount: { type: "integer", example: 96 },
                      itemsSold: { type: "integer", example: 214 },
                      avgOrderValue: { type: "number", format: "double", example: 19.17 },
                      change: {
                        type: "object",
                        description: "Percent change against the previous window of the same length.",
                        properties: {
                          revenue: { type: "number", format: "double", example: 12.4 },
                          orders: { type: "number", format: "double", example: 8.1 },
                          items: { type: "number", format: "double", example: -2.5 },
                        },
                      },
                      previous: {
                        type: "object",
                        description: "The same headline numbers for the previous window.",
                        properties: {
                          revenue: { type: "number", format: "double" },
                          orderCount: { type: "integer" },
                          itemsSold: { type: "integer" },
                          avgOrderValue: { type: "number", format: "double" },
                        },
                      },
                    },
                  },
                  series: {
                    type: "array",
                    description: "Revenue per day. Days with no sales are included as zeros.",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "string", format: "date", example: "2026-07-14" },
                        revenue: { type: "number", format: "double", example: 62.5 },
                        orders: { type: "integer", example: 4 },
                      },
                    },
                  },
                  topDishes: {
                    type: "array",
                    description: "Top 5 by revenue, with addon variants rolled up.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", example: "Hainanese Chicken Rice" },
                        qty: { type: "integer", example: 84 },
                        revenue: { type: "number", format: "double", example: 462.0 },
                      },
                    },
                  },
                  peakHours: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hour: { type: "integer", example: 12 },
                        orders: { type: "integer", example: 21 },
                        revenue: { type: "number", format: "double", example: 288.4 },
                      },
                    },
                  },
                  ratings: {
                    type: "object",
                    nullable: true,
                    description: "null when the Feedback table is not present.",
                    properties: {
                      total: { type: "integer", example: 18 },
                      avgRating: { type: "number", format: "double", nullable: true, example: 4.6 },
                      breakdown: {
                        type: "object",
                        description: "Count of reviews at each star level, keyed 1-5.",
                        additionalProperties: { type: "integer" },
                        example: { 5: 12, 4: 4, 3: 1, 2: 1, 1: 0 },
                      },
                    },
                  },
                  recentReviews: {
                    type: "array",
                    description: "The 4 newest reviews.",
                    items: {
                      type: "object",
                      properties: {
                        feedbackId: { type: "integer" },
                        rating: { type: "integer" },
                        comment: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                  complaints: {
                    type: "object",
                    nullable: true,
                    properties: {
                      total: { type: "integer", example: 3 },
                      open: { type: "integer", example: 1 },
                      resolved: { type: "integer", example: 2 },
                    },
                  },
                  menu: {
                    type: "object",
                    properties: {
                      itemCount: { type: "integer", example: 8 },
                      avgPrice: { type: "number", format: "double", example: 5.75 },
                      totalLikes: { type: "integer", example: 44 },
                      mostLiked: {
                        type: "object",
                        nullable: true,
                        properties: {
                          name: { type: "string", example: "Hainanese Chicken Rice" },
                          likes: { type: "integer", example: 21 },
                        },
                      },
                    },
                  },
                  compliance: {
                    type: "object",
                    properties: {
                      grade: {
                        type: "object",
                        nullable: true,
                        properties: {
                          grade: { type: "string", example: "A" },
                          validFrom: { type: "string", format: "date" },
                          validTo: { type: "string", format: "date" },
                        },
                      },
                      lastInspection: {
                        type: "object",
                        nullable: true,
                        properties: {
                          score: { type: "integer", example: 88 },
                          completedDate: { type: "string", format: "date" },
                          remarks: { type: "string", nullable: true },
                        },
                      },
                      nextExpiry: {
                        type: "object",
                        nullable: true,
                        description: "The soonest non-terminated agreement to expire.",
                        properties: {
                          name: { type: "string", example: "Stall 01-32 rental" },
                          agreementType: { type: "string", example: "Rental" },
                          expiryDate: { type: "string", format: "date" },
                          daysToExpiry: { type: "integer", example: 42 },
                        },
                      },
                      expiringCount: {
                        type: "integer",
                        description: "Agreements expiring within 30 days.",
                        example: 0,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "`days` was not one of 7, 14, 30, 90.",
          content: {
            "application/json": {
              schema: { type: "object", properties: { error: { type: "string" } } },
              example: { error: "'days' must be one of 7, 14, 30, 90." },
            },
          },
        },
        ...vendorAuthResponses,
      },
    },
  },
};

module.exports = { tag, schemas, paths };
