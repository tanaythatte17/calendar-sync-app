import express from "express";
import { microsoftEventsWebhookHandler, microsoftCalendarListWebhookHandler } from "../controllers/microsoftWebhookController.js";

const router = express.Router();

router.post('/events', microsoftEventsWebhookHandler);
router.post('/list', microsoftCalendarListWebhookHandler);

export default router;