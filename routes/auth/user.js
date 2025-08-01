const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const {
    v4: uuidv4
} = require('uuid');
const pool = require('../../config/db');

// Standardized error response structure
const createErrorResponse = (code, message, details = {}) => {
    return {
        success: false,
        error: {
            code,
            message,
            ...details
        }
    };
};

// Standardized success response structure
const createSuccessResponse = (message, data = {}) => {
    return {
        success: true,
        message,
        ...data
    };
};

// Error codes enum for consistency
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_EXISTS: 'USER_EXISTS',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVER_ERROR: 'SERVER_ERROR',
    MISSING_FIELDS: 'MISSING_FIELDS',
    INVALID_FORMAT: 'INVALID_FORMAT',
    PASSWORD_WEAK: 'PASSWORD_WEAK',
    ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED'
};

router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
        req.ip;
};

// Helper function to check if IP is blocked
const isIPBlocked = async (ip) => {
    try {
        const {
            rows
        } = await pool.query(
            'SELECT blocked_until FROM login_attempts WHERE ip_address = $1 AND blocked_until > NOW()',
            [ip]
        );
        return rows.length > 0 ? rows[0].blocked_until : null;
    } catch (error) {
        console.error('Error checking IP block:', error);
        return null;
    }
};

// Helper function to record login attempt
const recordLoginAttempt = async (ip, email, success) => {
    try {
        if (success) {
            // Clear failed attempts on successful login
            await pool.query(
                'DELETE FROM login_attempts WHERE ip_address = $1 OR email = $2',
                [ip, email]
            );
        } else {
            // Record failed attempt
            await pool.query(`
                INSERT INTO login_attempts (ip_address, email, attempt_time, success)
                VALUES ($1, $2, NOW(), FALSE)
                ON CONFLICT (ip_address, email) 
                DO UPDATE SET 
                    attempt_count = login_attempts.attempt_count + 1,
                    last_attempt = NOW(),
                    blocked_until = CASE 
                        WHEN login_attempts.attempt_count + 1 >= 5 
                        THEN NOW() + INTERVAL '5 minutes'
                        ELSE NULL
                    END
            `, [ip, email]);
        }
    } catch (error) {
        console.error('Error recording login attempt:', error);
    }
};

// Helper function to get remaining attempts
const getRemainingAttempts = async (ip, email) => {
    try {
        const {
            rows
        } = await pool.query(`
            SELECT 
                attempt_count,
                blocked_until,
                EXTRACT(EPOCH FROM (blocked_until - NOW()))::INTEGER as seconds_remaining
            FROM login_attempts 
            WHERE ip_address = $1 OR email = $2
            ORDER BY last_attempt DESC 
            LIMIT 1
        `, [ip, email]);

        if (rows.length === 0) return {
            remaining: 5,
            blocked: false,
            secondsRemaining: 0
        };

        const attempt = rows[0];
        const remaining = Math.max(0, 5 - attempt.attempt_count);
        const blocked = attempt.blocked_until && new Date(attempt.blocked_until) > new Date();

        return {
            remaining,
            blocked,
            secondsRemaining: blocked ? Math.max(0, attempt.seconds_remaining) : 0
        };
    } catch (error) {
        console.error('Error getting remaining attempts:', error);
        return {
            remaining: 5,
            blocked: false,
            secondsRemaining: 0
        };
    }
};

// Check if email exists
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.MISSING_FIELDS,
                    'Email is required',
                    { field: 'email' }
                )
            );
        }

        const {
            rows: existingUsers
        } = await pool.query(
            'SELECT COUNT(*) AS count FROM users WHERE email = $1',
            [email]
        );

        res.json(createSuccessResponse('Email check completed', {
            data: { exists: existingUsers[0].count > 0 }
        }));
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json(
            createErrorResponse(
                ERROR_CODES.SERVER_ERROR,
                'Failed to check email availability',
                { details: error.message }
            )
        );
    }
});

