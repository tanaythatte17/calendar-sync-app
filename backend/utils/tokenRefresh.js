import axios from 'axios';
import qs from 'qs';
import CalendarAccount from '../models/CalendarAccount.js';

// Refresh Google token
const refreshGoogleToken = async (calendarAccount) => {
  try {
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      qs.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: calendarAccount.refreshToken,
        grant_type: 'refresh_token'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;
    
    // Update calendar account with new tokens
    calendarAccount.accessToken = tokens.access_token;
    calendarAccount.tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    await calendarAccount.save();

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing Google token:', error.response?.data || error.message);
    throw new Error('Failed to refresh Google token');
  }
};

// Refresh Microsoft token
const refreshMicrosoftToken = async (calendarAccount) => {
  try {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: calendarAccount.refreshToken,
        grant_type: 'refresh_token'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;
    
    // Update calendar account with new tokens
    calendarAccount.accessToken = tokens.access_token;
    calendarAccount.tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    await calendarAccount.save();

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing Microsoft token:', error.response?.data || error.message);
    throw new Error('Failed to refresh Microsoft token');
  }
};

// Get valid access token
const getValidAccessToken = async (calendarAccount) => {
  if (needsRefresh(calendarAccount)) {
    if (calendarAccount.provider === 'google') {
      return await refreshGoogleToken(calendarAccount);
    } else if (calendarAccount.provider === 'microsoft') {
      return await refreshMicrosoftToken(calendarAccount);
    }
  }
  return calendarAccount.accessToken;
};

// Check if token needs refresh
const needsRefresh = (calendarAccount) => {
  const expiryTime = new Date(calendarAccount.tokenExpiry).getTime();
  const currentTime = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
  return currentTime + bufferTime >= expiryTime;
};

export {
  getValidAccessToken,
  needsRefresh
}; 