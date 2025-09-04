const express = require('express');
const CartController = require('../controllers/CartController');
const Authenticator = require('../core/Authenticator');
const TimeoutMiddleware = require('../middleware/timeoutMiddleware');

class CartRoutes {
    constructor() {
        this.router = express.Router();
        this.cartController = new CartController();
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
        // All cart routes require authentication
        
        // Get current cart
        this.router.get('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.getCart.bind(this.cartController)
        );

        // Add item to cart
        this.router.post('/add', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.addToCart.bind(this.cartController)
        );

        // Update cart item quantity
        this.router.put('/items/:productId', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.updateCartItem.bind(this.cartController)
        );

        // Remove item from cart
        this.router.delete('/items/:productId', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.removeFromCart.bind(this.cartController)
        );

        // Clear entire cart
        this.router.delete('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.clearCart.bind(this.cartController)
        );

        // Sync cart with local storage (for when user logs in)
        this.router.post('/sync', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.cartController.syncCartWithLocalStorage.bind(this.cartController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = CartRoutes;