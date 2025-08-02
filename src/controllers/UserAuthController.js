const UserAuth = require('../models/UserAuth');
const Logger = require('../core/Logger');

class UserAuthController {
    constructor() {
        this.userAuthModel = new UserAuth();
        this.logger = new Logger();
    }

    async checkEmail(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'Email is required',
                        field: 'email'
                    }
                });
            }

            const result = await this.userAuthModel.checkEmail(email);
            res.json({
                success: true,
                message: 'Email check completed',
                data: result
            });
        } catch (error) {
            this.logger.error('Email check error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Failed to check email availability',
                    details: error.message
                }
            });
        }
    }

    async register(req, res) {
        try {
            const result = await this.userAuthModel.register(req.body);
            
            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;
            req.session.authTime = Date.now();

            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Registration error:', error);
            
            if (error.message.includes('Required fields are missing')) {
                const missingFields = error.message.match(/\[(.*)\]/)?.[1]?.split(', ') || [];
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'Required fields are missing',
                        fields: missingFields
                    }
                });
            }
            
            if (error.message.includes('Invalid email address format')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_FORMAT',
                        message: 'Invalid email address format',
                        field: 'email'
                    }
                });
            }
            
            if (error.message.includes('Invalid role specified')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid role specified',
                        field: 'role',
                        validOptions: ['pharmacist', 'client', 'superuser']
                    }
                });
            }
            
            if (error.message.includes('Invalid gender value')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid gender value',
                        field: 'gender',
                        validOptions: ['male', 'female', 'other']
                    }
                });
            }
            
            if (error.message.includes('Invalid date of birth format')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_FORMAT',
                        message: 'Invalid date of birth format',
                        field: 'dateOfBirth',
                        expectedFormat: 'YYYY-MM-DD'
                    }
                });
            }
            
            if (error.message.includes('Date of birth cannot be in the future')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Date of birth cannot be in the future',
                        field: 'dateOfBirth'
                    }
                });
            }
            
            if (error.message.includes('Invalid phone number format')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_FORMAT',
                        message: 'Invalid phone number format',
                        field: 'phone',
                        expectedFormat: 'Vietnamese phone number format'
                    }
                });
            }
            
            if (error.message.includes('Password must be at least 8 characters long')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'PASSWORD_WEAK',
                        message: 'Password does not meet security requirements',
                        field: 'password',
                        requirements: ['Minimum 8 characters'],
                        currentLength: req.body.password?.length || 0
                    }
                });
            }
            
            if (error.message.includes('An account with this email already exists')) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'USER_EXISTS',
                        message: 'An account with this email already exists',
                        field: 'email'
                    }
                });
            }
            
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Registration process failed',
                    details: error.message
                }
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const clientIP = this.userAuthModel.getClientIP(req);

            if (!email || !password) {
                const missingFields = [];
                if (!email) missingFields.push('email');
                if (!password) missingFields.push('password');

                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'Login credentials are required',
                        fields: missingFields
                    }
                });
            }

            const result = await this.userAuthModel.login(email, password, clientIP);
            
            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;
            req.session.authTime = Date.now();

            res.json(result);
        } catch (error) {
            this.logger.error('Login error:', error);
            
            if (error.message.includes('Too many failed login attempts')) {
                const secondsRemaining = error.message.match(/(\d+)/)?.[1] || 0;
                return res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMITED',
                        message: 'Too many failed login attempts',
                        blocked: true,
                        secondsRemaining: parseInt(secondsRemaining),
                        retryAfter: parseInt(secondsRemaining)
                    }
                });
            }
            
            if (error.message.includes('Invalid login credentials')) {
                const remainingAttempts = error.message.match(/(\d+)/)?.[1] || 0;
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_FAILED',
                        message: 'Invalid login credentials',
                        remainingAttempts: parseInt(remainingAttempts),
                        blocked: false,
                        secondsRemaining: 0
                    }
                });
            }
            
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Login process failed',
                    details: error.message
                }
            });
        }
    }

    async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    this.logger.error('Logout error:', err);
                    return res.status(500).json({
                        success: false,
                        error: {
                            code: 'SERVER_ERROR',
                            message: 'Logout process failed',
                            details: err.message
                        }
                    });
                }
                res.json({
                    success: true,
                    message: 'Logout completed successfully'
                });
            });
        } catch (error) {
            this.logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Logout process failed',
                    details: error.message
                }
            });
        }
    }

    async changePassword(req, res) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHORIZATION_FAILED',
                        message: 'Authentication required to change password'
                    }
                });
            }

            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                const missingFields = [];
                if (!currentPassword) missingFields.push('currentPassword');
                if (!newPassword) missingFields.push('newPassword');

                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'Both current and new passwords are required',
                        fields: missingFields
                    }
                });
            }

            const result = await this.userAuthModel.changePassword(req.session.userId, currentPassword, newPassword);
            res.json(result);
        } catch (error) {
            this.logger.error('Change password error:', error);
            
            if (error.message.includes('Both current and new passwords are required')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_FIELDS',
                        message: 'Both current and new passwords are required'
                    }
                });
            }
            
            if (error.message.includes('New password must be at least 8 characters long')) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'PASSWORD_WEAK',
                        message: 'New password does not meet security requirements',
                        field: 'newPassword',
                        requirements: ['Minimum 8 characters'],
                        currentLength: req.body.newPassword?.length || 0
                    }
                });
            }
            
            if (error.message.includes('User account not found')) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User account not found'
                    }
                });
            }
            
            if (error.message.includes('Current password is incorrect')) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_FAILED',
                        message: 'Current password is incorrect',
                        field: 'currentPassword'
                    }
                });
            }
            
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Password change process failed',
                    details: error.message
                }
            });
        }
    }
}

module.exports = UserAuthController; 