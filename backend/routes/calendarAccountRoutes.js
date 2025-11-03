import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { apiLimiter } from "../services/rateLimitingService.js";
import { deleteCalendarAccount } from "../controllers/calendarAccountController.js";
const router = express.Router();

router.delete('/delete/:accountId', apiLimiter, protectRoute, deleteCalendarAccount);

export default router;