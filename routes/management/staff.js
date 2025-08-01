const express = require('express');
const router = express.Router();
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const pool = require('../../config/db');
const base64url = require('base64url');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

router.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});


router.get('/users/list', async (req, res) => {
    try {
        // Check if superuser is authenticated
        if (!req.session.authenticated || !req.session.userId) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        // Verify superuser exists and is active
        const {
            rows: superuser
        } = await pool.query(
            'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
            [req.session.userId]
        );

        if (superuser.length === 0) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        // Parse query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const isActive = req.query.is_active;

        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({
                error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100'
            });
        }

        const offset = (page - 1) * limit;

        // Build query conditions
        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            whereConditions.push(`(email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`);
            queryParams.push(`%${search}%`);
        }

        if (role) {
            paramCount++;
            whereConditions.push(`role = $${paramCount}`);
            queryParams.push(role);
        }

        if (isActive !== undefined) {
            paramCount++;
            whereConditions.push(`is_active = $${paramCount}`);
            queryParams.push(isActive === 'true');
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Count total records
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users
            ${whereClause}
        `;

        const {
            rows: countResult
        } = await pool.query(countQuery, queryParams);
        const totalRecords = parseInt(countResult[0].total);
        const totalPages = Math.ceil(totalRecords / limit);

        // Fetch users with pagination
        const usersQuery = `
            SELECT 
                user_id,
                email, 
                full_name,
                role,
                phone,
                is_active,
                last_login,
                (SELECT created_at FROM user_passwords WHERE user_id = users.user_id) as created_at
            FROM users
            ${whereClause}
            ORDER BY full_name ASC, email ASC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        queryParams.push(limit, offset);

        const {
            rows: users
        } = await pool.query(usersQuery, queryParams);

        // Format response
        const formattedUsers = users.map(user => ({
            id: user.user_id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            phone: user.phone,
            isActive: user.is_active,
            lastLogin: user.last_login ? new Date(user.last_login).toISOString() : null,
            createdAt: user.created_at ? new Date(user.created_at).toISOString() : null
        }));

        res.json({
            success: true,
            data: {
                users: formattedUsers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalRecords,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    search,
                    role,
                    isActive: isActive !== undefined ? (isActive === 'true') : undefined
                }
            }
        });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({
            error: 'Failed to list users: ' + error.message
        });
    }
});

// Create new staff with random password
router.post('/users/create-staff', async (req, res) => {
    try {
        // Check if superuser is authenticated
        if (!req.session.authenticated || !req.session.userId) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        // Verify superuser exists and is active
        const {
            rows: superuser
        } = await pool.query(
            'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
            [req.session.userId]
        );

        if (superuser.length === 0) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const { email, fullName, phone, role = 'pharmacist' } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!fullName) missingFields.push('fullName');
        if (!phone) missingFields.push('phone');

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Required fields are missing',
                missingFields
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email address format'
            });
        }

        // Validate phone format
        const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                error: 'Invalid phone number format',
                expectedFormat: 'Vietnamese phone number format'
            });
        }

        // Validate role
        const validRoles = ['pharmacist'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: 'Invalid role specified',
                validOptions: validRoles
            });
        }

        // Check if email already exists
        const {
            rows: existingUsers
        } = await pool.query(
            'SELECT COUNT(*) AS count FROM users WHERE email = $1',
            [email]
        );

        if (existingUsers[0].count > 0) {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        // Generate random password (12 characters with mixed case, numbers, and symbols)
        const generateRandomPassword = () => {
            const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            let password = '';
            for (let i = 0; i < 12; i++) {
                password += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            return password;
        };

        const randomPassword = generateRandomPassword();

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

        // Generate user ID
        const userId = uuidv4();

        // Insert user into database
        await pool.query(
            'INSERT INTO users (user_id, email, full_name, role, phone, is_active) VALUES ($1, $2, $3, $4, $5, TRUE)',
            [userId, email, fullName, role, phone]
        );

        // Store hashed password in a separate table
        await pool.query(
            'INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)',
            [userId, hashedPassword]
        );

        console.log(`Staff created by superuser: ${fullName} (${email}) (ID: ${userId}) with role: ${role}`);

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: userId,
                    email,
                    fullName,
                    phone,
                    role,
                    isActive: true
                },
                temporaryPassword: randomPassword
            }
        });
    } catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({
            error: 'Failed to create staff: ' + error.message
        });
    }
});

