import axios from "axios";
import qs from "querystring";
import dotenv from "dotenv";
import calendarAccount from "../models/calendarAccountModel.js";
import User from "../models/userModel.js";
import Event from "../models/eventModel.js";
import jwt from "jsonwebtoken";
import { refreshCalendarAccessToken } from "../utils/refreshToken.js";
import { scheduleMicrosoftRenewal } from '../utils/agendaUtils.js';

dotenv.config();

export function connect(userIdFromQuery, state, setCookie, redirect) {
  const userId = state ? null : (userIdFromQuery);
  if (!state) {
    setCookie("oauth_user_id", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: "/"
    });
  }
  const params = qs.stringify({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite',
    state: state || undefined
  });
  redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
}

export async function callback(query, cookies, clearCookie, redirect) {
  console.log('Inside microsoft callback');
  const { code, state } = query;
  let userId;
  if (state) {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    userId = decoded.userId || decoded.id;
  } else {
    userId = cookies.oauth_user_id;
    clearCookie("oauth_user_id");
  }
  console.log('User id is ', userId);
  if (!userId) {
    const err = new Error("Unauthorized - No user ID provided");
    err.statusCode = 401;
    throw err;
  }
  console.log('Before post request');
  let tokenRes;
  try{
      tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        scope: 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite',
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch(err){
    console.error('Error fetching tokens', err.response?.data || err.message);
  }
  const tokens = tokenRes.data;
  const userRes = await axios.get('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const userEmail = userRes.data.mail || userRes.data.userPrincipalName;
  console.log('User email is ', userEmail);
  const existingAccount = await calendarAccount.findOne({ userId, email: userEmail, provider: 'microsoft' });
  if (existingAccount) {
    existingAccount.accessToken = tokens.access_token;
    existingAccount.refreshToken = tokens.refresh_token || existingAccount.refreshToken;
    existingAccount.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    existingAccount.deltaLink = null;
    await existingAccount.save();
    await User.findByIdAndUpdate(userId, { $addToSet: { calendarAccounts: existingAccount._id } }, { new: true });
  } else {
    const newCalendarAccount = new calendarAccount({
      userId,
      email: userEmail,
      provider: 'microsoft',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      deltaLink: null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });
    await newCalendarAccount.save();
    await User.findByIdAndUpdate(userId, { $push: { calendarAccounts: newCalendarAccount._id } }, { new: true });
  }
  redirect(`${process.env.FRONTEND_URL}/dashboard`);
}

export async function sync(userId, userEmail) {
  if (!userId || !userEmail) {
    const err = new Error("Missing userId or email in request.");
    err.statusCode = 400;
    throw err;
  }
  const account = await calendarAccount.findOne({ userId, provider: 'microsoft', email: userEmail });
  if (!account) {
    const err = new Error("No linked Microsoft account found.");
    err.statusCode = 400;
    throw err;
  }
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET
    );
    account.accessToken = tokens.accessToken;
  }
  const headers = { Authorization: `Bearer ${account.accessToken}` };
  await updateMicrosoftCalendarList(account, { ...headers, 'Content-Type': 'application/json' });

  const now = new Date();
  const startDate = new Date(now); startDate.setFullYear(startDate.getFullYear() - 2);
  const endDate = new Date(now); endDate.setFullYear(endDate.getFullYear() + 2);
  const startTime = startDate.toISOString();
  const endTime = endDate.toISOString();

  let totalEvents = 0;
  for (const calendarEntry of account.calendarList) {
    const calendarId = calendarEntry.calendarId;
    let deltaLink = calendarEntry.deltaLink;
    try {
      if (!deltaLink) {
        const { eventsProcessed, newDeltaLink } = await performMicrosoftFullSync(calendarId, headers, account._id, startTime, endTime);
        totalEvents += eventsProcessed;
        calendarEntry.deltaLink = newDeltaLink;
      } else {
        const { eventsProcessed, newDeltaLink } = await performMicrosoftIncrementalSync(calendarId, deltaLink, headers, account._id, startTime, endTime);
        totalEvents += eventsProcessed;
        calendarEntry.deltaLink = newDeltaLink;
      }
    } catch (err) {
      if (err.response?.status === 410) {
        const { eventsProcessed, newDeltaLink } = await performMicrosoftFullSync(calendarId, headers, account._id, startTime, endTime);
        totalEvents += eventsProcessed;
        calendarEntry.deltaLink = newDeltaLink;
      } else {
        throw err;
      }
    }
  }
  account.lastSyncedAt = new Date();
  await account.save();
  const notificationResult = await createMicrosoftNotifications(userId, userEmail);
  return {
    message: "Microsoft calendar initial sync and notifications setup complete",
    calendars: account.calendarList.length,
    totalEventsProcessed: totalEvents,
    notifications: {
      calendarListSubscription: notificationResult.calendarListSubscription,
      eventSubscriptions: notificationResult.eventSubscriptions
    }
  };
}

