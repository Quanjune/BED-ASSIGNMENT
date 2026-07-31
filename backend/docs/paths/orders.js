// docs/paths/orders.js  (Quan Jun — checkout and order history)
//
// Covers backend/routes/orderRoutes.js.
//   GET  /api/orders/quote   preview the fees for the current cart
//   POST /api/orders         checkout: turn the cart into a paid order
//   GET  /api/orders         this customer's past orders
//
// The client NEVER sends money. It sends a payment method, a fulfillment type
// and, at most, a promo CODE. Every dollar figure is recalculated on the server
// from the stored prices, so a tampered request cannot buy food cheaply.

const tag = {
  name: "Orders",
  description:
    "Checkout and order history. All totals are computed server-side; the " +
    "promo code is looked up through Timely's promo model. (Quan Jun)",
};

const schemas = {
  // Shared by the quote and the checkout response — the same calculateFees()
  // function in orderModel.js produces both, so the cart page and the receipt
  // can never disagree.
  FeeBreakdown: {
    type: "object",
    properties: {
      subtotal: { type: "number", format: "float", example: 12.0, description: "Food only." },
      deliveryFee: { type: "number", format: "float", example: 5.0, description: "Flat $5 on delivery, $0 on takeaway." },
      minOrderFee: {
        type: "number",
        format: "float",
        example: 0,
        description:
          "Delivery has a $12 minimum. A cart below it is charged the shortfall " +
          "(a $5 cart pays $7). Worked out from the subtotal BEFORE any discount, " +
          "so a promo code can never be used to dodge the minimum.",
      },
      discount: {
        type: "number",
        format: "float",
        example: 2.0,
        description: "Taken off the food subtotal only, never off the delivery fee. Capped at the subtotal.",
      },
      total: { type: "number", format: "float", example: 15.0, description: "What the customer pays. Never below 0." },
      minOrder: { type: "number", format: "float", example: 12.0, description: "The delivery minimum, so the page can explain the fee." },
      promoCode: { type: "string", nullable: true, example: "SAVE2" },
    },
  },

  QuoteResponse: {
    allOf: [
      { $ref: "#/components/schemas/FeeBreakdown" },
      {
        type: "object",
        properties: {
          promoError: {
            type: "string",
            nullable: true,
            example: "That code has expired.",
            description:
              "A bad code here is NOT an error response. The quote still returns " +
              "200 with no discount and this field filled in, so the cart page can " +
              "show why the code was rejected without wiping the rest of the totals.",
          },
        },
      },
    ],
  },

  CheckoutRequest: {
    type: "object",
    required: ["paymentMethod", "fulfillment"],
    properties: {
      paymentMethod: {
        type: "string",
        enum: ["cash", "paynow", "visa", "mastercard"],
        example: "paynow",
        description: "An allow-list — anything else is rejected with 400. visa/mastercard need a saved card on the profile.",
      },
      fulfillment: { type: "string", enum: ["takeaway", "delivery"], example: "delivery" },
      promoCode: {
        type: "string",
        maxLength: 30,
        nullable: true,
        example: "SAVE2",
        description: "Optional. The code only — the server looks up what it is worth.",
      },
    },
  },

  OrderConfirmation: {
    allOf: [
      { type: "object", properties: { orderId: { type: "integer", example: 31 } } },
      { $ref: "#/components/schemas/FeeBreakdown" },
      {
        type: "object",
        properties: {
          paymentMethod: { type: "string", example: "paynow" },
          fulfillment: { type: "string", example: "delivery" },
          status: { type: "string", example: "paid" },
        },
      },
    ],
  },

  OrderHistoryEntry: {
    type: "object",
    properties: {
      orderId: { type: "integer", example: 31 },
      centerName: {
        type: "string",
        nullable: true,
        example: "Maxwell Food Centre",
        description: "LEFT JOINed from HawkerCenters, so older orders with no centerId still appear rather than vanishing.",
      },
      subtotal: { type: "number", format: "float", example: 12.0 },
      discount: { type: "number", format: "float", example: 2.0, description: "Read from the order itself, not recalculated, in case the code was edited later." },
      deliveryFee: { type: "number", format: "float", example: 5.0 },
      minOrderFee: { type: "number", format: "float", example: 0 },
      total: { type: "number", format: "float", example: 15.0 },
      promoCode: { type: "string", nullable: true, example: "SAVE2" },
      paymentMethod: { type: "string", example: "paynow" },
      fulfillment: { type: "string", example: "delivery" },
      status: { type: "string", example: "paid" },
      createdAt: { type: "string", format: "date-time", example: "2026-07-30T12:41:08.000Z" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productName: {
              type: "string",
              example: "Hainanese Chicken Rice (Roasted, Extra chicken)",
              description: "The name AND chosen addons are copied in at checkout, so history still reads correctly if the dish is later renamed or deleted.",
            },
            quantity: { type: "integer", example: 2 },
            itemTotal: { type: "number", format: "float", example: 12.0 },
          },
        },
      },
    },
  },
};

