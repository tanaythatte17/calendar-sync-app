import express from 'express';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getUserCalendars
} from '../controllers/calendarEventController.js';
import protectRoute from "../middleware/protectRoute.js";
import { apiLimiter } from '../services/rateLimitingService.js';

const router = express.Router();

router.post('/events', apiLimiter, protectRoute, createCalendarEvent);
router.put('/events/:id', apiLimiter, protectRoute, updateCalendarEvent);
router.delete('/events/:id', apiLimiter, protectRoute, deleteCalendarEvent);
router.get('/calendars', apiLimiter, protectRoute, getUserCalendars);

export default router; 