const twilio = require('twilio');
require('dotenv').config();

const logger = {
  info: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
};

async function verify() {
  logger.info('--- Whispr Twilio Diagnostic ---');

  // 1. Check Environment Variables
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const number = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!sid || !token || !number) {
    logger.error('Missing Environment Variables!');
    if (!sid) console.log('   - TWILIO_ACCOUNT_SID is missing');
    if (!token) console.log('   - TWILIO_AUTH_TOKEN is missing');
    if (!number) console.log('   - TWILIO_WHATSAPP_NUMBER is missing');
    return;
  }

  logger.info('Environment variables present');
  console.log(`   - SID: ${sid.substring(0, 6)}...`);
  console.log(`   - Number: ${number}`);

  // 2. Check Number Format
  if (!number.startsWith('whatsapp:')) {
    logger.warn('TWILIO_WHATSAPP_NUMBER is missing "whatsapp:" prefix.');
    logger.warn('Fixing temporarily for this test...');
  } else {
    logger.info('TWILIO_WHATSAPP_NUMBER format correct (starts with whatsapp:)');
  }

  // 3. Test Connection
  try {
    const client = twilio(sid, token);
    logger.info('Connecting to Twilio API...');
    
    // Fetch account details to verify credentials
    const account = await client.api.accounts(sid).fetch();
    logger.info(`Authentication Successful! Connected as: ${account.friendlyName}`);
    logger.info(`Account Status: ${account.status}`);
    logger.info(`Account Type: ${account.type}`);

  } catch (error) {
    logger.error('Authentication Failed!');
    console.error('Error details:', error.message);
    if (error.code === 20003) {
      console.log('   -> Hint: Double check your Account SID and Auth Token.');
    }
  }
}

verify().catch(console.error);
