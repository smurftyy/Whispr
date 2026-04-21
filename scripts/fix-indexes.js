#!/usr/bin/env node
// scripts/fix-indexes.js
// Idempotent migration: drops the legacy phoneNumber_1 unique index (which
// blocks null-phoneNumber users) and syncs the correct partial indexes for
// both User and Reminder models.
//
// Usage: node scripts/fix-indexes.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Reminder = require('../src/models/Reminder');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Drop the legacy plain-unique phoneNumber index if it still exists.
  // The new partial index (added to the schema) replaces it.
  const userCollection = mongoose.connection.collection('users');
  const existingIndexes = await userCollection.indexes();
  const legacyIndex = existingIndexes.find((idx) => idx.name === 'phoneNumber_1');
  if (legacyIndex) {
    await userCollection.dropIndex('phoneNumber_1');
    console.log('Dropped legacy index: phoneNumber_1');
  } else {
    console.log('Legacy index phoneNumber_1 not present — skipping drop');
  }

  // Sync schema-defined indexes onto both collections.
  // syncIndexes() creates missing indexes and drops stale ones — safe to re-run.
  await User.syncIndexes();
  console.log('User indexes synced');

  await Reminder.syncIndexes();
  console.log('Reminder indexes synced');

  // Log final index state for verification
  const finalUserIndexes = await userCollection.indexes();
  console.log('\nUser indexes:');
  finalUserIndexes.forEach((idx) => console.log(' ', idx.name, JSON.stringify(idx.key)));

  const reminderCollection = mongoose.connection.collection('reminders');
  const finalReminderIndexes = await reminderCollection.indexes();
  console.log('\nReminder indexes:');
  finalReminderIndexes.forEach((idx) => console.log(' ', idx.name, JSON.stringify(idx.key)));

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
