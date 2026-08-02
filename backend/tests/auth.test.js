// auth.test.js  (Aswin)
// Tests the auth routes on a small in-memory Express app. The SQL model layer
// is mocked, so these run fast and need no database.

process.env.ACCESS_TOKEN_SECRET = "test-secret-key";

// Replace the real SQL model with fakes.
jest.mock("../models/userModel", () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  getAllUsers: jest.fn(),
  saveCard: jest.fn(),
  removeCard: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const userRoutes = require("../routes/userRoutes");

const app = express();
app.use(express.json());
app.use("/api/auth", userRoutes);

const tokenFor = (user) => jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

beforeEach(() => jest.clearAllMocks());

describe("POST /api/auth/signup", () => {
  test("400 when the password is too weak", async () => {
    const res = await request(app).post("/api/auth/signup")
      .send({ name: "Jane Tan", email: "jane@test.com", password: "123", role: "customer" });
    expect(res.status).toBe(400);
  });

  test("201 when the body is valid and the email is free", async () => {
    userModel.findUserByEmail.mockResolvedValue(undefined);
    userModel.createUser.mockResolvedValue(1);
    const res = await request(app).post("/api/auth/signup")
      .send({ name: "Jane Tan", email: "jane@test.com", password: "Password123", role: "customer" });
    expect(res.status).toBe(201);
    expect(userModel.createUser).toHaveBeenCalled();
  });

  test("409 when the email already exists", async () => {
    userModel.findUserByEmail.mockResolvedValue({ userId: 1, email: "jane@test.com" });
    const res = await request(app).post("/api/auth/signup")
      .send({ name: "Jane Tan", email: "jane@test.com", password: "Password123", role: "customer" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  test("400 when a field is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "jane@test.com" });
    expect(res.status).toBe(400);
  });

  test("200 and returns a token on correct credentials", async () => {
    const passwordHash = await bcrypt.hash("Password123", 10);
    userModel.findUserByEmail.mockResolvedValue({
      userId: 1, name: "Jane", email: "jane@test.com", passwordHash, role: "customer",
    });
    const res = await request(app).post("/api/auth/login")
      .send({ email: "jane@test.com", password: "Password123" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test("401 on a wrong password", async () => {
    const passwordHash = await bcrypt.hash("Password123", 10);
    userModel.findUserByEmail.mockResolvedValue({ userId: 1, passwordHash, role: "customer" });
    const res = await request(app).post("/api/auth/login")
      .send({ email: "jane@test.com", password: "WrongPass9" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me (JWT required)", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("200 with a valid token", async () => {
    userModel.findUserById.mockResolvedValue({ userId: 1, name: "Jane", email: "jane@test.com", role: "customer" });
    const res = await request(app).get("/api/auth/me")
      .set("Authorization", "Bearer " + tokenFor({ userId: 1, role: "customer" }));
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });
});
