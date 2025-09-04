const Authenticator = require('../core/Authenticator');
const Logger = require('../core/Logger');

class AuthController {
    constructor() {
        this.authenticator = new Authenticator();
        this.logger = new Logger();
    }

    async getSession(req, res, next) {
        try {
            const sessionInfo = await this.authenticator.getSessionInfo(req, res);
            res.json(sessionInfo);
        } catch (error) {
            this.logger.error('Session check error:', error);
            next(error);
        }
    }

    async logout(req, res, next) {
        try {
            const result = await this.authenticator.logout(req);
            res.json(result);
        } catch (error) {
            this.logger.error('Logout error:', error);
            next(error);
        }
    }
}

module.exports = AuthController; 