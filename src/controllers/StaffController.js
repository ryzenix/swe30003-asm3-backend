const Staff = require('../models/Staff');
const Logger = require('../core/Logger');

class StaffController {
    constructor() {
        this.staffModel = new Staff();
        this.logger = new Logger();
    }

    async listStaff(req, res) {
        try {
            const filters = {
                page: req.query.page,
                limit: req.query.limit,
                search: req.query.search,
                role: req.query.role,
                isActive: req.query.is_active
            };
            
            const result = await this.staffModel.list(filters);
            res.json(result);
        } catch (error) {
            this.logger.error('List staff error:', error);
            
            if (error.message.includes('Invalid pagination parameters')) {
                return res.status(400).json({
                    error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100'
                });
            }
            
            res.status(500).json({
                error: 'Failed to list users: ' + error.message
            });
        }
    }

    async createStaff(req, res) {
        try {
            const result = await this.staffModel.createStaff(req.body);
            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Create staff error:', error);
            
            if (error.message.includes('Required fields are missing')) {
                const missingFields = error.message.match(/\[(.*)\]/)?.[1]?.split(', ') || [];
                return res.status(400).json({
                    error: 'Required fields are missing',
                    missingFields
                });
            }
            
            if (error.message.includes('Invalid email address format')) {
                return res.status(400).json({
                    error: 'Invalid email address format'
                });
            }
            
            if (error.message.includes('Invalid phone number format')) {
                return res.status(400).json({
                    error: 'Invalid phone number format',
                    expectedFormat: 'Vietnamese phone number format'
                });
            }
            
            if (error.message.includes('Invalid role specified')) {
                return res.status(400).json({
                    error: 'Invalid role specified',
                    validOptions: ['pharmacist']
                });
            }
            
            if (error.message.includes('An account with this email already exists')) {
                return res.status(409).json({
                    error: 'An account with this email already exists'
                });
            }
            
            res.status(500).json({
                error: 'Failed to create staff: ' + error.message
            });
        }
    }

    async modifyStaff(req, res) {
        try {
            const { userId } = req.params;
            const result = await this.staffModel.modifyStaff(userId, req.body);
            res.json(result);
        } catch (error) {
            this.logger.error('Modify staff error:', error);
            
            if (error.message === 'At least one field must be provided for update') {
                return res.status(400).json({
                    error: 'At least one field must be provided for update',
                    validFields: ['email', 'fullName', 'phone', 'isActive']
                });
            }
            
            if (error.message.includes('Invalid email address format')) {
                return res.status(400).json({
                    error: 'Invalid email address format'
                });
            }
            
            if (error.message.includes('Invalid phone number format')) {
                return res.status(400).json({
                    error: 'Invalid phone number format',
                    expectedFormat: 'Vietnamese phone number format'
                });
            }
            
            if (error.message === 'Staff user not found') {
                return res.status(404).json({
                    error: 'Staff user not found'
                });
            }
            
            if (error.message.includes('isActive field is required for client users')) {
                return res.status(400).json({
                    error: 'isActive field is required for client users'
                });
            }
            
            if (error.message.includes('Email is already taken by another user')) {
                return res.status(409).json({
                    error: 'Email is already taken by another user'
                });
            }
            
            res.status(500).json({
                error: 'Failed to modify staff: ' + error.message
            });
        }
    }

    async deleteStaff(req, res) {
        try {
            const { userId } = req.params;
            const result = await this.staffModel.deleteStaff(userId);
            res.json(result);
        } catch (error) {
            this.logger.error('Delete staff error:', error);
            
            if (error.message === 'User ID is required') {
                return res.status(400).json({
                    error: 'Missing parameter'
                });
            }
            
            if (error.message === 'User not found') {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            res.status(500).json({
                error: 'Failed to delete user: ' + error.message
            });
        }
    }
}

module.exports = StaffController; 