const BaseError = require('./BaseError');

/**
 * ConflictError - for resource conflicts (409 status)
 */
class ConflictError extends BaseError {
    constructor(message, conflictType = null, conflictDetails = null) {
        super(message, 409, 'CONFLICT_ERROR', {
            conflictType,
            conflictDetails
        });
    }

    /**
     * Create ConflictError for duplicate email
     */
    static duplicateEmail(email) {
        return new ConflictError(
            'An account with this email already exists',
            'DUPLICATE_EMAIL',
            { email }
        );
    }

    /**
     * Create ConflictError for duplicate SKU
     */
    static duplicateSKU(sku) {
        return new ConflictError(
            'A product with this SKU already exists',
            'DUPLICATE_SKU',
            { sku }
        );
    }

    /**
     * Create ConflictError for resource already taken
     */
    static resourceTaken(resourceType, value) {
        return new ConflictError(
            `${resourceType} is already taken`,
            'RESOURCE_TAKEN',
            { resourceType, value }
        );
    }
}

module.exports = ConflictError;