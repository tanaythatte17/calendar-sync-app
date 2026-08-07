import logger from "../utils/logger.js";
const protectOAuthRoute = async (req, res, next) => {
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

        req.token = token;
        next();
    } catch (error) {
        logger.info(error.message);
        res.status(500).json({ error: "Error in OAuth Middleware" });
    }
};

export default protectOAuthRoute;