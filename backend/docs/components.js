// docs/components.js
// The pieces EVERY feature shares: the JWT security scheme, the two error
// body shapes, and the error responses that almost any endpoint can produce.
//
// Keeping them here means a path file can write
//   401: { $ref: "#/components/responses/Unauthorized" }
// instead of repeating the same block on every operation.
//
// >>> DO NOT add your feature's own schemas here. <<<
// Export them from your own paths/<feature>.js instead - index.js merges them
// in automatically, and that way we are not all editing the same file. See
// ./README.md.

// --- How a client authenticates -------------------------------------------
// POST /api/auth/login returns accessToken. The client then sends
//   Authorization: Bearer <accessToken>
// on every request. In Swagger UI you paste the token once into the green
// "Authorize" button and it is attached automatically.
const securitySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Log in with POST /api/auth/login, copy the accessToken from the " +
      "response, click Authorize above and paste it in.",
  },
};

// --- Error body shapes -----------------------------------------------------
const schemas = {
  Error: {
    type: "object",
    description:
      "Standard error body. Most routes use 'message'; some of the older ones " +
      "use 'error' instead.",
    properties: {
      message: { type: "string", example: "Something went wrong on the server." },
    },
  },

  ValidationError: {
    type: "object",
    description: "A 400 from a validation middleware. 'field' names the offending input.",
    properties: {
      message: { type: "string", example: "basePrice is required and must be a positive number." },
      field: { type: "string", example: "basePrice" },
    },
  },
};

// --- Error responses shared by many endpoints ------------------------------
const responses = {
  BadRequest: {
    description: "Validation failed. The body did not pass the route's validation middleware.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ValidationError" },
      },
    },
  },

  Unauthorized: {
    description: "No token was sent, or the token is missing/expired.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: { message: "No token provided." },
      },
    },
  },

  Forbidden: {
    description: "Logged in, but this role (or this user) is not allowed to do it.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: { message: "Access denied." },
      },
    },
  },

  NotFound: {
    description: "No record with that id.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: { message: "Not found." },
      },
    },
  },

  ServerError: {
    description: "Unexpected server or database error.",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
};

module.exports = { securitySchemes, schemas, responses };