// User registration
router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            fullName,
            role,
            phone,
            dateOfBirth,
            gender
        } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!password) missingFields.push('password');
        if (!fullName) missingFields.push('fullName');
        if (!role) missingFields.push('role');

        if (missingFields.length > 0) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.MISSING_FIELDS,
                    'Required fields are missing',
                    { fields: missingFields }
                )
            );
        }

        // Validate gender if provided
        if (gender && !['male', 'female', 'other'].includes(gender)) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Invalid gender value',
                    { field: 'gender', validOptions: ['male', 'female', 'other'] }
                )
            );
        }

        // Validate date of birth if provided
        if (dateOfBirth) {
            const dobDate = new Date(dateOfBirth);
            const today = new Date();
            const age = today.getFullYear() - dobDate.getFullYear();
            const monthDiff = today.getMonth() - dobDate.getMonth();
            
            if (isNaN(dobDate.getTime())) {
                return res.status(400).json(
                    createErrorResponse(
                        ERROR_CODES.INVALID_FORMAT,
                        'Invalid date of birth format',
                        { field: 'dateOfBirth', expectedFormat: 'YYYY-MM-DD' }
                    )
                );
            }
            
            if (age < 0 || (age === 0 && monthDiff < 0) || (age === 0 && monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                return res.status(400).json(
                    createErrorResponse(
                        ERROR_CODES.VALIDATION_ERROR,
                        'Date of birth cannot be in the future',
                        { field: 'dateOfBirth' }
                    )
                );
            }
            
            if (age > 120) {
                return res.status(400).json(
                    createErrorResponse(
                        ERROR_CODES.VALIDATION_ERROR,
                        'Date of birth seems invalid (age too high)',
                        { field: 'dateOfBirth', maxAge: 120 }
                    )
                );
            }
        }

        // Validate phone format
        const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.INVALID_FORMAT,
                    'Invalid phone number format',
                    { field: 'phone', expectedFormat: 'Vietnamese phone number format' }
                )
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.INVALID_FORMAT,
                    'Invalid email address format',
                    { field: 'email' }
                )
            );
        }

        // Validate role
        const validRoles = ['pharmacist', 'client', 'superuser'];
        if (!validRoles.includes(role)) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.VALIDATION_ERROR,
                    'Invalid role specified',
                    { field: 'role', validOptions: validRoles }
                )
            );
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.PASSWORD_WEAK,
                    'Password does not meet security requirements',
                    { 
                        field: 'password',
                        requirements: ['Minimum 8 characters'],
                        currentLength: password.length
                    }
                )
            );
        }

        // Check if email already exists
        const {
            rows: existingUsers
        } = await pool.query(
            'SELECT COUNT(*) AS count FROM users WHERE email = $1',
            [email]
        );

        if (existingUsers[0].count > 0) {
            return res.status(409).json(
                createErrorResponse(
                    ERROR_CODES.USER_EXISTS,
                    'An account with this email already exists',
                    { field: 'email' }
                )
            );
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Generate user ID
        const userId = uuidv4();

        // Insert user into database
        await pool.query(
            'INSERT INTO users (user_id, email, full_name, role, phone, is_active, gender, date_of_birth) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)',
            [userId, email, fullName, role, phone, gender || null, dateOfBirth || null]
        );

        // Store hashed password in a separate table
        await pool.query(
            'INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)',
            [userId, hashedPassword]
        );

        // Create session
        req.session.authenticated = true;
        req.session.userId = userId;
        req.session.authTime = Date.now();

        console.log(`User registered: ${email} (ID: ${userId}) with role: ${role}`);

        res.status(201).json(createSuccessResponse('Registration completed successfully', {
            user: {
                id: userId,
                email,
                fullName,
                role,
                phone,
                gender: gender || null,
                dateOfBirth: dateOfBirth || null,
                authTime: new Date(req.session.authTime).toISOString()
            }
        }));
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json(
            createErrorResponse(
                ERROR_CODES.SERVER_ERROR,
                'Registration process failed',
                { details: error.message }
            )
        );
    }
});

