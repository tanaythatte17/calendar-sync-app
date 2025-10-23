import express from "express";
import { connectMicrosoft, microsoftCallback, syncMicrosoft } from "../controllers/microsoftController.js";
import protectRoute from "../middleware/protectRoute.js";
import protectOAuthRoute from "../middleware/OAuthMiddleware.js";
const router = express.Router();

router.get('/auth', protectOAuthRoute,connectMicrosoft);
router.get('/auth/callback', microsoftCallback);
router.get('/sync/microsoft', protectRoute, syncMicrosoft);

export default router;