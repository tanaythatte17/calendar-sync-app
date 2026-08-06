import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import authRoutes from "../../../routes/authRoutes.js";
import User from "../../../models/userModel.js";
import { validSignupPayload } from "../../../tests/fixtures/users.js";

// Rate limiting has its own dedicated unit test (tests/unit/services/rateLimitingService.test.js);
// mocking it here keeps this suite focused on auth behavior and immune to
// hitting real per-IP limits as more test cases are added over time.
vi.mock("../../../services/rateLimitingService.js", () => {
  const passThrough = (req, res, next) => next();
  return { authLimiter: passThrough, apiLimiter: passThrough };
});

// sendMail.js creates a real Nodemailer/Zoho SMTP transporter as an import-time
// side effect. We never want tests reaching out over SMTP, so the whole
// module is replaced with a spy.
const sendOTPEmailMock = vi.fn().mockResolvedValue({ success: true, messageId: "test-message-id" });
vi.mock("../../../utils/sendMail.js", () => ({
  sendOTPEmail: (...args) => sendOTPEmailMock(...args),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  return app;
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    sendOTPEmailMock.mockClear();
  });

  it("creates a new user and sets a jwt cookie", async () => {
    const app = buildApp();

    const response = await request(app).post("/api/auth/signup").send(validSignupPayload());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(response.body).not.toHaveProperty("password");
    expect(response.headers["set-cookie"][0]).toMatch(/^jwt=/);
  });

  it("rejects a second signup with the same email", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup").send(validSignupPayload());

    const response = await request(app).post("/api/auth/signup").send(validSignupPayload());

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("User already exists");
  });

  it("rejects a malformed email address before touching the database", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/auth/signup")
      .send(validSignupPayload({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid email format");
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects mismatched password confirmation", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/auth/signup")
      .send(validSignupPayload({ confirmPassword: "something-else" }));

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Passwords don't match");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials and sets a jwt cookie", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup").send(validSignupPayload());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse-battery-staple" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email: "ada@example.com" });
    expect(response.headers["set-cookie"][0]).toMatch(/^jwt=/);
  });

  it("rejects an incorrect password", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup").send(validSignupPayload());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "wrong-password" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Incorrect Password");
  });

  it("rejects a login for an email that was never registered", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "irrelevant" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Such user does not exist");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when no session cookie is present", async () => {
    const app = buildApp();

    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's profile when the jwt cookie is valid", async () => {
    const app = buildApp();
    const signupResponse = await request(app).post("/api/auth/signup").send(validSignupPayload());
    // The jwt cookie is set with Secure + SameSite=None, which superagent's
    // automatic cookie jar (request.agent()) won't replay over the plain-HTTP
    // connection supertest uses. Forward it explicitly instead, the way any
    // HTTPS client actually would in production.
    const jwtCookie = signupResponse.headers["set-cookie"][0];

    const response = await request(app).get("/api/auth/me").set("Cookie", jwtCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the jwt cookie", async () => {
    const app = buildApp();

    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Successfully logged out" });
    expect(response.headers["set-cookie"].some((cookie) => cookie.startsWith("jwt=;"))).toBe(true);
  });
});

describe("password reset flow", () => {
  it("lets a user reset their password via OTP and log in with the new one", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup").send(validSignupPayload());

    const forgotResponse = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ada@example.com" });
    expect(forgotResponse.status).toBe(200);
    expect(sendOTPEmailMock).toHaveBeenCalledTimes(1);

    // The OTP itself is only ever emailed to the user, never returned by the
    // API, so we read it directly from the (mocked-email, real-DB) user record.
    const userWithOTP = await User.findOne({ email: "ada@example.com" });
    const otp = userWithOTP.forgotPasswordOTP;

    const verifyResponse = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "ada@example.com", otp });
    expect(verifyResponse.status).toBe(200);
    const { resetToken } = verifyResponse.body;
    expect(resetToken).toBeTruthy();

    const resetResponse = await request(app).post("/api/auth/reset-password").send({
      email: "ada@example.com",
      newPassword: "a-brand-new-password",
      confirmNewPassword: "a-brand-new-password",
      resetToken,
    });
    expect(resetResponse.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-horse-battery-staple" });
    expect(oldPasswordLogin.status).toBe(400);

    const newPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "a-brand-new-password" });
    expect(newPasswordLogin.status).toBe(200);
  });

  it("rejects an incorrect OTP", async () => {
    const app = buildApp();
    await request(app).post("/api/auth/signup").send(validSignupPayload());
    await request(app).post("/api/auth/forgot-password").send({ email: "ada@example.com" });

    const response = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "ada@example.com", otp: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid OTP");
  });
});
