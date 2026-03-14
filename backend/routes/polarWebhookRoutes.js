import express from 'express';
import { handlePolarWebhook } from '../controllers/polarWebhookController.js';

const router = express.Router();

router.post('/listen', express.raw({ type: 'application/json' }), handlePolarWebhook);

export default router;