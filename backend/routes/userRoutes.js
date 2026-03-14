import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getCalendarAccountsHandler, getUserEventsHandler, getUserProfile, updateUserTimezone, getUserTimezone } from "../controllers/userController.js";
import { apiLimiter, eventLimiter } from "../services/rateLimitingService.js";

const router = express.Router();

router.get('/events', eventLimiter, protectRoute, getUserEventsHandler);
router.get('/accounts', apiLimiter, protectRoute, getCalendarAccountsHandler);
router.get('/profile', apiLimiter, protectRoute, getUserProfile);
router.put('/timezone', apiLimiter, protectRoute, updateUserTimezone);
router.get('/timezone', apiLimiter, protectRoute, getUserTimezone);

export default router;