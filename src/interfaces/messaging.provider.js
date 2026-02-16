// src/interfaces/messaging.provider.js — Adapter Interface Contract
//
// Every messaging adapter (Telegram, Discord, WhatsApp, etc.) MUST extend
// this class and implement both methods.  The core never calls platform
// APIs directly — it routes through the NotifierService which delegates
// to the registered adapter.

/**
 * Abstract base class for messaging platform adapters.
 *
 * Implementing a new adapter:
 *   1. Create `src/adapters/<platform>.adapter.js`
 *   2. Extend this class
 *   3. Implement `send()` and `onMessage()`
 *   4. Register the adapter in `server.js` via `notifierService.registerAdapter()`
 *
 * See `src/adapters/discord.adapter.js` for a documented stub example.
 */
class MessagingProvider {
  /**
   * Send a message to a recipient.
   * @param {string} to - Recipient identifier (platform-specific, e.g. chat ID)
   * @param {string} message - Plain-text message body
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async send(to, message) {
    throw new Error('MessagingProvider.send() must be implemented by subclass');
  }

  /**
   * Register a callback invoked on every inbound user message.
   * @param {(from: string, body: string, messageId: string) => void} callback
   */
  onMessage(callback) {
    throw new Error('MessagingProvider.onMessage() must be implemented by subclass');
  }
}

module.exports = MessagingProvider;
