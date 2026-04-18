// scripts/fix-frequency-enum.js
// One-shot migration: normalize legacy frequency='once' → 'none'.
// Run manually: node scripts/fix-frequency-enum.js
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await mongoose.connection.collection('reminders').updateMany(
    { frequency: 'once' },
    { $set: { frequency: 'none' } },
  );

  console.log(`Updated ${result.modifiedCount} reminders`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
