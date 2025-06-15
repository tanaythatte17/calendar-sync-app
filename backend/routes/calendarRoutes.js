import express from 'express';
import { protect } from '../middleware/auth.js';
import googleController from '../controllers/googleController.js';
import microsoftController from '../controllers/microsoftController.js';
import calendarController from '../controllers/calendarController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Google Calendar Routes
router.get('/google/auth', googleController.redirectToGoogle);
router.get('/google/callback', googleController.handleGoogleCallback);
router.get('/google/sync', googleController.syncGoogleEvents);
router.post('/google/events', googleController.createGoogleEvent);
router.post('/google/disconnect', googleController.disconnectGoogle);

// Microsoft Calendar Routes
router.get('/microsoft/auth', microsoftController.redirectToMicrosoft);
router.get('/microsoft/callback', microsoftController.handleMicrosoftCallback);
router.get('/microsoft/sync', microsoftController.syncMicrosoftEvents);
router.post('/microsoft/events', microsoftController.createMicrosoftEvent);
router.post('/microsoft/disconnect', microsoftController.disconnectMicrosoft);

// Get all calendar accounts
router.get('/accounts', calendarController.getCalendarAccounts);

// Get sync status for all accounts
router.get('/sync-status', calendarController.getSyncStatus);

// Sync a specific calendar account
router.post('/sync/:accountId', calendarController.syncCalendarAccount);

// Sync all calendar accounts
router.post('/sync-all', calendarController.syncAllCalendars);

// Disconnect a calendar account
router.delete('/disconnect/:accountId', calendarController.disconnectCalendar);

export default router; 