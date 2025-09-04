const UserAuth = require('../models/UserAuth');
const Logger = require('../core/Logger');

class UserAuthController {
    constructor() {
        this.userAuthModel = new UserAuth();
        this.logger = new Logger();
    }

    async checkEmail(req, res, next) {
        try {
            const { email } = req.body;
            const result = await this.userAuthModel.checkEmail(email);
            res.json(result);
        } catch (error) {
            this.logger.error('Email check error:', error);
            next(error);
        }
    }

    async register(req, res, next) {
        try {
            const result = await this.userAuthModel.register(req.body);
            
            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;
            req.session.authTime = Date.now();

            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Registration error:', error);
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const clientIP = this.userAuthModel.getClientIP(req);

            const result = await this.userAuthModel.login(email, password, clientIP);
            
            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;
            req.session.authTime = Date.now();

            res.json(result);
        } catch (error) {
            this.logger.error('Login error:', error);
            next(error);
        }
    }

    async logout(req, res, next) {
        try {
            // Use Promise to properly handle async session destruction
            await new Promise((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        this.logger.error('Logout error:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            res.json({
                success: true,
                message: 'Logout completed successfully'
            });
        } catch (error) {
            this.logger.error('Logout error:', error);
            next(error);
        }
    }

    async changePassword(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { currentPassword, newPassword } = req.body;
            const result = await this.userAuthModel.changePassword(req.session.userId, currentPassword, newPassword);
            res.json(result);
        } catch (error) {
            this.logger.error('Change password error:', error);
            next(error);
        }
    }
}

module.exports = UserAuthController; 