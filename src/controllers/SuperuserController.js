const Superuser = require('../models/Superuser');
const Logger = require('../core/Logger');
const {
    ValidationError,
    AuthenticationError,
    BusinessLogicError
} = require('../core/errors');

class SuperuserController {
    constructor() {
        this.superuserModel = new Superuser();
        this.logger = new Logger();
    }

    async checkEmail(req, res, next) {
        try {
            const { email } = req.body;
            
            if (!email) {
                throw ValidationError.missingFields(['email']);
            }
            
            const result = await this.superuserModel.checkEmail(email);
            res.json(result);
        } catch (error) {
            this.logger.error('Email check error:', error);
            next(error);
        }
    }

    async getSession(req, res, next) {
        try {
            if (req.session.authenticated && req.session.userId) {
                const sessionInfo = await this.superuserModel.getSessionInfo(req.session.userId);
                res.json(sessionInfo);
            } else {
                res.json({ authenticated: false });
            }
        } catch (error) {
            this.logger.error('Session check error:', error);
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
                message: 'Logged out successfully'
            });
        } catch (error) {
            this.logger.error('Logout error:', error);
            next(error);
        }
    }

    async generateRegistrationChallenge(req, res, next) {
        try {
            const { email, fullName } = req.body;
            
            if (!email || !fullName) {
                const missingFields = [];
                if (!email) missingFields.push('email');
                if (!fullName) missingFields.push('fullName');
                throw ValidationError.missingFields(missingFields);
            }

            const result = await this.superuserModel.generateRegistrationChallenge(email, fullName);
            
            // Store challenge in session for verification
            req.session.registrationChallenge = result.challenge;
            req.session.pendingUserId = result.user.id;
            req.session.challengeTimestamp = Date.now();
            
            res.json(result);
        } catch (error) {
            this.logger.error('Registration challenge error:', error);
            next(error);
        }
    }

    async register(req, res, next) {
        try {
            const { id, rawId, response, userInfo } = req.body;
            
            if (!id || !rawId || !response || !userInfo || !req.session.registrationChallenge || !req.session.pendingUserId) {
                const missingFields = [];
                if (!id) missingFields.push('id');
                if (!rawId) missingFields.push('rawId');
                if (!response) missingFields.push('response');
                if (!userInfo) missingFields.push('userInfo');
                if (!req.session.registrationChallenge) missingFields.push('session challenge');
                throw ValidationError.missingFields(missingFields);
            }

            if (Date.now() - req.session.challengeTimestamp > 300000) {
                delete req.session.registrationChallenge;
                delete req.session.challengeTimestamp;
                throw AuthenticationError.challengeExpired();
            }

            const result = await this.superuserModel.verifyRegistration(
                { id, rawId, response, userInfo },
                req.session.registrationChallenge
            );

            // Clear session data
            delete req.session.registrationChallenge;
            delete req.session.pendingUserId;
            delete req.session.challengeTimestamp;
            
            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;

            res.json(result);
        } catch (error) {
            this.logger.error('Registration error:', error);
            next(error);
        }
    }

    async generateAuthenticationChallenge(req, res, next) {
        try {
            const result = await this.superuserModel.generateAuthenticationChallenge();
            
            // Store challenge for verification later
            req.session.authChallenge = result.challenge;
            req.session.challengeTimestamp = Date.now();
            
            res.json(result);
        } catch (error) {
            this.logger.error('Login challenge error:', error);
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { id, response } = req.body;
            
            if (!id || !response || !req.session.authChallenge) {
                const missingFields = [];
                if (!id) missingFields.push('id');
                if (!response) missingFields.push('response');
                if (!req.session.authChallenge) missingFields.push('session challenge');
                throw ValidationError.missingFields(missingFields);
            }

            if (Date.now() - req.session.challengeTimestamp > 300000) {
                delete req.session.authChallenge;
                delete req.session.challengeTimestamp;
                throw AuthenticationError.challengeExpired();
            }

            const result = await this.superuserModel.verifyAuthentication(
                { id, response },
                req.session.authChallenge
            );

            // Create session
            req.session.authenticated = true;
            req.session.userId = result.user.id;
            req.session.authTime = Date.now();

            // Clear challenge
            delete req.session.authChallenge;
            delete req.session.challengeTimestamp;

            res.json(result);
        } catch (error) {
            this.logger.error('Authentication error:', error);
            next(error);
        }
    }
}

module.exports = SuperuserController; 