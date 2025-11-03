import express from "express";
import { connectMicrosoft, microsoftCallback, syncMicrosoft } from "../controllers/microsoftController.js";
import protectRoute from "../middleware/protectRoute.js";
import protectOAuthRoute from "../middleware/OAuthMiddleware.js";
import { apiLimiter } from "../services/rateLimitingService.js";
const router = express.Router();

router.get('/auth', apiLimiter,protectOAuthRoute,connectMicrosoft);
router.get('/auth/callback', microsoftCallback);
router.get('/sync/microsoft', apiLimiter, protectRoute, syncMicrosoft);

export default router;