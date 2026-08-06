import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import User from "../../../models/userModel.js";
import protectRoute from "../../../middleware/protectRoute.js";

vi.mock("../../../models/userModel.js", () => ({
  default: { findById: vi.fn() },
}));

function createMockReqRes({ authorization, jwtCookie } = {}) {
  const req = {
    headers: authorization ? { authorization } : {},
    cookies: jwtCookie ? { jwt: jwtCookie } : {},
  };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  return { req, res, next };
}

describe("protectRoute middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests with no token in header or cookie", async () => {
    const { req, res, next } = createMockReqRes();

    await protectRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized - No Token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid/expired token", async () => {
    const { req, res, next } = createMockReqRes({ jwtCookie: "not-a-real-token" });

    await protectRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the token is valid but the user no longer exists", async () => {
    const token = jwt.sign({ userId: "deleted-user" }, process.env.JWT_SECRET);
    const { req, res, next } = createMockReqRes({ jwtCookie: token });
    User.findById.mockResolvedValue(null);

    await protectRoute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the user and calls next() for a valid cookie token", async () => {
    const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
    const { req, res, next } = createMockReqRes({ jwtCookie: token });
    const fakeUser = { _id: "user-1", name: "Ada" };
    User.findById.mockResolvedValue(fakeUser);

    await protectRoute(req, res, next);

    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("prefers a Bearer token in the Authorization header over the cookie", async () => {
    const headerToken = jwt.sign({ userId: "user-header" }, process.env.JWT_SECRET);
    const { req, res, next } = createMockReqRes({
      authorization: `Bearer ${headerToken}`,
      jwtCookie: "some-other-cookie-token",
    });
    const fakeUser = { _id: "user-header" };
    User.findById.mockResolvedValue(fakeUser);

    await protectRoute(req, res, next);

    expect(User.findById).toHaveBeenCalledWith("user-header");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
