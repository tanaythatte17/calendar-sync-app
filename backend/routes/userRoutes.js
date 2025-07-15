import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getCalendarAccountsHandler, getUserEventsHandler, getUserProfile, updateUserTimezone } from "../controllers/userController.js";

const router = express.Router();

router.get('/events', protectRoute, getUserEventsHandler);
router.get('/accounts', protectRoute, getCalendarAccountsHandler);
router.get('/profile', protectRoute, getUserProfile);
router.put('/timezone', protectRoute, updateUserTimezone);

export default router;