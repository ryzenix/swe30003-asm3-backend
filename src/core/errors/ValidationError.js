const BaseError = require('./BaseError');

/**
 * ValidationError - for input validation failures
 */
class ValidationError extends BaseError {
    constructor(message, field = null, validationDetails = null) {
        super(message, 400, 'VALIDATION_ERROR', {
            field,
            validationDetails
        });
    }

    /**
     * Create ValidationError for missing required fields
     */
    static missingFields(fields) {
        return new ValidationError(
            'Required fields are missing',
            null,
            { missingFields: fields }
        );
    }

    /**
     * Create ValidationError for invalid format
     */
    static invalidFormat(field, expectedFormat = null) {
        return new ValidationError(
            `Invalid ${field} format`,
            field,
            { expectedFormat }
        );
    }

    /**
     * Create ValidationError for invalid enum value
     */
    static invalidEnum(field, value, validOptions) {
        return new ValidationError(
            `Invalid ${field} value`,
            field,
            { providedValue: value, validOptions }
        );
    }

    /**
     * Create ValidationError for number validation
     */
    static invalidNumber(field, value, min = null, max = null) {
        return new ValidationError(
            `${field} must be a valid number${min !== null ? ` (minimum: ${min})` : ''}${max !== null ? ` (maximum: ${max})` : ''}`,
            field,
            { providedValue: value, min, max }
        );
    }

    /**
     * Create ValidationError for string length
     */
    static invalidLength(field, length, minLength = null, maxLength = null) {
        return new ValidationError(
            `${field} length is invalid`,
            field,
            { currentLength: length, minLength, maxLength }
        );
    }
}

module.exports = ValidationError;