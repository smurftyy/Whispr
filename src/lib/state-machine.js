// src/lib/state-machine.js — Reminder lifecycle state machine

const REMINDER_TRANSITIONS = {
  pending:   ['parsed', 'failed', 'cancelled'],
  parsed:    ['scheduled', 'failed', 'cancelled'],
  scheduled: ['firing', 'failed', 'completed', 'cancelled'],
  firing:    ['fired', 'failed'],
  fired:     ['completed'],
  completed: [],
  failed:    [],
  cancelled: [],
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

module.exports = { canTransition, IllegalTransitionError, REMINDER_TRANSITIONS };
