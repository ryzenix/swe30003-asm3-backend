const express = require('express');
const multer = require('multer');
const PrescriptionController = require('../controllers/PrescriptionController');
const Authenticator = require('../core/Authenticator');
const TimeoutMiddleware = require('../middleware/timeoutMiddleware');

class PrescriptionRoutes {
    constructor() {
        this.router = express.Router();
        this.prescriptionController = new PrescriptionController();
        this.authenticator = new Authenticator();
        this.timeoutMiddleware = new TimeoutMiddleware();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Apply timeout middleware to all routes
        this.router.use(this.timeoutMiddleware.apiTimeout());
        
        // Parse JSON bodies
        this.router.use(express.json({ limit: '10mb' }));
        this.router.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Configure multer for file uploads
        const storage = multer.memoryStorage();
        this.upload = multer({
            storage: storage,
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB limit
                files: 5 // Maximum 5 files
            },
            fileFilter: (req, file, cb) => {
                // Accept only image files
                if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files or PDF files are allowed'), false);
                }
            }
        });
    }

    setupRoutes() {
        // Public routes (require authentication but accessible to all authenticated users)
        
        // Create new prescription
        this.router.post('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.createPrescription.bind(this.prescriptionController)
        );

        // Get user's prescription summary
        this.router.get('/summary', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.getUserPrescriptionSummary.bind(this.prescriptionController)
        );

        // List prescriptions (filtered by user for regular users, all prescriptions for superuser/pharmacist)
        this.router.get('/', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.listPrescriptions.bind(this.prescriptionController)
        );

        // Get specific prescription by ID
        this.router.get('/:id', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.getPrescription.bind(this.prescriptionController)
        );

        // Delete prescription (only prescription owner can delete)
        this.router.delete('/:id', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.deletePrescription.bind(this.prescriptionController)
        );

        // Upload prescription image
        this.router.post('/:prescriptionId/images', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.upload.single('image'),
            this.timeoutMiddleware.uploadTimeout(),
            this.prescriptionController.uploadPrescriptionImage.bind(this.prescriptionController)
        );

        // Delete prescription image
        this.router.delete('/:prescriptionId/images/:imageIndex', 
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.prescriptionController.deletePrescriptionImage.bind(this.prescriptionController)
        );

        // Protected routes (require superuser or pharmacist role)
        
        // Update prescription status (only superuser/pharmacist)
        this.router.patch('/:id/status', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.prescriptionController.updatePrescriptionStatus.bind(this.prescriptionController)
        );

        // Get prescription statistics (only superuser/pharmacist)
        this.router.get('/admin/statistics', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.prescriptionController.getPrescriptionStatistics.bind(this.prescriptionController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = PrescriptionRoutes;