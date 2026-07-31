// docs/paths/menu.js  (Quan Jun — browsing the menu + product CRUD)
//
// Covers backend/routes/productRoutes.js and backend/routes/addonRoutes.js.
// The browse chain is: centres -> stalls in a centre -> products in a stall ->
// one product -> that product's customisation options. All of it is public, so
// a guest can look at the food before deciding to sign up. Writing to the menu
// (POST/PUT/DELETE on a product) is vendor/admin only.

const tag = {
  name: "Menu",
  description:
    "Browse hawker centres, stalls, dishes and their customisation options, " +
    "plus create/update/delete a dish. (Quan Jun)",
};

const schemas = {
  HawkerCenter: {
    type: "object",
    properties: {
      centerId: { type: "integer", example: 1 },
      name: { type: "string", example: "Maxwell Food Centre" },
      description: { type: "string", nullable: true, example: "A Chinatown institution since 1928." },
      location: { type: "string", nullable: true, example: "1 Kadayanallur St, Singapore 069184" },
      imagePath: { type: "string", nullable: true, example: "/media/images/centers/maxwell.jpg" },
    },
  },

  FoodStall: {
    type: "object",
    properties: {
      stallId: { type: "integer", example: 4 },
      centerId: { type: "integer", example: 1 },
      name: { type: "string", example: "Tian Tian Hainanese Chicken Rice" },
      imagePath: { type: "string", nullable: true, example: "/media/images/stalls/tiantian.jpg" },
    },
  },

  Product: {
    type: "object",
    properties: {
      productId: { type: "integer", example: 12 },
      stallId: { type: "integer", example: 4 },
      name: { type: "string", example: "Hainanese Chicken Rice" },
      description: { type: "string", nullable: true, example: "Poached chicken with fragrant rice." },
      imagePath: { type: "string", nullable: true, example: "/media/images/ProductImage/chickenrice.jpg" },
      basePrice: { type: "number", format: "float", example: 5.5 },
      likes: { type: "integer", example: 42 },
    },
  },

  // Body for POST /api/products and PUT /api/products/{id}.
  // Limits mirror the column widths in database/qj and kishore masterdata.sql —
  // middlewares/productValidation.js enforces exactly these.
  ProductRequest: {
    type: "object",
    required: ["stallId", "name", "basePrice"],
    properties: {
      stallId: { type: "integer", minimum: 1, example: 4, description: "Which stall sells it. Must exist." },
      name: { type: "string", minLength: 2, maxLength: 100, example: "Hainanese Chicken Rice" },
      description: { type: "string", maxLength: 500, nullable: true, example: "Poached chicken with fragrant rice." },
      imagePath: { type: "string", maxLength: 300, nullable: true, example: "/media/images/ProductImage/chickenrice.jpg" },
      basePrice: { type: "number", format: "float", minimum: 0, maximum: 9999.99, example: 5.5 },
    },
  },

  // One customisation group, e.g. "Choose your chicken" with radio options.
  AddonGroup: {
    type: "object",
    properties: {
      groupId: { type: "integer", example: 7 },
      title: { type: "string", example: "Choose your chicken" },
      groupType: {
        type: "string",
        enum: ["radio", "checkbox"],
        example: "radio",
        description: "radio = pick exactly one. checkbox = pick any number.",
      },
      isRequired: { type: "boolean", example: true },
      options: {
        type: "array",
        items: { $ref: "#/components/schemas/AddonOption" },
      },
    },
  },

  AddonOption: {
    type: "object",
    properties: {
      optionId: { type: "integer", example: 21 },
      label: { type: "string", example: "Roasted" },
      price: {
        type: "number",
        format: "float",
        example: 0.5,
        description: "Added on top of the product's basePrice. 0 means free.",
      },
    },
  },
};

// Reusable path-parameter definitions so the same block isn't retyped.
const idParam = (name, example) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
  example,
  description: "Must be a positive whole number, otherwise the request is rejected with 400.",
});

