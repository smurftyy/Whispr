// src/adapters/discord.adapter.js — Discord Messaging Adapter (Stub)
//
// This file is a documented example for contributors who want to add Discord
// support.  It implements the MessagingProvider interface with TODO markers
// showing exactly what needs to be filled in.
//
// To activate:
//   1. npm install discord.js
//   2. Fill in the TODOs below
//   3. Register this adapter in server.js (see SETUP_GUIDE.md)

const MessagingProvider = require('../interfaces/messaging.provider');
const logger = require('../utils/logger');

/**
 * Discord adapter implementing the MessagingProvider interface.
 *
 * @example
 * const DiscordAdapter = require('./adapters/discord.adapter');
 * const discord = new DiscordAdapter(process.env.DISCORD_BOT_TOKEN);
 * discord.start();
 * discord.onMessage((from, body, messageId) => { ... });
 */
class DiscordAdapter extends MessagingProvider {
  /**
   * @param {string} token - Discord bot token
   */
  constructor(token) {
    super();
    this.token = token;
    this.client = null; // TODO: Initialize Discord.js Client
  }

  /**
   * Connect to Discord and start listening for messages.
   * TODO: Implement using discord.js Client.login()
   */
  start() {
    if (!this.token) {
      logger.error('DiscordAdapter: Missing bot token — adapter disabled');
      return;
    }

    // TODO: Uncomment and implement after installing discord.js
    //
    // const { Client, GatewayIntentBits } = require('discord.js');
    // this.client = new Client({
    //   intents: [
    //     GatewayIntentBits.Guilds,
    //     GatewayIntentBits.GuildMessages,
    //     GatewayIntentBits.MessageContent,
    //   ],
    // });
    //
    // this.client.once('ready', () => {
    //   logger.info('🟣 Discord bot connected');
    // });
    //
    // this.client.login(this.token);

    logger.warn('DiscordAdapter: start() is a stub — implement me');
  }

  /**
   * Send a text message to a Discord channel or user via DM.
   * @param {string} to - Discord channel ID or user ID
   * @param {string} message - Plain-text message body
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, message) {
    // TODO: Implement message sending
    //
    // try {
    //   const channel = await this.client.channels.fetch(to);
    //   await channel.send(message);
    //   return { success: true };
    // } catch (error) {
    //   logger.error(`DiscordAdapter: Failed to send to ${to}:`, error.message);
    //   return { success: false, error: error.message };
    // }

    logger.warn('DiscordAdapter: send() is a stub — implement me');
    return { success: false, error: 'Not implemented' };
  }

  /**
   * Register a callback that fires on every incoming text message.
   * @param {(from: string, body: string, messageId: string) => void} callback
   */
  onMessage(callback) {
    // TODO: Implement message listening
    //
    // this.client.on('messageCreate', (msg) => {
    //   if (msg.author.bot) return;
    //   callback(msg.author.id, msg.content, msg.id);
    // });

    logger.warn('DiscordAdapter: onMessage() is a stub — implement me');
  }
}

module.exports = DiscordAdapter;
