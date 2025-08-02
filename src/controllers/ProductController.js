const Product = require('../models/Product');
const Logger = require('../core/Logger');
const S3Service = require('../core/S3Service');

class ProductController {
    constructor() {
        this.productModel = new Product();
        this.logger = new Logger();
        this.s3Service = new S3Service();
    }

    async createProduct(req, res) {
        try {
            const result = await this.productModel.create(req.body);
            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Create product controller error:', error);
            
            if (error.message.includes('Required fields are missing')) {
                const missingFields = error.message.match(/\[(.*)\]/)?.[1]?.split(', ') || [];
                return res.status(400).json({
                    error: 'Required fields are missing',
                    missingFields
                });
            }
            
            if (error.message.includes('priceValue must be a non-negative number')) {
                return res.status(400).json({
                    error: 'priceValue must be a non-negative number'
                });
            }
            
            if (error.message.includes('Invalid status')) {
                return res.status(400).json({
                    error: 'Invalid status',
                    validOptions: ['active', 'inactive', 'out_of_stock']
                });
            }
            
            if (error.message.includes('stockQuantity must be a non-negative number')) {
                return res.status(400).json({
                    error: 'stockQuantity must be a non-negative number'
                });
            }
            
            if (error.message.includes('Invalid expiry date format')) {
                return res.status(400).json({
                    error: 'Invalid expiry date format. Use YYYY-MM-DD'
                });
            }
            
            if (error.message.includes('SKU already exists')) {
                return res.status(409).json({
                    error: 'A product with this SKU already exists'
                });
            }
            
            res.status(500).json({
                error: 'Failed to create product: ' + error.message
            });
        }
    }

    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await this.productModel.update(id, req.body);
            res.json(result);
        } catch (error) {
            this.logger.error('Update product controller error:', error);
            
            if (error.message === 'Product not found') {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            if (error.message.includes('priceValue must be a non-negative number')) {
                return res.status(400).json({
                    error: 'priceValue must be a non-negative number'
                });
            }
            
            if (error.message.includes('Invalid status')) {
                return res.status(400).json({
                    error: 'Invalid status',
                    validOptions: ['active', 'inactive', 'out_of_stock']
                });
            }
            
            if (error.message.includes('stockQuantity must be a non-negative number')) {
                return res.status(400).json({
                    error: 'stockQuantity must be a non-negative number'
                });
            }
            
            if (error.message.includes('Invalid expiry date format')) {
                return res.status(400).json({
                    error: 'Invalid expiry date format. Use YYYY-MM-DD'
                });
            }
            
            if (error.message.includes('SKU is already taken')) {
                return res.status(409).json({
                    error: 'SKU is already taken by another product'
                });
            }
            
            res.status(500).json({
                error: 'Failed to update product: ' + error.message
            });
        }
    }

    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await this.productModel.delete(id);
            res.json(result);
        } catch (error) {
            this.logger.error('Delete product controller error:', error);
            
            if (error.message === 'Product ID is required') {
                return res.status(400).json({
                    error: 'Product ID is required'
                });
            }
            
            if (error.message === 'Product not found') {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            res.status(500).json({
                error: 'Failed to delete product: ' + error.message
            });
        }
    }

    async getProduct(req, res) {
        try {
            const { id } = req.params;
            const result = await this.productModel.getById(id);
            res.json(result);
        } catch (error) {
            this.logger.error('Get product controller error:', error);
            
            if (error.message === 'Product ID is required') {
                return res.status(400).json({
                    error: 'Product ID is required'
                });
            }
            
            if (error.message === 'Product not found') {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            res.status(500).json({
                error: 'Failed to get product: ' + error.message
            });
        }
    }

    async listProducts(req, res) {
        try {
            const filters = {
                page: req.query.page,
                limit: req.query.limit,
                search: req.query.search,
                category: req.query.category,
                status: req.query.status,
                manufacturer: req.query.manufacturer
            };
            
            const result = await this.productModel.list(filters);
            res.json(result);
        } catch (error) {
            this.logger.error('List products controller error:', error);
            
            if (error.message.includes('Invalid pagination parameters')) {
                return res.status(400).json({
                    error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100'
                });
            }
            
            res.status(500).json({
                error: 'Failed to list products: ' + error.message
            });
        }
    }

    async uploadImage(req, res) {
        try {
            const { productId } = req.params;
            
            if (!req.file) {
                return res.status(400).json({
                    error: 'No image file provided'
                });
            }

            // Check if product exists
            const productResult = await this.productModel.getById(productId);
            if (!productResult.success) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }

            // Upload image to S3
            const uploadResult = await this.s3Service.uploadImage(req.file, productId);
            
            // Get current product data
            const currentProduct = productResult.data;
            const currentImages = currentProduct.images || [];
            
            // Add new image to the array
            const updatedImages = [...currentImages, uploadResult.url];
            
            // Update product with new image array
            const updateResult = await this.productModel.update(productId, {
                images: updatedImages
            });

            res.json({
                success: true,
                message: 'Image uploaded successfully',
                data: {
                    imageUrl: uploadResult.url,
                    imageKey: uploadResult.key,
                    updatedImages: updatedImages
                }
            });
        } catch (error) {
            this.logger.error('Upload image controller error:', error);
            
            if (error.message.includes('Product not found')) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            if (error.message.includes('Failed to upload image')) {
                return res.status(500).json({
                    error: 'Failed to upload image to S3'
                });
            }
            
            res.status(500).json({
                error: 'Failed to upload image: ' + error.message
            });
        }
    }

    async deleteImage(req, res) {
        try {
            const { productId, imageIndex } = req.params;
            
            // Check if product exists
            const productResult = await this.productModel.getById(productId);
            if (!productResult.success) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }

            const currentProduct = productResult.data;
            const currentImages = currentProduct.images || [];
            
            if (imageIndex < 0 || imageIndex >= currentImages.length) {
                return res.status(400).json({
                    error: 'Invalid image index'
                });
            }

            const imageUrl = currentImages[imageIndex];
            const imageKey = this.s3Service.extractKeyFromUrl(imageUrl);
            
            if (!imageKey) {
                return res.status(400).json({
                    error: 'Invalid image URL'
                });
            }

            // Delete image from S3
            await this.s3Service.deleteImage(imageKey);
            
            // Remove image from array
            const updatedImages = currentImages.filter((_, index) => index !== parseInt(imageIndex));
            
            // Update main image index if necessary
            let mainImageIndex = currentProduct.mainImageIndex || 0;
            if (parseInt(imageIndex) === mainImageIndex) {
                mainImageIndex = updatedImages.length > 0 ? 0 : 0;
            } else if (parseInt(imageIndex) < mainImageIndex) {
                mainImageIndex = Math.max(0, mainImageIndex - 1);
            }
            
            // Update product
            const updateResult = await this.productModel.update(productId, {
                images: updatedImages,
                mainImageIndex: mainImageIndex
            });

            res.json({
                success: true,
                message: 'Image deleted successfully',
                data: {
                    deletedImageUrl: imageUrl,
                    updatedImages: updatedImages,
                    mainImageIndex: mainImageIndex
                }
            });
        } catch (error) {
            this.logger.error('Delete image controller error:', error);
            
            if (error.message.includes('Product not found')) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            if (error.message.includes('Invalid image index')) {
                return res.status(400).json({
                    error: 'Invalid image index'
                });
            }
            
            res.status(500).json({
                error: 'Failed to delete image: ' + error.message
            });
        }
    }

    async setMainImage(req, res) {
        try {
            const { productId, imageIndex } = req.params;
            
            // Check if product exists
            const productResult = await this.productModel.getById(productId);
            if (!productResult.success) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }

            const currentProduct = productResult.data;
            const currentImages = currentProduct.images || [];
            
            if (imageIndex < 0 || imageIndex >= currentImages.length) {
                return res.status(400).json({
                    error: 'Invalid image index'
                });
            }

            // Update main image index
            const updateResult = await this.productModel.update(productId, {
                mainImageIndex: parseInt(imageIndex)
            });

            res.json({
                success: true,
                message: 'Main image updated successfully',
                data: {
                    mainImageIndex: parseInt(imageIndex),
                    mainImageUrl: currentImages[parseInt(imageIndex)]
                }
            });
        } catch (error) {
            this.logger.error('Set main image controller error:', error);
            
            if (error.message.includes('Product not found')) {
                return res.status(404).json({
                    error: 'Product not found'
                });
            }
            
            if (error.message.includes('Invalid image index')) {
                return res.status(400).json({
                    error: 'Invalid image index'
                });
            }
            
            res.status(500).json({
                error: 'Failed to set main image: ' + error.message
            });
        }
    }
}

module.exports = ProductController; 