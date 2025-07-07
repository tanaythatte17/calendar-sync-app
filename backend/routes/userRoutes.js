import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { getCalendarAccountsHandler, getUserEventsHandler } from "../controllers/userController.js";

const router = express.Router();

router.get('/events', protectRoute, getUserEventsHandler);
router.get('/accounts', protectRoute, getCalendarAccountsHandler);

export default router;