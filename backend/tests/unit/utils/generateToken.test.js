import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import generateTokenAndSetCookie from "../../../utils/generateToken.js";

function createMockRes() {
  return { cookie: vi.fn() };
}

describe("generateTokenAndSetCookie", () => {
  it("signs a JWT containing the given userId", () => {
    const res = createMockRes();
    const token = generateTokenAndSetCookie("user-123", res);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe("user-123");
  });

  it("sets an httpOnly cookie named 'jwt' with the signed token", () => {
    const res = createMockRes();
    const token = generateTokenAndSetCookie("user-123", res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [cookieName, cookieValue, cookieOptions] = res.cookie.mock.calls[0];
    expect(cookieName).toBe("jwt");
    expect(cookieValue).toBe(token);
    expect(cookieOptions).toMatchObject({ httpOnly: true, sameSite: "none" });
  });

  it("returns a token that expires roughly 15 days from now", () => {
    const res = createMockRes();
    const token = generateTokenAndSetCookie("user-123", res);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const fifteenDaysInSeconds = 15 * 24 * 60 * 60;
    const actualLifetime = decoded.exp - decoded.iat;

    expect(actualLifetime).toBe(fifteenDaysInSeconds);
  });

  it("rejects verification with the wrong secret", () => {
    const res = createMockRes();
    const token = generateTokenAndSetCookie("user-123", res);

    expect(() => jwt.verify(token, "a-completely-different-secret")).toThrow();
  });
});
