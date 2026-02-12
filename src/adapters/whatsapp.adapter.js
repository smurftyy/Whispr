// src/adapters/whatsapp.adapter.js - Clean Baileys Wrapper
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const crypto = require('crypto');

// Polyfill for Node.js 18 compatibility with Baileys Web Crypto requirements
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}


/**
 * WhatsAppAdapter handles the low-level Baileys socket lifecycle,
 * authentication state, and connection management.
 * 
 * It abstracts away technical Baileys details and provides a clean
 * event-based interface for the rest of the application.
 */
class WhatsAppAdapter extends EventEmitter {
    constructor(config = {}) {
        super();
        this.authDir = config.authDir || path.resolve(process.cwd(), 'auth_info_baileys');
        this.sock = null;
        this.isStopping = false;
        this.reconnectTimeout = null;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.printQR = config.printQR !== undefined ? config.printQR : true;
        
        // Ensure auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    /**
     * Start the WhatsApp connection
     */
    async start() {
        if (this.sock) {
            logger.warn('WhatsAppAdapter: Connection already active or in progress');
            return;
        }
        this.isStopping = false;
        logger.info('WhatsAppAdapter: Starting connection...');
        await this.#connect();
    }

    /**
     * Stop the WhatsApp connection and stop reconnection logic
     */
    async stop() {
        this.isStopping = true;
        this.#clearReconnect();
        
        if (this.sock) {
            // Gracefully end the socket
            this.sock.end();
            this.sock = null;
        }
        logger.info('WhatsAppAdapter: Stopped');
    }

    /**
     * Internal connection logic
     */
    async #connect() {
        try {
            // Baileys is often updated to use ESM. Dynamic import ensures compatibility.
            const { 
                default: makeWASocket, 
                DisconnectReason, 
                useMultiFileAuthState,
                fetchLatestWaWebVersion 
            } = await import('@whiskeysockets/baileys');
            
            const { version, isLatest } = await fetchLatestWaWebVersion();
            logger.info(`WhatsAppAdapter: Using WA Web v${version.join('.')}, isLatest: ${isLatest}`);

            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                browser: ['Whispr', 'Chrome', '1.0.0'],
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                // Suppress Baileys internal logger noise, use our logger instead
                logger: { 
                    level: 'silent', 
                    trace: () => {},
                    debug: () => {}, 
                    info: () => {}, 
                    warn: () => {}, 
                    error: (msg) => logger.error(`Baileys: ${msg}`),
                    fatal: (msg) => logger.error(`Baileys FATAL: ${msg}`),
                    child: function() { return this; }
                }
            });

            // Bind events
            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('connection.update', (update) => this.#handleConnectionUpdate(update, DisconnectReason));
            this.sock.ev.on('messages.upsert', (upsert) => this.#handleMessages(upsert));

        } catch (error) {
            logger.error('WhatsAppAdapter: Fatal connection error', error);
            this.#scheduleReconnect();
        }
    }

    /**
     * Handle connection status updates
     */
    #handleConnectionUpdate(update, DisconnectReason) {
        const { connection, lastDisconnect, qrcode: qr } = update;

        // 1. Handle QR Code
        if (qr) {
            if (this.printQR) {
                logger.info('WhatsApp QR Code received. Scan with your phone:');
                qrcode.generate(qr, { small: true });
            }
            this.emit('qr', qr);
        }

        // 2. Handle Connection Closure
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isStopping;

            const reason = this.#getDisconnectReason(statusCode, DisconnectReason);
            logger.info('WhatsAppAdapter: Connection closed', { statusCode, reason, shouldReconnect });

            this.sock = null;
            this.emit('disconnected', { statusCode, reason, shouldReconnect });

            if (shouldReconnect) {
                this.#scheduleReconnect();
            } else if (statusCode === DisconnectReason.loggedOut) {
                logger.error('WhatsAppAdapter: Session logged out. Manual intervention required.');
                this.emit('logout');
            }
        } 
        // 3. Handle Connection Success
        else if (connection === 'open') {
            logger.info('WhatsAppAdapter: Connection successfully opened');
            this.#clearReconnect();
            this.emit('connected', this.sock.user);
        }
    }

    /**
     * Handle incoming messages
     */
    #handleMessages(upsert) {
        if (upsert.type !== 'notify') return;

        for (const msg of upsert.messages) {
            if (!msg.message) continue;
            
            // Emit raw message for advanced usage if needed
            this.emit('raw-message', msg);

            // Ignore status updates
            if (msg.key.remoteJid === 'status@broadcast') continue;
            
            // Ignore self-messages
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const body = this.#extractText(msg.message);
            const id = msg.key.id;

            if (body) {
                this.emit('message', { 
                    from, 
                    body, 
                    id, 
                    pushName: msg.pushName,
                    timestamp: msg.messageTimestamp 
                });
            }
        }
    }

    /**
     * Extract text content from various message types
     */
    #extractText(message) {
        return message.conversation ||    
               message.extendedTextMessage?.text ||
               message.imageMessage?.caption ||
               message.videoMessage?.caption ||
               '';
    }

    /**
     * Implementation of reconnection with control
     */
    #scheduleReconnect() {
        if (this.isStopping || this.reconnectTimeout) return;

        logger.info(`WhatsAppAdapter: Reconnecting in ${this.reconnectInterval}ms...`);
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            await this.#connect();
        }, this.reconnectInterval);
    }

    #clearReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * Utility to get human-readable disconnect reason
     */
    #getDisconnectReason(statusCode, DisconnectReason) {
        for (const key in DisconnectReason) {
            if (DisconnectReason[key] === statusCode) return key;
        }
        return `unknown(${statusCode})`;
    }

    /**
     * PUBLIC API
     */

    /**
     * Send a message to a JID
     * @param {string} jid - Recipient JID (e.g. 12345@s.whatsapp.net)
     * @param {string|object} message - Message text or Baileys message object
     */
    async sendMessage(jid, message) {
        if (!this.sock) {
            throw new Error('WhatsAppAdapter: Cannot send message, socket not connected');
        }
        
        const content = typeof message === 'string' ? { text: message } : message;
        return await this.sock.sendMessage(jid, content);
    }

    /**
     * Helper for legacy compatibility or simple use cases
     */
    onMessage(callback) {
        this.on('message', callback);
    }
}

module.exports = WhatsAppAdapter;
