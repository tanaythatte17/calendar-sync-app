import express from "express";
import { connectSSE, getConnectionStatus } from "../controllers/sseController.js";
import protectRoute from "../middleware/protectRoute.js";
import { sseLimiter } from "../services/rateLimitingService.js";

const router = express.Router();

// SSE connection endpoint (requires authentication)
router.get('/events', sseLimiter, protectRoute, connectSSE);

// Get connection status (for debugging)
router.get('/status', sseLimiter, protectRoute, getConnectionStatus);

export default router;
