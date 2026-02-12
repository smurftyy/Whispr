# Whispr

Whispr is a prompt-based conversational reminder engine that converts natural language into structured, scheduled reminders.

Instead of manually configuring reminders in forms, users submit a single prompt:

> “Submit assignment Friday 5pm, remind me 2 days before and 1 hour before.”

Whispr extracts deadlines, recurrence rules, and alert offsets, requests confirmation, and schedules delivery automatically.

---

## ✨ Core Philosophy

Most reminder systems optimize UI.

Whispr optimizes input friction.

The goal is to allow users to create reliable reminders using natural language, with intelligent clarification and structured scheduling behind the scenes.

---

## 🧠 Architecture Overview

Whispr follows a modular architecture:

### 1. Core Engine (Transport-Agnostic)

Responsible for:

- Natural language parsing
- Deadline extraction
- Recurrence handling
- Clarification flow management
- Reminder structuring
- Priority ranking
- State tracking

The core contains no platform-specific logic.

---

### 2. Transport Layer (Adapter-Based)

Current transport:

- Telegram Bot API

Future transports (planned but not implemented):

- Web Chat
- CLI
- WhatsApp
- Email

Transport adapters are responsible for:

- Receiving user messages
- Sending confirmations
- Delivering scheduled reminders

---

### 3. Scheduler / Queue Worker

Handles:

- Persistent reminder storage
- Trigger evaluation
- Offset calculation
- Delivery execution
- Recovery after server restart

Reminders must fire even if the server restarts.

---

## 📦 Reminder Object (v1)

```ts
Reminder {
  id: string
  userId: string
  task: string
  deadline: Date
  recurrence: RecurrenceRule | null
  offsets: Offset[]
  priority: "low" | "medium" | "high"
  status: "pending" | "confirmed" | "completed" | "missed"
  confidenceScore: number
  createdAt: Date
}
```

---

## 🔐 Confirmation Policy

All reminders require explicit confirmation before scheduling.

No autonomous reminder creation is allowed.

---

## 🎯 Target Users

- Students with deadlines
- Remote workers
- Knowledge workers
- Builders managing deliverables

---

## 🚀 Roadmap

Phase 1:

- Refactor existing core into pure engine module
- Replace WhatsApp transport with Telegram adapter
- Add persistent database
- Add queue-based scheduler
- Implement confirmation state machine

Phase 2:

- Learning from corrections
- Priority optimization
- Web chat interface

---

## 🛠 Development Philosophy

- Core logic is transport-agnostic.
- Transport is replaceable.
- Scheduling is reliable.
- AI assists but does not invent.
- System favors explicit confirmation over automation risk.

---

## 📖 License

MIT
