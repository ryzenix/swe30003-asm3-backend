const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');

class Product {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    async create(productData) {
        try {
            this.validator.clearErrors();

            // Validate required fields
            const requiredFields = ['title', 'sku', 'priceValue', 'category'];
            if (!this.validator.validateRequired(productData, requiredFields)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate price_value
            if (!this.validator.validateNumber('priceValue', productData.priceValue, 0)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate status
            const validStatuses = ['active', 'inactive', 'out_of_stock'];
            if (!this.validator.validateEnum('status', productData.status, validStatuses)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate stock quantity
            if (!this.validator.validateNumber('stockQuantity', productData.stockQuantity, 0)) {
                throw new Error(this.validator.getErrors()[0].message);
            }

            // Validate expiry date format if provided
            if (productData.expiryDate) {
                if (!this.validator.validateDate('expiryDate', productData.expiryDate)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Check if SKU already exists
            const { rows: existingProducts } = await this.db.query(
                'SELECT COUNT(*) AS count FROM products WHERE sku = $1',
                [productData.sku]
            );

            if (existingProducts[0].count > 0) {
                throw new Error('A product with this SKU already exists');
            }

            // Insert product into database
            const { rows: newProduct } = await this.db.query(
                `INSERT INTO products (
                    title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING id`,
                [
                    productData.title, productData.sku, productData.price, productData.priceValue, 
                    productData.unit, productData.category, productData.subcategory,
                    productData.manufacturer, productData.status || 'inactive', 
                    productData.stockQuantity || 0, productData.expiryDate, 
                    productData.requiresPrescription || false, productData.description, 
                    productData.uses, productData.ingredients || [], 
                    productData.usageInstructions || [], productData.images || [], 
                    productData.mainImageIndex || 0
                ]
            );

            this.logger.info(`Product created: ${productData.title} (SKU: ${productData.sku}) (ID: ${newProduct[0].id})`);

            return {
                success: true,
                message: 'Product created successfully',
                data: {
                    id: newProduct[0].id,
                    ...productData
                }
            };

        } catch (error) {
            this.logger.error('Create product error:', error);
            throw error;
        }
    }

    async update(id, updateData) {
        try {
            this.validator.clearErrors();

            // Check if product exists
            const { rows: existingProduct } = await this.db.query(
                'SELECT id FROM products WHERE id = $1',
                [id]
            );

            if (existingProduct.length === 0) {
                throw new Error('Product not found');
            }

            // Validate price_value if provided
            if (updateData.priceValue !== undefined) {
                if (!this.validator.validateNumber('priceValue', updateData.priceValue, 0)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Validate status if provided
            if (updateData.status) {
                const validStatuses = ['active', 'inactive', 'out_of_stock'];
                if (!this.validator.validateEnum('status', updateData.status, validStatuses)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Validate stock quantity if provided
            if (updateData.stockQuantity !== undefined) {
                if (!this.validator.validateNumber('stockQuantity', updateData.stockQuantity, 0)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Validate expiry date format if provided
            if (updateData.expiryDate) {
                if (!this.validator.validateDate('expiryDate', updateData.expiryDate)) {
                    throw new Error(this.validator.getErrors()[0].message);
                }
            }

            // Check if SKU is already taken by another product (only if SKU is being updated)
            if (updateData.sku) {
                const { rows: skuConflict } = await this.db.query(
                    'SELECT id FROM products WHERE sku = $1 AND id != $2',
                    [updateData.sku, id]
                );

                if (skuConflict.length > 0) {
                    throw new Error('SKU is already taken by another product');
                }
            }

            // Build dynamic update query based on provided fields
            const updateFields = [];
            const updateValues = [];
            let paramCount = 0;

            const fieldsToUpdate = [
                'title', 'sku', 'price', 'priceValue', 'unit', 'category', 
                'subcategory', 'manufacturer', 'status', 'stockQuantity', 'expiryDate', 
                'requiresPrescription', 'description', 'uses', 'ingredients', 'usageInstructions',
                'images', 'mainImageIndex'
            ];

            for (const field of fieldsToUpdate) {
                if (updateData[field] !== undefined) {
                    const dbField = field === 'priceValue' ? 'price_value' : 
                                   field === 'stockQuantity' ? 'stock_quantity' : 
                                   field === 'expiryDate' ? 'expiry_date' : 
                                   field === 'requiresPrescription' ? 'requires_prescription' : 
                                   field === 'usageInstructions' ? 'usage_instructions' : 
                                   field === 'mainImageIndex' ? 'main_image_index' : field;
                    
                    updateFields.push(`${dbField} = $${++paramCount}`);
                    updateValues.push(updateData[field]);
                }
            }

            // Add product id as the last parameter
            updateValues.push(id);

            // Update product
            await this.db.query(
                `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramCount + 1}`,
                updateValues
            );

            // Get updated product information
            const { rows: updatedProduct } = await this.db.query(
                `SELECT 
                    id, title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index
                FROM products 
                WHERE id = $1`,
                [id]
            );

            const product = updatedProduct[0];

            this.logger.info(`Product updated (ID: ${id}) - Updated fields: ${Object.keys(updateData).join(', ')}`);

            return {
                success: true,
                message: 'Product updated successfully',
                data: {
                    id: product.id,
                    title: product.title,
                    sku: product.sku,
                    price: product.price,
                    priceValue: product.price_value,
                    unit: product.unit,
                    category: product.category,
                    subcategory: product.subcategory,
                    manufacturer: product.manufacturer,
                    status: product.status,
                    stockQuantity: product.stock_quantity,
                    expiryDate: product.expiry_date ? new Date(product.expiry_date).toISOString().split('T')[0] : null,
                    requiresPrescription: product.requires_prescription,
                    description: product.description,
                    uses: product.uses,
                    ingredients: product.ingredients || [],
                    usageInstructions: product.usage_instructions || [],
                    images: product.images || [],
                    mainImageIndex: product.main_image_index || 0
                }
            };

        } catch (error) {
            this.logger.error('Update product error:', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            // Check if product exists
            const { rows: existingProduct } = await this.db.query(
                'SELECT id, title, sku FROM products WHERE id = $1',
                [id]
            );

            if (existingProduct.length === 0) {
                throw new Error('Product not found');
            }

            const productTitle = existingProduct[0].title;
            const productSku = existingProduct[0].sku;

            // Delete the product
            await this.db.query(
                'DELETE FROM products WHERE id = $1',
                [id]
            );

            this.logger.info(`Product deleted - ID: ${id}, Title: ${productTitle}, SKU: ${productSku}`);

            return {
                success: true,
                message: 'Product deleted successfully',
                data: {
                    deletedProduct: {
                        id: parseInt(id),
                        title: productTitle,
                        sku: productSku
                    }
                }
            };

        } catch (error) {
            this.logger.error('Delete product error:', error);
            throw error;
        }
    }

    async getById(id) {
        try {
            if (!id) {
                throw new Error('Product ID is required');
            }

            const { rows: products } = await this.db.query(
                `SELECT 
                    id, title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index
                FROM products 
                WHERE id = $1`,
                [id]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const product = products[0];

            return {
                success: true,
                data: {
                    id: product.id,
                    title: product.title,
                    sku: product.sku,
                    price: product.price,
                    priceValue: product.price_value,
                    unit: product.unit,
                    category: product.category,
                    subcategory: product.subcategory,
                    manufacturer: product.manufacturer,
                    status: product.status,
                    stockQuantity: product.stock_quantity,
                    expiryDate: product.expiry_date ? new Date(product.expiry_date).toISOString().split('T')[0] : null,
                    requiresPrescription: product.requires_prescription,
                    description: product.description,
                    uses: product.uses,
                    ingredients: product.ingredients || [],
                    usageInstructions: product.usage_instructions || [],
                    images: product.images || [],
                    mainImageIndex: product.main_image_index || 0
                }
            };

        } catch (error) {
            this.logger.error('Get product error:', error);
            throw error;
        }
    }

    async list(filters = {}) {
        try {
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const search = filters.search || '';
            const category = filters.category || '';
            const status = filters.status || '';
            const manufacturer = filters.manufacturer || '';

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
                whereConditions.push(`(title ILIKE $${paramCount} OR sku ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
                queryParams.push(`%${search}%`);
            }

            if (category) {
                paramCount++;
                whereConditions.push(`category = $${paramCount}`);
                queryParams.push(category);
            }

            if (status) {
                paramCount++;
                whereConditions.push(`status = $${paramCount}`);
                queryParams.push(status);
            }

            if (manufacturer) {
                paramCount++;
                whereConditions.push(`manufacturer ILIKE $${paramCount}`);
                queryParams.push(`%${manufacturer}%`);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Count total records
            const countQuery = `
                SELECT COUNT(*) as total
                FROM products
                ${whereClause}
            `;

            const { rows: countResult } = await this.db.query(countQuery, queryParams);
            const totalRecords = parseInt(countResult[0].total);
            const totalPages = Math.ceil(totalRecords / limit);

            // Fetch products with pagination
            const productsQuery = `
                SELECT 
                    id, title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index
                FROM products
                ${whereClause}
                ORDER BY title ASC, sku ASC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            queryParams.push(limit, offset);

            const { rows: products } = await this.db.query(productsQuery, queryParams);

            // Format response
            const formattedProducts = products.map(product => ({
                id: product.id,
                title: product.title,
                sku: product.sku,
                price: product.price,
                priceValue: product.price_value,
                unit: product.unit,
                category: product.category,
                subcategory: product.subcategory,
                manufacturer: product.manufacturer,
                status: product.status,
                stockQuantity: product.stock_quantity,
                expiryDate: product.expiry_date ? new Date(product.expiry_date).toISOString().split('T')[0] : null,
                requiresPrescription: product.requires_prescription,
                description: product.description,
                uses: product.uses,
                ingredients: product.ingredients || [],
                usageInstructions: product.usage_instructions || [],
                images: product.images || [],
                mainImageIndex: product.main_image_index || 0
            }));

            return {
                success: true,
                data: {
                    products: formattedProducts,
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
                        category,
                        status,
                        manufacturer
                    }
                }
            };

        } catch (error) {
            this.logger.error('List products error:', error);
            throw error;
        }
    }
}

module.exports = Product; 