// scripts/verify_flow.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Reminder = require('../src/models/Reminder');
const webhookController = require('../src/controllers/webhook.controller');
const notifierService = require('../src/services/notifier.service');
const whisprService = require('../src/services/whispr.service');

// Mock Services
const mockSend = async (to, msg) => {
    console.log(`\n🤖 [Bot -> ${to}]:\n${msg}\n`);
};

const mockExtract = async (text) => {
    console.log(`🧠 [Gemini]: Extracting from "${text}"`);
    // Return a fixed date for testing
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    futureDate.setHours(17, 0, 0, 0);

    return {
        task: 'Buy milk',
        course: null,
        type: 'other',
        deadline: futureDate.toISOString(),
        urgency: 'medium',
        location: null,
        notes: null
    };
};

notifierService.send = mockSend;
whisprService.extractReminder = mockExtract;

const runVerification = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whispr');
        console.log('✅ Connected to DB');

        const PHONE = '+1234567890';

        // Cleanup previous test
        await User.deleteOne({ phoneNumber: PHONE });
        await Reminder.deleteMany({ userId: await User.findOne({ phoneNumber: PHONE })?._id });

        console.log('\n--- Step 1: Initial Message ---');
        // Initial Message
        await webhookController.processMessage(PHONE, 'Buy milk tomorrow at 5pm', 'msg1');

        let user = await User.findOne({ phoneNumber: PHONE });
        console.log(`User State: ${user.conversationState}`);
        if (user.conversationState !== 'CONFIRM_DETAILS') throw new Error('Failed to transition to CONFIRM_DETAILS');

        console.log('\n--- Step 2: Confirm Details (Input: 1) ---');
        await webhookController.processMessage(PHONE, '1', 'msg2');

        user = await User.findOne({ phoneNumber: PHONE });
        console.log(`User State: ${user.conversationState}`);
        if (user.conversationState !== 'SELECT_FREQUENCY') throw new Error('Failed to transition to SELECT_FREQUENCY');

        console.log('\n--- Step 3: Select Frequency (Input: 1) ---');
        await webhookController.processMessage(PHONE, '1', 'msg3');

        user = await User.findOne({ phoneNumber: PHONE });
        console.log(`User State: ${user.conversationState}`);
        if (user.conversationState !== 'SELECT_TIMING') throw new Error('Failed to transition to SELECT_TIMING');

        console.log('\n--- Step 4: Select Timing (Input: 1) ---');
        await webhookController.processMessage(PHONE, '1', 'msg4');

        user = await User.findOne({ phoneNumber: PHONE });
        console.log(`User State: ${user.conversationState}`);
        if (user.conversationState !== 'IDLE') throw new Error('Failed to transition back to IDLE');

        const reminder = await Reminder.findOne({ userId: user._id, status: 'active' });
        if (!reminder) throw new Error('Reminder not activated');
        console.log('✅ Reminder Activated:', reminder.extracted.task);

        console.log('\n✅ VERIFICATION SUCCESSFUL');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
