// src/lib/state-machine.js — Reminder lifecycle state machine
const { REMINDER_STATUS } = require('../constants');

const { PENDING, PARSED, SCHEDULED, FIRING, FIRED, COMPLETED, FAILED, CANCELLED } = REMINDER_STATUS;

const REMINDER_TRANSITIONS = {
  [PENDING]:   [PARSED, FAILED, CANCELLED],
  [PARSED]:    [SCHEDULED, FAILED, CANCELLED],
  [SCHEDULED]: [FIRING, FAILED, COMPLETED, CANCELLED],
  [FIRING]:    [FIRED, FAILED, CANCELLED],
  [FIRED]:     [COMPLETED, CANCELLED],
  [COMPLETED]: [CANCELLED],
  [FAILED]:    [CANCELLED],
  [CANCELLED]: [],
};

function canTransition(from, to) {
  return REMINDER_TRANSITIONS[from]?.includes(to) ?? false;
}

class IllegalTransitionError extends Error {
  constructor(from, to) {
    super(`Illegal reminder transition: ${from} → ${to}`);
    this.code = 'ILLEGAL_TRANSITION';
  }
}

/**
 * Canonical transition helper. Reads current status, validates the transition,
 * then applies it with a CAS guard to prevent lost-update races.
 *
 * Lives here (not in reminder.service) so notifier.service can import it
 * without creating a circular dependency through the queue.
 */
async function transitionReminder(reminderId, targetStatus, patch = {}) {
  // Lazy-require to avoid module-load-time circular dependency issues
  const Reminder = require('../models/Reminder');
  const reminder = await Reminder.findById(reminderId);
  if (!reminder) throw new Error('Reminder not found');
  if (!canTransition(reminder.status, targetStatus)) {
    throw new IllegalTransitionError(reminder.status, targetStatus);
  }
  const updated = await Reminder.findOneAndUpdate(
    { _id: reminderId, status: reminder.status }, // CAS guard — prevents lost-update races
    { $set: { status: targetStatus, ...patch } },
    { new: true },
  );
  if (!updated) throw new IllegalTransitionError(reminder.status, targetStatus);
  return updated;
}

module.exports = { canTransition, IllegalTransitionError, REMINDER_TRANSITIONS, transitionReminder, REMINDER_STATUS };
