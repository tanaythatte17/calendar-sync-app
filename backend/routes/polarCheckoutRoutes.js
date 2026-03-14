import express from 'express';
import { apiLimiter } from '../services/rateLimitingService.js';
import protectRoute from '../middleware/protectRoute.js';
import { getPolarCheckoutLink } from '../controllers/polarCheckoutController.js';
const router = express.Router();

router.get('/link', apiLimiter, protectRoute, getPolarCheckoutLink );

export default router;