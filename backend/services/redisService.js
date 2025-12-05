import { redisHelpers } from "../config/redis.js";

// Cache TTL in seconds
const EVENTS_CACHE_TTL = 300; // 5 minutes
const ACCOUNTS_CACHE_TTL = 300; // 5 minutes
const SYNC_STATUS_TTL = 3600; // 1 hour
const DEBOUNCE_TTL = 2; // 2 seconds

// Cache key generators
export const getCacheKey = {
  events: (userId) => `calendar:${userId}:events`,
  accounts: (userId) => `user:${userId}:calendarAccounts`,
  syncStatus: (userId, accountId) => `sync:status:${userId}:${accountId}`,
  debounce: (calendarId) => `debounce:${calendarId}`,
};

// =====================
// CACHE INVALIDATION
// =====================

/**
 * Invalidate user's events cache
 */
export async function invalidateUserEventsCache(userId) {
  const cacheKey = getCacheKey.events(userId);
  await redisHelpers.del(cacheKey);
  console.log(`🗑️  Invalidated events cache for user ${userId}`);
}

/**
 * Invalidate user's calendar accounts cache
 */
export async function invalidateUserAccountsCache(userId) {
  const cacheKey = getCacheKey.accounts(userId);
  await redisHelpers.del(cacheKey);
  console.log(`🗑️  Invalidated accounts cache for user ${userId}`);
}

/**
 * Invalidate all caches for a user
 */
export async function invalidateAllUserCaches(userId) {
  await invalidateUserEventsCache(userId);
  await invalidateUserAccountsCache(userId);
  console.log(`🗑️  Invalidated all caches for user ${userId}`);
}

// =====================
// SMART CACHE UPDATES
// =====================

/**
 * Update cached events after webhook notification
 * Only updates if cache exists, otherwise does nothing
 */
export async function updateCachedEvent(userId, eventData, operation) {
  const cacheKey = getCacheKey.events(userId);
  const cached = await redisHelpers.getJSON(cacheKey);
  
  if (!cached) {
    console.log(`⏭️  No cache to update for user ${userId}`);
    return; // No cache exists, skip update
  }

  let events = [...cached];

  switch (operation) {
    case 'created':
      // Add new event
      events.push(eventData);
      events.sort((a, b) => 
        new Date(a.start.dateTime) - new Date(b.start.dateTime)
      );
      console.log(`➕ Added event to cache for user ${userId}`);
      break;

    case 'updated':
      // Update existing event
      const updateIndex = events.findIndex(e => 
        e._id?.toString() === eventData._id?.toString() ||
        e.googleEventId === eventData.googleEventId ||
        e.outlookEventId === eventData.outlookEventId
      );
      
      if (updateIndex !== -1) {
        events[updateIndex] = eventData;
        console.log(`✏️  Updated event in cache for user ${userId}`);
      } else {
        // Event not in cache range, add it
        events.push(eventData);
        events.sort((a, b) => 
          new Date(a.start.dateTime) - new Date(b.start.dateTime)
        );
        console.log(`➕ Added new event to cache for user ${userId}`);
      }
      break;

    case 'deleted':
      // Remove event
      const beforeLength = events.length;
      events = events.filter(e => 
        e._id?.toString() !== eventData._id?.toString() &&
        e.googleEventId !== eventData.googleEventId &&
        e.outlookEventId !== eventData.outlookEventId
      );
      console.log(`🗑️  Deleted event from cache for user ${userId} (${beforeLength} -> ${events.length})`);
      break;

    default:
      console.log(`❓ Unknown operation ${operation}, invalidating cache`);
      await invalidateUserEventsCache(userId);
      return;
  }

  // Update cache with modified events
  await redisHelpers.setJSON(cacheKey, events, EVENTS_CACHE_TTL);
}

// =====================
// SYNC MANAGEMENT
// =====================

/**
 * Check if sync is already running for an account
 */
export async function isSyncRunning(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const status = await redisHelpers.getJSON(key);
  
  if (!status) return false;
  return status.running === true;
}

/**
 * Mark sync as started
 */
export async function startSync(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const data = {
    running: true,
    lastSyncStart: Date.now(),
    lastSyncEnd: null,
  };
  await redisHelpers.setJSON(key, data);
  console.log(`🔄 Started sync for user ${userId}, account ${accountId}`);
}

/**
 * Mark sync as completed
 */
export async function endSync(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const status = await redisHelpers.getJSON(key);
  const data = status || {};
  
  data.running = false;
  data.lastSyncEnd = Date.now();
  
  await redisHelpers.setJSON(key, data, SYNC_STATUS_TTL);
  console.log(`✅ Ended sync for user ${userId}, account ${accountId}`);
}

/**
 * Get sync status
 */
export async function getSyncStatus(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  return await redisHelpers.getJSON(key);
}

// =====================
// WEBHOOK DEBOUNCING
// =====================

/**
 * Check if webhook should be debounced
 * Returns true if webhook was recently processed
 */
export async function shouldDebounceWebhook(calendarId) {
  const key = getCacheKey.debounce(calendarId);
  const exists = await redisHelpers.exists(key);
  
  if (exists) {
    console.log(`⏸️  Debounced webhook for calendar ${calendarId}`);
    return true; // Already processing recent webhook
  }
  
  // Set debounce flag for 2 seconds
  await redisHelpers.setWithTTL(key, '1', DEBOUNCE_TTL);
  return false;
}

// =====================
// CACHE WARMING (Optional)
// =====================

/**
 * Pre-load cache on user login
 */
export async function warmUserCache(userId, accounts, events) {
  await redisHelpers.setJSON(
    getCacheKey.accounts(userId), 
    accounts, 
    ACCOUNTS_CACHE_TTL
  );
  
  await redisHelpers.setJSON(
    getCacheKey.events(userId), 
    events, 
    EVENTS_CACHE_TTL
  );
  
  console.log(`🔥 Warmed cache for user ${userId}`);
}

// =====================
// BULK OPERATIONS
// =====================

/**
 * Invalidate caches for multiple users (useful for admin operations)
 */
export async function invalidateMultipleUserCaches(userIds) {
  const promises = userIds.map(userId => invalidateAllUserCaches(userId));
  await Promise.all(promises);
  console.log(`🗑️  Invalidated caches for ${userIds.length} users`);
}

/**
 * Clear all calendar-related caches (use with caution!)
 */
export async function clearAllCalendarCaches() {
  const eventKeys = await redisHelpers.deletePattern('calendar:*:events');
  const accountKeys = await redisHelpers.deletePattern('user:*:calendarAccounts');
  console.log(`🗑️  Cleared ${eventKeys + accountKeys} cache keys`);
  return { eventsCleared: eventKeys, accountsCleared: accountKeys };
}

// =====================
// CACHE STATISTICS
// =====================

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats() {
  // This is a simplified version - you might want to use Redis INFO command
  // or implement more sophisticated monitoring
  
  const stats = {
    timestamp: new Date().toISOString(),
    // Add your monitoring logic here
  };
  
  return stats;
}