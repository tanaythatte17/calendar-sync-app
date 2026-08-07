# Calendar Sync Backend

A Node.js backend that synchronizes calendars from Google Calendar and Microsoft Outlook, providing real-time event updates via Server-Sent Events (SSE).

## Features

- **Multi-Provider Integration**
  - Google Calendar OAuth 2.0 authentication
  - Microsoft Outlook Calendar OAuth 2.0 authentication
  - Multi-calendar support per provider

- **Incremental Synchronization**
  - Uses Google sync tokens for efficient updates
  - Uses Microsoft delta links for efficient updates
  - Full sync on initial connection
  - Automatic sync token persistence

- **Real-Time Updates**
  - Server-Sent Events (SSE) for live event changes
  - Google Push Notifications for immediate event updates
  - Microsoft Change Notifications for Outlook calendars
  - Automatic webhook renewal using Agenda scheduler

- **Background Job Processing**
  - BullMQ workers for async webhook event processing
  - Agenda for scheduled tasks (webhook renewal)
  - Redis for job queue storage and pub/sub

- **Database Persistence**
  - MongoDB with Mongoose ODM
  - User accounts with provider authentication
  - Calendar metadata and sync tokens
  - Event storage and change tracking

- **User Authentication**
  - JWT-based session management
  - Email/password local authentication
  - OAuth 2.0 social login (Google & Microsoft)

## Tech Stack

- **Runtime**: Node.js with ES Modules
- **Server**: Express.js 5.x
- **Database**: MongoDB (Mongoose ODM)
- **Job Queue**: BullMQ + Redis
- **Scheduler**: Agenda
- **Authentication**: JWT, bcrypt, OAuth 2.0
- **Calendar APIs**: Google Calendar API v3, Microsoft Graph API
- **Additional**: Axios for HTTP, Nodemailer for email

## Architecture Overview

```
┌─────────────────┐
│  Frontend (SSE) │
└────────┬────────┘
         │
         │ WebSocket/SSE
         │
┌────────▼──────────────┐
│   Express API Server   │
├───────────────────────┤
│ Routes:               │
│ - /auth               │
│ - /google, /microsoft │
│ - /webhook/*          │
│ - /sse                │
└────────┬──────────────┘
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───▼───────────────┐  ┌──────────▼────────┐
│  Google Calendar  │  │ Microsoft Outlook │
│   Push Webhooks   │  │ Change Webhooks   │
└───┬───────────────┘  └──────────┬────────┘
    │                             │
    └────────┬────────────────────┘
             │
        ┌────▼──────────────┐
        │   BullMQ Workers  │
        │  (Job Processing) │
        └────┬──────────────┘
             │
    ┌────────┴──────────┐
    │                   │
┌───▼──────┐   ┌───────▼──────┐
│  Redis   │   │   Agenda     │
│  (Queue) │   │  (Scheduler) │
└──────────┘   └──────────────┘
    │                   │
    └────────┬──────────┘
             │
        ┌────▼──────────┐
        │   MongoDB     │
        │ (Persistence) │
        └───────────────┘
```

## Authentication Flow

### Local Authentication
```
POST /api/auth/signup
POST /api/auth/login
→ Creates JWT token in httpOnly cookie
```

### Google OAuth Flow
```
1. GET /api/auth/google/url
   → Returns Google OAuth authorization URL

2. User authenticates at Google
   → Redirects to /api/google/auth/callback?code=XXXX

3. Backend exchanges code for tokens
   → Stores in CalendarAccount
   → Sets JWT cookie
   → Redirects to frontend success page
```

### Microsoft OAuth Flow
```
1. GET /api/auth/microsoft/url
   → Returns Microsoft OAuth authorization URL

2. User authenticates at Microsoft
   → Redirects to /api/microsoft/auth/callback?code=XXXX

3. Backend exchanges code for tokens
   → Stores in CalendarAccount
   → Sets JWT cookie
   → Redirects to frontend success page
```

## Synchronization Flow

### Initial Full Sync

```
1. User calls: GET /api/google/sync/google?email=user@gmail.com

2. Backend:
   a. Fetches all calendars from Google Calendar API
   b. For each calendar:
      - Fetches all events with pagination
      - Handles recurring events (expands instances)
      - Upserts events into MongoDB
   c. Stores sync token for incremental updates
   d. Creates push notification subscriptions (3-day TTL)
   e. Schedules webhook renewal (2 hours before expiration)

3. Broadcasts initial calendar state via SSE
```

### Incremental Sync (Webhook-Triggered)

