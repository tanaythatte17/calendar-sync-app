import express from "express";
import protectRoute from "../middleware/protectRoute.js";
import { deleteCalendarAccount } from "../controllers/calendarAccountController.js";
const router = express.Router();

router.delete('/delete/:accountId', protectRoute, deleteCalendarAccount);

export default router;