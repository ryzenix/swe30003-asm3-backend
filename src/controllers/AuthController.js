const Authenticator = require('../core/Authenticator');
const Logger = require('../core/Logger');

class AuthController {
    constructor() {
        this.authenticator = new Authenticator();
        this.logger = new Logger();
    }

    async getSession(req, res) {
        try {
            const sessionInfo = await this.authenticator.getSessionInfo(req, res);
            res.json(sessionInfo);
        } catch (error) {
            this.logger.error('Session check error:', error);
            res.status(500).json({
                error: 'Failed to check session: ' + error.message
            });
        }
    }

    async logout(req, res) {
        try {
            const result = this.authenticator.logout(req, res);
            res.json(result);
        } catch (error) {
            this.logger.error('Logout error:', error);
            res.status(500).json({
                error: 'Failed to logout: ' + error.message
            });
        }
    }
}

module.exports = AuthController; 