```
1. Google/Microsoft sends webhook:
   POST /api/webhook/google/events or /webhook/microsoft/events

2. Handler validates and queues BullMQ job

3. BullMQ Worker:
   a. Fetches only changed events since last syncToken/deltaLink
   b. Updates MongoDB with changes
   c. Sends SSE updates to client (added/updated/deleted)
   d. Persists new syncToken/deltaLink

4. Frontend receives real-time updates over SSE
```

### Webhook Renewal

```
1. Agenda scheduler triggers at (expiration - 2 hours)
   → For Google: renewGoogleNotification job
   → For Microsoft: renewMicrosoftNotification job

2. Renewal process:
   a. Stops old webhook channel (best-effort)
   b. Creates new webhook channel (3-day TTL for Google, 1-day for Microsoft)
   c. Updates stored channel metadata
   d. Schedules next renewal

3. Process repeats continuously during user session
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Express server port | `3000` |
| `NODE_ENV` | Environment mode | `development`, `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@host/db` |
| `JWT_SECRET` | Secret key for JWT signing | (generated key) |
| `JWT_EXPIRES_IN` | JWT expiration in seconds | `604800` (7 days) |
| `GOOGLE_CLIENT_ID` | Google OAuth app ID | (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret | (from Google Cloud Console) |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL for Google | `http://localhost:3000/api/google/auth/callback` |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth app ID | (from Azure Portal) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth app secret | (from Azure Portal) |
| `MICROSOFT_REDIRECT_URI` | OAuth callback URL for Microsoft | `http://localhost:3000/api/microsoft/auth/callback` |
| `WEBHOOK_BASE_URL` | Public URL for webhook callbacks | `https://your-domain.com/api` |
| `FRONTEND_URL` | Frontend URL for redirects and CORS | `http://localhost:5173` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis authentication password | (optional) |
| `EMAIL_USER` | Email account for sending OTP | (email address) |
| `EMAIL_PASSWORD` | Email app password | (for Nodemailer) |

## Running Locally

### Prerequisites
- Node.js 18+
- MongoDB (local or cloud connection)
- Redis (local or cloud connection)
- Google OAuth app (from Google Cloud Console)
- Microsoft OAuth app (from Azure Portal)

### Setup

```bash
# Move into the backend directory
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start MongoDB and Redis
# (Ensure they're running on localhost:27017 and localhost:6379)

# Start development server
npm run dev

# Start production server
npm start
```

### Verify Server is Running
```bash
curl http://localhost:3000/api/auth/me
# Should return 401 (no auth token)
```

## Project Structure

```
backend/
├── controllers/        # HTTP request handlers
│   ├── authController.js
│   ├── googleController.js
│   ├── microsoftController.js
│   ├── googleWebhookController.js
│   ├── microsoftWebhookController.js
│   ├── sseController.js
│   └── ...
├── services/          # Business logic and API integration
│   ├── authService.js
│   ├── googleService.js        # Google sync & webhook logic
│   ├── microsoftService.js     # Microsoft sync & webhook logic
│   ├── sseService.js           # SSE broadcast management
│   ├── queueService.js         # BullMQ setup
│   └── rateLimitingService.js
├── models/            # MongoDB schemas
│   ├── userModel.js
│   ├── calendarAccountModel.js
│   └── eventModel.js
├── routes/            # Express route definitions
│   ├── authRoutes.js
│   ├── googleRoutes.js
│   ├── microsoftRoutes.js
│   ├── googleWebhookRoutes.js
│   ├── microsoftWebhookRoutes.js
│   ├── sseRoutes.js
│   └── ...
├── workers/           # BullMQ worker processes
│   ├── googleWebhookWorker.js
│   └── microsoftWebhookWorker.js
├── middleware/        # Express middleware
│   ├── protectRoute.js          # JWT verification
│   ├── OAuthMiddleware.js
│   └── ...
├── utils/             # Helper functions
│   ├── generateToken.js
│   ├── refreshToken.js
│   ├── sendMail.js
│   ├── agendaUtils.js           # Scheduler jobs
│   └── ...
├── config/            # Configuration
│   └── redis.js                 # Redis client setup
├── db/
│   └── connectDB.js
└── server.js          # Main entry point
```

## API Routes