export async function createMicrosoftNotifications(userId, userEmail) {
  const account = await calendarAccount.findOne({ userId, provider: 'microsoft', email: userEmail });
  if (!account) {
    const err = new Error("No linked Microsoft account found");
    err.statusCode = 400;
    throw err;
  }
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(
      account._id,
      account.refreshToken,
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET
    );
    account.accessToken = tokens.accessToken;
  }
  const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  const expirationDateTime = new Date(); expirationDateTime.setDate(expirationDateTime.getDate() + 3);
  const expirationTime = expirationDateTime.getTime();
  const calendarListPayload = {
    changeType: 'updated,deleted',
    notificationUrl: `${process.env.WEBHOOK_BASE_URL}/webhook/microsoft/list`,
    resource: 'me/calendars',
    expirationDateTime: expirationDateTime.toISOString(),
    clientState: Buffer.from(JSON.stringify({ userId: userId.toString(), accountId: account._id.toString(), type: 'calendar-list' })).toString('base64').slice(0, 128)
  };
  const calendarListResponse = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', calendarListPayload, { headers });
  const calendarListSubscriptionId = calendarListResponse.data.id;
  await scheduleMicrosoftRenewal(expirationTime, account._id.toString(), "calendar-list", null, calendarListSubscriptionId);
  const eventSubscriptions = [];
  for (const calendarEntry of account.calendarList || []) {
    try {
      const eventPayload = {
        changeType: 'created,updated,deleted',
        notificationUrl: `${process.env.WEBHOOK_BASE_URL}/webhook/microsoft/events`,
        resource: `me/calendars/${calendarEntry.calendarId}/events`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: Buffer.from(JSON.stringify({ userId: userId.toString(), calendarId: calendarEntry.calendarId, accountId: account._id.toString() })).toString('base64').slice(0, 128)
      };
      const eventResponse = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', eventPayload, { headers });
      eventSubscriptions.push({ subscriptionId: eventResponse.data.id, calendarId: calendarEntry.calendarId, calendarName: calendarEntry.name, expiration: new Date(expirationTime) });
      await scheduleMicrosoftRenewal(expirationTime, account._id.toString(), "events", calendarEntry.calendarId, eventResponse.data.id);
    } catch (err) {
      // continue
    }
  }
  account.webhookChannels = {
    calendarList: { channelId: calendarListSubscriptionId, resourceId: 'me/calendars', expiration: new Date(expirationTime) },
    events: eventSubscriptions.map(e => ({ calendarId: e.calendarId, calendarName: e.calendarName, channelId: e.subscriptionId, resourceId: `me/calendars/${e.calendarId}/events`, expiration: e.expiration }))
  };
  account.webhookSetupAt = new Date();
  await account.save();
  return { calendarListSubscription: calendarListSubscriptionId, eventSubscriptions: eventSubscriptions.length };
}

