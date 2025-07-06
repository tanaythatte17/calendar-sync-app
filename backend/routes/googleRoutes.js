import express from "express";
import { connectGoogle, googleCallback, syncGoogle } from "../controllers/googleController.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

router.get('/auth', protectRoute, connectGoogle);
router.get('/auth/callback', protectRoute, googleCallback);
router.get('/sync/google', protectRoute, syncGoogle);

export default router;