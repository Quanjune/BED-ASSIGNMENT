// validators.test.js  (Aswin)
// Pure unit tests for the Joi schemas - no server, no database, just the rules.
const { signupSchema, loginSchema, cardSchema } = require("../validators/userValidator");

describe("signupSchema", () => {
  test("accepts a valid signup", () => {
    const { error } = signupSchema.validate({
      name: "Jane Tan", email: "jane@test.com", password: "Password123", role: "customer",
    });
    expect(error).toBeUndefined();
  });

  test("rejects a password with no number", () => {
    const { error } = signupSchema.validate({
      name: "Jane Tan", email: "jane@test.com", password: "Password", role: "customer",
    });
    expect(error).toBeDefined();
  });

  test("rejects a password shorter than 8 characters", () => {
    const { error } = signupSchema.validate({
      name: "Jane Tan", email: "jane@test.com", password: "Pass1", role: "customer",
    });
    expect(error).toBeDefined();
  });

  test("rejects an invalid email", () => {
    const { error } = signupSchema.validate({
      name: "Jane Tan", email: "not-an-email", password: "Password123", role: "customer",
    });
    expect(error).toBeDefined();
  });

  test("rejects role 'admin' (only customer/vendor may self-register)", () => {
    const { error } = signupSchema.validate({
      name: "Jane Tan", email: "jane@test.com", password: "Password123", role: "admin",
    });
    expect(error).toBeDefined();
  });

  test("defaults role to 'customer' when omitted", () => {
    const { value, error } = signupSchema.validate({
      name: "Jane Tan", email: "jane@test.com", password: "Password123",
    });
    expect(error).toBeUndefined();
    expect(value.role).toBe("customer");
  });
});

describe("loginSchema", () => {
  test("requires both email and password", () => {
    const { error } = loginSchema.validate({ email: "jane@test.com" });
    expect(error).toBeDefined();
  });
});

describe("cardSchema", () => {
  test("accepts a 16-digit card number", () => {
    const { error } = cardSchema.validate({ cardNumber: "4111111111111111" });
    expect(error).toBeUndefined();
  });

  test("rejects a card number with letters", () => {
    const { error } = cardSchema.validate({ cardNumber: "4111-abcd" });
    expect(error).toBeDefined();
  });
});