export async function renewMicrosoftNotification(accountId, subscriptionType, calendarId, oldSubscriptionId) {
  const account = await calendarAccount.findById(accountId);
  if (!account) return;
  if (account.expiresAt && account.expiresAt < new Date()) {
    const tokens = await refreshCalendarAccessToken(account._id, account.refreshToken, 'https://login.microsoftonline.com/common/oauth2/v2.0/token', process.env.MICROSOFT_CLIENT_ID, process.env.MICROSOFT_CLIENT_SECRET);
    account.accessToken = tokens.accessToken;
  }
  const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  try { await axios.delete(`https://graph.microsoft.com/v1.0/subscriptions/${oldSubscriptionId}`, { headers }); } catch {}
  const expirationDateTime = new Date(); expirationDateTime.setDate(expirationDateTime.getDate() + 3);
  const expirationTime = expirationDateTime.getTime();
  let response;
  if (subscriptionType === "calendar-list") {
    const payload = { changeType: 'created,updated,deleted', notificationUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhook/microsoft/list`, resource: 'me/calendars', expirationDateTime: expirationDateTime.toISOString(), clientState: JSON.stringify({ accountId }) };
    response = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', payload, { headers });
  } else if (subscriptionType === "events") {
    const payload = { changeType: 'created,updated,deleted', notificationUrl: `${process.env.WEBHOOK_BASE_URL}/api/webhook/microsoft/events`, resource: `me/calendars/${calendarId}/events`, expirationDateTime: expirationDateTime.toISOString(), clientState: JSON.stringify({ accountId, calendarId }) };
    response = await axios.post('https://graph.microsoft.com/v1.0/subscriptions', payload, { headers });
  }
  await scheduleMicrosoftRenewal(expirationTime, accountId, subscriptionType, calendarId, response.data.id);
}

export async function updateMicrosoftCalendarList(account, headers) {
  const calendarsRes = await axios.get('https://graph.microsoft.com/v1.0/me/calendars', { headers });
  const calendars = calendarsRes.data.value || [];
  const previousCalendars = account.calendarList || [];
  const previousCalendarMap = new Map(previousCalendars.map(c => [c.calendarId, c]));
  const updatedCalendarList = calendars.map(cal => ({ calendarId: cal.id, name: cal.name, color: cal.color || null, deltaLink: previousCalendarMap.get(cal.id)?.deltaLink || null }));
  const currentCalendarIds = new Set(calendars.map(c => c.id));
  const previousCalendarIds = new Set(previousCalendars.map(c => c.calendarId));
  const removedCalendarIds = [...previousCalendarIds].filter(id => !currentCalendarIds.has(id));
  if (removedCalendarIds.length > 0) {
    await Event.deleteMany({ calendarAccountId: account._id, calendarId: { $in: removedCalendarIds }, source: 'microsoft' });
  }
  account.calendarList = updatedCalendarList;
  await account.save();
}

export async function performMicrosoftFullSync(calendarId, headers, accountId, startTime, endTime) {
  const expandedEvents = await fetchExpandedEvents(calendarId, startTime, endTime, headers);
  const existingEvents = await Event.find({ calendarAccountId: accountId, calendarId, source: 'microsoft' }).select('externalId');
  const existingEventIds = new Set(existingEvents.map(e => e.externalId));
  const newEventIds = new Set(expandedEvents.map(e => e.id));
  const eventsToDelete = [...existingEventIds].filter(id => !newEventIds.has(id));
  if (eventsToDelete.length > 0) {
    await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'microsoft', externalId: { $in: eventsToDelete } });
  }
  await processEvents(expandedEvents, accountId, calendarId);
  const eventsProcessed = expandedEvents.length;
  const deltaRes = await axios.get(`https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta`, { headers, params: { startDateTime: startTime, endDateTime: endTime, $select: 'id,subject,bodyPreview,location,organizer,attendees,type,seriesMasterId,isAllDay,showAs,webLink,start,end' } });
  const newDeltaLink = await getDeltaLink(deltaRes, headers);
  return { eventsProcessed, newDeltaLink };
}

export async function performMicrosoftIncrementalSync(calendarId, deltaLink, headers, accountId, startTime, endTime) {
  const { events: changedEvents, newDeltaLink } = await fetchDeltaEvents(deltaLink, headers);
  const modifiedSeries = new Set();
  for (const event of changedEvents) {
    if (event["@removed"]) {
      await handleEventDeletion(event, accountId, calendarId);
    } else {
      if (event.type === 'seriesMaster') {
        modifiedSeries.add(event.id);
        await handleRecurringEventUpdate(event, calendarId, startTime, endTime, headers, accountId);
      } else {
        await processEvents([event], accountId, calendarId);
      }
    }
  }
  await validateAllRecurringSeries(accountId, calendarId, startTime, endTime, headers, modifiedSeries);
  return { eventsProcessed: changedEvents.length, newDeltaLink };
}

async function fetchExpandedEvents(calendarId, startTime, endTime, headers) {
  let allEvents = [];
  let url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView?startDateTime=${startTime}&endDateTime=${endTime}`;
  while (url) {
    const response = await axios.get(url, { headers });
    if (response.data.value && Array.isArray(response.data.value)) {
      allEvents = allEvents.concat(response.data.value);
    }
    url = response.data['@odata.nextLink'] || null;
  }
  return allEvents;
}

async function fetchDeltaEvents(deltaLink, headers) {
  let allEvents = [];
  let url = deltaLink;
  let newDeltaLink = null;
  while (url) {
    const response = await axios.get(url, { headers });
    if (response.data.value && Array.isArray(response.data.value)) {
      allEvents = allEvents.concat(response.data.value);
    }
    if (response.data['@odata.nextLink']) {
      url = response.data['@odata.nextLink'];
    } else {
      url = null;
      newDeltaLink = response.data['@odata.deltaLink'];
    }
  }
  return { events: allEvents, newDeltaLink };
}

async function getDeltaLink(deltaRes, headers) {
  let url = deltaRes.data['@odata.nextLink'];
  let deltaLink = deltaRes.data['@odata.deltaLink'];
  while (url && !deltaLink) {
    const response = await axios.get(url, { headers });
    url = response.data['@odata.nextLink'];
    deltaLink = response.data['@odata.deltaLink'];
  }
  return deltaLink;
}

export async function handleRecurringEventUpdate(seriesMaster, calendarId, startTime, endTime, headers, accountId) {
  try {
    const existingInstances = await Event.find({ calendarAccountId: accountId, calendarId, source: 'microsoft', $or: [{ externalId: seriesMaster.id }, { recurringEventId: seriesMaster.id }] });
    const instancesUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${seriesMaster.id}/instances?startDateTime=${startTime}&endDateTime=${endTime}`;
    let url = instancesUrl;
    let freshInstances = [];
    while (url) {
      const response = await axios.get(url, { headers });
      if (response.data.value && Array.isArray(response.data.value)) {
        freshInstances = freshInstances.concat(response.data.value);
      }
      url = response.data['@odata.nextLink'] || null;
    }
    const existingIds = new Set(existingInstances.map(e => e.externalId));
    const freshIds = new Set(freshInstances.map(e => e.id));
    const instancesToDelete = [...existingIds].filter(id => !freshIds.has(id));
    if (instancesToDelete.length > 0) {
      await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'microsoft', externalId: { $in: instancesToDelete } });
    }
    await processEvents(freshInstances, accountId, calendarId);
  } catch (err) {}
}

export async function validateAllRecurringSeries(accountId, calendarId, startTime, endTime, headers, modifiedSeries = new Set()) {
  try {
    const recurringSeries = await Event.find({ calendarAccountId: accountId, calendarId, source: 'microsoft', isRecurring: true }).distinct('externalId');
    for (const seriesId of recurringSeries) {
      if (modifiedSeries.has(seriesId)) continue;
      try {
        const dbInstances = await Event.find({ calendarAccountId: accountId, calendarId, source: 'microsoft', $or: [{ externalId: seriesId }, { recurringEventId: seriesId }] });
        const instancesUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events/${seriesId}/instances?startDateTime=${startTime}&endDateTime=${endTime}`;
        let url = instancesUrl;
        let freshInstances = [];
        while (url) {
          const response = await axios.get(url, { headers });
          if (response.data.value && Array.isArray(response.data.value)) {
            freshInstances = freshInstances.concat(response.data.value);
          }
          url = response.data['@odata.nextLink'] || null;
        }
        const dbIds = new Set(dbInstances.map(e => e.externalId));
        const freshIds = new Set(freshInstances.map(e => e.id));
        const deletedIds = [...dbIds].filter(id => !freshIds.has(id));
        if (deletedIds.length > 0) {
          await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'microsoft', externalId: { $in: deletedIds } });
        }
        await processEvents(freshInstances, accountId, calendarId);
      } catch (err) {
        if (err.response?.status === 404) {
          await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'microsoft', $or: [{ externalId: seriesId }, { recurringEventId: seriesId }] });
        }
      }
    }
  } catch {}
}

