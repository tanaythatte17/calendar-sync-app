import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import calendarAccount from "../../../models/calendarAccountModel.js";
import { refreshCalendarAccessToken } from "../../../utils/refreshToken.js";

vi.mock("axios");
vi.mock("../../../models/calendarAccountModel.js", () => ({
  default: { findByIdAndUpdate: vi.fn() },
}));

const ACCOUNT_ID = "507f1f77bcf86cd799439011";
const TOKEN_URL = "https://example.com/oauth/token";

describe("refreshCalendarAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists the new access token and computes expiresAt from expires_in", async () => {
    axios.post.mockResolvedValue({
      data: { access_token: "new-access-token", expires_in: 3600 },
    });
    calendarAccount.findByIdAndUpdate.mockResolvedValue({ _id: ACCOUNT_ID });

    await refreshCalendarAccessToken(ACCOUNT_ID, "old-refresh-token", TOKEN_URL, "client-id", "client-secret");

    expect(calendarAccount.findByIdAndUpdate).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({
        accessToken: "new-access-token",
        expiresAt: new Date("2026-01-01T01:00:00Z"),
        syncToken: null,
        deltaLink: null,
      }),
      { new: true }
    );
  });

  it("prefers expiry_date over expires_in when the provider returns both", async () => {
    axios.post.mockResolvedValue({
      data: {
        access_token: "new-access-token",
        expires_in: 3600,
        expiry_date: new Date("2026-06-01T00:00:00Z").getTime(),
      },
    });
    calendarAccount.findByIdAndUpdate.mockResolvedValue({ _id: ACCOUNT_ID });

    await refreshCalendarAccessToken(ACCOUNT_ID, "old-refresh-token", TOKEN_URL, "client-id", "client-secret");

    const [, updatedFields] = calendarAccount.findByIdAndUpdate.mock.calls[0];
    expect(updatedFields.expiresAt).toEqual(new Date("2026-06-01T00:00:00Z"));
  });

  it("only overwrites the stored refresh token when the provider issues a new one", async () => {
    axios.post.mockResolvedValue({
      data: { access_token: "new-access-token", expires_in: 3600 },
    });
    calendarAccount.findByIdAndUpdate.mockResolvedValue({ _id: ACCOUNT_ID });

    await refreshCalendarAccessToken(ACCOUNT_ID, "old-refresh-token", TOKEN_URL, "client-id", "client-secret");

    const [, updatedFields] = calendarAccount.findByIdAndUpdate.mock.calls[0];
    expect(updatedFields).not.toHaveProperty("refreshToken");
  });

  it("clears the stored access token and rethrows when the token endpoint fails", async () => {
    const providerError = new Error("invalid_grant");
    axios.post.mockRejectedValue(providerError);
    calendarAccount.findByIdAndUpdate.mockResolvedValue({ _id: ACCOUNT_ID });

    await expect(
      refreshCalendarAccessToken(ACCOUNT_ID, "old-refresh-token", TOKEN_URL, "client-id", "client-secret")
    ).rejects.toThrow("invalid_grant");

    expect(calendarAccount.findByIdAndUpdate).toHaveBeenCalledWith(ACCOUNT_ID, {
      $unset: { accessToken: "" },
    });
  });
});
