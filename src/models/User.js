const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');

class User {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    async create(userData) {
        try {
            this.validator.clearErrors();

            // Validate required fields
            const requiredFields = ['email', 'password', 'fullName', 'role'];
            if (!this.validator.validateRequired(userData, requiredFields)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate email format
            if (!this.validator.validateEmail('email', userData.email)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate role
            const validRoles = ['customer', 'pharmacist', 'admin'];
            if (!this.validator.validateEnum('role', userData.role, validRoles)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Check if email already exists
            const { rows: existingUsers } = await this.db.query(
                'SELECT COUNT(*) AS count FROM users WHERE email = $1',
                [userData.email]
            );

            if (existingUsers[0].count > 0) {
                throw new Error('A user with this email already exists');
            }

            // Insert user into database
            const { rows: newUser } = await this.db.query(
                `INSERT INTO users (
                    email, password, full_name, role, phone, gender, date_of_birth, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING user_id`,
                [
                    userData.email, 
                    userData.password, 
                    userData.fullName, 
                    userData.role,
                    userData.phone || null,
                    userData.gender || null,
                    userData.dateOfBirth || null,
                    userData.isActive !== false // Default to true
                ]
            );

            this.logger.info(`User created: ${userData.email} (ID: ${newUser[0].user_id})`);

            return {
                success: true,
                message: 'User created successfully',
                data: {
                    id: newUser[0].user_id,
                    email: userData.email,
                    fullName: userData.fullName,
                    role: userData.role
                }
            };

        } catch (error) {
            this.logger.error('Create user error:', error);
            throw error;
        }
    }

    async update(id, updateData) {
        try {
            this.validator.clearErrors();

            // Check if user exists
            const { rows: existingUser } = await this.db.query(
                'SELECT user_id FROM users WHERE user_id = $1',
                [id]
            );

            if (existingUser.length === 0) {
                throw new Error('User not found');
            }

            // Validate email format if provided
            if (updateData.email) {
                if (!this.validator.validateEmail('email', updateData.email)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Validate role if provided
            if (updateData.role) {
                const validRoles = ['customer', 'pharmacist', 'admin'];
                if (!this.validator.validateEnum('role', updateData.role, validRoles)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Check if email is already taken by another user
            if (updateData.email) {
                const { rows: emailConflict } = await this.db.query(
                    'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
                    [updateData.email, id]
                );

                if (emailConflict.length > 0) {
                    throw new Error('Email is already taken by another user');
                }
            }

            // Build dynamic update query
            const updateFields = [];
            const updateValues = [];
            let paramCount = 0;

            const fieldsToUpdate = [
                'email', 'password', 'fullName', 'role', 'phone', 
                'gender', 'dateOfBirth', 'isActive'
            ];

            for (const field of fieldsToUpdate) {
                if (updateData[field] !== undefined) {
                    const dbField = field === 'fullName' ? 'full_name' : 
                                   field === 'dateOfBirth' ? 'date_of_birth' : 
                                   field === 'isActive' ? 'is_active' : field;
                    
                    updateFields.push(`${dbField} = $${++paramCount}`);
                    updateValues.push(updateData[field]);
                }
            }

            // Add user id as the last parameter
            updateValues.push(id);

            // Update user
            await this.db.query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${paramCount + 1}`,
                updateValues
            );

            // Get updated user information
            const { rows: updatedUser } = await this.db.query(
                `SELECT 
                    user_id, email, full_name, role, phone, gender, 
                    date_of_birth, is_active
                FROM users 
                WHERE user_id = $1`,
                [id]
            );

            const user = updatedUser[0];

            this.logger.info(`User updated (ID: ${id}) - Updated fields: ${Object.keys(updateData).join(', ')}`);

            return {
                success: true,
                message: 'User updated successfully',
                data: {
                    id: user.user_id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone,
                    gender: user.gender,
                    dateOfBirth: user.date_of_birth,
                    isActive: user.is_active
                }
            };

        } catch (error) {
            this.logger.error('Update user error:', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            if (!id) {
                throw new Error('User ID is required');
            }

            // Check if user exists
            const { rows: existingUser } = await this.db.query(
                'SELECT user_id, email, full_name FROM users WHERE user_id = $1',
                [id]
            );

            if (existingUser.length === 0) {
                throw new Error('User not found');
            }

            const userEmail = existingUser[0].email;
            const userFullName = existingUser[0].full_name;

            // Soft delete by setting is_active to false
            await this.db.query(
                'UPDATE users SET is_active = FALSE WHERE user_id = $1',
                [id]
            );

            this.logger.info(`User deleted - ID: ${id}, Email: ${userEmail}, Name: ${userFullName}`);

            return {
                success: true,
                message: 'User deleted successfully',
                data: {
                    deletedUser: {
                        id: parseInt(id),
                        email: userEmail,
                        fullName: userFullName
                    }
                }
            };

        } catch (error) {
            this.logger.error('Delete user error:', error);
            throw error;
        }
    }

    async getById(id) {
        try {
            if (!id) {
                throw new Error('User ID is required');
            }

            const { rows: users } = await this.db.query(
                `SELECT 
                    user_id, email, full_name, role, phone, gender, 
                    date_of_birth, is_active
                FROM users 
                WHERE user_id = $1`,
                [id]
            );

            if (users.length === 0) {
                throw new Error('User not found');
            }

            const user = users[0];

            return {
                success: true,
                data: {
                    id: user.user_id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone,
                    gender: user.gender,
                    dateOfBirth: user.date_of_birth,
                    isActive: user.is_active
                }
            };

        } catch (error) {
            this.logger.error('Get user error:', error);
            throw error;
        }
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
                queryParams.push(isActive);
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
                    user_id, email, full_name, role, phone, gender, 
                    date_of_birth, is_active
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
                gender: user.gender,
                dateOfBirth: user.date_of_birth,
                isActive: user.is_active
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
                        isActive
                    }
                }
            };

        } catch (error) {
            this.logger.error('List users error:', error);
            throw error;
        }
    }
}

module.exports = User; 