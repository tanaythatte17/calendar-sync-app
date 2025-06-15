// Google Calendar API error codes
const GOOGLE_ERRORS = {
  400: 'Invalid request',
  401: 'Authentication required',
  403: 'Insufficient permissions',
  404: 'Resource not found',
  409: 'Conflict with existing resource',
  429: 'Rate limit exceeded',
  500: 'Internal server error'
};

// Microsoft Graph API error codes
const MICROSOFT_ERRORS = {
  400: 'Invalid request',
  401: 'Authentication required',
  403: 'Insufficient permissions',
  404: 'Resource not found',
  409: 'Conflict with existing resource',
  429: 'Rate limit exceeded',
  500: 'Internal server error',
  503: 'Service unavailable'
};

// Handle Google API errors
const handleGoogleError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    if (status === 401) {
      return { status: 401, message: 'Google authentication failed' };
    }
    if (status === 403) {
      return { status: 403, message: 'Insufficient permissions for Google Calendar' };
    }
    if (status === 429) {
      return { status: 429, message: 'Google API rate limit exceeded' };
    }
    return { status, message: data.error?.message || 'Google API error' };
  }
  return { status: 500, message: 'Google API error' };
};

// Handle Microsoft API errors
const handleMicrosoftError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    if (status === 401) {
      return { status: 401, message: 'Microsoft authentication failed' };
    }
    if (status === 403) {
      return { status: 403, message: 'Insufficient permissions for Microsoft Calendar' };
    }
    if (status === 429) {
      return { status: 429, message: 'Microsoft API rate limit exceeded' };
    }
    return { status, message: data.error?.message || 'Microsoft API error' };
  }
  return { status: 500, message: 'Microsoft API error' };
};

// Handle token refresh errors
const handleTokenRefreshError = (error) => {
  return { status: 401, message: 'Token refresh failed' };
};

export {
  handleGoogleError,
  handleMicrosoftError,
  handleTokenRefreshError
}; 