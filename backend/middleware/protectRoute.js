import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const protectRoute = async (req, res, next) => {
    try {
        // Check for token in Authorization header
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies && req.cookies.jwt) {
            // Fallback to cookie
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