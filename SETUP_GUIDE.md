# Whispr — Setup Guide

Step-by-step guide to get Whispr running locally, configure it for your platform, and deploy to production.

---

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **MongoDB** — [Atlas free tier](https://www.mongodb.com/cloud/atlas) recommended
- **Redis** — [Upstash free tier](https://upstash.com/) recommended (or local Redis)
- **Telegram Bot Token** — from [@BotFather](https://t.me/botfather)
- **Gemini API Key** — from [Google AI Studio](https://aistudio.google.com/apikey)

---

## Step 1: Install Dependencies

```bash
git clone https://github.com/smurftyy/Whispr.git
cd Whispr
npm install
```

---

## Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
NODE_ENV=development
PORT=3000

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/whispr

# Redis — use rediss:// for TLS (Upstash), redis:// for local
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379

# Google Gemini AI
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token-here
```

### Getting Each Credential

#### MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster
3. Create a database user with read/write access
4. Whitelist your IP (or `0.0.0.0/0` for development)
5. Click "Connect" → "Connect your application" → copy the URI

#### Upstash Redis

1. Go to [Upstash](https://console.upstash.com/)
2. Create a Redis database (free tier works)
3. Copy the `rediss://` connection string from the dashboard

#### Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. **Important**: Send `/start` to your bot from your Telegram account

#### Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the key

---

## Step 3: Start the Application

### Development (with auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

You should see:

```
[INFO] 📦 MongoDB connected: cluster0-shard...
[INFO] 🔴 Redis connected
[INFO] 🚀 Telegram bot initialized and polling...
[INFO] ⏰ Periodic scheduler started (runs every hour)
[INFO] 🔔 Whispr running on port 3000
```

### Verify It Works

1. Open Telegram and find your bot
2. Send: `Remind me to buy groceries in 5 minutes`
3. You should receive a confirmation message
4. After ~5 minutes, you should receive the reminder

---

## Step 4: Health Check

The HTTP server exposes a health endpoint:

```bash
curl http://localhost:3000/health
# → {"status":"healthy","service":"whispr","timestamp":"..."}
```

---

## Replacing Telegram with Another Platform

Whispr is transport-agnostic. To switch to a different messaging platform:

### 1. Create an adapter

Create `src/adapters/myplatform.adapter.js`:

```javascript
const MessagingProvider = require("../interfaces/messaging.provider");

class MyPlatformAdapter extends MessagingProvider {
  constructor(token) {
    super();
    this.token = token;
    // Initialize your SDK client here
  }

  start() {
    // Connect to the platform
  }

  async send(to, message) {
    // Send message to user
    return { success: true };
  }

  onMessage(callback) {
    // Wire up incoming messages
    // callback(userId, messageText, messageId)
  }
}

module.exports = MyPlatformAdapter;
```

### 2. Update `server.js`

Replace the Telegram block with your adapter:

```javascript
// Before:
const TelegramAdapter = require('./src/adapters/telegram.adapter');
const telegram = new TelegramAdapter(env.TELEGRAM_BOT_TOKEN);
telegram.start();
telegram.onMessage(async (from, body, messageId) => { ... });
notifierService.registerAdapter('telegram', telegram);

// After:
const MyAdapter = require('./src/adapters/myplatform.adapter');
const myAdapter = new MyAdapter(env.MY_PLATFORM_TOKEN);
myAdapter.start();
myAdapter.onMessage(async (from, body, messageId) => {
  await webhookController.processMessage(from, body, messageId);
});
notifierService.registerAdapter('myplatform', myAdapter);
```

### 3. Update the User model default

In `src/models/User.js`, change the default platform:

```javascript
platform: {
  type: String,
  required: true,
  default: 'myplatform',
},
```

### 4. Done

No other files need changes. Controllers, services, and models are platform-agnostic.

---

## Deployment

### Option A: Railway (Recommended)

1. Push your code to GitHub
2. Go to [Railway](https://railway.app/) → New Project → Deploy from GitHub
3. Set environment variables in the Railway dashboard
4. Railway auto-detects `railway.json` and deploys

### Option B: Docker

```bash
# Build
docker build -t whispr .

# Run
docker run -d \
  --name whispr \
  --env-file .env \
  -p 3000:3000 \
  whispr
```

### Option C: VPS (Ubuntu/Debian)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and install
git clone https://github.com/smurftyy/Whispr.git
cd Whispr
npm ci --omit=dev

# Configure
cp .env.example .env
nano .env  # fill in your values

# Run with process manager
npm install -g pm2
pm2 start server.js --name whispr
pm2 save
pm2 startup
```

### Option D: Docker Compose (with local Redis)

Create `docker-compose.yml`:

```yaml
version: "3.8"
services:
  whispr:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```bash
docker-compose up -d
```

---

## Troubleshooting

| Issue                                    | Solution                                               |
| ---------------------------------------- | ------------------------------------------------------ |
| `Missing required environment variables` | Check `.env` file exists and has all required values   |
| `MongoDB connection error`               | Verify `MONGODB_URI`, check IP whitelist in Atlas      |
| `Redis error: ECONNREFUSED`              | Verify `REDIS_URL`, ensure Redis is running            |
| `Telegram polling error: 401`            | Bot token is invalid — regenerate via BotFather        |
| `Gemini 404 error`                       | Try changing `GEMINI_MODEL` to `gemini-2.0-flash-lite` |
| `Gemini quota exceeded`                  | Wait 60 seconds or upgrade your API plan               |
| Bot doesn't respond                      | Make sure you sent `/start` to the bot first           |