const paths = {
  // ---------------------------------------------------------------- CENTRES
  "/api/centers": {
    get: {
      tags: ["Menu"],
      summary: "List every hawker centre",
      description: "The entry point for browsing. Public — no token needed.",
      security: [],
      responses: {
        200: {
          description: "Every hawker centre. An empty array if none have been added yet.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/HawkerCenter" } },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/centers/{id}": {
    get: {
      tags: ["Menu"],
      summary: "Get one hawker centre",
      security: [],
      parameters: [idParam("id", 1)],
      responses: {
        200: {
          description: "The centre.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/HawkerCenter" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/centers/{centerId}/stalls": {
    get: {
      tags: ["Menu"],
      summary: "List the stalls inside one hawker centre",
      security: [],
      parameters: [idParam("centerId", 1)],
      responses: {
        200: {
          description:
            "The stalls in that centre. Returns an empty array (not a 404) if the " +
            "centre exists but has no stalls yet, or if the id matches no centre.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/FoodStall" } },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  // ----------------------------------------------------------------- STALLS
  "/api/stalls/{id}": {
    get: {
      tags: ["Menu"],
      summary: "Get one stall",
      security: [],
      parameters: [idParam("id", 4)],
      responses: {
        200: {
          description: "The stall.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/FoodStall" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/stalls/{stallId}/products": {
    get: {
      tags: ["Menu"],
      summary: "List the dishes sold by one stall",
      security: [],
      parameters: [idParam("stallId", 4)],
      responses: {
        200: {
          description: "That stall's dishes. Empty array if the stall has no dishes.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Product" } },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  // --------------------------------------------------------------- PRODUCTS
  "/api/products": {
    post: {
      tags: ["Menu"],
      summary: "Create a dish",
      description:
        "Vendor or admin only. The body is checked by " +
        "middlewares/productValidation.js before it reaches the database.",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ProductRequest" } },
        },
      },
      responses: {
        201: {
          description: "Created. Returns the new dish including its generated productId.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Product" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/products/{id}": {
    get: {
      tags: ["Menu"],
      summary: "Get one dish",
      description: "Public — the product detail page calls this before you log in.",
      security: [],
      parameters: [idParam("id", 12)],
      responses: {
        200: {
          description: "The dish.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Product" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    put: {
      tags: ["Menu"],
      summary: "Update a dish",
      description:
        "Vendor or admin only. Replaces name, description, imagePath and basePrice. " +
        "stallId is validated but the dish is not moved between stalls.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam("id", 12)],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ProductRequest" } },
        },
      },
      responses: {
        200: {
          description: "Updated. Returns the dish as it now stands.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Product" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    delete: {
      tags: ["Menu"],
      summary: "Delete a dish",
      description:
        "Vendor or admin only. Fails with 500 if the dish is still referenced by " +
        "a cart line or a past order — the foreign keys deliberately stop history " +
        "from being silently rewritten.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam("id", 12)],
      responses: {
        200: {
          description: "Deleted.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Product deleted." },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  // ----------------------------------------------------------------- ADDONS
  "/api/products/{productId}/addons": {
    get: {
      tags: ["Menu"],
      summary: "Get a dish's customisation options",
      description:
        "Returns the option groups for one dish — e.g. a required radio group " +
        '"Choose your chicken" (Steamed / Roasted) and an optional checkbox group ' +
        '"Add extras". The product detail page renders these, and the optionIds ' +
        "the customer ticks get sent to POST /api/cart.\n\n" +
        "Public, like the rest of the menu: a guest can see what a dish comes with " +
        "before signing up. Prices here are the EXTRA charged on top of basePrice.",
      security: [],
      parameters: [idParam("productId", 12)],
      responses: {
        200: {
          description:
            "The option groups, in display order. An empty array means this dish " +
            "has no customisation — that is normal, not an error.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/AddonGroup" } },
              example: [
                {
                  groupId: 7,
                  title: "Choose your chicken",
                  groupType: "radio",
                  isRequired: true,
                  options: [
                    { optionId: 21, label: "Steamed", price: 0 },
                    { optionId: 22, label: "Roasted", price: 0.5 },
                  ],
                },
                {
                  groupId: 8,
                  title: "Add extras",
                  groupType: "checkbox",
                  isRequired: false,
                  options: [
                    { optionId: 30, label: "Extra chicken", price: 2 },
                    { optionId: 31, label: "Fried egg", price: 1 },
                  ],
                },
              ],
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };