// admin.test.js  (Aswin)
// Tests that the admin routes are protected by JWT + admin role, and that an
// admin gets data back. The SQL model is mocked, so no database is needed.

process.env.ACCESS_TOKEN_SECRET = "test-secret-key";

jest.mock("../models/adminModel", () => ({
  getSummary: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const adminModel = require("../models/adminModel");
const adminRoutes = require("../routes/adminRoutes");

const app = express();
app.use(express.json());
app.use("/api/admin", adminRoutes);

const tokenFor = (user) => jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

beforeEach(() => jest.clearAllMocks());

describe("GET /api/admin/summary (admin only)", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/admin/summary");
    expect(res.status).toBe(401);
  });

  test("403 for a non-admin (customer) token", async () => {
    const res = await request(app).get("/api/admin/summary")
      .set("Authorization", "Bearer " + tokenFor({ userId: 2, role: "customer" }));
    expect(res.status).toBe(403);
  });

  test("200 and returns the summary for an admin token", async () => {
    adminModel.getSummary.mockResolvedValue({
      totalUsers: 5, totalComplaints: 2, avgRating: 4.2, reviewCount: 3,
      bestHawker: "Maxwell Food Centre", totalOrders: 10,
    });
    const res = await request(app).get("/api/admin/summary")
      .set("Authorization", "Bearer " + tokenFor({ userId: 1, role: "admin" }));
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(5);
    expect(adminModel.getSummary).toHaveBeenCalled();
  });
});
