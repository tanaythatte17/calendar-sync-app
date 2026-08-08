import { redisHelpers } from "../config/redis.js";
import logger from "../utils/logger.js";

const EVENTS_CACHE_TTL = 300;
const ACCOUNTS_CACHE_TTL = 300;
const SYNC_STATUS_TTL = 3600;
const DEBOUNCE_TTL = 2;

export const getCacheKey = {
  events: (userId) => `calendar:${userId}:events`,
  accounts: (userId) => `user:${userId}:calendarAccounts`,
  syncStatus: (userId, accountId) => `sync:status:${userId}:${accountId}`,
  debounce: (calendarId) => `debounce:${calendarId}`,
};

export async function invalidateUserEventsCache(userId) {
  const cacheKey = getCacheKey.events(userId);
  await redisHelpers.del(cacheKey);
  logger.info(`🗑️  Invalidated events cache for user ${userId}`);
}

export async function invalidateUserAccountsCache(userId) {
  const cacheKey = getCacheKey.accounts(userId);
  await redisHelpers.del(cacheKey);
  logger.info(`🗑️  Invalidated accounts cache for user ${userId}`);
}

export async function invalidateAllUserCaches(userId) {
  await invalidateUserEventsCache(userId);
  await invalidateUserAccountsCache(userId);
  logger.info(`🗑️  Invalidated all caches for user ${userId}`);
}

export async function updateCachedEvent(userId, eventData, operation) {
  const cacheKey = getCacheKey.events(userId);
  const cached = await redisHelpers.getJSON(cacheKey);

  if (!cached) {
    logger.info(`⏭️  No cache to update for user ${userId}`);
    return;
  }

  let events = [...cached];

  switch (operation) {
    case 'created':
      events.push(eventData);
      events.sort((a, b) =>
        new Date(a.start.dateTime) - new Date(b.start.dateTime)
      );
      logger.info(`➕ Added event to cache for user ${userId}`);
      break;

    case 'updated':
      const updateIndex = events.findIndex(e =>
        e._id?.toString() === eventData._id?.toString() ||
        e.googleEventId === eventData.googleEventId ||
        e.outlookEventId === eventData.outlookEventId
      );

      if (updateIndex !== -1) {
        events[updateIndex] = eventData;
        logger.info(`✏️  Updated event in cache for user ${userId}`);
      } else {
        events.push(eventData);
        events.sort((a, b) =>
          new Date(a.start.dateTime) - new Date(b.start.dateTime)
        );
        logger.info(`➕ Added new event to cache for user ${userId}`);
      }
      break;

    case 'deleted':
      const beforeLength = events.length;
      events = events.filter(e =>
        e._id?.toString() !== eventData._id?.toString() &&
        e.googleEventId !== eventData.googleEventId &&
        e.outlookEventId !== eventData.outlookEventId
      );
      logger.info(`🗑️  Deleted event from cache for user ${userId} (${beforeLength} -> ${events.length})`);
      break;

    default:
      logger.info(`❓ Unknown operation ${operation}, invalidating cache`);
      await invalidateUserEventsCache(userId);
      return;
  }

  await redisHelpers.setJSON(cacheKey, events, EVENTS_CACHE_TTL);
}

export async function isSyncRunning(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const status = await redisHelpers.getJSON(key);

  if (!status) return false;
  return status.running === true;
}

export async function startSync(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const data = {
    running: true,
    lastSyncStart: Date.now(),
    lastSyncEnd: null,
  };
  await redisHelpers.setJSON(key, data);
  logger.info(`🔄 Started sync for user ${userId}, account ${accountId}`);
}

export async function endSync(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  const status = await redisHelpers.getJSON(key);
  const data = status || {};

  data.running = false;
  data.lastSyncEnd = Date.now();

  await redisHelpers.setJSON(key, data, SYNC_STATUS_TTL);
  logger.info(`✅ Ended sync for user ${userId}, account ${accountId}`);
}

export async function getSyncStatus(userId, accountId) {
  const key = getCacheKey.syncStatus(userId, accountId);
  return await redisHelpers.getJSON(key);
}

export async function shouldDebounceWebhook(calendarId) {
  const key = getCacheKey.debounce(calendarId);
  const exists = await redisHelpers.exists(key);

  if (exists) {
    logger.info(`⏸️  Debounced webhook for calendar ${calendarId}`);
    return true;
  }

  await redisHelpers.setWithTTL(key, '1', DEBOUNCE_TTL);
  return false;
}

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

  logger.info(`🔥 Warmed cache for user ${userId}`);
}

export async function invalidateMultipleUserCaches(userIds) {
  const promises = userIds.map(userId => invalidateAllUserCaches(userId));
  await Promise.all(promises);
  logger.info(`🗑️  Invalidated caches for ${userIds.length} users`);
}

export async function clearAllCalendarCaches() {
  const eventKeys = await redisHelpers.deletePattern('calendar:*:events');
  const accountKeys = await redisHelpers.deletePattern('user:*:calendarAccounts');
  logger.info(`🗑️  Cleared ${eventKeys + accountKeys} cache keys`);
  return { eventsCleared: eventKeys, accountsCleared: accountKeys };
}

export async function getCacheStats() {
  const stats = {
    timestamp: new Date().toISOString(),
  };

  return stats;
}