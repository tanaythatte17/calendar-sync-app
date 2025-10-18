import express from "express";
import { connectSSE, getConnectionStatus } from "../controllers/sseController.js";
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

// SSE connection endpoint (requires authentication)
router.get('/events', protectRoute, connectSSE);

// Get connection status (for debugging)
router.get('/status', protectRoute, getConnectionStatus);

export default router;
