// Pure unit tests for the Joi schemas behind /api/inspections and
// /api/hygiene-grades - no server, no database, just the rules.
// Same shape as Aswin's validators.test.js.
const {
  scheduleInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
  hygieneGradeSchema,
} = require("../validators/inspectionValidator");

describe("scheduleInspectionSchema", () => {
  test("accepts a valid booking", () => {
    const { error } = scheduleInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-02",
    });
    expect(error).toBeUndefined();
  });

  test("rejects a missing stallId", () => {
    const { error } = scheduleInspectionSchema.validate({ scheduledDate: "2026-09-02" });
    expect(error).toBeDefined();
  });

  test("rejects a stallId that is not a number", () => {
    const { error } = scheduleInspectionSchema.validate({
      stallId: "banana", scheduledDate: "2026-09-02",
    });
    expect(error).toBeDefined();
  });

  test("rejects a date that is not a real date", () => {
    const { error } = scheduleInspectionSchema.validate({
      stallId: 4, scheduledDate: "not-a-date",
    });
    expect(error).toBeDefined();
  });

  // The officer is taken from the JWT, never from the request body. If the
  // schema quietly accepted an officerId, one officer could file an inspection
  // under a colleague's name - so an unknown key must be an error.
  test("rejects an officerId smuggled into the body", () => {
    const { error } = scheduleInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-02", officerId: 99,
    });
    expect(error).toBeDefined();
  });

  // .raw() keeps the original string instead of turning it into a Date object,
  // because the model and controller are written to receive strings.
  test("keeps the date as a YYYY-MM-DD string", () => {
    const { value } = scheduleInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-02",
    });
    expect(typeof value.scheduledDate).toBe("string");
    expect(value.scheduledDate).toBe("2026-09-02");
  });
});

describe("updateInspectionSchema", () => {
  test("defaults status to Scheduled when omitted", () => {
    const { value, error } = updateInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-09",
    });
    expect(error).toBeUndefined();
    expect(value.status).toBe("Scheduled");
  });

  test("accepts Cancelled", () => {
    const { error } = updateInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-09", status: "Cancelled",
    });
    expect(error).toBeUndefined();
  });

  // Completing needs a score, so it has its own endpoint and its own schema.
  // Allowing "Completed" here would let a visit be marked done with no result.
  test("rejects status Completed", () => {
    const { error } = updateInspectionSchema.validate({
      stallId: 4, scheduledDate: "2026-09-09", status: "Completed",
    });
    expect(error).toBeDefined();
  });
});

describe("completeInspectionSchema", () => {
  test("accepts a score with remarks", () => {
    const { error } = completeInspectionSchema.validate({
      score: 88, remarks: "Minor grease build-up near the stove.",
    });
    expect(error).toBeUndefined();
  });

  test("requires a score", () => {
    const { error } = completeInspectionSchema.validate({ remarks: "Looked fine." });
    expect(error).toBeDefined();
  });

  test("accepts the boundary scores 0 and 100", () => {
    expect(completeInspectionSchema.validate({ score: 0 }).error).toBeUndefined();
    expect(completeInspectionSchema.validate({ score: 100 }).error).toBeUndefined();
  });

  test("rejects a score outside 0-100", () => {
    expect(completeInspectionSchema.validate({ score: -1 }).error).toBeDefined();
    expect(completeInspectionSchema.validate({ score: 101 }).error).toBeDefined();
  });

  test("rejects a score that is not a whole number", () => {
    const { error } = completeInspectionSchema.validate({ score: 87.5 });
    expect(error).toBeDefined();
  });

  test("rejects remarks longer than 500 characters", () => {
    const { error } = completeInspectionSchema.validate({
      score: 80, remarks: "x".repeat(501),
    });
    expect(error).toBeDefined();
  });
});

describe("hygieneGradeSchema", () => {
  test("accepts a valid grade", () => {
    const { error } = hygieneGradeSchema.validate({
      stallId: 1, grade: "B", validFrom: "2026-06-01", validTo: "2027-05-31",
    });
    expect(error).toBeUndefined();
  });

  // uppercase() runs before valid(), and validate() writes the cleaned value
  // back onto req.body - so the controller never needs its own toUpperCase().
  test("upper-cases a lower-case grade", () => {
    const { value, error } = hygieneGradeSchema.validate({
      stallId: 1, grade: "a", validFrom: "2026-06-01", validTo: "2027-05-31",
    });
    expect(error).toBeUndefined();
    expect(value.grade).toBe("A");
  });

  test("rejects a grade outside A-D", () => {
    const { error } = hygieneGradeSchema.validate({
      stallId: 1, grade: "E", validFrom: "2026-06-01", validTo: "2027-05-31",
    });
    expect(error).toBeDefined();
  });

  test("rejects validTo before validFrom", () => {
    const { error } = hygieneGradeSchema.validate({
      stallId: 1, grade: "A", validFrom: "2027-05-31", validTo: "2026-06-01",
    });
    expect(error).toBeDefined();
  });

  test("rejects validTo equal to validFrom", () => {
    const { error } = hygieneGradeSchema.validate({
      stallId: 1, grade: "A", validFrom: "2026-06-01", validTo: "2026-06-01",
    });
    expect(error).toBeDefined();
  });
});