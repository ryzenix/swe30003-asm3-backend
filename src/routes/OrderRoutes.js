const express = require('express');
const multer = require('multer');
const OrderController = require('../controllers/OrderController');
const Authenticator = require('../core/Authenticator');
const TimeoutMiddleware = require('../middleware/timeoutMiddleware');

class OrderRoutes {
    constructor() {
        this.router = express.Router();
        this.orderController = new OrderController();
        this.authenticator = new Authenticator();
        this.timeoutMiddleware = new TimeoutMiddleware();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Apply timeout middleware to all routes
        this.router.use(this.timeoutMiddleware.apiTimeout());
        
        // Parse JSON bodies
        this.router.use(express.json({ limit: '10mb' }));
        this.router.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    setupRoutes() {
        // Public routes (require authentication but accessible to all authenticated users)
        
        // Create new order
        this.router.post('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.orderController.createOrder.bind(this.orderController)
        );

        // Get user's order summary
        this.router.get('/summary', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.orderController.getUserOrderSummary.bind(this.orderController)
        );

        // List orders (filtered by user for regular users, all orders for superuser/pharmacist)
        this.router.get('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.orderController.listOrders.bind(this.orderController)
        );

        // Get specific order by ID
        this.router.get('/:id', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.orderController.getOrder.bind(this.orderController)
        );

        // Cancel order (only order owner can cancel)
        this.router.post('/:id/cancel', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.orderController.cancelOrder.bind(this.orderController)
        );

        // Protected routes (require superuser or pharmacist role)
        
        // Update order status (only superuser/pharmacist)
        this.router.patch('/:id/status', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.orderController.updateOrderStatus.bind(this.orderController)
        );

        // Get order statistics (only superuser/pharmacist)
        this.router.get('/admin/statistics', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.orderController.getOrderStatistics.bind(this.orderController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = OrderRoutes;