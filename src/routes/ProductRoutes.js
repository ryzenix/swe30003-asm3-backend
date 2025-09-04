const express = require('express');
const multer = require('multer');
const ProductController = require('../controllers/ProductController');
const Authenticator = require('../core/Authenticator');
const ServiceManager = require('../core/ServiceManager');
const TimeoutMiddleware = require('../middleware/timeoutMiddleware');

class ProductRoutes {
    constructor() {
        this.router = express.Router();
        this.productController = new ProductController();
        this.authenticator = new Authenticator();
        this.timeoutMiddleware = new TimeoutMiddleware();
        
        // Use ServiceManager to get shared service instances
        const serviceManager = ServiceManager.getInstance();
        this.logger = serviceManager.getLogger();
        
        // Configure multer for file uploads
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
                fieldSize: 10 * 1024 * 1024, // 10MB for other fields
            },
            fileFilter: (req, file, cb) => {
                // Accept only image files
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files are allowed. Supported formats: jpg, jpeg, png, gif, webp'), false);
                }
            }
        });
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Logging middleware
        this.router.use(this.logger.logRequest.bind(this.logger));
        
        // Error handling for multer
        this.router.use((err, req, res, next) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        error: 'File too large',
                        message: 'Maximum file size is 5MB'
                    });
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({
                        error: 'Unexpected file field',
                        message: 'Please use the correct field name: "image"'
                    });
                }
                return res.status(400).json({
                    error: 'File upload error',
                    message: err.message
                });
            }
            
            // Handle file filter errors
            if (err.message && err.message.includes('Only image files are allowed')) {
                return res.status(400).json({
                    error: 'Invalid file type',
                    message: err.message
                });
            }
            
            next(err);
        });
    }

    setupRoutes() {
        // Customer routes for fetching products
        this.router.get('/list', 
            this.productController.listProducts.bind(this.productController)
        );
        this.router.get('/filter-options', 
            this.productController.getFilterOptions.bind(this.productController)
        );
        this.router.get('/:id', 
            this.productController.getProduct.bind(this.productController)
        );

        // Check product availability (for cart validation)
        this.router.post('/check-availability',
            this.authenticator.authenticateUser.bind(this.authenticator),
            this.productController.checkAvailability.bind(this.productController)
        );

        // Management routes (require superuser or pharmacist authentication)
        this.router.post('/management/create', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.createProduct.bind(this.productController)
        );
        
        this.router.put('/management/update/:id', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.updateProduct.bind(this.productController)
        );
        
        this.router.delete('/management/delete/:id', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.deleteProduct.bind(this.productController)
        );

        // Image management routes (require superuser or pharmacist authentication)
        this.router.post('/management/:productId/images/upload', 
            this.timeoutMiddleware.uploadTimeout(),
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.upload.single('image'),
            this.productController.uploadImage.bind(this.productController)
        );
        
        this.router.delete('/management/:productId/images/:imageIndex', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.deleteImage.bind(this.productController)
        );
        
        this.router.put('/management/:productId/images/:imageIndex/main', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.setMainImage.bind(this.productController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ProductRoutes; 