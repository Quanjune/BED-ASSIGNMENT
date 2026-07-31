// docs/paths/login.js
//
// NOT PART OF THE VENDOR FEATURE. Login belongs to Aswin's auth module and is
// documented in full on his side. It is included here for one reason only:
// every vendor endpoint needs a Bearer token, and without a way to get one
// this page would have nothing you could actually click "Try it out" on.
//
// Only the login call is listed - not signup, profile, cards or user admin.
// Whoever owns the auth feature should add their own paths/auth.js with the
// full set; this file can then be deleted and nothing else needs changing.

const tag = {
  name: "Getting a token",
  description:
    "Log in here first - every 🔒 endpoint on this page needs the token this returns.",
};

const paths = {
  "/api/auth/login": {
    post: {
      tags: ["Getting a token"],
      summary: "Log in to get a Bearer token",
      description:
        "Run this, copy `accessToken` out of the response, then click **Authorize** " +
        "at the top of this page and paste it in. Every 🔒 endpoint will then work.\n\n" +
        "Seeded test accounts:\n\n" +
        "| Email | Password | Role |\n" +
        "|---|---|---|\n" +
        "| `admin@hawkers.sg` | `Admin123` | admin |\n" +
        "| `siti@test.com` | `Password123` | customer |\n" +
        "| `chickenrice@test.com` | `Password123` | vendor, owns stall 1 |\n\n" +
        "Use the vendor account for the **Vendor** endpoints - a vendor account made " +
        "through the signup page has no stall linked yet and gets a 403 from them.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email", example: "chickenrice@test.com" },
                password: { type: "string", example: "Password123" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Logged in. Copy `accessToken`.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string", example: "Login successful." },
                  accessToken: {
                    type: "string",
                    description: "Send as 'Authorization: Bearer <token>'.",
                    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                  },
                  user: {
                    type: "object",
                    properties: {
                      userId: { type: "integer", example: 4 },
                      name: { type: "string", example: "Chicken Rice Stall" },
                      email: { type: "string", format: "email", example: "chickenrice@test.com" },
                      role: { type: "string", example: "vendor" },
                      stallId: {
                        type: "integer",
                        nullable: true,
                        description: "The stall this vendor owns. This is what the endpoints below use.",
                        example: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: {
          description: "Wrong email or password.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { message: "Invalid email or password." },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, paths };
