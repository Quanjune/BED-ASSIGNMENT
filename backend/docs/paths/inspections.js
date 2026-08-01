// docs/paths/inspections.js  (Kaden - NEA inspections)
// Swagger documentation for /api/inspections. Picked up automatically by
// docs/index.js - see backend/docs/README.md.
//
// Reads are public (a customer may look at a stall's inspection history);
// every write, and the three officer worklist endpoints, need an officer
// token. Log in as tan@nea.gov.sg / Password123 to try them here.

const tag = {
  name: "Inspections",
  description:
    "NEA inspection scheduling and results. Completing an inspection also " +
    "issues the hygiene grade, and books a re-inspection if the stall failed. (Kaden)",
};

const schemas = {
  Inspection: {
    type: "object",
    properties: {
      inspectionId: { type: "integer", example: 12 },
      stallId: { type: "integer", example: 1 },
      stallName: { type: "string", example: "Maxwell Chicken Rice" },
      centerName: { type: "string", example: "Maxwell Food Centre" },
      officerId: { type: "integer", example: 20 },
      officerName: {
        type: "string",
        example: "Officer Tan Wei Ming",
        description: "Joined from Users - not stored on the inspection row.",
      },
      scheduledDate: { type: "string", format: "date", example: "2026-08-14" },
      status: {
        type: "string",
        enum: ["Scheduled", "Completed", "Cancelled"],
        example: "Scheduled",
      },
      completedDate: { type: "string", format: "date", nullable: true, example: null },
      score: {
        type: "integer",
        nullable: true,
        minimum: 0,
        maximum: 100,
        example: null,
      },
      remarks: { type: "string", nullable: true, example: null },
      followUpOf: {
        type: "integer",
        nullable: true,
        example: null,
        description: "Set when this visit was booked automatically after a failed one.",
      },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  InspectionScheduleRequest: {
    type: "object",
    required: ["stallId", "scheduledDate"],
    description:
      "There is deliberately no officer field. The officer is taken from the " +
      "JWT, so a visit can never be filed under someone else's name.",
    properties: {
      stallId: { type: "integer", example: 4 },
      scheduledDate: { type: "string", format: "date", example: "2026-09-02" },
    },
  },

  InspectionUpdateRequest: {
    type: "object",
    required: ["stallId", "scheduledDate"],
    description:
      "Moving or cancelling a booked visit. 'Completed' is not accepted here - " +
      "recording a result needs a score, so it has its own endpoint.",
    properties: {
      stallId: { type: "integer", example: 4 },
      scheduledDate: { type: "string", format: "date", example: "2026-09-09" },
      status: {
        type: "string",
        enum: ["Scheduled", "Cancelled"],
        default: "Scheduled",
      },
    },
  },

  InspectionCompleteRequest: {
    type: "object",
    required: ["score"],
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100, example: 88 },
      remarks: {
        type: "string",
        maxLength: 500,
        nullable: true,
        example: "Good hygiene practices. Minor grease build-up near the stove.",
      },
      completedDate: {
        type: "string",
        format: "date",
        example: "2026-08-14",
        description: "Optional. Defaults to today. Cannot be in the future.",
      },
    },
  },

  InspectionCompleteResponse: {
    type: "object",
    description:
      "All three writes happen in one transaction: the result, the grade, and " +
      "(if the score was below 55) the re-inspection.",
    properties: {
      inspection: { $ref: "#/components/schemas/Inspection" },
      hygieneGrade: { $ref: "#/components/schemas/HygieneGrade" },
      followUp: {
        allOf: [{ $ref: "#/components/schemas/Inspection" }],
        nullable: true,
        description: "The automatically booked re-inspection, or null if the stall passed.",
      },
      summary: {
        type: "string",
        example: "Grade A issued, valid until 2027-08-14.",
      },
    },
  },

  OfficerWorklist: {
    type: "object",
    description: "The logged-in officer's own work, split by urgency.",
    properties: {
      officer: {
        type: "object",
        properties: {
          officerId: { type: "integer", example: 20 },
          name: { type: "string", nullable: true },
        },
      },
      stats: {
        type: "object",
        properties: {
          overdue: { type: "integer", example: 2 },
          dueToday: { type: "integer", example: 2 },
          upcoming: { type: "integer", example: 4 },
          completedLast30Days: { type: "integer", example: 3 },
        },
      },
      overdue: { type: "array", items: { $ref: "#/components/schemas/Inspection" } },
      dueToday: { type: "array", items: { $ref: "#/components/schemas/Inspection" } },
      upcoming: { type: "array", items: { $ref: "#/components/schemas/Inspection" } },
      recentlyCompleted: {
        type: "array",
        items: { $ref: "#/components/schemas/Inspection" },
      },
    },
  },

  WeatherOutlook: {
    type: "object",
    description:
      "One day of Singapore's 4-day outlook from data.gov.sg. Always returned " +
      "with HTTP 200 - if the service is down or the date is outside the " +
      "window, available is false and reason explains why, so the scheduling " +
      "page can carry on working.",
    properties: {
      available: { type: "boolean", example: true },
      reason: {
        type: "string",
        nullable: true,
        example: "No forecast yet - data.gov.sg only publishes four days ahead.",
      },
      date: { type: "string", format: "date", example: "2026-08-03" },
      day: { type: "string", example: "Sunday" },
      forecast: { type: "string", example: "Thundery Showers" },
      summary: { type: "string", example: "Afternoon thundery showers" },
      code: { type: "string", example: "TL" },
      tempLow: { type: "integer", example: 26 },
      tempHigh: { type: "integer", example: 34 },
      humidityHigh: { type: "integer", nullable: true, example: 90 },
      wet: {
        type: "boolean",
        example: true,
        description: "True for rain or thundery forecast codes - worked out on the server.",
      },
    },
  },

  StallDue: {
    type: "object",
    description:
      "One stall with everything needed to decide whether to visit it. " +
      "priority and reason are worked out on the server so the front end " +
      "does not re-implement the rule.",
    properties: {
      stallId: { type: "integer", example: 7 },
      stallName: { type: "string", example: "Wang Wang Crispy Curry Puff" },
      centerName: { type: "string", example: "Old Airport Road Food Centre" },
      lastInspected: { type: "string", format: "date", nullable: true },
      lastScore: { type: "integer", nullable: true, example: 52 },
      currentGrade: { type: "string", nullable: true, example: "D" },
      gradeValidTo: { type: "string", format: "date", nullable: true },
      openInspectionId: { type: "integer", nullable: true },
      openScheduledDate: { type: "string", format: "date", nullable: true },
      daysSinceLastVisit: { type: "integer", nullable: true, example: 90 },
      daysUntilGradeExpires: { type: "integer", nullable: true, example: -4 },
      priority: {
        type: "string",
        enum: ["high", "medium", "booked", "ok"],
        example: "high",
      },
      reason: { type: "string", example: "Grade expired 4 days ago" },
    },
  },
};

