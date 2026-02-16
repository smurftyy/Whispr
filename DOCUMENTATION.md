# Whispr — Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Message Flow](#message-flow)
3. [Adapter Interface](#adapter-interface)
4. [AI Extraction Design](#ai-extraction-design)
5. [Scheduling Design](#scheduling-design)
6. [Urgency & Strategy Mapping](#urgency--strategy-mapping)
7. [Error Handling Philosophy](#error-handling-philosophy)
8. [Deployment Architecture](#deployment-architecture)

---

## Architecture Overview

Whispr follows a **layered architecture** with strict separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        Transport Layer                       │
│   Adapters (Telegram, Discord, etc.)                        │
│   Implements: MessagingProvider interface                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       Controller Layer                       │
│   WebhookController — routes messages through state machine  │
│   Owns: conversation flow, user state, command dispatch      │
│   Does NOT: call platform APIs or compute scheduling delays  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Service Layer                         │
│                                                              │
│   WhisprService    — AI extraction (Gemini + chrono-node)    │
│   SchedulerService — deterministic delay math + Bull queue   │
│   NotifierService  — platform-agnostic message routing       │
│                                                              │
│   Invariant: services never import adapters directly         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Infrastructure Layer                     │
│   MongoDB (persistence), Redis (job queue), Gemini API       │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Rules

1. **No transport leakage**: Core services never import `telegram.adapter.js` or any platform module directly. The `NotifierService` receives adapters at boot time via `registerAdapter()`.
2. **No AI in scheduling**: `SchedulerService` never calls Gemini. It receives structured data and performs deterministic math.
3. **No scheduling in AI**: `WhisprService` never computes delays or interacts with Bull. It only returns structured JSON.
4. **No raw `process.env`**: All environment access goes through `src/config/env.js`, which validates at startup.

---

## Message Flow

Complete path from user message to reminder notification:

```
User sends "Remind me to call Mom in 10 minutes"
    │
    ▼
[Telegram Adapter] — receives message via polling
    │
    ▼
[WebhookController.processMessage()]
    │  1. Find or create User document
    │  2. Check for slash commands (/help, /list, /delete, /cancel)
    │  3. Route to state handler (IDLE for new messages)
    │
    ▼
[WebhookController._handleIdle()]
    │  1. Send "⏳ Analyzing..." to user
    │  2. Call WhisprService.extractReminder()
    │
    ▼
[WhisprService.extractReminder()]
    │  1. Build Gemini prompt with current time context
    │  2. Send to Gemini 2.0 Flash
    │  3. Parse strict JSON response
    │  4. If eventTime is null, try chrono-node fallback
    │  5. Return: { task, eventTime, recurrence, urgency, suggestedNotificationStrategy }
    │
    ▼
[WebhookController._handleIdle()] — continued
    │  1. Map strategy to timing: "immediate_only" → [0], "1_hour_before" → [60]
    │  2. Create Reminder document (status: 'active')
    │  3. Call SchedulerService.scheduleReminder()
    │
    ▼
[SchedulerService.scheduleReminder()]
    │  1. Read reminder.notificationTiming (in minutes)
    │  2. For each timing: notifyAt = deadline - (minutes × 60000)
    │  3. delay = notifyAt - Date.now()
    │  4. Add Bull job with computed delay
    │  5. Save scheduledReminders array to document
    │
    ▼
[Bull Queue] — job sits in Redis with precise delay
    │
    ▼  (after delay elapses)
    │
[SchedulerService worker (reminderQueue.process)]
    │  1. Load Reminder + User from MongoDB
    │  2. Check status (skip if cancelled)
    │  3. Call NotifierService.sendReminder()
    │  4. Mark scheduledReminder slot as sent
    │
    ▼
[NotifierService.sendReminder()]
    │  1. Format reminder message
    │  2. Look up adapter for user.platform
    │  3. Delegate to adapter.send()
    │
    ▼
[TelegramAdapter.send()] — delivers message to user
```

---

## Adapter Interface

All adapters extend `src/interfaces/messaging.provider.js`:

```javascript
class MessagingProvider {
  async send(to, message) {
    /* returns {success, error?} */
  }
  onMessage(callback) {
    /* callback(from, body, messageId) */
  }
}
```

### Implementing a new adapter

1. **Create the file**: `src/adapters/<platform>.adapter.js`
2. **Extend** `MessagingProvider`
3. **Implement** `send()` and `onMessage()`
4. **Register in `server.js`**:

```javascript
const MyAdapter = require("./src/adapters/my.adapter");
const adapter = new MyAdapter(env.MY_TOKEN);
adapter.start();
adapter.onMessage(async (from, body, id) => {
  await webhookController.processMessage(from, body, id);
});
notifierService.registerAdapter("myplatform", adapter);
```

5. **Done.** No changes needed in controllers, services, or models.

---

## AI Extraction Design

### Prompt Engineering

The Gemini prompt is designed for **strict JSON output** with zero commentary:

- **Current time injection**: The exact server time is included in every prompt so relative phrases ("in 5 minutes", "tomorrow") resolve correctly.
- **Rule-based inference**: The prompt encodes urgency and strategy rules directly, so the AI applies consistent logic.
- **No hallucinated times**: If the AI can't determine a time, it must return `null`.

### Dual-Layer Extraction

```
User message
    │
    ▼
[Gemini AI] ──── success ────▶ Structured JSON
    │                              │
    failure or                     │ eventTime is null?
    null eventTime                 │
    │                              ▼
    ▼                        [chrono-node fallback]
[chrono-node fallback]             │
    │                              ▼
    ▼                        Adjusted urgency + strategy
Fallback JSON
```

### Output Schema

```json
{
  "task": "Submit assignment",
  "eventTime": "2026-02-16T17:00:00.000Z",
  "recurrence": "none",
  "urgency": "medium",
  "suggestedNotificationStrategy": "1_hour_before"
}
```

---

## Scheduling Design

### Deterministic Timing

The scheduler never trusts AI-computed delays. It receives a strategy label and maps it to concrete minutes:

| Strategy            | Minutes Before Deadline |
| ------------------- | ----------------------- |
| `immediate_only`    | 0                       |
| `30_minutes_before` | 30                      |
| `1_hour_before`     | 60                      |
| `1_day_before`      | 1440                    |

The delay is computed as:

```
notifyAt = deadline - (minutes × 60 × 1000)
delay    = notifyAt - Date.now()
```

### Rehydration (Restart Resilience)

When the server boots:

1. **Immediate check**: If MongoDB is already connected, scan for pending reminders and re-queue them.
2. **Deferred check**: If MongoDB is still connecting, listen for the `connected` event, then scan.
3. **Periodic sweep**: Every hour, check for any "orphaned" reminders with no scheduled jobs.

This ensures **zero job loss** across server restarts, deploys, or crashes.

### Near-Immediate Reminders

If `notificationTiming` is `[0]` (from `immediate_only` strategy) and the deadline is within 60 seconds of now, the job is queued with `delay: 0` — it fires immediately.

---

## Urgency & Strategy Mapping

The AI infers urgency and strategy based on temporal proximity:

| Time Until Deadline          | Urgency  | Strategy                               |
| ---------------------------- | -------- | -------------------------------------- |
| < 30 minutes                 | `high`   | `immediate_only`                       |
| 30 min – 24 hours (same day) | `medium` | `30_minutes_before` or `1_hour_before` |
| > 24 hours                   | `low`    | `1_day_before`                         |

User overrides are respected — if a user says "remind me 2 hours before", the AI selects the closest matching strategy.

---

## Error Handling Philosophy

1. **Fail fast at startup**: Missing environment variables cause immediate `process.exit(1)` with a clear message.
2. **Graceful degradation at runtime**: If Gemini is unavailable, `chrono-node` provides a local fallback. If even that fails, the user gets a clear error message.
3. **Retry for transient failures**: Bull jobs use exponential backoff (3 attempts, starting at 2 seconds).
4. **No silent failures**: Every error is logged with context (reminder ID, user ID, platform).
5. **State recovery**: If a user's conversation state becomes invalid, it resets to `IDLE`.

---

## Deployment Architecture

### Single Process (recommended for small scale)

```
┌────────────────────────────────────────┐
│              Node.js Process            │
│                                        │
│  HTTP Server (Express, port 3000)      │
│  Telegram Polling (long-poll)          │
│  Bull Worker (processes reminder jobs) │
│                                        │
│  Connects to:                          │
│    → MongoDB Atlas (persistence)       │
│    → Upstash Redis (job queue)         │
└────────────────────────────────────────┘
```

### Separate Worker (recommended for production scale)

To scale the job processing independently, extract the Bull worker into a separate process. The current architecture supports this by splitting `server.js` into two entry points:

- `server.js` — HTTP + Telegram polling (no queue processing)
- `worker.js` — Bull queue processing only

This separation is straightforward because all queue setup is isolated in `SchedulerService`.

### Railway Deployment

The included `railway.json` and `nixpacks.toml` enable one-click deployment:

- Set environment variables in Railway dashboard
- Connect your GitHub repo
- Railway auto-detects Node.js and runs `npm start`

### Docker Deployment

```bash
docker build -t whispr .
docker run -d \
  -e MONGODB_URI=... \
  -e REDIS_URL=... \
  -e GEMINI_API_KEY=... \
  -e TELEGRAM_BOT_TOKEN=... \
  -p 3000:3000 \
  whispr
```
