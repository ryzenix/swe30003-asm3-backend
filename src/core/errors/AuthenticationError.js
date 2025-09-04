const BaseError = require('./BaseError');

/**
 * AuthenticationError - for authentication failures
 */
class AuthenticationError extends BaseError {
    constructor(message, authDetails = null) {
        super(message, 401, 'AUTHENTICATION_FAILED', authDetails);
    }

    /**
     * Create AuthenticationError for invalid credentials
     */
    static invalidCredentials(remainingAttempts = null) {
        return new AuthenticationError(
            'Invalid login credentials',
            { remainingAttempts, blocked: false }
        );
    }

    /**
     * Create AuthenticationError for rate limiting
     */
    static rateLimited(secondsRemaining) {
        const error = new AuthenticationError(
            'Too many failed login attempts',
            { 
                blocked: true, 
                secondsRemaining,
                retryAfter: secondsRemaining
            }
        );
        error.errorCode = 'RATE_LIMITED';
        return error;
    }

    /**
     * Create AuthenticationError for incorrect password
     */
    static incorrectPassword(field = 'password') {
        return new AuthenticationError(
            `Current ${field} is incorrect`,
            { field }
        );
    }

    /**
     * Create AuthenticationError for session required
     */
    static sessionRequired() {
        return new AuthenticationError(
            'Authentication required to access this resource'
        );
    }

    /**
     * Create AuthenticationError for expired challenge
     */
    static challengeExpired() {
        return new AuthenticationError(
            'Authentication challenge has expired'
        );
    }
}

module.exports = AuthenticationError;