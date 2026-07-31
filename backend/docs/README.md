# API documentation — how to add yours

The Swagger page at <http://localhost:3000/api-docs> is built from the files in
this folder. **To document your feature you add one file to `paths/`. That's it.**

You do **not** edit `index.js` and you do **not** edit `components.js` — those are
shared, and if all five of us edited them every branch would conflict. `index.js`
reads whatever is in `paths/` and merges it in automatically.

---

## The 3 steps

### 1. Create `paths/<yourfeature>.js`

Name it after your feature: `feedback.js`, `admin.js`, `cart.js`, etc.

### 2. Export three things

```js
// docs/paths/feedback.js  (Your Name - what your feature is)

// The group your endpoints appear under in Swagger UI.
const tag = {
  name: "Feedback",
  description: "Ratings and reviews. (Your Name)",
};

// Object shapes your endpoints send or return. Referenced below as
// "#/components/schemas/Feedback".
const schemas = {
  Feedback: {
    type: "object",
    properties: {
      feedbackId: { type: "integer", example: 4 },
      rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
      comment: { type: "string", nullable: true, example: "Great food." },
    },
  },
};

// Your endpoints: URL -> method -> what it does.
const paths = {
  "/api/feedback": {
    get: {
      tags: ["Feedback"],              // must match tag.name above
      summary: "List every review",
      security: [],                    // [] = public, omit = needs a token
      responses: {
        200: {
          description: "All reviews.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Feedback" } },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };
```

### 3. Restart the server and check `/api-docs`

Your group appears on the page. Nothing else to do.

---

## Things worth knowing

**Auth.** Every operation needs a token by default. Mark a public one with
`security: []`. Mark one that needs a token with `security: [{ bearerAuth: [] }]`
(or just leave it out — that's the default).

**Reuse the shared error responses** instead of writing them out each time:

```js
400: { $ref: "#/components/responses/BadRequest" }
401: { $ref: "#/components/responses/Unauthorized" }
403: { $ref: "#/components/responses/Forbidden" }
404: { $ref: "#/components/responses/NotFound" }
500: { $ref: "#/components/responses/ServerError" }
```

**Path parameters** use `{braces}`, not `:colons` — `/api/feedback/{id}`, not
`/api/feedback/:id` — and each one must be declared:

```js
parameters: [
  { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 5 },
],
```

**Request bodies** go in `requestBody`, not `parameters`:

```js
requestBody: {
  required: true,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/FeedbackRequest" } },
  },
},
```

**Duplicate URLs crash the server on purpose.** If two files document the same
path, you get a clear error at startup naming the file — better than one silently
overwriting the other.

**Write down the real behaviour, not the ideal.** If a route returns 200 with
`valid: false` instead of an error, document that. If a field in the body is
ignored, say so. The point of these docs is that someone can use your API without
reading your controller.

---

## Layout

```
backend/docs/
├── index.js       # merges everything — don't edit
├── components.js  # shared error shapes + JWT scheme — don't edit
├── README.md      # this file
└── paths/
    ├── login.js   # token helper, so the Authorize button has something to use
    └── vendors.js # a full worked example — copy its structure
```

[`paths/vendors.js`](paths/vendors.js) is the most complete example — tag,
schemas, path params, request bodies, shared responses, and a large nested
response object. Copy its shape.
