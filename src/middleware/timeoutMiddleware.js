const Logger = require('../core/Logger');

class TimeoutMiddleware {
    constructor() {
        this.logger = new Logger();
    }

    /**
     * Create a timeout middleware for requests
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} operation - Operation name for logging
     * @returns {Function} Express middleware function
     */
    createTimeout(timeoutMs = 60000, operation = 'request') {
        return (req, res, next) => {
            // Set a timeout for the request
            const timeout = setTimeout(() => {
                if (!res.headersSent) {
                    this.logger.error(`${operation} timeout after ${timeoutMs}ms for ${req.method} ${req.path}`);
                    res.status(408).json({
                        success: false,
                        error: 'Request Timeout',
                        message: `${operation} took too long to complete. Please try again.`,
                        timeout: timeoutMs
                    });
                }
            }, timeoutMs);

            // Clear timeout when response is finished
            res.on('finish', () => {
                clearTimeout(timeout);
            });

            // Clear timeout when response is closed
            res.on('close', () => {
                clearTimeout(timeout);
            });

            // Continue to next middleware
            next();
        };
    }

    /**
     * Specific timeout for file uploads (longer timeout)
     * @returns {Function} Express middleware function
     */
    uploadTimeout() {
        return this.createTimeout(120000, 'File upload'); // 2 minutes
    }

    /**
     * Standard timeout for API requests
     * @returns {Function} Express middleware function
     */
    apiTimeout() {
        return this.createTimeout(30000, 'API request'); // 30 seconds
    }

    /**
     * Short timeout for health checks and simple operations
     * @returns {Function} Express middleware function
     */
    quickTimeout() {
        return this.createTimeout(10000, 'Quick operation'); // 10 seconds
    }
}

module.exports = TimeoutMiddleware;