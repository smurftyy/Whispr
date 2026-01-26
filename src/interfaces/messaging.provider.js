/**
 * Interface for Messaging Providers
 * abstract class used as interface
 */
class MessagingProvider {
    /**
     * Send a message to a recipient
     * @param {string} to - Recipient ID (e.g. phone number)
     * @param {string} message - Message content
     * @returns {Promise<any>} - Provider-specific response
     */
    async send(to, message) {
        throw new Error('Method not implemented');
    }

    /**
     * Set a callback involved when a message is received
     * @param {function(string, string, string): void} callback - (from, body, messageId)
     */
    onMessage(callback) {
        throw new Error('Method not implemented');
    }
}

module.exports = MessagingProvider;
