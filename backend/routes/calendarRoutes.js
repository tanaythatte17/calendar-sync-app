import express from 'express';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getUserCalendars
} from '../controllers/calendarEventController.js';
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.use(protectRoute);

router.post('/events', createCalendarEvent);
router.put('/events/:id', updateCalendarEvent);
router.delete('/events/:id', deleteCalendarEvent);
router.get('/calendars', getUserCalendars);

export default router; 