// User login
router.post('/login', async (req, res) => {
    const clientIP = getClientIP(req);

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const missingFields = [];
            if (!email) missingFields.push('email');
            if (!password) missingFields.push('password');

            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.MISSING_FIELDS,
                    'Login credentials are required',
                    { fields: missingFields }
                )
            );
        }

        // Check if IP is currently blocked
        const blockedUntil = await isIPBlocked(clientIP);
        if (blockedUntil) {
            const secondsRemaining = Math.ceil((new Date(blockedUntil) - new Date()) / 1000);
            return res.status(429).json(
                createErrorResponse(
                    ERROR_CODES.RATE_LIMITED,
                    'Too many failed login attempts',
                    {
                        blocked: true,
                        secondsRemaining: Math.max(0, secondsRemaining),
                        blockedUntil: blockedUntil,
                        retryAfter: Math.max(0, secondsRemaining)
                    }
                )
            );
        }

        // Find user by email
        const {
            rows: users
        } = await pool.query(
            'SELECT user_id, email, full_name, role, phone, gender, date_of_birth FROM users WHERE email = $1 AND is_active = TRUE',
            [email]
        );

        if (users.length === 0) {
            await recordLoginAttempt(clientIP, email, false);
            const updatedAttemptInfo = await getRemainingAttempts(clientIP, email);

            return res.status(401).json(
                createErrorResponse(
                    ERROR_CODES.AUTHENTICATION_FAILED,
                    'Invalid login credentials',
                    {
                        remainingAttempts: updatedAttemptInfo.remaining,
                        blocked: updatedAttemptInfo.blocked,
                        secondsRemaining: updatedAttemptInfo.secondsRemaining
                    }
                )
            );
        }

        const user = users[0];

        // Get stored password hash
        const {
            rows: passwords
        } = await pool.query(
            'SELECT password_hash FROM user_passwords WHERE user_id = $1',
            [user.user_id]
        );

        if (passwords.length === 0) {
            await recordLoginAttempt(clientIP, email, false);
            const updatedAttemptInfo = await getRemainingAttempts(clientIP, email);

            return res.status(401).json(
                createErrorResponse(
                    ERROR_CODES.AUTHENTICATION_FAILED,
                    'Invalid login credentials',
                    {
                        remainingAttempts: updatedAttemptInfo.remaining,
                        blocked: updatedAttemptInfo.blocked,
                        secondsRemaining: updatedAttemptInfo.secondsRemaining
                    }
                )
            );
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, passwords[0].password_hash);

        if (!isValidPassword) {
            await recordLoginAttempt(clientIP, email, false);
            const updatedAttemptInfo = await getRemainingAttempts(clientIP, email);

            return res.status(401).json(
                createErrorResponse(
                    ERROR_CODES.AUTHENTICATION_FAILED,
                    'Invalid login credentials',
                    {
                        remainingAttempts: updatedAttemptInfo.remaining,
                        blocked: updatedAttemptInfo.blocked,
                        secondsRemaining: updatedAttemptInfo.secondsRemaining
                    }
                )
            );
        }

        // Login successful - clear failed attempts
        await recordLoginAttempt(clientIP, email, true);

        // Update last login time
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE user_id = $1',
            [user.user_id]
        );

        // Create session
        req.session.authenticated = true;
        req.session.userId = user.user_id;
        req.session.authTime = Date.now();

        console.log(`User authenticated: ${user.email} (ID: ${user.user_id}) with role: ${user.role}`);

        res.json(createSuccessResponse('Login successful', {
            user: {
                id: user.user_id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                phone: user.phone,
                gender: user.gender,
                dateOfBirth: user.date_of_birth,
                authTime: new Date(req.session.authTime).toISOString()
            }
        }));
    } catch (error) {
        console.error('Login error:', error);
        await recordLoginAttempt(clientIP, email || 'unknown', false);

        res.status(500).json(
            createErrorResponse(
                ERROR_CODES.SERVER_ERROR,
                'Login process failed',
                { details: error.message }
            )
        );
    }
});

// Logout
router.post('/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json(
                    createErrorResponse(
                        ERROR_CODES.SERVER_ERROR,
                        'Logout process failed',
                        { details: err.message }
                    )
                );
            }
            res.json(createSuccessResponse('Logout completed successfully'));
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json(
            createErrorResponse(
                ERROR_CODES.SERVER_ERROR,
                'Logout process failed',
                { details: error.message }
            )
        );
    }
});

// Change password
router.post('/change-password', async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.authenticated || !req.session.userId) {
            return res.status(401).json(
                createErrorResponse(
                    ERROR_CODES.AUTHORIZATION_FAILED,
                    'Authentication required to change password'
                )
            );
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            const missingFields = [];
            if (!currentPassword) missingFields.push('currentPassword');
            if (!newPassword) missingFields.push('newPassword');

            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.MISSING_FIELDS,
                    'Both current and new passwords are required',
                    { fields: missingFields }
                )
            );
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json(
                createErrorResponse(
                    ERROR_CODES.PASSWORD_WEAK,
                    'New password does not meet security requirements',
                    {
                        field: 'newPassword',
                        requirements: ['Minimum 8 characters'],
                        currentLength: newPassword.length
                    }
                )
            );
        }

        // Get current password hash
        const {
            rows: passwords
        } = await pool.query(
            'SELECT password_hash FROM user_passwords WHERE user_id = $1',
            [req.session.userId]
        );

        if (passwords.length === 0) {
            return res.status(404).json(
                createErrorResponse(
                    ERROR_CODES.USER_NOT_FOUND,
                    'User account not found'
                )
            );
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, passwords[0].password_hash);

        if (!isValidPassword) {
            return res.status(401).json(
                createErrorResponse(
                    ERROR_CODES.AUTHENTICATION_FAILED,
                    'Current password is incorrect',
                    { field: 'currentPassword' }
                )
            );
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await pool.query(
            'UPDATE user_passwords SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
            [hashedNewPassword, req.session.userId]
        );

        console.log(`Password changed for user ID: ${req.session.userId}`);

        res.json(createSuccessResponse('Password changed successfully'));
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json(
            createErrorResponse(
                ERROR_CODES.SERVER_ERROR,
                'Password change process failed',
                { details: error.message }
            )
        );
    }
});

module.exports = router;