const express = require('express');
const UserAuthController = require('../controllers/UserAuthController');
const Logger = require('../core/Logger');

class UserAuthRoutes {
    constructor() {
        this.router = express.Router();
        this.userAuthController = new UserAuthController();
        this.logger = new Logger();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Logging middleware
        this.router.use(this.logger.logRequest.bind(this.logger));
    }

    setupRoutes() {
        // Email check
        this.router.post('/check-email', 
            this.userAuthController.checkEmail.bind(this.userAuthController)
        );
        
        // User registration and authentication
        this.router.post('/register', 
            this.userAuthController.register.bind(this.userAuthController)
        );
        this.router.post('/login', 
            this.userAuthController.login.bind(this.userAuthController)
        );
        this.router.post('/logout', 
            this.userAuthController.logout.bind(this.userAuthController)
        );
        
        // Password management
        this.router.post('/change-password', 
            this.userAuthController.changePassword.bind(this.userAuthController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = UserAuthRoutes; 