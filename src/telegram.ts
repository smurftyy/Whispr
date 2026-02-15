// src/telegram.ts - Telegram Bot implementation (TypeScript version)
import TelegramBot from 'node-telegram-bot-api';
// @ts-ignore
import webhookController from './controllers/webhook.controller';
// @ts-ignore
import logger from './utils/logger';

const token = process.env.TELEGRAM_BOT_TOKEN as string;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
}

let bot: TelegramBot;

try {
  bot = new TelegramBot(token, { polling: true });
  console.log('🚀 Telegram bot initialized and polling...');

  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const platformId = msg.from?.id.toString();
    if (!platformId) return;
    
    const text = msg.text;
    const messageId = msg.message_id.toString();

    console.log(`Received Telegram message from ${platformId}: ${text}`);

    try {
      await webhookController.processMessage(platformId, text, messageId);
    } catch (error) {
      console.error('Error processing Telegram message:', error);
    }
  });

  bot.on('polling_error', (error: any) => {
    console.error('Telegram Polling Error:', error.code || error.message);
  });

} catch (error: any) {
  console.error('Failed to initialize Telegram Bot:', error.message);
}

/**
 * Send a message via Telegram
 * @param {string} to - Telegram user ID
 * @param {string} message - Content
 */
export const sendMessage = async (to: string, message: string) => {
  if (!bot) {
    console.error('Cannot send message: Telegram bot not initialized');
    return { success: false, error: 'Bot not initialized' };
  }
  try {
    await bot.sendMessage(to, message);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send Telegram message to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

export default bot;
