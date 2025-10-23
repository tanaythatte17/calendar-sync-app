import express from "express";
import { connectGoogle, googleCallback, syncGoogle } from "../controllers/googleController.js";
import protectRoute from "../middleware/protectRoute.js";
import protectOAuthRoute from "../middleware/OAuthMiddleware.js";
const router = express.Router();

router.get('/auth', protectOAuthRoute, connectGoogle);
router.get('/auth/callback', googleCallback);
router.get('/sync/google', protectRoute, syncGoogle);

export default router;