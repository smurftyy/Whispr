// src/lib/errors.js — Domain error classes

class InvalidAIOutputError extends Error {
  constructor(issues) {
    super('AI output failed schema validation');
    this.name = 'InvalidAIOutputError';
    this.issues = issues;
    this.code = 'INVALID_AI_OUTPUT';
  }
}

module.exports = { InvalidAIOutputError };
