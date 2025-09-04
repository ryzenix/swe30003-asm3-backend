const Database = require('../core/Database');
const Validator = require('../core/Validator');
const ServiceManager = require('../core/ServiceManager');
const { 
    ValidationError, 
    NotFoundError, 
    ConflictError, 
    AuthenticationError,
    BusinessLogicError,
    ExternalServiceError 
} = require('../core/errors');

class Prescription {
    constructor() {
        this.db = new Database();
        this.validator = new Validator();
        
        // Use ServiceManager to get shared service instances
        const serviceManager = ServiceManager.getInstance();
        this.logger = serviceManager.getLogger();
        this.s3Service = serviceManager.getS3Service();
    }

    async create(prescriptionData, userId) {
        console.log("prescriptionData: ", prescriptionData);
        try {
            this.validator.clearErrors();

            // Validate required fields
            const requiredFields = ['patientName', 'doctorName', 'issueDate'];
            if (!this.validator.validateRequired(prescriptionData, requiredFields)) {
                const missingFields = requiredFields.filter(field => 
                    prescriptionData[field] === undefined || prescriptionData[field] === null || prescriptionData[field] === ''
                );
                throw ValidationError.missingFields(missingFields);
            }

            // Validate issue date format
            if (!this.validator.validateDate('issueDate', prescriptionData.issueDate)) {
                throw ValidationError.invalidFormat('issueDate', 'YYYY-MM-DD');
            }

            // Validate expiry date if provided
            if (prescriptionData.expiryDate) {
                if (!this.validator.validateDate('expiryDate', prescriptionData.expiryDate)) {
                    throw ValidationError.invalidFormat('expiryDate', 'YYYY-MM-DD');
                }

                // Check if expiry date is after issue date
                const issueDate = new Date(prescriptionData.issueDate);
                const expiryDate = new Date(prescriptionData.expiryDate);
                
                if (expiryDate <= issueDate) {
                    throw BusinessLogicError.invalidOperation(
                        'set expiry date',
                        'Expiry date must be after issue date'
                    );
                }
            }

            // Validate status
            const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
            const status = prescriptionData.status || 'pending';
            if (!this.validator.validateEnum('status', status, validStatuses)) {
                throw ValidationError.invalidEnum('status', status, validStatuses);
            }

            // Process prescription images if provided
            let processedImages = [];
            if (prescriptionData.images && Array.isArray(prescriptionData.images)) {
                processedImages = await this.processBase64Images(prescriptionData.images, userId);
            }

            // Start transaction
            const client = await this.db.getClient();
            
            try {
                await client.query('BEGIN');

                // Create prescription
                const { rows: newPrescription } = await client.query(
                    `INSERT INTO prescriptions (
                        user_id, patient_name, doctor_name, doctor_license, clinic_name,
                        issue_date, expiry_date, status, images, notes, diagnosis
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id, created_at`,
                    [
                        userId,
                        prescriptionData.patientName,
                        prescriptionData.doctorName,
                        prescriptionData.doctorLicense || null,
                        prescriptionData.clinicName || null,
                        prescriptionData.issueDate,
                        prescriptionData.expiryDate || null,
                        status,
                        processedImages,
                        prescriptionData.notes || null,
                        prescriptionData.diagnosis || null
                    ]
                );

                const prescriptionId = newPrescription[0].id;
                const prescriptionCreatedAt = newPrescription[0].created_at;

                // Create prescription items if provided
                const prescriptionItems = [];
                if (prescriptionData.items && Array.isArray(prescriptionData.items)) {
                    for (const item of prescriptionData.items) {
                        // Validate item structure
                        if (!item.medicationName || !item.dosage || !item.frequency) {
                            throw ValidationError.missingFields(['medicationName', 'dosage', 'frequency']);
                        }

                        // Insert prescription item
                        const { rows: prescriptionItem } = await client.query(
                            `INSERT INTO prescription_items (
                                prescription_id, medication_name, dosage, frequency, duration,
                                quantity, instructions, product_id
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            RETURNING id`,
                            [
                                prescriptionId,
                                item.medicationName,
                                item.dosage,
                                item.frequency,
                                item.duration || null,
                                item.quantity || null,
                                item.instructions || null,
                                item.productId || null
                            ]
                        );

                        prescriptionItems.push({
                            id: prescriptionItem[0].id,
                            medicationName: item.medicationName,
                            dosage: item.dosage,
                            frequency: item.frequency,
                            duration: item.duration,
                            quantity: item.quantity,
                            instructions: item.instructions,
                            productId: item.productId
                        });
                    }
                }

                await client.query('COMMIT');

                this.logger.info(`Prescription created successfully - ID: ${prescriptionId}, User: ${userId}, Patient: ${prescriptionData.patientName}`);

                return {
                    success: true,
                    message: 'Prescription created successfully',
                    data: {
                        id: prescriptionId,
                        userId: userId,
                        patientName: prescriptionData.patientName,
                        doctorName: prescriptionData.doctorName,
                        doctorLicense: prescriptionData.doctorLicense,
                        clinicName: prescriptionData.clinicName,
                        issueDate: prescriptionData.issueDate,
                        expiryDate: prescriptionData.expiryDate,
                        status: status,
                        images: processedImages,
                        notes: prescriptionData.notes,
                        diagnosis: prescriptionData.diagnosis,
                        items: prescriptionItems,
                        createdAt: prescriptionCreatedAt
                    }
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            this.logger.error('Create prescription error:', error);
            throw error;
        }
    }

    async getById(prescriptionId, userId = null) {
        try {
            if (!prescriptionId) {
                throw ValidationError.missingFields(['prescriptionId']);
            }

            // Build query with optional user filter
            let query = `
                SELECT 
                    p.id, p.user_id, p.patient_name, p.doctor_name, p.doctor_license, p.clinic_name,
                    p.issue_date, p.expiry_date, p.status, p.images, p.notes, p.diagnosis,
                    p.created_at, p.updated_at, p.reviewed_by, p.reviewed_at, p.review_notes,
                    u.email as user_email, u.full_name as user_name, u.phone as user_phone
                FROM prescriptions p
                LEFT JOIN users u ON p.user_id = u.user_id
                WHERE p.id = $1
            `;
            
            const queryParams = [prescriptionId];
            
            if (userId) {
                query += ' AND p.user_id = $2';
                queryParams.push(userId);
            }

            const { rows: prescriptions } = await this.db.query(query, queryParams);

            if (prescriptions.length === 0) {
                throw NotFoundError.product(prescriptionId); // Reusing product error for prescription
            }

            const prescription = prescriptions[0];

            // Get prescription items
            const { rows: items } = await this.db.query(
                `SELECT 
                    pi.id, pi.medication_name, pi.dosage, pi.frequency, pi.duration,
                    pi.quantity, pi.instructions, pi.product_id,
                    p.title as product_title, p.price, p.images as product_images
                FROM prescription_items pi
                LEFT JOIN products p ON pi.product_id = p.id
                WHERE pi.prescription_id = $1
                ORDER BY pi.id`,
                [prescriptionId]
            );

            // Get order items for this prescription
            const orderItems = await this.getOrderItemsForPrescription(prescriptionId);
            
            // Combine prescription items and order items
            const prescriptionItems = items.map(item => ({
                id: item.id,
                medicationName: item.medication_name,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                quantity: item.quantity,
                instructions: item.instructions,
                productId: item.product_id,
                productTitle: item.product_title,
                productPrice: item.price,
                productImages: item.product_images || [],
                source: 'prescription'
            }));
            
            const allItems = [...prescriptionItems, ...orderItems];

            return {
                success: true,
                data: {
                    id: prescription.id,
                    userId: prescription.user_id,
                    patientName: prescription.patient_name,
                    doctorName: prescription.doctor_name,
                    doctorLicense: prescription.doctor_license,
                    clinicName: prescription.clinic_name,
                    issueDate: prescription.issue_date,
                    expiryDate: prescription.expiry_date,
                    status: prescription.status,
                    images: prescription.images || [],
                    notes: prescription.notes,
                    diagnosis: prescription.diagnosis,
                    createdAt: prescription.created_at,
                    updatedAt: prescription.updated_at,
                    reviewedBy: prescription.reviewed_by,
                    reviewedAt: prescription.reviewed_at,
                    reviewNotes: prescription.review_notes,
                    user: {
                        email: prescription.user_email,
                        name: prescription.user_name,
                        phone: prescription.user_phone
                    },
                    items: allItems
                }
            };

        } catch (error) {
            console.error(error);
            this.logger.error('Get prescription error:', error);
            throw error;
        }
    }

    async getOrderItemsForPrescription(prescriptionId) {
        try {
            const { rows } = await this.db.query(`
                SELECT 
                    oi.id, oi.product_id, oi.quantity, oi.unit_price,
                    p.title as product_title, p.images as product_images,
                    o.id as order_id, o.status as order_status
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id  
                JOIN products p ON oi.product_id = p.id
                WHERE o.prescription_id = $1
                ORDER BY oi.id
            `, [prescriptionId]);
            
            return rows.map(item => ({
                id: item.id,
                medicationName: item.product_title,
                dosage: 'Theo chỉ định bác sĩ', // Default for order items
                frequency: 'Theo chỉ định bác sĩ', // Default for order items
                duration: null,
                quantity: item.quantity,
                instructions: null,
                productId: item.product_id,
                productTitle: item.product_title,
                productPrice: item.unit_price,
                productImages: item.product_images || [],
                source: 'order', // To distinguish from prescription items
                orderId: item.order_id,
                orderStatus: item.order_status
            }));
        } catch (error) {
            this.logger.error('Get order items for prescription error:', error);
            return []; // Return empty array on error to not break the main flow
        }
    }

    async list(filters = {}, userId = null) {
        try {
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const status = filters.status || '';
            const patientName = filters.patientName || '';
            const doctorName = filters.doctorName || '';
            const startDate = filters.startDate || '';
            const endDate = filters.endDate || '';

            // Validate pagination parameters
            if (page < 1 || limit < 1 || limit > 100) {
                throw ValidationError.invalidNumber('pagination', `page: ${page}, limit: ${limit}`, null, null);
            }

            const offset = (page - 1) * limit;

            // Build query conditions
            let whereConditions = [];
            let queryParams = [];
            let paramCount = 0;

            // User filter (if provided)
            if (userId) {
                paramCount++;
                whereConditions.push(`p.user_id = $${paramCount}`);
                queryParams.push(userId);
            }

            // Status filter
            if (status) {
                paramCount++;
                whereConditions.push(`p.status = $${paramCount}`);
                queryParams.push(status);
            }

            // Patient name filter
            if (patientName) {
                paramCount++;
                whereConditions.push(`p.patient_name ILIKE $${paramCount}`);
                queryParams.push(`%${patientName}%`);
            }

            // Doctor name filter
            if (doctorName) {
                paramCount++;
                whereConditions.push(`p.doctor_name ILIKE $${paramCount}`);
                queryParams.push(`%${doctorName}%`);
            }

            // Date range filter
            if (startDate) {
                paramCount++;
                whereConditions.push(`p.issue_date >= $${paramCount}`);
                queryParams.push(startDate);
            }

            if (endDate) {
                paramCount++;
                whereConditions.push(`p.issue_date <= $${paramCount}`);
                queryParams.push(endDate);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Count total records
            const countQuery = `
                SELECT COUNT(*) as total
                FROM prescriptions p
                ${whereClause}
            `;

            const { rows: countResult } = await this.db.query(countQuery, queryParams);
            const totalRecords = parseInt(countResult[0].total);
            const totalPages = Math.ceil(totalRecords / limit);

            // Fetch prescriptions with pagination
            const prescriptionsQuery = `
                SELECT 
                    p.id, p.user_id, p.patient_name, p.doctor_name, p.clinic_name,
                    p.issue_date, p.expiry_date, p.status, p.created_at, p.updated_at,
                    u.email as user_email, u.full_name as user_name, u.phone as user_phone,
                    COUNT(pi.id) as item_count
                FROM prescriptions p
                LEFT JOIN users u ON p.user_id = u.user_id
                LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
                ${whereClause}
                GROUP BY p.id, u.email, u.full_name, u.phone
                ORDER BY p.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            queryParams.push(limit, offset);

            const { rows: prescriptions } = await this.db.query(prescriptionsQuery, queryParams);

            // Format response
            const formattedPrescriptions = prescriptions.map(prescription => ({
                id: prescription.id,
                userId: prescription.user_id,
                patientName: prescription.patient_name,
                doctorName: prescription.doctor_name,
                clinicName: prescription.clinic_name,
                issueDate: prescription.issue_date,
                expiryDate: prescription.expiry_date,
                status: prescription.status,
                itemCount: parseInt(prescription.item_count),
                createdAt: prescription.created_at,
                updatedAt: prescription.updated_at,
                user: {
                    email: prescription.user_email,
                    name: prescription.user_name,
                    phone: prescription.user_phone
                }
            }));

            return {
                success: true,
                data: {
                    prescriptions: formattedPrescriptions,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalRecords,
                        limit,
                        hasNextPage: page < totalPages,
                        hasPrevPage: page > 1
                    },
                    filters: {
                        status,
                        patientName,
                        doctorName,
                        startDate,
                        endDate
                    }
                }
            };

        } catch (error) {
            this.logger.error('List prescriptions error:', error);
            throw error;
        }
    }

    async updateStatus(prescriptionId, newStatus, reviewerId = null, reviewNotes = null) {
        try {
            this.validator.clearErrors();

            if (!prescriptionId || !newStatus) {
                throw ValidationError.missingFields(['prescriptionId', 'status']);
            }

            // Validate status
            const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
            if (!this.validator.validateEnum('status', newStatus, validStatuses)) {
                throw ValidationError.invalidEnum('status', newStatus, validStatuses);
            }

            // Update prescription status
            const { rows: updatedPrescription } = await this.db.query(
                `UPDATE prescriptions 
                SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, 
                    review_notes = $3, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $4
                RETURNING id, status, updated_at, reviewed_at`,
                [newStatus, reviewerId, reviewNotes, prescriptionId]
            );

            if (updatedPrescription.length === 0) {
                throw NotFoundError.product(prescriptionId); // Reusing product error for prescription
            }

            this.logger.info(`Prescription status updated - ID: ${prescriptionId}, New Status: ${newStatus}, Reviewer: ${reviewerId}`);

            return {
                success: true,
                message: 'Prescription status updated successfully',
                data: {
                    id: updatedPrescription[0].id,
                    status: updatedPrescription[0].status,
                    updatedAt: updatedPrescription[0].updated_at,
                    reviewedAt: updatedPrescription[0].reviewed_at,
                    reviewNotes: reviewNotes
                }
            };

        } catch (error) {
            this.logger.error('Update prescription status error:', error);
            throw error;
        }
    }

    async delete(prescriptionId, userId) {
        try {
            if (!prescriptionId) {
                throw ValidationError.missingFields(['prescriptionId']);
            }

            // Start transaction to clean up images
            const client = await this.db.getClient();
            
            try {
                await client.query('BEGIN');

                // Get prescription details including images
                const { rows: prescriptions } = await client.query(
                    'SELECT id, images, user_id FROM prescriptions WHERE id = $1 AND user_id = $2',
                    [prescriptionId, userId]
                );

                if (prescriptions.length === 0) {
                    throw NotFoundError.product(prescriptionId);
                }

                const prescription = prescriptions[0];
                const images = prescription.images || [];

                // Delete prescription items first
                await client.query(
                    'DELETE FROM prescription_items WHERE prescription_id = $1',
                    [prescriptionId]
                );

                // Delete prescription
                await client.query(
                    'DELETE FROM prescriptions WHERE id = $1',
                    [prescriptionId]
                );

                await client.query('COMMIT');

                // Clean up S3 images (outside transaction)
                const s3DeleteResults = [];
                if (images.length > 0) {
                    this.logger.info(`Cleaning up ${images.length} prescription images for prescription ${prescriptionId}`);
                    
                    for (const imageUrl of images) {
                        try {
                            await this.s3Service.deleteImageFromUrl(imageUrl);
                            s3DeleteResults.push({ url: imageUrl, success: true });
                            this.logger.info(`Successfully deleted prescription image: ${imageUrl}`);
                        } catch (s3Error) {
                            s3DeleteResults.push({ url: imageUrl, success: false, error: s3Error.message });
                            this.logger.warn(`Failed to delete prescription image: ${imageUrl}. Error: ${s3Error.message}`);
                        }
                    }
                }

                this.logger.info(`Prescription deleted - ID: ${prescriptionId}, User: ${userId}`);

                return {
                    success: true,
                    message: 'Prescription deleted successfully',
                    data: {
                        id: prescriptionId,
                        imageCleanup: {
                            totalImages: images.length,
                            results: s3DeleteResults,
                            successfulDeletes: s3DeleteResults.filter(r => r.success).length,
                            failedDeletes: s3DeleteResults.filter(r => !r.success).length
                        }
                    }
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            this.logger.error('Delete prescription error:', error);
            throw error;
        }
    }

    async processBase64Images(images, userId) {
        try {
            if (!images || !Array.isArray(images)) {
                return [];
            }

            const uploadedImageUrls = [];
            
            for (let i = 0; i < images.length; i++) {
                const imageData = images[i];
                
                // Check if it's a base64 image
                if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                    // Extract mime type and base64 data
                    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
                    if (matches) {
                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        
                        // Convert base64 to buffer
                        const buffer = Buffer.from(base64Data, 'base64');
                        
                        // Determine file extension from mime type
                        const fileExtension = mimeType.split('/')[1] || 'jpg';
                        
                        // Create a fake file object for the S3Service
                        const fakeFile = {
                            buffer: buffer,
                            mimetype: mimeType,
                            originalname: `prescription_${i}.${fileExtension}`
                        };
                        
                        // Upload to S3 with prescription folder structure
                        const uploadResult = await this.s3Service.uploadImage(fakeFile, `prescriptions/${userId}`);
                        uploadedImageUrls.push(uploadResult.url);
                        
                        this.logger.info(`Converted base64 prescription image ${i} to S3 URL: ${uploadResult.url}`);
                    } else {
                        // If it's not a valid base64 image, skip it
                        this.logger.warn(`Invalid base64 prescription image format at index ${i}`);
                    }
                } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
                    // If it's already a URL, keep it as is
                    uploadedImageUrls.push(imageData);
                } else {
                    this.logger.warn(`Unknown prescription image format at index ${i}: ${typeof imageData}`);
                }
            }

            return uploadedImageUrls;
            
        } catch (error) {
            this.logger.error('Error processing prescription base64 images:', error);
            throw new Error(`Failed to process prescription images: ${error.message}`);
        }
    }
}

module.exports = Prescription;