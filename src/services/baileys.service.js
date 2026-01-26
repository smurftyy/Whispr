const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const MessagingProvider = require('../interfaces/messaging.provider');
const logger = require('../utils/logger');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

class BaileysService extends MessagingProvider {
    constructor() {
        super();
        this.sock = null;
        this.messageHandler = null;
        this.authDir = path.resolve(__dirname, '../../auth_info_baileys');

        // Create auth directory if it doesn't exist
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    async initialize() {
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Let Baileys handle QR display
        });

        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qrcode: qr } = update;

            // Debug log to see what's happening
            logger.info('Connection update:', { connection, hasQr: !!qr });

            if (qr) {
                console.log('Scan this QR code:', qr);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    logger.info('Connection closed due to error, reconnecting...');
                    this.initialize();
                } else {
                    logger.error('Connection closed. You are logged out.');
                }
            } else if (connection === 'open') {
                logger.info('✅ WhatsApp connection opened!');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                if (!msg.message) continue;
                // Ignore status updates/broadcasts
                if (msg.key.remoteJid === 'status@broadcast') continue;
                // Ignore my own messages
                if (msg.key.fromMe) continue;

                const from = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                // Extract text body
                const body = msg.message.conversation ||
                    msg.message.extendedTextMessage?.text ||
                    msg.message.imageMessage?.caption ||
                    '';

                const messageId = msg.key.id;

                if (this.messageHandler && body) {
                    // Normalize to +12345 format used in system
                    const normalizedFrom = '+' + from;
                    logger.info(`Incoming Baileys message from ${normalizedFrom}: ${body}`);
                    this.messageHandler(normalizedFrom, body, messageId);
                }
            }
        });
    }

    onMessage(callback) {
        this.messageHandler = callback;
    }

    async send(to, message) {
        if (!this.sock) {
            throw new Error('Baileys socket not initialized');
        }

        // Format 'to': System uses '+123456', Baileys needs '123456@s.whatsapp.net'
        const cleanNumber = to.replace('+', '').replace('whatsapp:', '');
        const jid = `${cleanNumber}@s.whatsapp.net`;

        await this.sock.sendMessage(jid, { text: message });
        return { sid: 'baileys-msg-id' }; // Mock return to match expected interface slightly
    }
}

module.exports = new BaileysService();
