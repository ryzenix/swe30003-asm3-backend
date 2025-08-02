const express = require('express');
const multer = require('multer');
const ProductController = require('../controllers/ProductController');
const Authenticator = require('../core/Authenticator');
const Logger = require('../core/Logger');

class ProductRoutes {
    constructor() {
        this.router = express.Router();
        this.productController = new ProductController();
        this.authenticator = new Authenticator();
        this.logger = new Logger();
        
        // Configure multer for file uploads
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
            fileFilter: (req, file, cb) => {
                // Accept only image files
                if (file.mimetype.startsWith('image/')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files are allowed'), false);
                }
            }
        });
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Logging middleware
        this.router.use(this.logger.logRequest.bind(this.logger));
    }

    setupRoutes() {
        // Public routes (no authentication required)
        this.router.get('/list', this.productController.listProducts.bind(this.productController));
        this.router.get('/:id', this.productController.getProduct.bind(this.productController));

        // Protected routes (require authentication)
        this.router.post('/create', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.createProduct.bind(this.productController)
        );
        
        this.router.put('/update/:id', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.updateProduct.bind(this.productController)
        );
        
        this.router.delete('/delete/:id', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.deleteProduct.bind(this.productController)
        );

        // Image management routes (require authentication)
        this.router.post('/:productId/images/upload', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.upload.single('image'),
            this.productController.uploadImage.bind(this.productController)
        );
        
        this.router.delete('/:productId/images/:imageIndex', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.deleteImage.bind(this.productController)
        );
        
        this.router.put('/:productId/images/:imageIndex/main', 
            this.authenticator.authenticateSuperuserOrPharmacist.bind(this.authenticator),
            this.productController.setMainImage.bind(this.productController)
        );
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ProductRoutes; 