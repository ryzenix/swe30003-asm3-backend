const Logger = require('./Logger');
const { BaseError } = require('./errors');

/**
 * Centralized Error Handler Middleware
 * Follows OOP principles and provides consistent error responses
 */
class ErrorHandler {
    constructor() {
        this.logger = new Logger();
    }

    /**
     * Express error handling middleware
     */
    handle(error, req, res, next) {
        this.logger.error('Error occurred:', {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Handle operational errors (expected errors)
        if (error instanceof BaseError) {
            return res.status(error.getStatusCode()).json(error.toJSON());
        }

        // Handle unexpected errors (programming errors)
        if (error.name === 'ValidationError' && error.errors) {
            // Mongoose validation errors
            const formattedErrors = Object.values(error.errors).map(err => ({
                field: err.path,
                message: err.message
            }));
            
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: { validationErrors: formattedErrors },
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Handle PostgreSQL errors
        if (error.code) {
            return this.handleDatabaseError(error, res);
        }

        // Handle JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Handle multer errors (file upload)
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'FILE_TOO_LARGE',
                    message: 'File size exceeds the allowed limit',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Log unexpected errors for debugging
        this.logger.error('Unexpected error:', error);

        // Default error response for unexpected errors
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred: ' + error.message,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * Handle database-specific errors
     */
    handleDatabaseError(error, res) {
        const { code } = error;

        switch (code) {
            case '23505': // Unique constraint violation
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'DUPLICATE_ENTRY',
                        message: 'A record with this value already exists',
                        details: { constraint: error.constraint },
                        timestamp: new Date().toISOString()
                    }
                });

            case '23503': // Foreign key constraint violation
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'REFERENCE_ERROR',
                        message: 'Referenced record does not exist',
                        details: { constraint: error.constraint },
                        timestamp: new Date().toISOString()
                    }
                });

            case '23502': // Not null constraint violation
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'REQUIRED_FIELD_MISSING',
                        message: 'Required field cannot be null',
                        details: { column: error.column },
                        timestamp: new Date().toISOString()
                    }
                });

            case '22P02': // Invalid input syntax
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_INPUT_FORMAT',
                        message: 'Invalid input format for database operation',
                        timestamp: new Date().toISOString()
                    }
                });

            default:
                this.logger.error('Unhandled database error:', error);
                return res.status(500).json({
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'Database operation failed',
                        timestamp: new Date().toISOString()
                    }
                });
        }
    }

    /**
     * Handle 404 errors (route not found)
     */
    handleNotFound(req, res) {
        res.status(404).json({
            success: false,
            error: {
                code: 'ROUTE_NOT_FOUND',
                message: `Route ${req.method} ${req.originalUrl} not found`,
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * Create error handler middleware function
     */
    getMiddleware() {
        return this.handle.bind(this);
    }

    /**
     * Create 404 handler middleware function
     */
    getNotFoundMiddleware() {
        return this.handleNotFound.bind(this);
    }
}

module.exports = ErrorHandler;