// Modify staff user
router.put('/users/modify/:userId', async (req, res) => {
    try {
        // Check if superuser is authenticated
        if (!req.session.authenticated || !req.session.userId) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        // Verify superuser exists and is active
        const {
            rows: superuser
        } = await pool.query(
            'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
            [req.session.userId]
        );

        if (superuser.length === 0) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const { userId } = req.params;
        const { email, fullName, phone, isActive } = req.body;

        // Check if at least one field is provided for update
        if (!email && !fullName && !phone && isActive === undefined) {
            return res.status(400).json({
                error: 'At least one field must be provided for update',
                validFields: ['email', 'fullName', 'phone', 'isActive']
            });
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email address format'
                });
            }
        }

        // Validate phone format if provided
        if (phone) {
            const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    error: 'Invalid phone number format',
                    expectedFormat: 'Vietnamese phone number format'
                });
            }
        }

        // Check if user exists and is a staff member (pharmacist) or client
        const {
            rows: existingUser
        } = await pool.query(
            'SELECT user_id, email, full_name, role, phone, is_active FROM users WHERE user_id = $1 AND (role = $2 OR role = $3)',
            [userId, 'pharmacist', 'client']
        );

        if (existingUser.length === 0) {
            return res.status(404).json({
                error: 'Staff user not found'
            });
        }

        const userRole = existingUser[0].role;
        const isClientUser = userRole === 'client';

        // If it's a client user, only allow updating isActive status
        if (isClientUser) {

            // For client users, only update isActive
            await pool.query(
                'UPDATE users SET is_active = $1 WHERE user_id = $2',
                [isActive, userId]
            );

            // Get updated user information
            const {
                rows: updatedUser
            } = await pool.query(
                'SELECT user_id, email, full_name, role, phone, is_active, last_login FROM users WHERE user_id = $1',
                [userId]
            );

            return res.json({
                success: true,
                message: 'Client user active status updated successfully',
                data: {
                    user: {
                        id: updatedUser[0].user_id,
                        email: updatedUser[0].email,
                        fullName: updatedUser[0].full_name,
                        phone: updatedUser[0].phone,
                        role: updatedUser[0].role,
                        isActive: updatedUser[0].is_active,
                        lastLogin: updatedUser[0].last_login ? new Date(updatedUser[0].last_login).toISOString() : null
                    }
                }
            });
        }

        // For pharmacist users, perform all validations and allow all field updates
        // Check if email is already taken by another user (only if email is being updated)
        if (email) {
            const {
                rows: emailConflict
            } = await pool.query(
                'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
                [email, userId]
            );

            if (emailConflict.length > 0) {
                return res.status(409).json({
                    error: 'Email is already taken by another user'
                });
            }
        }

        // Build dynamic update query based on provided fields
        const updateFields = [];
        const updateValues = [];
        let paramCount = 0;

        if (email !== undefined) {
            updateFields.push(`email = $${++paramCount}`);
            updateValues.push(email);
        }

        if (fullName !== undefined) {
            updateFields.push(`full_name = $${++paramCount}`);
            updateValues.push(fullName);
        }

        if (phone !== undefined) {
            updateFields.push(`phone = $${++paramCount}`);
            updateValues.push(phone);
        }

        if (isActive !== undefined) {
            updateFields.push(`is_active = $${++paramCount}`);
            updateValues.push(isActive);
        }

        // Add user_id as the last parameter
        updateValues.push(userId);

        // Update user information
        await pool.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${paramCount + 1}`,
            updateValues
        );

        // Get updated user information
        const {
            rows: updatedUser
        } = await pool.query(
            'SELECT user_id, email, full_name, role, phone, is_active, last_login FROM users WHERE user_id = $1',
            [userId]
        );

        const updatedFields = [];
        if (email !== undefined) updatedFields.push(`email: ${email}`);
        if (fullName !== undefined) updatedFields.push(`name: ${fullName}`);
        if (phone !== undefined) updatedFields.push(`phone: ${phone}`);
        if (isActive !== undefined) updatedFields.push(`isActive: ${isActive}`);

        console.log(`Staff user modified by superuser (ID: ${userId}) - Updated fields: ${updatedFields.join(', ')}`);

        res.json({
            success: true,
            message: 'Staff user updated successfully',
            data: {
                user: {
                    id: updatedUser[0].user_id,
                    email: updatedUser[0].email,
                    fullName: updatedUser[0].full_name,
                    phone: updatedUser[0].phone,
                    role: updatedUser[0].role,
                    isActive: updatedUser[0].is_active,
                    lastLogin: updatedUser[0].last_login ? new Date(updatedUser[0].last_login).toISOString() : null
                }
            }
        });
    } catch (error) {
        console.error('Modify staff error:', error);
        res.status(500).json({
            error: 'Failed to modify staff: ' + error.message
        });
    }
});

// Delete user route
router.delete('/users/delete/:userId', async (req, res) => {
    try {
        // Check if superuser is authenticated
        if (!req.session.authenticated || !req.session.userId) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }

        // Verify superuser exists and is active
        const {
            rows: superuser
        } = await pool.query(
            'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
            [req.session.userId]
        );

        if (superuser.length === 0) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        const { userId } = req.params;

        // Check if userId param is provided
        if (!userId) {
            return res.status(400).json({
                error: 'Missing parameter'
            });
        }

        // Check if user exists and is a staff member (pharmacist) or client
        const {
            rows: existingUser
        } = await pool.query(
            'SELECT user_id, email, full_name, role, is_active FROM users WHERE user_id = $1 AND (role = $2 OR role = $3)',
            [userId, 'pharmacist', 'client']
        );

        if (existingUser.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const userRole = existingUser[0].role;
        const userEmail = existingUser[0].email;
        const userName = existingUser[0].full_name;

        // Prevent deletion of the superuser themselves
        if (userId === req.session.userId) {
            return res.status(400).json({
                error: 'Cannot delete your own account'
            });
        }

        // Delete the user
        await pool.query(
            'DELETE FROM users WHERE user_id = $1',
            [userId]
        );

        console.log(`User deleted by superuser - ID: ${userId}, Email: ${userEmail}, Name: ${userName}, Role: ${userRole}`);

        res.json({
            success: true,
            message: 'User deleted successfully',
            data: {
                deletedUser: {
                    id: userId,
                    email: userEmail,
                    fullName: userName,
                    role: userRole
                }
            }
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            error: 'Failed to delete user: ' + error.message
        });
    }
});

module.exports = router;