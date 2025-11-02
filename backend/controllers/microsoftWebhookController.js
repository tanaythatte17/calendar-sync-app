import calendarAccount from "../models/calendarAccountModel.js";
import { refreshCalendarAccessToken } from "../utils/refreshToken.js";
import { updateMicrosoftCalendarList, performMicrosoftIncrementalSync, performMicrosoftFullSync } from "../services/microsoftService.js";
import sseService from "../services/sseService.js";

export const microsoftEventsWebhookHandler = async (req, res) => {
    if (req.query.validationToken) {
        console.log('🔐 Responding to Microsoft validation challenge');
        return res.status(200).send(req.query.validationToken);
    }

    try {
        const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
        console.log('📬 Received calendar event notification:', notifications);

        // Acknowledge quickly
        res.sendStatus(202);

        // Process in background
        setImmediate(async () => {
            for (const note of notifications) {
                const subscriptionId = note.subscriptionId;
                if (!subscriptionId) continue;

                // Find the account that owns this subscription
                const account = await calendarAccount.findOne({
                    'webhookChannels.events.channelId': subscriptionId,
                    provider: 'microsoft'
                });

                if (!account) {
                    console.warn(`No Microsoft account found for subscription ${subscriptionId}`);
                    continue;
                }

                // Find the calendar entry associated with this subscription
                const eventSub = (account.webhookChannels?.events || []).find(e => e.channelId === subscriptionId);
                if (!eventSub) {
                    console.warn(`No event subscription entry found on account ${account._id} for subscription ${subscriptionId}`);
                    continue;
                }

                const calendarId = eventSub.calendarId;
                const calendarEntry = (account.calendarList || []).find(c => c.calendarId === calendarId);
                const deltaLink = calendarEntry?.deltaLink || null;

                // Ensure fresh access token
                if (account.expiresAt && account.expiresAt < new Date()) {
                    const tokens = await refreshCalendarAccessToken(
                        account._id,
                        account.refreshToken,
                        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                        process.env.MICROSOFT_CLIENT_ID,
                        process.env.MICROSOFT_CLIENT_SECRET
                    );
                    account.accessToken = tokens.accessToken;
                    await account.save();
                }

                const headers = {
                    Authorization: `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                };

                // Define time range (2 years past/future) like in sync
                const now = new Date();
                const startDate = new Date(now);
                startDate.setFullYear(startDate.getFullYear() - 2);
                const endDate = new Date(now);
                endDate.setFullYear(endDate.getFullYear() + 2);
                const startTime = startDate.toISOString();
                const endTime = endDate.toISOString();

                const persistDelta = async (newDeltaLink) => {
                    if (!newDeltaLink) return;
                    await calendarAccount.updateOne(
                        { _id: account._id, 'calendarList.calendarId': calendarId },
                        { $set: { 'calendarList.$.deltaLink': newDeltaLink } }
                    );
                };

                try {
                    let eventsProcessed = 0;
                    const userId = account.userId.toString();
                    if (deltaLink) {
                        const { eventsProcessed: incrementalEvents, newDeltaLink } = await performMicrosoftIncrementalSync(
                            calendarId,
                            deltaLink,
                            headers,
                            account._id,
                            startTime,
                            endTime,
                            userId
                        );
                        eventsProcessed = incrementalEvents;
                        await persistDelta(newDeltaLink);
                    } else {
                        // If no deltaLink yet, perform a full sync to initialize it
                        const { eventsProcessed: fullEvents, newDeltaLink } = await performMicrosoftFullSync(
                            calendarId,
                            headers,
                            account._id,
                            startTime,
                            endTime
                        );
                        eventsProcessed = fullEvents;
                        await persistDelta(newDeltaLink);
                    }
                    
                    // Send SSE update to user
                    sseService.sendSyncStatus(
                        account.userId.toString(),
                        'completed',
                        `Synced ${eventsProcessed} events from Microsoft Calendar`,
                        { calendarId, eventsProcessed, provider: 'microsoft' }
                    );
                } catch (err) {
                    // If the deltaLink is expired (HTTP 410), fallback to full
                    if (err?.response?.status === 410) {
                        try {
                            const { newDeltaLink } = await performMicrosoftFullSync(
                                calendarId,
                                headers,
                                account._id,
                                startTime,
                                endTime
                            );
                            await persistDelta(newDeltaLink);
                        } catch (fallbackErr) {
                            console.error('Microsoft webhook full sync fallback failed:', fallbackErr.message);
                        }
                    } else {
                        console.error('Microsoft webhook incremental sync failed:', err.message);
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error handling Microsoft event webhook:', err.message);
        // In case something fails before ack
        if (!res.headersSent) res.sendStatus(500);
    }
}

export const microsoftCalendarListWebhookHandler = async (req, res) => {
    if (req.query.validationToken) {
        console.log('🔐 Responding to Microsoft validation challenge');
        return res.status(200).send(req.query.validationToken);
    }

    try {
        const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
        console.log('📬 Received calendar list notification:', notifications);

        // Acknowledge quickly
        res.sendStatus(202);

        setImmediate(async () => {
            for (const note of notifications) {
                const subscriptionId = note.subscriptionId;
                if (!subscriptionId) continue;

                // Find the account by calendar-list subscriptionId
                const account = await calendarAccount.findOne({
                    'webhookChannels.calendarList.channelId': subscriptionId,
                    provider: 'microsoft'
                });

                if (!account) {
                    console.warn(`No Microsoft account found for calendar-list subscription ${subscriptionId}`);
                    continue;
                }

                // Ensure fresh access token
                if (account.expiresAt && account.expiresAt < new Date()) {
                    const tokens = await refreshCalendarAccessToken(
                        account._id,
                        account.refreshToken,
                        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                        process.env.MICROSOFT_CLIENT_ID,
                        process.env.MICROSOFT_CLIENT_SECRET
                    );
                    account.accessToken = tokens.accessToken;
                    await account.save();
                }

                const headers = {
                    Authorization: `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                };

                try {
                    await updateMicrosoftCalendarList(account, headers);
                    
                    // Send SSE update to user
                    sseService.sendCalendarListUpdate(
                        account.userId.toString(),
                        account.calendarList,
                        'updated'
                    );
                } catch (err) {
                    console.error('Failed to update Microsoft calendar list from webhook:', err.message);
                }
            }
        });
    } catch (err) {
        console.error('Error handling Microsoft calendar list webhook:', err.message);
        if (!res.headersSent) res.sendStatus(500);
    }
}