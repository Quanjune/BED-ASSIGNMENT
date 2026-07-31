// docs/paths/auth.js  (Aswin - user accounts)
// Signup, the logged-in user's own profile + saved card, and the admin user list.
// Login lives in login.js on purpose (get-a-token helper) - do NOT duplicate it here.

const tag = {
  name: "Accounts",
  description: "Signup, your own profile, saved card, and the admin user list. (Aswin)",
};

const schemas = {
  User: {
    type: "object",
    properties: {
      userId: { type: "integer", example: 2 },
      name: { type: "string", example: "Siti" },
      email: { type: "string", format: "email", example: "siti@test.com" },
      role: { type: "string", enum: ["customer", "vendor", "admin"], example: "customer" },
      stallId: { type: "integer", nullable: true, example: null },
      cardLast4: { type: "string", nullable: true, example: "1111" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
};

const paths = {
  "/api/auth/signup": {
    post: {
      tags: ["Accounts"],
      summary: "Create a customer or vendor account",
      security: [], // public
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "email", "password", "role"],
              properties: {
                name: { type: "string", example: "Jane Tan" },
                email: { type: "string", format: "email", example: "jane@test.com" },
                password: {
                  type: "string",
                  example: "Password123",
                  description: "8+ characters, with at least one letter and one number.",
                },
                role: { type: "string", enum: ["customer", "vendor"], example: "customer" },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Account created." },
        400: { $ref: "#/components/responses/BadRequest" },
        409: {
          description: "Email already in use.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Email already registered." },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/auth/me": {
    get: {
      tags: ["Accounts"],
      summary: "Get your own profile",
      responses: {
        200: {
          description: "Your profile.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
    put: {
      tags: ["Accounts"],
      summary: "Update your own name and email",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", example: "Jane Tan" },
                email: { type: "string", format: "email", example: "jane@test.com" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Profile updated." },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
    delete: {
      tags: ["Accounts"],
      summary: "Delete your own account",
      responses: {
        200: { description: "Account deleted." },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/auth/me/card": {
    put: {
      tags: ["Accounts"],
      summary: "Save a payment card (only the last 4 digits are stored)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cardNumber"],
              properties: {
                cardNumber: {
                  type: "string",
                  example: "4111111111111111",
                  description: "The full number is sent, but only the last 4 digits are stored.",
                },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Card saved." },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
    delete: {
      tags: ["Accounts"],
      summary: "Remove your saved card",
      responses: {
        200: { description: "Card removed." },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/auth/users": {
    get: {
      tags: ["Accounts"],
      summary: "List all users (admin only)",
      responses: {
        200: {
          description: "Array of users.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/User" } },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };
