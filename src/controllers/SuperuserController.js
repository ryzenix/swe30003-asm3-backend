const Superuser = require('../models/Superuser');
const Logger = require('../core/Logger');

class SuperuserController {
    constructor() {
        this.superuserModel = new Superuser();
        this.logger = new Logger();
    }

    async checkEmail(req, res) {
        try {
            const { email } = req.body;
            const result = await this.superuserModel.checkEmail(email);
            res.json(result);
        } catch (error) {
            this.logger.error('Email check error:', error);
            res.status(500).json({
                error: 'Failed to check email: ' + error.message
            });
        }
    }

    async getSession(req, res) {
        try {
            if (req.session.authenticated && req.session.userId) {
                const sessionInfo = await this.superuserModel.getSessionInfo(req.session.userId);
                res.json(sessionInfo);
            } else {
                res.json({ authenticated: false });
            }
        } catch (error) {
            this.logger.error('Session check error:', error);
            res.status(500).json({
                error: 'Failed to check session: ' + error.message
            });
        }
    }

    async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    this.logger.error('Logout error:', err);
                    return res.status(500).json({
                        error: 'Failed to logout'
                    });
                }
                res.json({
                    success: true,
                    message: 'Logged out successfully'
                });
            });
        } catch (error) {
            this.logger.error('Logout error:', error);
            res.status(500).json({
                error: 'Failed to logout: ' + error.message
            });
        }
    }

    async generateRegistrationChallenge(req, res) {
        try {
            const { email, fullName } = req.body;
            
            if (!email || !fullName) {
                return res.status(400).json({
                    error: 'Missing email or fullName'
                });
            }

            const result = await this.superuserModel.generateRegistrationChallenge(email, fullName);
            
            // Store challenge in session for verification
            req.session.registrationChallenge = result.challenge;
            req.session.pendingUserId = result.user.id;
            req.session.challengeTimestamp = Date.now();
            
            res.json(result);
        } catch (error) {
            this.logger.error('Registration challenge error:', error);
            res.status(500).json({
                error: 'Failed to generate registration challenge: ' + error.message
            });
        }
    }

    async register(req, res) {
        try {
            const { id, rawId, response, userInfo } = req.body;
            
            if (!id || !rawId || !response || !userInfo || !req.session.registrationChallenge || !req.session.pendingUserId) {
                return res.status(400).json({
                    error: 'Missing required data or session challenge'
                });
            }

            if (Date.now() - req.session.challengeTimestamp > 300000) {
                delete req.session.registrationChallenge;
                delete req.session.challengeTimestamp;
                return res.status(400).json({
                    error: 'Challenge expired'
                });
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
            res.status(500).json({
                error: 'Registration failed: ' + error.message
            });
        }
    }

    async generateAuthenticationChallenge(req, res) {
        try {
            const result = await this.superuserModel.generateAuthenticationChallenge();
            
            // Store challenge for verification later
            req.session.authChallenge = result.challenge;
            req.session.challengeTimestamp = Date.now();
            
            res.json(result);
        } catch (error) {
            this.logger.error('Login challenge error:', error);
            res.status(500).json({
                error: 'Failed to generate login challenge: ' + error.message
            });
        }
    }

    async login(req, res) {
        try {
            const { id, response } = req.body;
            
            if (!id || !response || !req.session.authChallenge) {
                return res.status(400).json({
                    error: 'Missing required data or session challenge'
                });
            }

            if (Date.now() - req.session.challengeTimestamp > 300000) {
                delete req.session.authChallenge;
                delete req.session.challengeTimestamp;
                return res.status(400).json({
                    error: 'Challenge expired'
                });
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
            res.status(500).json({
                error: 'Authentication failed: ' + error.message
            });
        }
    }
}

module.exports = SuperuserController; 