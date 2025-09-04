const Database = require('../core/Database');
const Validator = require('../core/Validator');
const ServiceManager = require('../core/ServiceManager');
const { 
    ValidationError, 
    NotFoundError, 
    ConflictError, 
    ExternalServiceError 
} = require('../core/errors');

class Product {
    constructor() {
        this.db = new Database();
        this.validator = new Validator();
        
        // Use ServiceManager to get shared service instances
        const serviceManager = ServiceManager.getInstance();
        this.logger = serviceManager.getLogger();
    }

    async create(productData) {
        try {
            this.validator.clearErrors();

            // Validate required fields - SKU is optional, will be auto-generated if not provided
            const requiredFields = ['title', 'priceValue', 'category', 'manufacturer', 'unit'];
            if (!this.validator.validateRequired(productData, requiredFields)) {
                const missingFields = requiredFields.filter(field => 
                    productData[field] === undefined || productData[field] === null || productData[field] === ''
                );
                throw ValidationError.missingFields(missingFields);
            }

            // Auto-generate SKU if not provided
            if (!productData.sku || productData.sku.trim() === '') {
                productData.sku = await this.generateUniqueSKU(productData.title);
            }

            // Validate price_value
            if (!this.validator.validateNumber('priceValue', productData.priceValue, 0)) {
                throw ValidationError.invalidNumber('priceValue', productData.priceValue, 0);
            }

            // Validate status
            const validStatuses = ['active', 'inactive', 'out_of_stock'];
            if (!this.validator.validateEnum('status', productData.status, validStatuses)) {
                throw ValidationError.invalidEnum('status', productData.status, validStatuses);
            }

            // Validate stock quantity
            if (!this.validator.validateNumber('stockQuantity', productData.stockQuantity, 0)) {
                throw ValidationError.invalidNumber('stockQuantity', productData.stockQuantity, 0);
            }

            // Validate expiry date format if provided
            if (productData.expiryDate) {
                if (!this.validator.validateDate('expiryDate', productData.expiryDate)) {
                    throw ValidationError.invalidFormat('expiryDate', 'YYYY-MM-DD');
                }
            }

            // Check if SKU already exists
            const { rows: existingProducts } = await this.db.query(
                'SELECT COUNT(*) AS count FROM products WHERE sku = $1',
                [productData.sku]
            );

            if (existingProducts[0].count > 0) {
                throw ConflictError.duplicateSKU(productData.sku);
            }

            // Auto-calculate formatted price from priceValue
            const formattedPrice = productData.price || `${parseInt(productData.priceValue).toLocaleString('vi-VN')}đ`;

            // Insert product into database
            const { rows: newProduct } = await this.db.query(
                `INSERT INTO products (
                    title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index, origin
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id`,
                [
                    productData.title, productData.sku, formattedPrice, productData.priceValue, 
                    productData.unit, productData.category, productData.subcategory || null,
                    productData.manufacturer, productData.status || 'active', 
                    productData.stockQuantity || 0, productData.expiryDate || null, 
                    productData.requiresPrescription || false, productData.description || null, 
                    productData.uses || null, productData.ingredients || [], 
                    productData.usageInstructions || [], productData.images || [], 
                    productData.mainImageIndex || 0, productData.origin || null
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
                throw NotFoundError.product(id);
            }

            // Validate price_value if provided
            if (updateData.priceValue !== undefined) {
                if (!this.validator.validateNumber('priceValue', updateData.priceValue, 0)) {
                    throw ValidationError.invalidNumber('priceValue', updateData.priceValue, 0);
                }
            }

            // Validate status if provided
            if (updateData.status) {
                const validStatuses = ['active', 'inactive', 'out_of_stock'];
                if (!this.validator.validateEnum('status', updateData.status, validStatuses)) {
                    throw ValidationError.invalidEnum('status', updateData.status, validStatuses);
                }
            }

            // Validate stock quantity if provided
            if (updateData.stockQuantity !== undefined) {
                if (!this.validator.validateNumber('stockQuantity', updateData.stockQuantity, 0)) {
                    throw ValidationError.invalidNumber('stockQuantity', updateData.stockQuantity, 0);
                }
            }

            // Validate expiry date format if provided
            if (updateData.expiryDate) {
                if (!this.validator.validateDate('expiryDate', updateData.expiryDate)) {
                    throw ValidationError.invalidFormat('expiryDate', 'YYYY-MM-DD');
                }
            }

            // Check if SKU is already taken by another product (only if SKU is being updated)
            if (updateData.sku) {
                const { rows: skuConflict } = await this.db.query(
                    'SELECT id FROM products WHERE sku = $1 AND id != $2',
                    [updateData.sku, id]
                );

                if (skuConflict.length > 0) {
                    throw ConflictError.resourceTaken('SKU', updateData.sku);
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
                'images', 'mainImageIndex', 'origin'
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
                    
                    // If updating priceValue, also auto-update the formatted price
                    if (field === 'priceValue') {
                        updateValues.push(updateData[field]);
                        updateFields.push(`price = $${++paramCount}`);
                        updateValues.push(`${parseInt(updateData[field]).toLocaleString('vi-VN')}đ`);
                    } else {
                        updateValues.push(updateData[field]);
                    }
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
                    description, uses, ingredients, usage_instructions, images, main_image_index, origin
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
                    mainImageIndex: product.main_image_index || 0,
                    origin: product.origin
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
                throw ValidationError.missingFields(['id']);
            }

            // Check if product exists
            const { rows: existingProduct } = await this.db.query(
                'SELECT id, title, sku FROM products WHERE id = $1',
                [id]
            );

            if (existingProduct.length === 0) {
                throw NotFoundError.product(id);
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
                throw ValidationError.missingFields(['id']);
            }

            const { rows: products } = await this.db.query(
                `SELECT 
                    id, title, sku, price, price_value, unit, category, subcategory,
                    manufacturer, status, stock_quantity, expiry_date, requires_prescription,
                    description, uses, ingredients, usage_instructions, images, main_image_index, origin
                FROM products 
                WHERE id = $1`,
                [id]
            );

            if (products.length === 0) {
                throw NotFoundError.product(id);
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
                    mainImageIndex: product.main_image_index || 0,
                    origin: product.origin
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
            const sort = filters.sort || '';

            // Validate pagination parameters
            if (page < 1 || limit < 1 || limit > 100) {
                throw ValidationError.invalidNumber('pagination', `page: ${page}, limit: ${limit}`, null, null);
            }

            // Validate sort parameter
            if (sort && !['price_asc', 'price_desc'].includes(sort)) {
                throw ValidationError.invalidValue('sort', sort, ['price_asc', 'price_desc']);
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

            // Build ORDER BY clause
            let orderByClause = 'ORDER BY ';
            if (sort === 'price_asc') {
                orderByClause += 'price_value ASC, title ASC';
            } else if (sort === 'price_desc') {
                orderByClause += 'price_value DESC, title ASC';
            } else {
                orderByClause += 'title ASC, sku ASC';
            }

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
                    description, uses, ingredients, usage_instructions, images, main_image_index, origin
                FROM products
                ${whereClause}
                ${orderByClause}
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
                mainImageIndex: product.main_image_index || 0,
                origin: product.origin
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
                        manufacturer,
                        sort
                    }
                }
            };

        } catch (error) {
            this.logger.error('List products error:', error);
            throw error;
        }
    }

    async getFilterOptions() {
        try {
            // Get distinct categories and subcategories
            const { rows: categories } = await this.db.query(`
                SELECT DISTINCT 
                    category,
                    subcategory
                FROM products 
                WHERE category IS NOT NULL 
                ORDER BY category, subcategory
            `);

            // Get price ranges (min and max)
            const { rows: priceRange } = await this.db.query(`
                SELECT 
                    MIN(price_value) as min_price,
                    MAX(price_value) as max_price
                FROM products 
                WHERE price_value IS NOT NULL
            `);

            // Get distinct manufacturers
            const { rows: manufacturers } = await this.db.query(`
                SELECT DISTINCT manufacturer
                FROM products 
                WHERE manufacturer IS NOT NULL 
                ORDER BY manufacturer
            `);

            // Get distinct origins
            const { rows: origins } = await this.db.query(`
                SELECT DISTINCT origin
                FROM products 
                WHERE origin IS NOT NULL 
                ORDER BY origin
            `);

            // Get available statuses
            const { rows: statuses } = await this.db.query(`
                SELECT DISTINCT status
                FROM products 
                WHERE status IS NOT NULL 
                ORDER BY status
            `);

            // Count products with discounts (assuming discount field exists or calculate from price logic)
            const { rows: discountCount } = await this.db.query(`
                SELECT COUNT(*) as count
                FROM products 
                WHERE price_value < (
                    SELECT AVG(price_value) 
                    FROM products 
                    WHERE category = products.category
                )
            `);

            // Count products requiring prescription
            const { rows: prescriptionCount } = await this.db.query(`
                SELECT 
                    COUNT(CASE WHEN requires_prescription = true THEN 1 END) as requires_prescription_count,
                    COUNT(CASE WHEN requires_prescription = false THEN 1 END) as no_prescription_count
                FROM products
            `);

            // Process categories to group by category and subcategory
            const categoryMap = {};
            categories.forEach(row => {
                if (!categoryMap[row.category]) {
                    categoryMap[row.category] = [];
                }
                if (row.subcategory && !categoryMap[row.category].includes(row.subcategory)) {
                    categoryMap[row.category].push(row.subcategory);
                }
            });

            // Automatically create price ranges based on actual data distribution
            const minPrice = priceRange[0]?.min_price || 0;
            const maxPrice = priceRange[0]?.max_price || 1000000;
            
            // Get price distribution to create meaningful ranges
            const { rows: priceDistribution } = await this.db.query(`
                SELECT 
                    price_value,
                    COUNT(*) as product_count
                FROM products 
                WHERE price_value IS NOT NULL 
                GROUP BY price_value 
                ORDER BY price_value
            `);

            // Create dynamic price ranges based on quartiles
            const priceRanges = [];
            if (priceDistribution.length > 0) {
                const priceGap = (maxPrice - minPrice) / 5; // Create 5 ranges
                
                for (let i = 0; i < 5; i++) {
                    const rangeMin = Math.floor(minPrice + (priceGap * i));
                    const rangeMax = i === 4 ? maxPrice : Math.floor(minPrice + (priceGap * (i + 1)));
                    
                    // Format price labels in Vietnamese currency
                    const formatPrice = (price) => {
                        if (price >= 1000000) {
                            return `${(price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1)}tr`;
                        } else if (price >= 1000) {
                            return `${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 0)}k`;
                        }
                        return `${price}`;
                    };
                    
                    let label;
                    if (i === 0) {
                        label = `Dưới ${formatPrice(rangeMax)}đ`;
                    } else if (i === 4) {
                        label = `Trên ${formatPrice(rangeMin)}đ`;
                    } else {
                        label = `${formatPrice(rangeMin)}đ - ${formatPrice(rangeMax)}đ`;
                    }
                    
                    priceRanges.push({
                        label,
                        min: rangeMin,
                        max: rangeMax
                    });
                }
            }

            return {
                success: true,
                data: {
                    categories: Object.keys(categoryMap).map(category => ({
                        category,
                        subcategories: categoryMap[category]
                    })),
                    priceRange: {
                        min: minPrice,
                        max: maxPrice,
                        suggestedRanges: priceRanges
                    },
                    manufacturers: manufacturers.map(row => row.manufacturer),
                    origins: origins.map(row => row.origin),
                    statuses: statuses.map(row => row.status),
                    availability: {
                        hasDiscountedProducts: discountCount[0]?.count > 0,
                        prescriptionOptions: {
                            requiresPrescription: prescriptionCount[0]?.requires_prescription_count > 0,
                            noPrescription: prescriptionCount[0]?.no_prescription_count > 0
                        }
                    }
                }
            };

        } catch (error) {
            this.logger.error('Get filter options error:', error);
            throw error;
        }
    }

    // Helper method to generate unique SKU
    async generateUniqueSKU(productTitle) {
        try {
            // Create base SKU from product title
            const baseSKU = productTitle
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, '') // Remove spaces
                .substring(0, 8) // Take first 8 characters
                .toUpperCase();
            
            // Add timestamp to make it unique
            const timestamp = Date.now().toString().slice(-6); // Last 6 digits
            let candidateSKU = `${baseSKU}${timestamp}`;
            
            // Check if SKU already exists and generate a new one if needed
            let counter = 0;
            while (true) {
                const { rows: existingProducts } = await this.db.query(
                    'SELECT COUNT(*) AS count FROM products WHERE sku = $1',
                    [candidateSKU]
                );

                if (Number(existingProducts[0].count) === 0) {
                    return candidateSKU;
                }
                
                // If SKU exists, try with counter
                counter++;
                candidateSKU = `${baseSKU}${timestamp}${counter}`;
                
                // Prevent infinite loop
                if (counter > 999) {
                    throw ExternalServiceError.databaseError('generate unique SKU');
                }
            }
        } catch (error) {
            this.logger.error('Error generating SKU:', error);
            // Fallback to timestamp-based SKU
            return `PROD${Date.now()}`;
        }
    }
}

module.exports = Product; 