// Reused by several operations below.
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
  example: 5,
};

const paths = {
  "/api/inspections": {
    get: {
      tags: ["Inspections"],
      summary: "List inspections",
      description:
        "Public. Optional filters. Used by the stall pages to show inspection history.",
      security: [],
      parameters: [
        { name: "stallId", in: "query", schema: { type: "integer" }, example: 1 },
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["Scheduled", "Completed", "Cancelled"] },
        },
        { name: "officerId", in: "query", schema: { type: "integer" } },
      ],
      responses: {
        200: {
          description: "Inspections, newest scheduled date first.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Inspection" } },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    post: {
      tags: ["Inspections"],
      summary: "Schedule an inspection",
      description:
        "Officer only. The officer is taken from the token. Fails with 409 if " +
        "that stall already has an open visit booked on that date.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/InspectionScheduleRequest" },
          },
        },
      },
      responses: {
        201: {
          description: "Booked.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Inspection" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        409: {
          description: "That stall is already booked for that date.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                message:
                  "That stall already has an inspection booked for this date. Pick another date.",
              },
            },
          },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/inspections/mine": {
    get: {
      tags: ["Inspections"],
      summary: "My worklist",
      description:
        "Officer only. Returns the caller's own inspections split into overdue, " +
        "due today, upcoming and recently completed. There is no id in the URL, " +
        "so an officer cannot ask for somebody else's list.",
      responses: {
        200: {
          description: "The officer's worklist.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/OfficerWorklist" } },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/inspections/overdue": {
    get: {
      tags: ["Inspections"],
      summary: "Overdue inspections",
      description:
        "Officer only. Booked, the scheduled date has passed, and no result was " +
        "recorded. Agency-wide unless ?mine=true.",
      parameters: [
        {
          name: "mine",
          in: "query",
          schema: { type: "boolean" },
          description: "true limits the list to the logged-in officer.",
        },
      ],
      responses: {
        200: {
          description: "Overdue inspections, oldest first.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/Inspection" } },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/inspections/stalls-due": {
    get: {
      tags: ["Inspections"],
      summary: "Every stall, ordered by how badly it needs a visit",
      description:
        "Officer only. Never-inspected stalls first, then whichever grades expire " +
        "soonest. Drives the scheduling page.",
      responses: {
        200: {
          description: "All stalls with their compliance state.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/StallDue" } },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },

  "/api/inspections/weather": {
    get: {
      tags: ["Inspections"],
      summary: "Weather outlook for a date (third-party API)",
      description:
        "Officer only. Calls data.gov.sg's 4-day outlook from the BACK END and " +
        "returns just the fields the scheduling page needs.\n\n" +
        "Hawker centres are open-air, so an officer booking a site visit wants " +
        "to know if storms are forecast.\n\n" +
        "Never returns 5xx: the weather is a helpful extra, not something " +
        "scheduling depends on, so an outage comes back as 200 with " +
        "available:false.",
      parameters: [
        {
          name: "date",
          in: "query",
          required: true,
          schema: { type: "string", format: "date" },
          example: "2026-08-03",
        },
      ],
      responses: {
        200: {
          description: "The forecast, or available:false with a reason.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/WeatherOutlook" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
  },

  "/api/inspections/{id}": {
    get: {
      tags: ["Inspections"],
      summary: "Get one inspection",
      security: [],
      parameters: [idParam],
      responses: {
        200: {
          description: "The inspection.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Inspection" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        404: { $ref: "#/components/responses/NotFound" },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    put: {
      tags: ["Inspections"],
      summary: "Move or cancel a booked inspection",
      description:
        "Officer only. A Completed inspection is a record of something that " +
        "happened, so it cannot be edited - that returns 409.",
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/InspectionUpdateRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Inspection" } },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        409: {
          description:
            "Already completed, or the stall is already booked on the new date.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },

    delete: {
      tags: ["Inspections"],
      summary: "Delete an inspection",
      description:
        "Officer only. Any hygiene grade this inspection issued is KEPT - the " +
        "foreign key is ON DELETE SET NULL, so the stall does not lose its history.",
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
                  deleted: { $ref: "#/components/schemas/Inspection" },
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

  "/api/inspections/{id}/complete": {
    put: {
      tags: ["Inspections"],
      summary: "Record the result and issue the hygiene grade",
      description:
        "Officer only. The main endpoint of this feature.\n\n" +
        "Score bands: 85+ = A, 70+ = B, 55+ = C, below 55 = D.\n" +
        "Validity: A and B run for 12 months, C for 6, D for 3.\n" +
        "A score below 55 also books a re-inspection about 30 days later.\n\n" +
        "All of it runs in one transaction, so an inspection can never end up " +
        "marked Completed with no grade behind it.",
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/InspectionCompleteRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Result recorded and grade issued.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InspectionCompleteResponse" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
        404: { $ref: "#/components/responses/NotFound" },
        409: {
          description: "Already completed, or was cancelled.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        500: { $ref: "#/components/responses/ServerError" },
      },
    },
  },
};

module.exports = { tag, schemas, paths };