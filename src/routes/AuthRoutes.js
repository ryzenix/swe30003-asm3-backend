const express = require('express');
const AuthController = require('../controllers/AuthController');
const Logger = require('../core/Logger');

class AuthRoutes {
    constructor() {
        this.router = express.Router();
        this.authController = new AuthController();
        this.logger = new Logger();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Logging middleware
        this.router.use(this.logger.logRequest.bind(this.logger));
    }

    setupRoutes() {
        // Session management routes
        this.router.get('/session', 
            this.authController.getSession.bind(this.authController)
        );
        this.router.post('/logout', 
            this.authController.logout.bind(this.authController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AuthRoutes; 