### Authentication
- `POST /api/auth/signup` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get authenticated user
- `GET /api/auth/google/url` - Get Google OAuth URL
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/microsoft/url` - Get Microsoft OAuth URL
- `GET /api/auth/microsoft/callback` - Microsoft OAuth callback

### Google Calendar
- `GET /api/google/auth` - Start Google account connection
- `GET /api/google/auth/callback` - Handle OAuth callback
- `GET /api/google/sync/google?email=...` - Trigger full sync

### Microsoft Calendar
- `GET /api/microsoft/auth` - Start Microsoft account connection
- `GET /api/microsoft/auth/callback` - Handle OAuth callback
- `GET /api/microsoft/sync/microsoft?email=...` - Trigger full sync

### Webhooks
- `POST /api/webhook/google/events` - Google calendar events changed
- `POST /api/webhook/google/list` - Google calendar list changed
- `POST /api/webhook/microsoft/events` - Microsoft events changed
- `POST /api/webhook/microsoft/list` - Microsoft calendar list changed

### Real-Time Updates
- `GET /api/sse/connect` - Establish SSE connection
- `GET /api/sse/status` - Check connection status

### Calendar Management
- `GET /api/calendar` - List user's calendar accounts
- `GET /api/calendarAccount` - Get calendar account details
- `DELETE /api/calendarAccount/:id` - Disconnect calendar account

## Key Implementation Details

### Sync Tokens & Delta Links

**Google Calendar**: Uses `nextSyncToken` to fetch only changes since last sync
- Sync token is stored per calendar
- If sync token expires/invalidates, full sync is triggered
- Allows efficient incremental updates

**Microsoft Outlook**: Uses `nextDeltaLink` with similar concept
- Delta link is stored per calendar
- Implements delta query pattern from Microsoft Graph API
- Fallback to full sync on delta link expiration

### Webhook Verification

**Google**: Validates token in `x-goog-channel-token` header (base64-encoded JSON)
- Token contains: `{ calendarId, accountId }`
- Allows matching webhook to calendar without database lookup

**Microsoft**: Validates subscription ID against stored subscriptions
- Looks up account by channel ID in database
- Supports multiple concurrent subscriptions

### Concurrency & Job Processing

- **BullMQ Workers**: Process 5 concurrent webhook jobs
- **Graceful Shutdown**: Waits for workers to close before exiting
- **Job Deduplication**: Uses `jobId` to prevent duplicate processing
- **Auto-cleanup**: Removes completed jobs from queue

### SSE Broadcasting

- **Client Tracking**: Map of userId → Set of connections
- **Selective Delivery**: Events sent only to authenticated user
- **Automatic Cleanup**: Dead connections removed on write errors
- **Message Types**:
  - `event` - Calendar event update (added/updated/deleted)
  - `calendarList` - Calendar added/removed/updated
  - `syncStatus` - Sync started/completed/error

### Token Refresh Strategy

- Tokens are refreshed on-demand before API calls
- Expiration time checked: `if (account.expiresAt < now) → refresh`
- Prevents mid-operation token expiration
- New tokens persisted to database for next session

## Monitoring & Debugging

### BullMQ Job Monitoring
```javascript
// Check job status in Redis
const jobs = await googleWebhookQueue.getWaiting();
const failedJobs = await googleWebhookQueue.getFailed();
```

### SSE Connection Status
```bash
GET /api/sse/status
# Returns: { userId, connected, totalClients, timestamp }
```

### Event Logs
- All sync operations log events with timestamps
- Webhook processing logs included in BullMQ job output
- Error logging to console with stack traces

## Notes on Limitations & Assumptions

1. **Webhook TTL Management**
   - Google webhooks expire in 3 days
   - Microsoft webhooks expire in 1 day
   - Renewal jobs must run continuously or subscriptions will lapse

2. **Sync Token Invalidation**
   - If sync token becomes invalid, automatic full sync is triggered
   - This can happen after ~30 days for Google or ~90 days for Microsoft

3. **Recurring Events**
   - Google recurring events are expanded to instances using time range
   - Current range: -2 to +2 years from today
   - Reduces memory usage vs storing master + all future instances

4. **Event Details Stored**
   - Full event object stored in `raw` field for debugging
   - Allows future feature additions without data loss

5. **Timezone Handling**
   - Event times stored in UTC (dateTime field)
   - Original timezone preserved in `timeZone` field
   - Frontend responsible for local timezone display

## Performance Considerations

- **Pagination**: All API calls use maxResults=2500 to minimize requests
- **Bulk Operations**: Events upserted in single bulk write operation
- **Sync Token Persistence**: Reduces resync window significantly
- **Incremental Updates**: Only changed events fetched via webhooks
- **Job Queuing**: Prevents sync operations from blocking HTTP responses

## Security Notes

- JWT tokens stored in httpOnly cookies (CSRF-safe)
- OAuth tokens encrypted in database (refresh tokens)
- Webhook tokens base64-encoded and base64-encoded for verification
- Rate limiting on sensitive endpoints (/auth, /webhook)
- CORS configured for frontend URL only

## Future Enhancements

- [ ] Batch event operations (drag-drop, multi-select delete)
- [ ] Event conflict detection
- [ ] Calendar sharing & guest list management
- [ ] Mobile notification support
- [ ] Offline sync queue
- [ ] Event search/filtering
- [ ] Timezone-aware recurrence rules
