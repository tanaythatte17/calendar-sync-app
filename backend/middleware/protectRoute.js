import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

/**
 * Middleware to verify JWT token and authenticate requests.
 * Checks Authorization header (Bearer token) or JWT cookie.
 * Populates req.user with authenticated user document.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns 401 if no token or invalid, 404 if user not found, 500 on error
 */
const protectRoute = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized - No Token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid Token provided" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: "Error in Middleware" });
  }
};

export default protectRoute;