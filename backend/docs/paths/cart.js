// docs/paths/cart.js  (Quan Jun — the shopping cart)
//
// Covers backend/routes/cartRoutes.js. Full CRUD on one resource:
//   POST   /api/cart              Create
//   GET    /api/cart              Retrieve
//   PUT    /api/cart/{cartItemId} Update
//   DELETE /api/cart/{cartItemId} Delete (one line)
//   DELETE /api/cart              Delete (everything)
//
// Every route needs a token. There is no "cart id" in any URL: the cart is
// always the CURRENT user's, taken from the JWT, so one customer can never
// read or edit another's cart by guessing a number.

const tag = {
  name: "Cart",
  description:
    "The logged-in customer's shopping cart. Prices are always calculated " +
    "server-side from the database. (Quan Jun)",
};

const schemas = {
  CartItem: {
    type: "object",
    description: "One line in the cart. A dish with different addons is a separate line.",
    properties: {
      cartItemId: { type: "integer", example: 15 },
      userId: { type: "string", example: "4" },
      productId: { type: "integer", example: 12 },
      productName: { type: "string", example: "Hainanese Chicken Rice" },
      imagePath: { type: "string", nullable: true, example: "/media/images/ProductImage/chickenrice.jpg" },
      centerId: {
        type: "integer",
        nullable: true,
        example: 1,
        description: "Which hawker centre the dish came from. Joined in from FoodStalls, and copied onto the order at checkout.",
      },
      quantity: { type: "integer", example: 2 },
      unitPrice: {
        type: "number",
        format: "float",
        example: 6.0,
        description: "basePrice plus every chosen addon, frozen at the moment it was added.",
      },
      lineTotal: { type: "number", format: "float", example: 12.0, description: "quantity × unitPrice." },
      addons: {
        type: "array",
        description: "The options chosen for this line, with the price they cost at the time.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", example: "Roasted" },
            price: { type: "number", format: "float", example: 0.5 },
          },
        },
      },
    },
  },

  CartResponse: {
    type: "object",
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
      total: {
        type: "number",
        format: "float",
        example: 12.0,
        description: "Sum of every lineTotal. Food only — no delivery fee. Use GET /api/orders/quote for the full breakdown.",
      },
    },
  },

  AddToCartRequest: {
    type: "object",
    required: ["productId"],
    properties: {
      productId: { type: "integer", minimum: 1, example: 12 },
      quantity: {
        type: "integer",
        minimum: 1,
        maximum: 99,
        default: 1,
        example: 2,
        description: "Optional. Defaults to 1.",
      },
      optionIds: {
        type: "array",
        items: { type: "integer", minimum: 1 },
        maxItems: 20,
        example: [22, 30],
        description:
          "Optional. The optionIds ticked on the product page, from " +
          "GET /api/products/{productId}/addons. Send the IDS ONLY — never a " +
          "price. The server looks each one up and adds the real price itself, " +
          "so the cost cannot be faked from the browser. Every option must " +
          "belong to this product, and no duplicates.",
      },
    },
  },

  UpdateQuantityRequest: {
    type: "object",
    required: ["quantity"],
    properties: {
      quantity: { type: "integer", minimum: 1, maximum: 99, example: 3 },
    },
  },
};

const cartItemIdParam = {
  name: "cartItemId",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
  example: 15,
  description: "Must be a positive whole number, otherwise the request is rejected with 400.",
};

const paths = {
  "/api/cart": {
    // ------------------------------------------------------------- RETRIEVE
    get: {
      tags: ["Cart"],
      summary: "View my cart",
      description:
        "Returns every line in the current user's cart plus the food total. " +
        "Which cart is loaded comes from the token, never from the URL.",
      responses: {
        200: {
          description: "The cart. items is an empty array and total is 0 if the cart is empty.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CartResponse" } },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    // --------------------------------------------------------------- CREATE
    post: {
      tags: ["Cart"],
      summary: "Add a dish to my cart",
      description:
        "Adds a dish, optionally with customisation options.\n\n" +
        "**If the dish has no addons and is already in the cart, the existing " +
        "line's quantity goes up instead of a duplicate line appearing.** A dish " +
        "WITH addons always becomes its own line, because chicken rice with extra " +
        "chicken is genuinely a different item from plain chicken rice.\n\n" +
        "unitPrice is worked out on the server as basePrice + the price of each " +
        "chosen option, read fresh from the database.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AddToCartRequest" },
            examples: {
              plain: { summary: "Just the dish", value: { productId: 12, quantity: 2 } },
              customised: {
                summary: "With customisation",
                value: { productId: 12, quantity: 1, optionIds: [22, 30] },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Added. Returns the cart line that was created or updated.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CartItem" } },
          },
        },
        400: {
          description:
            "Validation failed, or an optionId does not belong to this product " +
            '("One or more selected options are invalid for this product.").',
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: {
          description: "No product with that productId.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Product not found." },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    // ------------------------------------------------------- DELETE (whole)
    delete: {
      tags: ["Cart"],
      summary: "Empty my whole cart",
      description:
        "Removes every line. Chosen addons are deleted first so the foreign key " +
        "on CartItemAddons is never violated.",
      responses: {
        200: {
          description: "Cleared.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Cart cleared." },
                  itemsRemoved: { type: "integer", example: 3 },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/cart/{cartItemId}": {
    // --------------------------------------------------------------- UPDATE
    put: {
      tags: ["Cart"],
      summary: "Change how many of one line",
      description:
        "**Ownership is checked before anything is written.** The controller loads " +
        "the line first and compares its userId with the one in the token — if they " +
        "differ it answers 403. Without that check, changing the number in the URL " +
        "would let anyone edit a stranger's cart.",
      parameters: [cartItemIdParam],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/UpdateQuantityRequest" } },
        },
      },
      responses: {
        200: {
          description: "Updated. Returns the line with its new quantity.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CartItem" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: {
          description: "That cart line belongs to a different user.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "You cannot modify another user's cart." },
            },
          },
        },
        404: {
          description: "No cart line with that id.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Cart item not found." },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    // --------------------------------------------------------- DELETE (one)
    delete: {
      tags: ["Cart"],
      summary: "Remove one line from my cart",
      description: "Same ownership check as PUT — you can only remove your own lines.",
      parameters: [cartItemIdParam],
      responses: {
        200: {
          description: "Removed.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Item removed from cart." },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: {
          description: "That cart line belongs to a different user.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "You cannot modify another user's cart." },
            },
          },
        },
        404: {
          description: "No cart line with that id.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Cart item not found." },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };