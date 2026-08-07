import logger from "../utils/logger.js";
import { 
  signup as signupService, 
  login as loginService, 
  logout as logoutService, 
  getMe as getMeService, 
  forgotPasswordService, 
  verifyOTPService, 
  setNewPasswordService,
  getGoogleAuthURLService,
  handleGoogleCallbackService,
  getMicrosoftAuthURLService,
  handleMicrosoftCallbackService
} from "../services/authService.js";

/**
 * Register a new user with email and password.
 * Validates email format and password confirmation.
 * Sets JWT token in response cookie.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - { name, email, password, confirmPassword }
 * @param {Object} res - Express response object
 * @returns {Object} User data (id, name, email)
 */
export const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords don't match" });
    }
    const result = await signupService(res, { name, email, password });
    return res.status(201).json(result);
  } catch (error) {
    logger.info(error.message);
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || "Internal error in creating user" });
  }
}
/**
 * Authenticate a user with email and password.
 * Sets JWT token in response cookie on success.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - { email, password }
 * @param {Object} res - Express response object
 * @returns {Object} User data (id, name, email)
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginService(res, { email, password });
    return res.status(200).json(result);
  } catch (error) {
    logger.info(error.message);
    const status = error.statusCode || 400;
    res.status(status).json({ error: error.message || "Internal error" });
  }
}
/**
 * Clear the JWT cookie to log out the user.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Logout confirmation message
 */
export const logout = (req, res) => {
  try {
    const result = logoutService(res);
    res.status(200).json(result);
  } catch (error) {
    logger.info(error.message);
    res.status(400).json({ error: "Internal error" });
  }
}

/**
 * Retrieve the authenticated user's profile data.
 * Requires valid JWT token (checked by protectRoute middleware).
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} res - Express response object
 * @returns {Object} User data (id, name, email)
 */
export const getMe = (req, res) => {
  try {
    const result = getMeService(req.user);
    res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 400;
    res.status(status).json({ error: error.message || "Error" });
  }
};

export const forgotPassword = async (req, res) => {
    try {
        const {email} = req.body;
        const result = await forgotPasswordService(email);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const {email, otp} = req.body;
        const result = await verifyOTPService(email, otp);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

export const setNewPassword = async (req, res) => {
    try{
        const {email, newPassword, confirmNewPassword, resetToken} = req.body;
        const result = await setNewPasswordService(email, newPassword, confirmNewPassword, resetToken);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

/**
 * Generate Google OAuth 2.0 authorization URL.
 * User browser redirects to this URL to authenticate with Google.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} { authUrl } - Google OAuth URL
 */
export const getGoogleAuthURL = async (req, res) => {
  try {
    const result = await getGoogleAuthURLService();
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

/**
 * Handle Google OAuth 2.0 callback.
 * Exchanges authorization code for tokens and creates/updates user account.
 * Sets JWT token in response cookie.
 *
 * @param {Object} req - Express request object
 * @param {string} req.query.code - Google authorization code
 * @param {Object} res - Express response object
 * @returns Redirects to frontend success page or error page
 */
export const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    const result = await handleGoogleCallbackService(code, res);
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);
  } catch (error) {
    logger.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};

/**
 * Generate Microsoft OAuth 2.0 authorization URL.
 * User browser redirects to this URL to authenticate with Microsoft.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} { authUrl } - Microsoft OAuth URL
 */
export const getMicrosoftAuthURL = async (req, res) => {
  try {
    const result = await getMicrosoftAuthURLService();
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error generating Microsoft auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

/**
 * Handle Microsoft OAuth 2.0 callback.
 * Exchanges authorization code for tokens and creates/updates user account.
 * Sets JWT token in response cookie.
 *
 * @param {Object} req - Express request object
 * @param {string} req.query.code - Microsoft authorization code
 * @param {Object} res - Express response object
 * @returns Redirects to frontend success page or error page
 */
export const handleMicrosoftCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    const result = await handleMicrosoftCallbackService(code, res);
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);
  } catch (error) {
    logger.error('Microsoft callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};