const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { 
    ValidationError, 
    NotFoundError, 
    ConflictError 
} = require('../core/errors');

class Staff {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    async list(filters = {}) {
        try {
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const search = filters.search || '';
            const role = filters.role || '';
            const isActive = filters.isActive;

            // Validate pagination parameters
            if (page < 1 || limit < 1 || limit > 100) {
                throw new Error('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
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

            const { rows: countResult } = await this.db.query(countQuery, queryParams);
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

            const { rows: users } = await this.db.query(usersQuery, queryParams);

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

            return {
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
            };
        } catch (error) {
            this.logger.error('List users error:', error);
            throw error;
        }
    }

    async createStaff(staffData) {
        try {
            this.validator.clearErrors();

            const { email, fullName, phone, role = 'pharmacist' } = staffData;

            // Validate required fields
            const requiredFields = ['email', 'fullName', 'phone'];
            if (!this.validator.validateRequired(staffData, requiredFields)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate email format
            if (!this.validator.validateEmail('email', email)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate phone format
            const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
            if (!phoneRegex.test(phone)) {
                throw new Error('Invalid phone number format. Expected Vietnamese phone number format');
            }

            // Validate role
            const validRoles = ['pharmacist'];
            if (!this.validator.validateEnum('role', role, validRoles)) {
                throw new Error(`Invalid role specified. Valid options: ${validRoles.join(', ')}`);
            }

            // Check if email already exists
            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM users WHERE email = $1',
                [email]
            );

            if (existingUsers[0].count > 0) {
                throw new Error('An account with this email already exists');
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
            await this.db.query(
                'INSERT INTO users (user_id, email, full_name, role, phone, is_active) VALUES ($1, $2, $3, $4, $5, TRUE)',
                [userId, email, fullName, role, phone]
            );

            // Store hashed password in a separate table
            await this.db.query(
                'INSERT INTO user_passwords (user_id, password_hash) VALUES ($1, $2)',
                [userId, hashedPassword]
            );

            this.logger.info(`Staff created: ${fullName} (${email}) (ID: ${userId}) with role: ${role}`);

            return {
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
            };
        } catch (error) {
            this.logger.error('Create staff error:', error);
            throw error;
        }
    }

    async modifyStaff(userId, updateData) {
        try {
            this.validator.clearErrors();

            const { email, fullName, phone, isActive } = updateData;

            // Check if at least one field is provided for update
            if (!email && !fullName && !phone && isActive === undefined) {
                throw new Error('At least one field must be provided for update');
            }

            // Validate email format if provided
            if (email) {
                if (!this.validator.validateEmail('email', email)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Validate phone format if provided
            if (phone) {
                const phoneRegex = /^(\+84|84|0)[3|5|7|8|9]\d{8}$/;
                if (!phoneRegex.test(phone)) {
                    throw new Error('Invalid phone number format. Expected Vietnamese phone number format');
                }
            }

            // Check if user exists and is a staff member (pharmacist) or client
            const { rows: existingUser } = await this.db.query(
                'SELECT user_id, email, full_name, role, phone, is_active FROM users WHERE user_id = $1 AND (role = $2 OR role = $3)',
                [userId, 'pharmacist', 'client']
            );

            if (existingUser.length === 0) {
                throw new Error('Staff user not found');
            }

            const userRole = existingUser[0].role;
            const isClientUser = userRole === 'client';

            // If it's a client user, only allow updating isActive status
            if (isClientUser) {
                if (isActive === undefined) {
                    throw new Error('isActive field is required for client users');
                }

                // For client users, only update isActive
                await this.db.query(
                    'UPDATE users SET is_active = $1 WHERE user_id = $2',
                    [isActive, userId]
                );

                // Get updated user information
                const { rows: updatedUser } = await this.db.query(
                    'SELECT user_id, email, full_name, role, phone, is_active, last_login FROM users WHERE user_id = $1',
                    [userId]
                );

                return {
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
                };
            }

            // For pharmacist users, perform all validations and allow all field updates
            // Check if email is already taken by another user (only if email is being updated)
            if (email) {
                const { rows: emailConflict } = await this.db.query(
                    'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
                    [email, userId]
                );

                if (emailConflict.length > 0) {
                    throw new Error('Email is already taken by another user');
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
            await this.db.query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${paramCount + 1}`,
                updateValues
            );

            // Get updated user information
            const { rows: updatedUser } = await this.db.query(
                'SELECT user_id, email, full_name, role, phone, is_active, last_login FROM users WHERE user_id = $1',
                [userId]
            );

            const updatedFields = [];
            if (email !== undefined) updatedFields.push(`email: ${email}`);
            if (fullName !== undefined) updatedFields.push(`name: ${fullName}`);
            if (phone !== undefined) updatedFields.push(`phone: ${phone}`);
            if (isActive !== undefined) updatedFields.push(`isActive: ${isActive}`);

            this.logger.info(`Staff user modified (ID: ${userId}) - Updated fields: ${updatedFields.join(', ')}`);

            return {
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
            };
        } catch (error) {
            this.logger.error('Modify staff error:', error);
            throw error;
        }
    }

    async deleteStaff(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            // Check if user exists and is a staff member (pharmacist) or client
            const { rows: existingUser } = await this.db.query(
                'SELECT user_id, email, full_name, role, is_active FROM users WHERE user_id = $1 AND (role = $2 OR role = $3)',
                [userId, 'pharmacist', 'client']
            );

            if (existingUser.length === 0) {
                throw new Error('User not found');
            }

            const userRole = existingUser[0].role;
            const userEmail = existingUser[0].email;
            const userName = existingUser[0].full_name;

            // Delete the user
            await this.db.query(
                'DELETE FROM users WHERE user_id = $1',
                [userId]
            );

            this.logger.info(`User deleted - ID: ${userId}, Email: ${userEmail}, Name: ${userName}, Role: ${userRole}`);

            return {
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
            };
        } catch (error) {
            this.logger.error('Delete user error:', error);
            throw error;
        }
    }
}

module.exports = Staff; 