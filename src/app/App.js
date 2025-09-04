const express = require('express');
const session = require('express-session');
const cors = require('cors');
const Database = require('../core/Database');
const Logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const pgSession = require('connect-pg-simple')(session);

class App {
    constructor() {
        this.app = express();
        this.db = new Database();
        this.logger = new Logger();
        this.errorHandler = new ErrorHandler();
        this.port = process.env.PORT || 3000;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // CORS configuration
        const corsOptions = {
            origin: /^http:\/\/localhost:\d+$/,
            credentials: true
        };
        this.app.use(cors(corsOptions));

        // Body parsing middleware with increased limits for file uploads
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Note: Specific error handling (JSON parsing, file limits) now handled by centralized ErrorHandler

        // Session configuration
        this.app.use(session({
            store: new pgSession({
                pool: this.db.getPool(),
                tableName: 'session'
            }),
            secret: process.env.SESSION_SECRET || 'your-session-secret',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false,
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000
            }
        }));
    }

    setupRoutes() {
        // Import route classes
        const ProductRoutes = require('../routes/ProductRoutes');
        const AuthRoutes = require('../routes/AuthRoutes');
        const SuperuserRoutes = require('../routes/SuperuserRoutes');
        const UserAuthRoutes = require('../routes/UserAuthRoutes');
        const StaffRoutes = require('../routes/StaffRoutes');
        const OrderRoutes = require('../routes/OrderRoutes');
        const PrescriptionRoutes = require('../routes/PrescriptionRoutes');
        const CartRoutes = require('../routes/CartRoutes');
        
        // Initialize route instances
        const productRoutes = new ProductRoutes();
        const authRoutes = new AuthRoutes();
        const superuserRoutes = new SuperuserRoutes();
        const userAuthRoutes = new UserAuthRoutes();
        const staffRoutes = new StaffRoutes();
        const orderRoutes = new OrderRoutes();
        const prescriptionRoutes = new PrescriptionRoutes();
        const cartRoutes = new CartRoutes();

        // Mount routes
        this.app.use('/products', productRoutes.getRouter());
        this.app.use('/auth', authRoutes.getRouter());
        this.app.use('/auth/superuser', superuserRoutes.getRouter());
        this.app.use('/auth/user', userAuthRoutes.getRouter());
        this.app.use('/management/users', staffRoutes.getRouter());
        this.app.use('/orders', orderRoutes.getRouter());
        this.app.use('/prescriptions', prescriptionRoutes.getRouter());
        this.app.use('/cart', cartRoutes.getRouter());
    }

    setupErrorHandling() {
        // Handle 404 errors (route not found) - must be after routes
        this.app.use(this.errorHandler.getNotFoundMiddleware());
        
        // Global error handler - must be last middleware
        this.app.use(this.errorHandler.getMiddleware());
    }

    start() {
        this.app.listen(this.port, () => {
            this.logger.info(`Server running on http://localhost:${this.port}`);
        });
    }

    getApp() {
        return this.app;
    }
}

module.exports = App; 