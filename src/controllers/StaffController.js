const Staff = require('../models/Staff');
const Logger = require('../core/Logger');

class StaffController {
    constructor() {
        this.staffModel = new Staff();
        this.logger = new Logger();
    }

    async listStaff(req, res, next) {
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
            next(error);
        }
    }

    async createStaff(req, res, next) {
        try {
            const result = await this.staffModel.createStaff(req.body);
            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Create staff error:', error);
            
            next(error);
        }
    }

    async modifyStaff(req, res, next) {
        try {
            const { userId } = req.params;
            const result = await this.staffModel.modifyStaff(userId, req.body);
            res.json(result);
        } catch (error) {
            this.logger.error('Modify staff error:', error);
            
            next(error);
        }
    }

    async deleteStaff(req, res, next) {
        try {
            const { userId } = req.params;
            const result = await this.staffModel.deleteStaff(userId);
            res.json(result);
        } catch (error) {
            this.logger.error('Delete staff error:', error);
            
            next(error);
        }
    }
}

module.exports = StaffController; 