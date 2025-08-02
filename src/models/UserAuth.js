const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class UserAuth {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    getClientIP(req) {
        return req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
            req.ip;
    }

    async isIPBlocked(ip) {
        try {
            const { rows } = await this.db.query(
                'SELECT blocked_until FROM login_attempts WHERE ip_address = $1 AND blocked_until > NOW()',
                [ip]
            );
            return rows.length > 0 ? rows[0].blocked_until : null;
        } catch (error) {
            this.logger.error('Error checking IP block:', error);
            return null;
        }
    }

    async recordLoginAttempt(ip, email, success) {
        try {
            if (success) {
                // Clear failed attempts on successful login
                await this.db.query(
                    'DELETE FROM login_attempts WHERE ip_address = $1 OR email = $2',
                    [ip, email]
                );
            } else {
                // Record failed attempt
                await this.db.query(`
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
            this.logger.error('Error recording login attempt:', error);
        }
    }

    async getRemainingAttempts(ip, email) {
        try {
            const { rows } = await this.db.query(`
                SELECT 
                    attempt_count,
                    blocked_until,
                    CASE 
                        WHEN blocked_until IS NOT NULL AND blocked_until > NOW() 
                        THEN EXTRACT(EPOCH FROM (blocked_until - NOW()))::INTEGER
                        ELSE 0
                    END as seconds_remaining
                FROM login_attempts 
                WHERE (ip_address = $1 OR email = $2)
                    AND (blocked_until IS NULL OR blocked_until > NOW() - INTERVAL '1 hour')
                ORDER BY last_attempt DESC 
                LIMIT 1
            `, [ip, email]);

            if (rows.length === 0) {
                return {
                    remaining: 5,
                    blocked: false,
                    secondsRemaining: 0
                };
            }

            const attempt = rows[0];
            const remaining = Math.max(0, 5 - attempt.attempt_count);
            const blocked = attempt.blocked_until && new Date(attempt.blocked_until) > new Date();
            const secondsRemaining = blocked ? Math.max(0, attempt.seconds_remaining || 0) : 0;

            return {
                remaining,
                blocked,
                secondsRemaining
            };
        } catch (error) {
            this.logger.error('Error getting remaining attempts:', error);
            return {
                remaining: 5,
                blocked: false,
                secondsRemaining: 0
            };
        }
    }

    async checkEmail(email) {
        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM users WHERE email = $1',
                [email]
            );

            return {
                exists: existingUsers[0].count > 0
            };
        } catch (error) {
            this.logger.error('Email check error:', error);
            throw error;
        }
    }

    async register(userData) {
        try {
            this.validator.clearErrors();

            const { email, password, fullName, role, phone, dateOfBirth, gender } = userData;

            // Validate required fields
            const requiredFields = ['email', 'password', 'fullName', 'role'];
            if (!this.validator.validateRequired(userData, requiredFields)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate email format
            if (!this.validator.validateEmail('email', email)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate role
            const validRoles = ['pharmacist', 'client', 'superuser'];
            if (!this.validator.validateEnum('role', role, validRoles)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate gender if provided
            if (gender && !['male', 'female', 'other'].includes(gender)) {
                throw new Error('Invalid gender value. Must be male, female, or other');
            }

            // Validate date of birth if provided
            if (dateOfBirth) {
                const dobDate = new Date(dateOfBirth);
                const today = new Date();
                const age = today.getFullYear() - dobDate.getFullYear();
                const monthDiff = today.getMonth() - dobDate.getMonth();
                
                if (isNaN(dobDate.getTime())) {
                    throw new Error('Invalid date of birth format. Use YYYY-MM-DD');
                }
                
                if (age < 0 || (age === 0 && monthDiff < 0) || (age === 0 && monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                    throw new Error('Date of birth cannot be in the future');
                }
                
                if (age > 120) {
                    throw new Error('Date of birth seems invalid (age too high)');
                }
            }

            // Validate phone format
            const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
            if (!phoneRegex.test(phone)) {
                throw new Error('Invalid phone number format. Expected Vietnamese phone number format');
            }

            // Validate password strength
            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Check if email already exists
            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM users WHERE email = $1',
                [email]
            );

            if (existingUsers[0].count > 0) {
                throw new Error('An account with this email already exists');
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Generate user ID
            const userId = uuidv4();

            // Insert user into database
            await this.db.query(
                'INSERT INTO users (user_id, email, full_name, role, phone, is_active, gender, date_of_birth) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)',
                [userId, email, fullName, role, phone, gender || null, dateOfBirth || null]
            );

            // Store hashed password in a separate table
            await this.db.query(
                'INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)',
                [userId, hashedPassword]
            );

            this.logger.info(`User registered: ${email} (ID: ${userId}) with role: ${role}`);

            return {
                success: true,
                message: 'Registration completed successfully',
                user: {
                    id: userId,
                    email,
                    fullName,
                    role,
                    phone,
                    gender: gender || null,
                    dateOfBirth: dateOfBirth || null
                }
            };
        } catch (error) {
            this.logger.error('Registration error:', error);
            throw error;
        }
    }

    async login(email, password, clientIP) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            // Check if IP is currently blocked
            const blockedUntil = await this.isIPBlocked(clientIP);
            if (blockedUntil) {
                const { rows } = await this.db.query(`
                    SELECT EXTRACT(EPOCH FROM (blocked_until - NOW()))::INTEGER as seconds_remaining
                    FROM login_attempts 
                    WHERE ip_address = $1 AND blocked_until > NOW()
                    LIMIT 1
                `, [clientIP]);
                
                const secondsRemaining = rows.length > 0 ? Math.max(0, rows[0].seconds_remaining || 0) : 0;
                
                throw new Error(`Too many failed login attempts. Try again in ${secondsRemaining} seconds.`);
            }

            // Find user by email
            const { rows: users } = await this.db.query(
                'SELECT user_id, email, full_name, role, phone, gender, date_of_birth FROM users WHERE email = $1 AND is_active = TRUE',
                [email]
            );

            if (users.length === 0) {
                await this.recordLoginAttempt(clientIP, email, false);
                const updatedAttemptInfo = await this.getRemainingAttempts(clientIP, email);
                throw new Error(`Invalid login credentials. ${updatedAttemptInfo.remaining} attempts remaining.`);
            }

            const user = users[0];

            // Get stored password hash
            const { rows: passwords } = await this.db.query(
                'SELECT password_hash FROM user_passwords WHERE user_id = $1',
                [user.user_id]
            );

            if (passwords.length === 0) {
                await this.recordLoginAttempt(clientIP, email, false);
                const updatedAttemptInfo = await this.getRemainingAttempts(clientIP, email);
                throw new Error(`Invalid login credentials. ${updatedAttemptInfo.remaining} attempts remaining.`);
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, passwords[0].password_hash);

            if (!isValidPassword) {
                await this.recordLoginAttempt(clientIP, email, false);
                const updatedAttemptInfo = await this.getRemainingAttempts(clientIP, email);
                throw new Error(`Invalid login credentials. ${updatedAttemptInfo.remaining} attempts remaining.`);
            }

            // Login successful - clear failed attempts
            await this.recordLoginAttempt(clientIP, email, true);

            // Update last login time
            await this.db.query(
                'UPDATE users SET last_login = NOW() WHERE user_id = $1',
                [user.user_id]
            );

            this.logger.info(`User authenticated: ${user.email} (ID: ${user.user_id}) with role: ${user.role}`);

            return {
                success: true,
                message: 'Login successful',
                user: {
                    id: user.user_id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone,
                    gender: user.gender,
                    dateOfBirth: user.date_of_birth
                }
            };
        } catch (error) {
            this.logger.error('Login error:', error);
            throw error;
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        try {
            if (!currentPassword || !newPassword) {
                throw new Error('Both current and new passwords are required');
            }

            // Validate new password strength
            if (newPassword.length < 8) {
                throw new Error('New password must be at least 8 characters long');
            }

            // Get current password hash
            const { rows: passwords } = await this.db.query(
                'SELECT password_hash FROM user_passwords WHERE user_id = $1',
                [userId]
            );

            if (passwords.length === 0) {
                throw new Error('User account not found');
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, passwords[0].password_hash);

            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await this.db.query(
                'UPDATE user_passwords SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
                [hashedNewPassword, userId]
            );

            this.logger.info(`Password changed for user ID: ${userId}`);

            return {
                success: true,
                message: 'Password changed successfully'
            };
        } catch (error) {
            this.logger.error('Change password error:', error);
            throw error;
        }
    }
}

module.exports = UserAuth; 