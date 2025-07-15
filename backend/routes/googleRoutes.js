import express from "express";
import { connectGoogle, googleCallback, syncGoogle } from "../controllers/googleController.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

router.get('/auth', connectGoogle);
router.get('/auth/callback', googleCallback);
router.get('/sync/google', protectRoute, syncGoogle);

export default router;