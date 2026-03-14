import express from "express";
import { connectGoogle, googleCallback, syncGoogle } from "../controllers/googleController.js";
import protectRoute from "../middleware/protectRoute.js";
import protectOAuthRoute from "../middleware/OAuthMiddleware.js";
import { apiLimiter } from "../services/rateLimitingService.js";
const router = express.Router();

router.get('/auth', apiLimiter, protectOAuthRoute, connectGoogle);
router.get('/auth/callback', googleCallback);
router.get('/sync/google', apiLimiter, protectRoute, syncGoogle);

export default router;