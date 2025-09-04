const express = require('express');
const StaffController = require('../controllers/StaffController');
const Authenticator = require('../core/Authenticator');
const Logger = require('../core/Logger');

class StaffRoutes {
    constructor() {
        this.router = express.Router();
        this.staffController = new StaffController();
        this.authenticator = new Authenticator();
        this.logger = new Logger();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Logging middleware
        this.router.use(this.logger.logRequest.bind(this.logger));
        
        // Apply superuser authentication middleware to all routes
        this.router.use(this.authenticator.authenticateSuperuser.bind(this.authenticator));
    }

    setupRoutes() {
        // Staff management routes (all require superuser authentication)
        this.router.get('/list', 
            this.staffController.listStaff.bind(this.staffController)
        );
        this.router.post('/create-staff', 
            this.staffController.createStaff.bind(this.staffController)
        );
        this.router.put('/modify/:userId', 
            this.staffController.modifyStaff.bind(this.staffController)
        );
        this.router.delete('/delete/:userId', 
            this.staffController.deleteStaff.bind(this.staffController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = StaffRoutes; 