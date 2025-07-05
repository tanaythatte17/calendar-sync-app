import express from "express";
import { connectMicrosoft, microsoftCallback, syncMicrosoft } from "../controllers/microsoftController.js";
import protectRoute from "../middleware/protectRoute.js";
const router = express.Router();

//router.get('/auth', protectRoute, connectMicrosoft);
router.get('/auth', connectMicrosoft);
//router.get('/auth/callback', protectRoute, microsoftCallback);
router.get('/auth/callback', microsoftCallback);
//router.get('/sync/google', protectRoute, syncMicrosoft);
router.get('/sync/microsoft', syncMicrosoft);

export default router;