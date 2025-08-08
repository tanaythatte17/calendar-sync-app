import express from "express";
import { googleEventsWebhookHandler, googleCalendarListWebhookHandler } from "../controllers/googleWebhookController.js";

const router = express.Router();

router.post('/events', googleEventsWebhookHandler);
router.post('/list', googleCalendarListWebhookHandler);

export default router;