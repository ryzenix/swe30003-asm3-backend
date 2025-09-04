const Prescription = require('../models/Prescription');
const Logger = require('../core/Logger');

class PrescriptionController {
    constructor() {
        this.prescriptionModel = new Prescription();
        this.logger = new Logger();
    }

    async createPrescription(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const result = await this.prescriptionModel.create(req.body, req.session.userId);
            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Create prescription controller error:', error);
            next(error);
        }
    }

    async getPrescription(req, res, next) {
        try {
            const { id } = req.params;
            
            // For regular users, filter by their user ID
            // For superusers/pharmacists, allow access to all prescriptions
            let userId = null;
            if (req.session.authenticated && req.session.userId) {
                // Check if user is superuser or pharmacist
                const { rows: superuser } = await this.prescriptionModel.db.query(
                    'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                    [req.session.userId]
                );

                const { rows: pharmacist } = await this.prescriptionModel.db.query(
                    'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                    [req.session.userId, 'pharmacist']
                );

                // If not superuser or pharmacist, filter by user ID
                if (superuser.length === 0 && pharmacist.length === 0) {
                    userId = req.session.userId;
                }
            } else {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const result = await this.prescriptionModel.getById(id, userId);
            res.json(result);
        } catch (error) {
            this.logger.error('Get prescription controller error:', error);
            next(error);
        }
    }

    async listPrescriptions(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const filters = {
                page: req.query.page,
                limit: req.query.limit,
                status: req.query.status,
                patientName: req.query.patient_name,
                doctorName: req.query.doctor_name,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            };

            // For regular users, filter by their user ID
            // For superusers/pharmacists, allow access to all prescriptions
            let userId = null;
            
            // Check if user is superuser or pharmacist
            const { rows: superuser } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // If not superuser or pharmacist, filter by user ID
            if (superuser.length === 0 && pharmacist.length === 0) {
                userId = req.session.userId;
            }

            const result = await this.prescriptionModel.list(filters, userId);
            res.json(result);
        } catch (error) {
            this.logger.error('List prescriptions controller error:', error);
            next(error);
        }
    }

    async updatePrescriptionStatus(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { id } = req.params;
            const { status, reviewNotes } = req.body;

            // Check if user has permission to update prescription status
            const { rows: superuser } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // Only superusers and pharmacists can update prescription status
            if (superuser.length === 0 && pharmacist.length === 0) {
                const { AuthorizationError } = require('../core/errors');
                throw AuthorizationError.insufficientPermissions('update prescription status');
            }

            const result = await this.prescriptionModel.updateStatus(id, status, req.session.userId, reviewNotes);
            res.json(result);
        } catch (error) {
            this.logger.error('Update prescription status controller error:', error);
            next(error);
        }
    }

    async deletePrescription(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { id } = req.params;

            const result = await this.prescriptionModel.delete(id, req.session.userId);
            res.json(result);
        } catch (error) {
            this.logger.error('Delete prescription controller error:', error);
            next(error);
        }
    }

    async uploadPrescriptionImage(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { prescriptionId } = req.params;
            
            if (!req.file) {
                const { ValidationError } = require('../core/errors');
                throw ValidationError.missingFields(['file']);
            }

            // Check if prescription exists and belongs to user
            const prescriptionResult = await this.prescriptionModel.getById(prescriptionId, req.session.userId);
            
            // Upload image to S3
            const uploadResult = await this.prescriptionModel.s3Service.uploadImage(
                req.file, 
                `prescriptions/${req.session.userId}`
            );

            // Get current prescription data
            const currentPrescription = prescriptionResult.data;
            const currentImages = currentPrescription.images || [];
            
            // Add new image to the array
            const updatedImages = [...currentImages, uploadResult.url];
            
            // Update prescription with new image array using PostgreSQL array syntax
            await this.prescriptionModel.db.query(
                'UPDATE prescriptions SET images = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [updatedImages, prescriptionId]
            );

            res.json({
                success: true,
                message: 'Prescription image uploaded successfully',
                data: {
                    imageUrl: uploadResult.url,
                    imageKey: uploadResult.key,
                    updatedImages: updatedImages
                }
            });
        } catch (error) {
            this.logger.error('Upload prescription image controller error:', error);
            next(error);
        }
    }

    async deletePrescriptionImage(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { prescriptionId, imageIndex } = req.params;
            
            // Check if prescription exists and belongs to user
            const prescriptionResult = await this.prescriptionModel.getById(prescriptionId, req.session.userId);
            
            const currentPrescription = prescriptionResult.data;
            const currentImages = currentPrescription.images || [];
            
            if (imageIndex < 0 || imageIndex >= currentImages.length) {
                const { ValidationError } = require('../core/errors');
                throw ValidationError.invalidNumber('imageIndex', imageIndex, 0, currentImages.length - 1);
            }

            const imageUrl = currentImages[imageIndex];
            let s3DeleteSuccess = false;
            let s3DeleteError = null;

            // Attempt to delete image from S3
            try {
                await this.prescriptionModel.s3Service.deleteImageFromUrl(imageUrl);
                s3DeleteSuccess = true;
                this.logger.info(`Successfully deleted prescription image from S3: ${imageUrl}`);
            } catch (s3Error) {
                s3DeleteError = s3Error.message;
                this.logger.warn(`Failed to delete prescription image from S3: ${imageUrl}. Error: ${s3Error.message}`);
            }
            
            // Always proceed with database cleanup regardless of S3 deletion result
            // Remove image from array
            const updatedImages = currentImages.filter((_, index) => index !== parseInt(imageIndex));
            
            // Update prescription in database
            await this.prescriptionModel.db.query(
                'UPDATE prescriptions SET images = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [updatedImages, prescriptionId]
            );

            // Prepare response based on S3 deletion result
            const responseData = {
                success: true,
                message: s3DeleteSuccess 
                    ? 'Prescription image deleted successfully from both S3 and database'
                    : 'Prescription image removed from database (S3 deletion failed but database was cleaned up)',
                data: {
                    deletedImageUrl: imageUrl,
                    updatedImages: updatedImages,
                    s3DeleteSuccess: s3DeleteSuccess
                }
            };

            // Add warning if S3 deletion failed
            if (!s3DeleteSuccess) {
                responseData.warning = `S3 deletion failed: ${s3DeleteError}. Image was removed from database but may still exist in S3.`;
            }

            res.json(responseData);
        } catch (error) {
            this.logger.error('Delete prescription image controller error:', error);
            next(error);
        }
    }

    async getPrescriptionStatistics(req, res, next) {
        try {
            // Check if user is authenticated and has permission
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            // Check if user is superuser or pharmacist
            const { rows: superuser } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.prescriptionModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // Only superusers and pharmacists can view statistics
            if (superuser.length === 0 && pharmacist.length === 0) {
                const { AuthorizationError } = require('../core/errors');
                throw AuthorizationError.insufficientPermissions('view prescription statistics');
            }

            // Get prescription statistics
            const { rows: statusStats } = await this.prescriptionModel.db.query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM prescriptions 
                GROUP BY status
                ORDER BY status
            `);

            const { rows: dailyStats } = await this.prescriptionModel.db.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as prescription_count,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
                FROM prescriptions 
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `);

            const { rows: monthlyStats } = await this.prescriptionModel.db.query(`
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as prescription_count,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
                FROM prescriptions 
                WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month DESC
            `);

            const { rows: topMedications } = await this.prescriptionModel.db.query(`
                SELECT 
                    pi.medication_name,
                    COUNT(*) as prescription_count,
                    COUNT(DISTINCT pi.prescription_id) as unique_prescriptions
                FROM prescription_items pi
                JOIN prescriptions p ON pi.prescription_id = p.id
                WHERE p.created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY pi.medication_name
                ORDER BY prescription_count DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    statusStatistics: statusStats.map(stat => ({
                        status: stat.status,
                        count: parseInt(stat.count)
                    })),
                    dailyStatistics: dailyStats.map(stat => ({
                        date: stat.date,
                        prescriptionCount: parseInt(stat.prescription_count),
                        approvedCount: parseInt(stat.approved_count),
                        rejectedCount: parseInt(stat.rejected_count)
                    })),
                    monthlyStatistics: monthlyStats.map(stat => ({
                        month: stat.month,
                        prescriptionCount: parseInt(stat.prescription_count),
                        approvedCount: parseInt(stat.approved_count),
                        rejectedCount: parseInt(stat.rejected_count)
                    })),
                    topMedications: topMedications.map(med => ({
                        medicationName: med.medication_name,
                        prescriptionCount: parseInt(med.prescription_count),
                        uniquePrescriptions: parseInt(med.unique_prescriptions)
                    }))
                }
            });
        } catch (error) {
            this.logger.error('Get prescription statistics controller error:', error);
            next(error);
        }
    }

    async getUserPrescriptionSummary(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const userId = req.session.userId;

            // Get user's prescription summary
            const { rows: summary } = await this.prescriptionModel.db.query(`
                SELECT 
                    COUNT(*) as total_prescriptions,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_prescriptions,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_prescriptions,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_prescriptions,
                    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_prescriptions
                FROM prescriptions 
                WHERE user_id = $1
            `, [userId]);

            // Get recent prescriptions
            const { rows: recentPrescriptions } = await this.prescriptionModel.db.query(`
                SELECT 
                    id, patient_name, doctor_name, status, issue_date, created_at,
                    COUNT(pi.id) as item_count
                FROM prescriptions p
                LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
                WHERE p.user_id = $1
                GROUP BY p.id, p.patient_name, p.doctor_name, p.status, p.issue_date, p.created_at
                ORDER BY p.created_at DESC
                LIMIT 5
            `, [userId]);

            res.json({
                success: true,
                data: {
                    summary: {
                        totalPrescriptions: parseInt(summary[0].total_prescriptions),
                        pendingPrescriptions: parseInt(summary[0].pending_prescriptions),
                        approvedPrescriptions: parseInt(summary[0].approved_prescriptions),
                        rejectedPrescriptions: parseInt(summary[0].rejected_prescriptions),
                        expiredPrescriptions: parseInt(summary[0].expired_prescriptions)
                    },
                    recentPrescriptions: recentPrescriptions.map(prescription => ({
                        id: prescription.id,
                        patientName: prescription.patient_name,
                        doctorName: prescription.doctor_name,
                        status: prescription.status,
                        issueDate: prescription.issue_date,
                        itemCount: parseInt(prescription.item_count),
                        createdAt: prescription.created_at
                    }))
                }
            });
        } catch (error) {
            this.logger.error('Get user prescription summary controller error:', error);
            next(error);
        }
    }
}

module.exports = PrescriptionController;