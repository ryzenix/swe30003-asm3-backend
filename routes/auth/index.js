const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});



router.get('/session', async (req, res) => {
    try {
        if (req.session.authenticated && req.session.userId) {
            const { rows: superusers } = await pool.query(
                'SELECT user_id, email, full_name FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: users } = await pool.query(
                'SELECT user_id, email, full_name, role, phone, gender, date_of_birth FROM users WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            if (superusers.length) {
                res.json({
                    authenticated: true,
                    user: {
                        id: superusers[0].user_id,
                        email: superusers[0].email,
                        fullName: superusers[0].full_name,
                        role: 'superuser', // default for superusers table
                        phone: null,
                        authTime: req.session.authTime ? new Date(req.session.authTime).toISOString() : null
                    }
                });

            } else if (users.length) {
                res.json({
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
                });

            } else {
                return res.json({
                    authenticated: false
                });
            }

        } else {
            res.json({
                authenticated: false
            });
        }
    } catch (error) {
        console.error('Session check error:', error);
        res.status(500).json({
            error: 'Failed to check session: ' + error.message
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({
                    error: 'Failed to logout'
                });
            }
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Failed to logout: ' + error.message
        });
    }
});

module.exports = router;