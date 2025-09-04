const express = require('express');
const SuperuserController = require('../controllers/SuperuserController');
const Logger = require('../core/Logger');

class SuperuserRoutes {
    constructor() {
        this.router = express.Router();
        this.superuserController = new SuperuserController();
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
            this.superuserController.checkEmail.bind(this.superuserController)
        );
        
        // Session management
        this.router.get('/session', 
            this.superuserController.getSession.bind(this.superuserController)
        );
        this.router.post('/logout', 
            this.superuserController.logout.bind(this.superuserController)
        );
        
        // WebAuthn registration
        this.router.post('/register-challenge', 
            this.superuserController.generateRegistrationChallenge.bind(this.superuserController)
        );
        this.router.post('/register', 
            this.superuserController.register.bind(this.superuserController)
        );
        
        // WebAuthn authentication
        this.router.post('/login-challenge', 
            this.superuserController.generateAuthenticationChallenge.bind(this.superuserController)
        );
        this.router.post('/login', 
            this.superuserController.login.bind(this.superuserController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = SuperuserRoutes; 