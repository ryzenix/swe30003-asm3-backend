const BaseError = require('./BaseError');

/**
 * BusinessLogicError - for business rule violations
 */
class BusinessLogicError extends BaseError {
    constructor(message, businessRule = null, ruleDetails = null) {
        super(message, 422, 'BUSINESS_LOGIC_ERROR', {
            businessRule,
            ruleDetails
        });
    }

    /**
     * Create BusinessLogicError for password requirements
     */
    static passwordRequirements(requirements = [], currentLength = 0) {
        return new BusinessLogicError(
            'Password does not meet security requirements',
            'PASSWORD_POLICY',
            { requirements, currentLength }
        );
    }

    /**
     * Create BusinessLogicError for age restrictions
     */
    static ageRestriction(minAge, providedAge = null) {
        return new BusinessLogicError(
            `Age must be at least ${minAge} years`,
            'AGE_RESTRICTION',
            { minAge, providedAge }
        );
    }

    /**
     * Create BusinessLogicError for date restrictions
     */
    static futureDate(field) {
        return new BusinessLogicError(
            `${field} cannot be in the future`,
            'FUTURE_DATE_NOT_ALLOWED',
            { field }
        );
    }

    /**
     * Create BusinessLogicError for invalid operations
     */
    static invalidOperation(operation, reason = null) {
        return new BusinessLogicError(
            `Cannot ${operation}${reason ? ': ' + reason : ''}`,
            'INVALID_OPERATION',
            { operation, reason }
        );
    }
}

module.exports = BusinessLogicError;