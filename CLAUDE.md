# Whispr — Agent Context

## Architecture
Telegram message → webhook.controller.js → api.controller.js
→ ai.service.js (chrono extraction) → reminder.service.js
→ Bull job → fires notification via telegram.adapter.js

## Critical Files
- src/services/ai.service.js — extraction + suggestedNotificationStrategy
- src/services/reminder.service.js — fireAt computation, Bull job delay
- src/controllers/api.controller.js — passes req.user to extractReminder
- src/constants.js — NOTIFICATION_STRATEGIES values
- src/schemas/ai.schema.js — Zod validation on extraction output

## Known Issues Log
- suggestedNotificationStrategy was hardcoded '1_hour_before' → fixed dynamically
- extractReminder wasn't receiving req.user → fixed in api.controller.js:30
- Trailing 'in' surviving chrono cleanup → fixed with /\s+in\s*$/i strip

## Testing
Run the scheduling pipeline locally:
npm run test:scheduler
