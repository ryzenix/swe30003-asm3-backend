const BaseError = require('./BaseError');

/**
 * AuthorizationError - for authorization failures (403)
 */
class AuthorizationError extends BaseError {
    constructor(message, requiredRole = null, userRole = null) {
        super(message, 403, 'AUTHORIZATION_FAILED', {
            requiredRole,
            userRole
        });
    }

    /**
     * Create AuthorizationError for insufficient permissions
     */
    static insufficientPermissions(action = null) {
        const message = action 
            ? `Insufficient permissions to ${action}`
            : 'Insufficient permissions to access this resource';
        return new AuthorizationError(message);
    }

    /**
     * Create AuthorizationError for role requirement
     */
    static roleRequired(requiredRole, userRole = null) {
        return new AuthorizationError(
            `${requiredRole} role required for this action`,
            requiredRole,
            userRole
        );
    }
}

module.exports = AuthorizationError;