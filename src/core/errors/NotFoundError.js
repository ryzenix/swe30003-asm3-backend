const BaseError = require('./BaseError');

/**
 * NotFoundError - for resource not found scenarios
 */
class NotFoundError extends BaseError {
    constructor(resource, identifier = null) {
        const message = identifier 
            ? `${resource} with identifier '${identifier}' not found`
            : `${resource} not found`;
            
        super(message, 404, 'NOT_FOUND', {
            resource,
            identifier
        });
    }

    /**
     * Create NotFoundError for user
     */
    static user(userId = null) {
        return new NotFoundError('User', userId);
    }

    /**
     * Create NotFoundError for product
     */
    static product(productId = null) {
        return new NotFoundError('Product', productId);
    }

    /**
     * Create NotFoundError for staff
     */
    static staff(staffId = null) {
        return new NotFoundError('Staff', staffId);
    }
}

module.exports = NotFoundError;