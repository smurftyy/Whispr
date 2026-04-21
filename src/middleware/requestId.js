// src/middleware/requestId.js — Attach a UUID to every request for end-to-end traceability
const { randomUUID } = require('crypto');

module.exports = function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