const paths = {
  "/api/orders/quote": {
    get: {
      tags: ["Orders"],
      summary: "Preview the fees for my current cart",
      description:
        "The cart page calls this every time the customer switches between " +
        "takeaway and delivery or types a promo code, so the figures on screen " +
        "are always the server's figures. Nothing is written to the database.",
      parameters: [
        {
          name: "fulfillment",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["takeaway", "delivery"], default: "takeaway" },
          example: "delivery",
          description: "Anything other than 'delivery' is treated as takeaway.",
        },
        {
          name: "promoCode",
          in: "query",
          required: false,
          schema: { type: "string" },
          example: "SAVE2",
          description: "Optional. A bad code returns 200 with promoError set, not an error status.",
        },
      ],
      responses: {
        200: {
          description: "The fee breakdown for the current cart.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QuoteResponse" },
              example: {
                subtotal: 12.0,
                deliveryFee: 5.0,
                minOrderFee: 0,
                discount: 2.0,
                total: 15.0,
                minOrder: 12.0,
                promoCode: "SAVE2",
                promoError: null,
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/orders": {
    post: {
      tags: ["Orders"],
      summary: "Checkout — turn my cart into an order",
      description:
        "Reads the cart from the database, recalculates every figure, writes the " +
        "order, and empties the cart.\n\n" +
        "**All the writes run inside one SQL transaction.** Creating the order " +
        "header, copying each cart line into OrderItems, incrementing the promo " +
        "code's usage counter and clearing the cart either ALL succeed or ALL get " +
        "rolled back. Without that, a crash halfway through could leave an order " +
        "with no items, or a cart the customer has already paid for.\n\n" +
        "The promo code is resolved BEFORE the transaction opens — a wrong code is " +
        "the customer's mistake, not a database failure, so it should not need a " +
        "rollback. The usage counter is bumped with " +
        "`WHERE timesUsed < usageLimit`, so two people checking out at the same " +
        "instant can never push a limited code past its limit.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CheckoutRequest" },
            examples: {
              takeaway: { summary: "Takeaway, cash", value: { paymentMethod: "cash", fulfillment: "takeaway" } },
              delivery: { summary: "Delivery with a promo code", value: { paymentMethod: "paynow", fulfillment: "delivery", promoCode: "SAVE2" } },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Order placed. The cart is now empty.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/OrderConfirmation" } },
          },
        },
        400: {
          description:
            "Validation failed, or one of three business rules stopped it. The " +
            "`code` field tells the front-end which, so it can react properly " +
            "instead of just printing the message.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  code: { type: "string", nullable: true, enum: ["NO_CARD", "BAD_PROMO"] },
                  message: { type: "string" },
                  field: { type: "string", nullable: true },
                },
              },
              examples: {
                emptyCart: { summary: "Nothing to buy", value: { message: "Your cart is empty." } },
                noCard: {
                  summary: "Paying by card with no card saved",
                  value: { code: "NO_CARD", message: "No saved card on your profile. Add a card before paying by card." },
                },
                badPromo: {
                  summary: "Promo code rejected",
                  value: { code: "BAD_PROMO", message: "That code has reached its usage limit." },
                },
                badMethod: {
                  summary: "Unknown payment method",
                  value: { message: "paymentMethod is required and must be one of: cash, paynow, visa, mastercard", field: "paymentMethod" },
                },
              },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: {
          description: "The transaction was rolled back — nothing was saved and the cart is untouched.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Payment could not be completed." },
            },
          },
        },
      },
    },

    get: {
      tags: ["Orders"],
      summary: "My order history",
      description:
        "Every past order for the logged-in user, newest first, with its line " +
        "items and fee breakdown attached. Two queries, not one per order — the " +
        "items for all the orders are fetched together and grouped in JavaScript.",
      responses: {
        200: {
          description: "The orders. An empty array if this customer has never ordered.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/OrderHistoryEntry" } },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };