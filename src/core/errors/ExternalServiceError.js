const BaseError = require('./BaseError');

/**
 * ExternalServiceError - for external service failures
 */
class ExternalServiceError extends BaseError {
    constructor(message, service = null, serviceDetails = null) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR', {
            service,
            serviceDetails
        });
    }

    /**
     * Create ExternalServiceError for S3 operations
     */
    static s3Error(operation, originalError = null) {
        return new ExternalServiceError(
            `Failed to ${operation} with S3 storage service`,
            'AWS_S3',
            { operation, originalError: originalError?.message }
        );
    }

    /**
     * Create ExternalServiceError for database operations
     */
    static databaseError(operation, originalError = null) {
        return new ExternalServiceError(
            `Database ${operation} operation failed`,
            'DATABASE',
            { operation, originalError: originalError?.message }
        );
    }

    /**
     * Create ExternalServiceError for authentication services
     */
    static authServiceError(operation, originalError = null) {
        return new ExternalServiceError(
            `Authentication service ${operation} failed`,
            'AUTH_SERVICE',
            { operation, originalError: originalError?.message }
        );
    }
}

module.exports = ExternalServiceError;