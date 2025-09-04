/**
 * Base Error class for all application errors
 * Follows OOP principles with proper inheritance
 */
class BaseError extends Error {
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to standardized JSON format
     */
    toJSON() {
        return {
            success: false,
            error: {
                code: this.errorCode,
                message: this.message,
                details: this.details,
                timestamp: this.timestamp
            }
        };
    }

    /**
     * Get HTTP status code
     */
    getStatusCode() {
        return this.statusCode;
    }

    /**
     * Check if error is operational (expected) or programming error
     */
    isOperationalError() {
        return this.isOperational;
    }
}

module.exports = BaseError;