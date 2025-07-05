import express from "express";
import { connectGoogle, googleCallback, syncGoogle } from "../controllers/googleController.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

//router.get('/auth', protectRoute, connectGoogle);
router.get('/auth', connectGoogle);
//router.get('/auth/callback', protectRoute, googleCallback);
router.get('/auth/callback', googleCallback);
//router.get('/sync/google', protectRoute, syncGoogle);
router.get('/sync/google', syncGoogle);

export default router;