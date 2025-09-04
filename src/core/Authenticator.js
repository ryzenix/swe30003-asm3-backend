const Database = require('./Database');
const Logger = require('./Logger');

class Authenticator {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
    }

    async authenticateSuperuserOrPharmacist(req, res, next) {
        try {
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('./errors');
                return next(AuthenticationError.sessionRequired());
            }

            // Check if user is a superuser
            const { rows: superuser } = await this.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            if (superuser.length > 0) {
                return next(); // Superuser access granted
            }

            // Check if user is a pharmacist
            const { rows: pharmacist } = await this.db.query(
                'SELECT user_id, role FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            if (pharmacist.length > 0) {
                return next(); // Pharmacist access granted
            }

            // User is neither superuser nor pharmacist
            const { AuthorizationError } = require('./errors');
            return next(AuthorizationError.insufficientPermissions('access this resource (superuser or pharmacist required)'));

        } catch (error) {
            this.logger.error('Authentication error:', error);
            next(error);
        }
    }

    async authenticateSuperuser(req, res, next) {
        try {
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('./errors');
                return next(AuthenticationError.sessionRequired());
            }

            const { rows: superuser } = await this.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            if (superuser.length === 0) {
                const { AuthorizationError } = require('./errors');
                return next(AuthorizationError.insufficientPermissions('access this resource (superuser required)'));
            }

            return next();

        } catch (error) {
            this.logger.error('Superuser authentication error:', error);
            next(error);
        }
    }

    async authenticateUser(req, res, next) {
        try {
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('./errors');
                return next(AuthenticationError.sessionRequired());
            }

            // Check if user exists in superusers table first
            const { rows: superuser } = await this.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            if (superuser.length > 0) {
                return next(); // Superuser access granted
            }

            // Check if user exists in regular users table
            const { rows: user } = await this.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            if (user.length === 0) {
                const { AuthorizationError } = require('./errors');
                return next(AuthorizationError.insufficientPermissions('access this resource (user not found or inactive)'));
            }

            return next();

        } catch (error) {
            this.logger.error('User authentication error:', error);
            next(error);
        }
    }

    async getSessionInfo(req, res) {
        try {
            if (req.session.authenticated && req.session.userId) {
                const { rows: superusers } = await this.db.query(
                    'SELECT user_id, email, full_name FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                    [req.session.userId]
                );

                const { rows: users } = await this.db.query(
                    'SELECT user_id, email, full_name, role, phone, gender, date_of_birth FROM users WHERE user_id = $1 AND is_active = TRUE',
                    [req.session.userId]
                );

                if (superusers.length) {
                    return {
                        authenticated: true,
                        user: {
                            id: superusers[0].user_id,
                            email: superusers[0].email,
                            fullName: superusers[0].full_name,
                            role: 'superuser',
                            phone: null,
                            authTime: req.session.authTime ? new Date(req.session.authTime).toISOString() : null
                        }
                    };
                } else if (users.length) {
                    return {
                        authenticated: true,
                        user: {
                            id: users[0].user_id,
                            email: users[0].email,
                            fullName: users[0].full_name,
                            role: users[0].role,
                            phone: users[0].phone,
                            gender: users[0].gender,
                            dateOfBirth: users[0].date_of_birth,
                            authTime: req.session.authTime ? new Date(req.session.authTime).toISOString() : null
                        }
                    };
                }
            }

            return { authenticated: false };

        } catch (error) {
            this.logger.error('Session check error:', error);
            throw error;
        }
    }

    logout(req) {
        return new Promise((resolve, reject) => {
            req.session.destroy((err) => {
                if (err) {
                    this.logger.error('Logout error:', err);
                    reject(new Error('Failed to logout'));
                } else {
                    resolve({
                        success: true,
                        message: 'Logged out successfully'
                    });
                }
            });
        });
    }
}

module.exports = Authenticator; 