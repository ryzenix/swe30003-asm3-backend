/**
 * Error classes index - centralized export for all custom error types
 * Following OOP principles with proper inheritance hierarchy
 */

const BaseError = require('./BaseError');
const ValidationError = require('./ValidationError');
const NotFoundError = require('./NotFoundError');
const ConflictError = require('./ConflictError');
const AuthenticationError = require('./AuthenticationError');
const AuthorizationError = require('./AuthorizationError');
const BusinessLogicError = require('./BusinessLogicError');
const ExternalServiceError = require('./ExternalServiceError');

module.exports = {
    BaseError,
    ValidationError,
    NotFoundError,
    ConflictError,
    AuthenticationError,
    AuthorizationError,
    BusinessLogicError,
    ExternalServiceError
};