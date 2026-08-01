// docs/paths/hygieneGrades.js  (Kaden - hygiene grading)
// Swagger documentation for /api/hygiene-grades. Picked up automatically by
// docs/index.js - see backend/docs/README.md.
//
// A hygiene grade is public information - that is the point of the NEA
// scheme - so the reads need no token. Only "expiring" is officer-only,
// because it is a work-planning list rather than public information.
//
// Kept in its own file (separate from inspections.js) so the two feature
// groups appear as two sections in Swagger UI. index.js only crashes on a
// duplicate URL, and there is no overlap between the two files.

const tag = {
  name: "Hygiene Grades",
  description:
    "Grades issued from completed inspections. Grades are never overwritten - " +
    "each new one is added, so every stall keeps a full history. (Kaden)",
};

const schemas = {
  HygieneGrade: {
    type: "object",
    properties: {
      gradeId: { type: "integer", example: 8 },
      stallId: { type: "integer", example: 1 },
      stallName: { type: "string", example: "Maxwell Chicken Rice" },
      centerName: { type: "string", example: "Maxwell Food Centre" },
      inspectionId: {
        type: "integer",
        nullable: true,
        example: 12,
        description: "null if entered manually, or if the inspection was later deleted.",
      },
      inspectionScore: { type: "integer", nullable: true, example: 91 },
      grade: { type: "string", enum: ["A", "B", "C", "D"], example: "A" },
      validFrom: { type: "string", format: "date", example: "2026-06-01" },
      validTo: { type: "string", format: "date", example: "2027-05-31" },
      isCurrent: {
        type: "integer",
        enum: [0, 1],
        example: 1,
        description: "1 when today falls inside the validity window. Worked out in SQL.",
      },
      daysUntilExpiry: { type: "integer", example: 120, description: "Negative once expired." },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  HygieneGradeRequest: {
    type: "object",
    required: ["stallId", "grade", "validFrom", "validTo"],
    description:
      "Manual or corrective entry. Most grades are issued automatically by " +
      "PUT /api/inspections/{id}/complete instead.",
    properties: {
      stallId: { type: "integer", example: 1 },
      inspectionId: { type: "integer", nullable: true, example: 12 },
      grade: {
        type: "string",
        enum: ["A", "B", "C", "D"],
        example: "B",
        description: "Lower case is accepted - Joi upper-cases it before validating.",
      },
      validFrom: { type: "string", format: "date", example: "2026-06-01" },
      validTo: {
        type: "string",
        format: "date",
        example: "2027-05-31",
        description: "Must be after validFrom.",
      },
    },
  },

  StallCompliance: {
    type: "object",
    description:
      "One stall's whole compliance picture in a single request: current grade, " +
      "every grade it has held, and every inspection behind them.",
    properties: {
      stallId: { type: "integer", example: 1 },
      stallName: { type: "string", example: "Maxwell Chicken Rice" },
      currentGrade: {
        allOf: [{ $ref: "#/components/schemas/HygieneGrade" }],
        nullable: true,
      },
      grades: {
        type: "array",
        items: { $ref: "#/components/schemas/HygieneGrade" },
      },
      inspections: {
        type: "array",
        items: { $ref: "#/components/schemas/Inspection" },
        description: "Defined in paths/inspections.js.",
      },
    },
  },
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
  example: 3,
};

const paths = {
  "/api/hygiene-grades": {
    get: {
      tags: ["Hygiene Grades"],
      summary: "The full grade register",
      description: "Public. Add ?stallId= for one stall's history.",
      security: [],
      parameters: [
        { name: "stallId", in: "query", schema: { type: "integer" }, example: 1 },
      ],
      responses: {
        200: {
          description: "Grades, newest first.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/HygieneGrade" } },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    post: {
      tags: ["Hygiene Grades"],
      summary: "Issue a grade manually",
      description:
        "Officer only. For corrections and historical records. Normal grades " +
        "come from completing an inspection.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/HygieneGradeRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Issued.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/HygieneGrade" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/hygiene-grades/current": {
    get: {
      tags: ["Hygiene Grades"],
      summary: "One current grade per stall",
      description:
        "Public. The grade each stall is displaying right now, worked out in SQL " +
        "with ROW_NUMBER() rather than by downloading the whole history and " +
        "filtering in the browser. This is what the public grades page and the " +
        "stall badges use.",
      security: [],
      responses: {
        200: {
          description: "One row per stall that has ever been graded.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/HygieneGrade" } },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/hygiene-grades/expiring": {
    get: {
      tags: ["Hygiene Grades"],
      summary: "Grades about to run out",
      description:
        "Officer only. Current grades expiring within the next N days, including " +
        "ones that already expired (negative daysUntilExpiry). Drives the " +
        "scheduling decisions.",
      parameters: [
        {
          name: "days",
          in: "query",
          schema: { type: "integer", minimum: 0, maximum: 365, default: 30 },
          example: 30,
        },
      ],
      responses: {
        200: {
          description: "Grades expiring soonest first.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/HygieneGrade" } },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/hygiene-grades/stall/{stallId}": {
    get: {
      tags: ["Hygiene Grades"],
      summary: "One stall's full compliance history",
      description:
        "Public. Current grade + every grade ever held + every inspection, in " +
        "one request instead of three.",
      security: [],
      parameters: [
        {
          name: "stallId",
          in: "path",
          required: true,
          schema: { type: "integer" },
          example: 1,
        },
      ],
      responses: {
        200: {
          description: "The stall's compliance record.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/StallCompliance" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/hygiene-grades/{id}": {
    get: {
      tags: ["Hygiene Grades"],
      summary: "Get one grade",
      security: [],
      parameters: [idParam],
      responses: {
        200: {
          description: "The grade.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/HygieneGrade" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    put: {
      tags: ["Hygiene Grades"],
      summary: "Correct an issued grade",
      description: "Officer only.",
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/HygieneGradeRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Corrected.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/HygieneGrade" } },
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
      tags: ["Hygiene Grades"],
      summary: "Delete a grade",
      description: "Officer only. Removes the row from the stall's history.",
      parameters: [idParam],
      responses: {
        200: {
          description: "Deleted.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  deleted: { $ref: "#/components/schemas/HygieneGrade" },
                },
              },
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
};

module.exports = { tag, schemas, paths };