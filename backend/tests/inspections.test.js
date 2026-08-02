// inspections.test.js  (Kaden)
// Tests the NEA inspection routes: that reads are public, that every write is
// locked to the officer role, that the officer is taken from the JWT rather
// than the request body, and that the grade banding is right.

process.env.ACCESS_TOKEN_SECRET = "test-secret-key";

jest.mock("../models/inspectionModel", () => ({
  getAllInspections: jest.fn(),
  getInspectionById: jest.fn(),
  getOpenByOfficer: jest.fn(),
  getCompletedByOfficer: jest.fn(),
  getOverdue: jest.fn(),
  getStallsDue: jest.fn(),
  stallExists: jest.fn(),
  hasOpenSlot: jest.fn(),
  createInspection: jest.fn(),
  updateInspection: jest.fn(),
  completeInspection: jest.fn(),
  findFreeFollowUpDate: jest.fn(),
  deleteInspection: jest.fn(),
}));

jest.mock("../services/weatherService", () => ({
  getFourDayOutlook: jest.fn(),
  getForecastForDate: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const inspectionModel = require("../models/inspectionModel");
const weatherService = require("../services/weatherService");
const inspectionRoutes = require("../routes/inspectionRoutes");
const { scoreToGrade } = require("../controllers/inspectionController");

const app = express();
app.use(express.json());
app.use("/api/inspections", inspectionRoutes);

const tokenFor = (user) => jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
const OFFICER = { userId: 20, role: "officer" };
const CUSTOMER = { userId: 2, role: "customer" };
const ADMIN = { userId: 1, role: "admin" };

// Dates relative to today, so the worklist tests keep working next month.
const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => jest.clearAllMocks());

// ============================================================
// Grade banding - a pure function, so no mocking involved
// ============================================================
describe("scoreToGrade", () => {

  test("85 and above is an A", () => {
    expect(scoreToGrade(85)).toBe("A");
    expect(scoreToGrade(100)).toBe("A");
  });

  test("70 to 84 is a B", () => {
    expect(scoreToGrade(84)).toBe("B");
    expect(scoreToGrade(70)).toBe("B");
  });

  test("55 to 69 is a C", () => {
    expect(scoreToGrade(69)).toBe("C");
    expect(scoreToGrade(55)).toBe("C");
  });

  test("below 55 is a D", () => {
    expect(scoreToGrade(54)).toBe("D");
    expect(scoreToGrade(0)).toBe("D");
  });
});

// ============================================================
// Public reads
// ============================================================
describe("GET /api/inspections (public)", () => {
  test("200 with no token at all - a customer may see inspection history", async () => {
    inspectionModel.getAllInspections.mockResolvedValue([]);
    const res = await request(app).get("/api/inspections");
    expect(res.status).toBe(200);
  });

  test("400 when the status filter is not a real status", async () => {
    const res = await request(app).get("/api/inspections?status=Banana");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/inspections/:id", () => {
  test("400 when the id is not a number (validateIdParam)", async () => {
    const res = await request(app).get("/api/inspections/abc");
    expect(res.status).toBe(400);
    expect(inspectionModel.getInspectionById).not.toHaveBeenCalled();
  });

  test("404 when the inspection does not exist", async () => {
    inspectionModel.getInspectionById.mockResolvedValue(undefined);
    const res = await request(app).get("/api/inspections/999");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// The officer worklist
// ============================================================
describe("GET /api/inspections/mine (officer only)", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/inspections/mine");
    expect(res.status).toBe(401);
  });

  test("403 for a customer token", async () => {
    const res = await request(app).get("/api/inspections/mine")
      .set("Authorization", "Bearer " + tokenFor(CUSTOMER));
    expect(res.status).toBe(403);
  });

  test("403 for an admin token - admin does not run inspections", async () => {
    const res = await request(app).get("/api/inspections/mine")
      .set("Authorization", "Bearer " + tokenFor(ADMIN));
    expect(res.status).toBe(403);
  });

  test("splits the officer's open visits into overdue, today and upcoming", async () => {
    inspectionModel.getOpenByOfficer.mockResolvedValue([
      { inspectionId: 1, scheduledDate: iso(-5) },   // overdue
      { inspectionId: 2, scheduledDate: iso(0) },    // today
      { inspectionId: 3, scheduledDate: iso(0) },    // today
      { inspectionId: 4, scheduledDate: iso(7) },    // upcoming
    ]);
    inspectionModel.getCompletedByOfficer.mockResolvedValue([
      { inspectionId: 5, completedDate: iso(-3) },   // inside the 30-day window
      { inspectionId: 6, completedDate: iso(-90) },  // outside it
    ]);

    const res = await request(app).get("/api/inspections/mine")
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    expect(res.status).toBe(200);
    expect(res.body.stats.overdue).toBe(1);
    expect(res.body.stats.dueToday).toBe(2);
    expect(res.body.stats.upcoming).toBe(1);
    expect(res.body.stats.completedLast30Days).toBe(1);
  });

  test("asks the model for the officer id in the TOKEN, not one from the URL", async () => {
    inspectionModel.getOpenByOfficer.mockResolvedValue([]);
    inspectionModel.getCompletedByOfficer.mockResolvedValue([]);

    await request(app).get("/api/inspections/mine?officerId=999")
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    expect(inspectionModel.getOpenByOfficer).toHaveBeenCalledWith(20);
  });
});

// ============================================================
// Scheduling
// ============================================================
describe("POST /api/inspections (officer only)", () => {
  const body = { stallId: 4, scheduledDate: iso(7) };

  test("401 without a token", async () => {
    const res = await request(app).post("/api/inspections").send(body);
    expect(res.status).toBe(401);
  });

  test("403 for a customer token", async () => {
    const res = await request(app).post("/api/inspections").send(body)
      .set("Authorization", "Bearer " + tokenFor(CUSTOMER));
    expect(res.status).toBe(403);
  });

  test("400 when the body fails validation", async () => {
    const res = await request(app).post("/api/inspections")
      .send({ stallId: "banana", scheduledDate: iso(7) })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(400);
    expect(inspectionModel.createInspection).not.toHaveBeenCalled();
  });

  test("400 when the stall does not exist", async () => {
    inspectionModel.stallExists.mockResolvedValue(false);
    const res = await request(app).post("/api/inspections").send(body)
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(400);
  });

  test("400 when the date is in the past", async () => {
    inspectionModel.stallExists.mockResolvedValue(true);
    const res = await request(app).post("/api/inspections")
      .send({ stallId: 4, scheduledDate: iso(-1) })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(400);
  });

  test("409 when that stall is already booked for that date", async () => {
    inspectionModel.stallExists.mockResolvedValue(true);
    inspectionModel.hasOpenSlot.mockResolvedValue(true);
    const res = await request(app).post("/api/inspections").send(body)
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(409);
  });

  test("400 when an officerId is smuggled into the body", async () => {
    inspectionModel.stallExists.mockResolvedValue(true);
    inspectionModel.hasOpenSlot.mockResolvedValue(false);

    const res = await request(app).post("/api/inspections")
      .send({ ...body, officerId: 999 })          // an attempt to impersonate
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    // Joi rejects unknown keys, so the request is refused before the model is
    // reached. This is what stops one officer filing under another's name.
    expect(res.status).toBe(400);
    expect(inspectionModel.createInspection).not.toHaveBeenCalled();
  });

  test("201 and the officer id comes from the token", async () => {
    inspectionModel.stallExists.mockResolvedValue(true);
    inspectionModel.hasOpenSlot.mockResolvedValue(false);
    inspectionModel.createInspection.mockResolvedValue({ inspectionId: 30, ...body, officerId: 20 });

    const res = await request(app).post("/api/inspections").send(body)
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    expect(res.status).toBe(201);
    // 20 is the userId inside OFFICER's token - nothing in the body said so.
    expect(inspectionModel.createInspection).toHaveBeenCalledWith(
      expect.objectContaining({ officerId: 20, stallId: 4 })
    );
  });
});

// ============================================================
// Recording a result
// ============================================================
describe("PUT /api/inspections/:id/complete", () => {
  test("409 when the inspection was already completed", async () => {
    inspectionModel.getInspectionById.mockResolvedValue({
      inspectionId: 5, stallId: 1, status: "Completed",
    });
    const res = await request(app).put("/api/inspections/5/complete").send({ score: 80 })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(409);
  });

  test("409 when the inspection was cancelled", async () => {
    inspectionModel.getInspectionById.mockResolvedValue({
      inspectionId: 5, stallId: 1, status: "Cancelled",
    });
    const res = await request(app).put("/api/inspections/5/complete").send({ score: 80 })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(409);
  });

  test("a passing score issues a grade and books NO follow-up", async () => {
    inspectionModel.getInspectionById.mockResolvedValue({
      inspectionId: 5, stallId: 1, status: "Scheduled",
    });
    inspectionModel.completeInspection.mockResolvedValue({
      inspection: { inspectionId: 5, stallName: "Maxwell Chicken Rice" },
      hygieneGrade: { grade: "A" },
      followUp: null,
    });

    const res = await request(app).put("/api/inspections/5/complete").send({ score: 91 })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    expect(res.status).toBe(200);
    expect(inspectionModel.findFreeFollowUpDate).not.toHaveBeenCalled();
    expect(inspectionModel.completeInspection).toHaveBeenCalledWith(
      "5", expect.objectContaining({ grade: "A", followUpDate: null })
    );
  });

  test("a failing score (under 55) books a re-inspection automatically", async () => {
    inspectionModel.getInspectionById.mockResolvedValue({
      inspectionId: 5, stallId: 1, status: "Scheduled",
    });
    inspectionModel.findFreeFollowUpDate.mockResolvedValue(iso(30));
    inspectionModel.completeInspection.mockResolvedValue({
      inspection: { inspectionId: 5, stallName: "Maxwell Chicken Rice" },
      hygieneGrade: { grade: "D" },
      followUp: { inspectionId: 31, scheduledDate: iso(30) },
    });

    const res = await request(app).put("/api/inspections/5/complete").send({ score: 40 })
      .set("Authorization", "Bearer " + tokenFor(OFFICER));

    expect(res.status).toBe(200);
    expect(inspectionModel.findFreeFollowUpDate).toHaveBeenCalled();
    expect(res.body.summary).toMatch(/re-inspection/i);
  });
});

// ============================================================
// Third-party API
// ============================================================
describe("GET /api/inspections/weather (third-party API)", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/inspections/weather?date=" + iso(1));
    expect(res.status).toBe(401);
  });

  test("400 when the date is missing or malformed", async () => {
    const res = await request(app).get("/api/inspections/weather?date=tomorrow")
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(400);
  });

  test("200 with the forecast when data.gov.sg answers", async () => {
    weatherService.getForecastForDate.mockResolvedValue({
      date: iso(1), day: "Sunday", forecast: "Thundery Showers",
      summary: "Afternoon thundery showers", code: "TL",
      tempLow: 26, tempHigh: 34, humidityHigh: 90, wet: true,
    });
    const res = await request(app).get("/api/inspections/weather?date=" + iso(1))
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.wet).toBe(true);
  });

 
  // comes back 200 with available:false rather than an error the page has to handle.
  test("200 with available:false when the third-party API fails", async () => {
    weatherService.getForecastForDate.mockRejectedValue(new Error("network down"));
    const res = await request(app).get("/api/inspections/weather?date=" + iso(1))
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBeDefined();
  });

  test("200 with available:false for a date beyond the four-day window", async () => {
    weatherService.getForecastForDate.mockResolvedValue(null);
    const res = await request(app).get("/api/inspections/weather?date=" + iso(30))
      .set("Authorization", "Bearer " + tokenFor(OFFICER));
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });
});