const express = require('express');
const session = require('express-session');
const cors = require('cors');
const Database = require('../core/Database');
const Logger = require('../core/Logger');
const pgSession = require('connect-pg-simple')(session);

class App {
    constructor() {
        this.app = express();
        this.db = new Database();
        this.logger = new Logger();
        this.port = process.env.PORT || 3000;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS configuration
        const corsOptions = {
            origin: /^http:\/\/localhost:\d+$/,
            credentials: true
        };
        this.app.use(cors(corsOptions));

        // Body parsing middleware
        this.app.use(express.json());

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

        // Initialize route instances
        const productRoutes = new ProductRoutes();
        const authRoutes = new AuthRoutes();
        const superuserRoutes = new SuperuserRoutes();
        const userAuthRoutes = new UserAuthRoutes();
        const staffRoutes = new StaffRoutes();

        // Mount routes
        this.app.use('/products', productRoutes.getRouter());
        this.app.use('/auth', authRoutes.getRouter());
        this.app.use('/auth/superuser', superuserRoutes.getRouter());
        this.app.use('/auth/user', userAuthRoutes.getRouter());
        this.app.use('/management/users', staffRoutes.getRouter());
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