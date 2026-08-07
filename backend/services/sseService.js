import logger from "../utils/logger.js";
/**
 * Server-Sent Events (SSE) broadcast service.
 * Manages client connections and broadcasts real-time updates.
 * Clients are tracked by userId for selective delivery.
 */
class SSEService {
  constructor() {
    this.clients = new Map(); // userId -> Set of client connections
  }

  /**
   * Register a new SSE client connection.
   *
   * @param {string} userId - User ID
   * @param {string} clientId - Unique client identifier
   * @param {Object} response - Express response object (stream)
   * @returns {Object} Client object with id, response, userId
   */
  addClient(userId, clientId, response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }

    const client = {
      id: clientId,
      response,
      userId
    };

    this.clients.get(userId).add(client);

    return client;
  }

  /**
   * Deregister a client connection.
   * Cleans up empty user sets.
   *
   * @param {string} userId - User ID
   * @param {string} clientId - Client ID to remove
   */
  removeClient(userId, clientId) {
    if (!this.clients.has(userId)) return;

    const userClients = this.clients.get(userId);
    for (const client of userClients) {
      if (client.id === clientId) {
        userClients.delete(client);
        break;
      }
    }

    if (userClients.size === 0) {
      this.clients.delete(userId);
    }
  }

  /**
   * Get total number of connected clients across all users.
   *
   * @returns {number} Total client count
   */
  getTotalClients() {
    let total = 0;
    for (const userClients of this.clients.values()) {
      total += userClients.size;
    }
    return total;
  }

  /**
   * Send SSE message to a specific user's connected clients.
   * Automatically removes dead connections on write errors.
   *
   * @param {string} userId - User ID
   * @param {Object} data - Message data (will be JSON stringified)
   */
  sendToUser(userId, data) {
    if (!this.clients.has(userId)) {
      logger.info(`No clients found for user ${userId}`);
      return;
    }

    const userClients = this.clients.get(userId);
    const deadClients = new Set();

    for (const client of userClients) {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        logger.info(`Client ${client.id} disconnected (write error)`);
        deadClients.add(client);
      }
    }

    // Clean up dead connections
    for (const deadClient of deadClients) {
      userClients.delete(deadClient);
    }

    if (userClients.size === 0) {
      this.clients.delete(userId);
    }
  }

  /**
   * Broadcast message to all connected clients (all users).
   *
   * @param {Object} data - Message data
   */
  broadcast(data) {
    for (const [userId, userClients] of this.clients.entries()) {
      this.sendToUser(userId, data);
    }
  }

  /**
   * Send event update message.
   * Used for calendar event additions, updates, deletions.
   *
   * @param {string} userId - User ID
   * @param {Object} eventData - Event object from database
   * @param {string} action - 'added', 'updated', or 'deleted'
   */
  sendEventUpdate(userId, eventData, action) {
    const updateData = {
      type: 'event',
      action,
      data: eventData,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(userId, updateData);
  }

  /**
   * Send calendar list update message.
   * Used when calendars are added, removed, or modified.
   *
   * @param {string} userId - User ID
   * @param {Object} calendarData - Calendar data
   * @param {string} action - 'added', 'updated', or 'deleted'
   */
  sendCalendarListUpdate(userId, calendarData, action) {
    const updateData = {
      type: 'calendarList',
      action,
      data: calendarData,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(userId, updateData);
  }

  /**
   * Send sync status message.
   * Notifies client of sync operations (started, completed, error).
   *
   * @param {string} userId - User ID
   * @param {string} status - 'started', 'completed', or 'error'
   * @param {string} message - Human-readable status message
   * @param {Object} details - Additional details (provider, calendarId, etc.)
   */
  sendSyncStatus(userId, status, message, details = {}) {
    const updateData = {
      type: 'syncStatus',
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.sendToUser(userId, updateData);
  }
}

// Export singleton instance
export default new SSEService();