export async function handleEventDeletion(removedEvent, accountId, calendarId) {
  const eventId = removedEvent.id;
  const existingEvent = await Event.findOne({ calendarAccountId: accountId, calendarId, source: 'microsoft', externalId: eventId });
  const hasInstances = await Event.findOne({ calendarAccountId: accountId, calendarId, source: 'microsoft', recurringEventId: eventId });
  if (existingEvent?.isRecurring || hasInstances) {
    await Event.deleteMany({ calendarAccountId: accountId, calendarId, source: 'microsoft', $or: [{ externalId: eventId }, { recurringEventId: eventId }] });
  } else {
    await Event.deleteOne({ calendarAccountId: accountId, calendarId, source: 'microsoft', externalId: eventId });
  }
}

export async function processEvents(events, accountId, calendarId) {
  for (const event of events) {
    await Event.findOneAndUpdate(
      { calendarAccountId: accountId, externalId: event.id, calendarId, source: 'microsoft' },
      {
        calendarAccountId: accountId,
        calendarId,
        source: 'microsoft',
        externalId: event.id,
        title: event.subject,
        description: event.bodyPreview,
        location: event.location?.displayName,
        start: { dateTime: new Date(event.start?.dateTime + "Z"), timeZone: event.start?.timeZone || 'UTC' },
        end: { dateTime: new Date(event.end?.dateTime + "Z"), timeZone: event.end?.timeZone || 'UTC' },
        isAllDay: Boolean(event.isAllDay),
        organizer: { email: event.organizer?.emailAddress?.address, name: event.organizer?.emailAddress?.name },
        attendees: event.attendees?.map(a => ({ email: a.emailAddress?.address, name: a.emailAddress?.name, responseStatus: a.status?.response })),
        isRecurring: event.type === 'seriesMaster',
        recurringEventId: event.seriesMasterId,
        status: event.isCancelled ? 'cancelled' : (event.showAs === 'tentative' ? 'tentative' : 'confirmed'),
        htmlLink: event.webLink,
        raw: event,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
  }
}


