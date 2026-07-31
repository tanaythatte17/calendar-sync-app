import sseService from "../services/sseService.js";
import protectRoute from "../middleware/protectRoute.js";

/**
 * Establish Server-Sent Events (SSE) connection for real-time updates.
 * Keeps connection open and sends event/calendar changes to client.
 * Client must maintain connection and reconnect on disconnect.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object (stream)
 * @returns Streaming SSE events (no return value)
 */
export const connectSSE = (req, res) => {
  try {
    console.log('Inside SSE connection endpoint');
    const userId = req.user._id.toString();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      message: 'Connected to real-time updates',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Generate unique client ID for tracking
    const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Register client
    const client = sseService.addClient(userId, clientId, res);

    // Send initial status
    sseService.sendSyncStatus(userId, 'connected', 'Real-time updates enabled');

    // Handle disconnect
    req.on('close', () => {
      sseService.removeClient(userId, clientId);
    });

    req.on('error', (err) => {
      console.error(`SSE connection error for client ${clientId}:`, err);
      sseService.removeClient(userId, clientId);
    });
  } catch (error) {
    console.error('SSE connection error:', error);
    res.status(500).json({ error: 'Failed to establish SSE connection' });
  }
};

/**
 * Get SSE connection status for current user.
 * Useful for debugging and monitoring.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} Connection status including total connected clients
 */
export const getConnectionStatus = (req, res) => {
  try {
    const userId = req.user._id.toString();
    const totalClients = sseService.getTotalClients();
    const userHasClients = sseService.clients.has(userId);

    res.json({
      userId,
      connected: userHasClients,
      totalClients,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting connection status:', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
};
