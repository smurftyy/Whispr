const MessagingProvider = require('../interfaces/messaging.provider');
const logger = require('../utils/logger');
const WhatsAppAdapter = require('../adapters/whatsapp.adapter');

/**
 * BaileysService implements the MessagingProvider interface using WhatsAppAdapter.
 * It handles high-level application logic like number normalization and 
 * serves as the bridge between the low-level adapter and the application.
 */
class BaileysService extends MessagingProvider {
    constructor() {
        super();
        this.adapter = new WhatsAppAdapter();
        this.messageHandler = null;
        this.#setupAdapter();
    }

    /**
     * Set up adapter event listeners and map them to service logic
     */
    #setupAdapter() {
        // Handle incoming messages
        this.adapter.on('message', ({ from, body, id }) => {
            if (this.messageHandler) {
                // Normalize '123456@s.whatsapp.net' -> '+123456'
                const cleanNumber = from.split('@')[0];
                const normalizedFrom = '+' + cleanNumber;
                
                logger.info(`BaileysService: Incoming message from ${normalizedFrom}`);
                
                try {
                    this.messageHandler(normalizedFrom, body, id);
                } catch (error) {
                    logger.error('BaileysService: Error in message handler', error);
                }
            }
        });

        // Lifecycle logging
        this.adapter.on('connected', (user) => {
            logger.info(`✅ WhatsApp Service connected as ${user.id}`);
        });

        this.adapter.on('disconnected', ({ reason, shouldReconnect }) => {
            logger.warn(`❌ WhatsApp Service disconnected. Reason: ${reason}. Will reconnect: ${shouldReconnect}`);
        });

        this.adapter.on('logout', () => {
            logger.error('❌ WhatsApp Service: Logged out! Please delete auth folder and scan QR again.');
        });
    }

    /**
     * Start the service
     */
    async initialize() {
        logger.info('Initializing BaileysService...');
        await this.adapter.start();
    }

    /**
     * Register a callback for when a message is received
     * @param {Function} callback - (from, body, messageId)
     */
    onMessage(callback) {
        this.messageHandler = callback;
    }

    /**
     * Send a message to a phone number
     * @param {string} to - Phone number (e.g. +123456)
     * @param {string} message - Text content
     */
    async send(to, message) {
        // Format 'to': System uses '+123456', Baileys needs '123456@s.whatsapp.net'
        const cleanNumber = to.replace('+', '').replace('whatsapp:', '').trim();
        const jid = `${cleanNumber}@s.whatsapp.net`;

        try {
            await this.adapter.sendMessage(jid, message);
            return { provider: 'baileys', success: true };
        } catch (error) {
            logger.error(`BaileysService: Failed to send message to ${to}`, error);
            throw error;
        }
    }

    /**
     * Stop the service (for graceful shutdown)
     */
    async stop() {
        logger.info('Stopping BaileysService...');
        await this.adapter.stop();
    }
}

// Single instance
module.exports = new BaileysService();

