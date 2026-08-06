import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { authLimiter } from "../../../services/rateLimitingService.js";

// authLimiter is configured for 5 requests/minute per IP+route. Its store is
// a module-level singleton shared by every test in this file (it's imported
// once), so each test mounts it on its own unique path — otherwise the
// keyGenerator (ip + originalUrl) would let one test's hits bleed into the
// next test's count.
function buildAppWithFailingHandler(path) {
  const app = express();
  app.post(path, authLimiter, (req, res) => {
    res.status(400).json({ error: "invalid credentials" });
  });
  return app;
}

describe("authLimiter", () => {
  it("allows requests under the limit through", async () => {
    const app = buildAppWithFailingHandler("/allows-under-limit");

    const response = await request(app).post("/allows-under-limit");

    expect(response.status).toBe(400);
  });

  it("blocks with 429 once the per-minute limit of failed attempts is exceeded", async () => {
    const path = "/blocks-over-limit";
    const app = buildAppWithFailingHandler(path);

    for (let i = 0; i < 5; i += 1) {
      const response = await request(app).post(path);
      expect(response.status).toBe(400);
    }

    const sixthAttempt = await request(app).post(path);

    expect(sixthAttempt.status).toBe(429);
    expect(sixthAttempt.body).toEqual({
      error: "Too many authentication attempts. Please try again later.",
    });
  });

  it("does not count successful responses toward the limit", async () => {
    const path = "/does-not-count-success";
    const app = express();
    app.post(path, authLimiter, (req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 10; i += 1) {
      const response = await request(app).post(path);
      expect(response.status).toBe(200);
    }
  });
});
