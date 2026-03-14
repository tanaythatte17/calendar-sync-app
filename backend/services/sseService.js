class SSEService {
  constructor() {
    this.clients = new Map(); // Map of userId -> Set of client connections
  }

  // Add a new client connection
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

  // Remove a client connection
  removeClient(userId, clientId) {
    if (!this.clients.has(userId)) return;
    
    const userClients = this.clients.get(userId);
    for (const client of userClients) {
      if (client.id === clientId) {
        userClients.delete(client);
        break;
      }
    }
    
    // Clean up empty user sets
    if (userClients.size === 0) {
      this.clients.delete(userId);
    }
  }

  // Get total number of connected clients
  getTotalClients() {
    let total = 0;
    for (const userClients of this.clients.values()) {
      total += userClients.size;
    }
    return total;
  }

  // Send data to a specific user's clients
  sendToUser(userId, data) {
    if (!this.clients.has(userId)) {
      console.log(`No clients found for user ${userId}`);
      return;
    }

    const userClients = this.clients.get(userId);
    const deadClients = new Set();
    
    for (const client of userClients) {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.log(`Client ${client.id} disconnected (write error)`);
        deadClients.add(client);
      }
    }
    
    // Remove dead clients
    for (const deadClient of deadClients) {
      userClients.delete(deadClient);
    }
    
    if (userClients.size === 0) {
      this.clients.delete(userId);
    }
  }

  // Send data to all connected clients
  broadcast(data) {
    for (const [userId, userClients] of this.clients.entries()) {
      this.sendToUser(userId, data);
    }
  }

  // Send event update to specific user
  sendEventUpdate(userId, eventData, action) {
    const updateData = {
      type: 'event',
      action, // 'added', 'updated', 'deleted'
      data: eventData,
      timestamp: new Date().toISOString()
    };
    
    this.sendToUser(userId, updateData);
  }

  // Send calendar list update to specific user
  sendCalendarListUpdate(userId, calendarData, action) {
    const updateData = {
      type: 'calendarList',
      action, // 'added', 'updated', 'deleted'
      data: calendarData,
      timestamp: new Date().toISOString()
    };
    
    this.sendToUser(userId, updateData);
  }

  // Send sync status update to specific user
  sendSyncStatus(userId, status, message, details = {}) {
    const updateData = {
      type: 'syncStatus',
      status, // 'started', 'completed', 'error'
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.sendToUser(userId, updateData);
  }
}

// Export singleton instance
export default new SSEService();
