// controllers/microsoftWebhookController.js
import calendarAccount from "../models/calendarAccountModel.js";
import { microsoftWebhookQueue, microsoftCalendarListQueue } from "../services/queueService.js";
import logger from "../utils/logger.js";

export const microsoftEventsWebhookHandler = async (req, res) => {
    logger.info('🔔 Microsoft Events Webhook received a request');
    // Handle validation challenge
    if (req.query.validationToken) {
        logger.info('🔐 Responding to Microsoft validation challenge');
        return res.status(200).send(req.query.validationToken);
    }

    try {
        const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
        logger.info('📬 Received calendar event notification:', notifications);

        // Validate notifications
        if (notifications.length === 0) {
            return res.sendStatus(202);
        }

        // Process each notification
        for (const note of notifications) {
            const subscriptionId = note.subscriptionId;
            if (!subscriptionId) continue;

            // Find the account that owns this subscription
            const account = await calendarAccount.findOne({
                'webhookChannels.events.channelId': subscriptionId,
                provider: 'microsoft'
            });

            if (!account) {
                logger.warn(`No Microsoft account found for subscription ${subscriptionId}`);
                continue;
            }

            // Find the calendar entry associated with this subscription
            const eventSub = (account.webhookChannels?.events || []).find(e => e.channelId === subscriptionId);
            if (!eventSub) {
                logger.warn(`No event subscription entry found on account ${account._id} for subscription ${subscriptionId}`);
                continue;
            }

            const calendarId = eventSub.calendarId;

            // Add job to queue
            await microsoftWebhookQueue.add(
                'sync-microsoft-events',
                {
                    accountId: account._id.toString(),
                    calendarId,
                    subscriptionId,
                    receivedAt: new Date().toISOString(),
                },
                {
                    jobId: `microsoft-${account._id}-${calendarId}-${Date.now()}`,
                    removeOnComplete: true,
                }
            );

            logger.info(`✅ Job queued for Microsoft calendar: ${calendarId}`);
        }

        // Acknowledge immediately
        return res.sendStatus(202);

    } catch (err) {
        logger.error('Error handling Microsoft event webhook:', err.message);
        return res.sendStatus(500);
    }
};

export const microsoftCalendarListWebhookHandler = async (req, res) => {
    // Handle validation challenge
    if (req.query.validationToken) {
        logger.info('🔐 Responding to Microsoft validation challenge');
        return res.status(200).send(req.query.validationToken);
    }

    try {
        const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
        logger.info('📬 Received calendar list notification:', notifications);

        // Validate notifications
        if (notifications.length === 0) {
            return res.sendStatus(202);
        }

        // Process each notification
        for (const note of notifications) {
            const subscriptionId = note.subscriptionId;
            if (!subscriptionId) continue;

            // Find the account by calendar-list subscriptionId
            const account = await calendarAccount.findOne({
                'webhookChannels.calendarList.channelId': subscriptionId,
                provider: 'microsoft'
            });

            if (!account) {
                logger.warn(`No Microsoft account found for calendar-list subscription ${subscriptionId}`);
                continue;
            }

            // Add job to queue
            await microsoftCalendarListQueue.add(
                'sync-microsoft-calendar-list',
                {
                    accountId: account._id.toString(),
                    subscriptionId,
                    receivedAt: new Date().toISOString(),
                },
                {
                    jobId: `microsoft-list-${account._id}-${Date.now()}`,
                    removeOnComplete: true,
                }
            );

            logger.info(`✅ Calendar list job queued for Microsoft account: ${account._id}`);
        }

        // Acknowledge immediately
        return res.sendStatus(202);

    } catch (err) {
        logger.error('Error handling Microsoft calendar list webhook:', err.message);
        return res.sendStatus(500);
    }
};