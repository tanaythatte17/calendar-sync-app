import calendarAccount from "../models/calendarAccountModel.js";
import axios from "axios";

export const refreshCalendarAccessToken = async (
  accountId,
  refreshToken,
  tokenUrl,
  clientId,
  clientSecret,
  extraParams = {}
) => {
  try {
    // OAuth2 refresh token grant
    const params = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      ...extraParams,
    };

    const response = await axios.post(tokenUrl, new URLSearchParams(params), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const tokens = response.data;

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + tokens.expires_in * 1000);

    const updatedFields = {
      accessToken: tokens.access_token,
      expiresAt,
      lastSyncedAt: new Date(),
      // only if a new refresh token is provided
      ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
      // clear incremental sync state for safety
      syncToken: null,
      deltaLink: null,
    };

    const updatedAccount = await calendarAccount.findByIdAndUpdate(
      accountId,
      updatedFields,
      { new: true }
    );

    return updatedAccount;
  } catch (err) {
    console.error(`Token refresh failed for account ${accountId}:`, err.message);
    // optionally clear invalid accessToken
    await calendarAccount.findByIdAndUpdate(accountId, {
      $unset: { accessToken: "" },
    });
    throw err;
  }
};
