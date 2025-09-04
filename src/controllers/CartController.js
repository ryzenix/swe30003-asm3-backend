const Logger = require('../core/Logger');
const Database = require('../core/Database');
const Validator = require('../core/Validator');
const { 
    ValidationError, 
    NotFoundError, 
    AuthenticationError,
    BusinessLogicError 
} = require('../core/errors');

class CartController {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    async getCart(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            // Get cart from session or initialize empty cart
            const cart = req.session.cart || { items: [], totalAmount: 0, totalItems: 0 };
            
            // Validate cart items against current product data
            const validatedCart = await this.validateCartItems(cart);
            
            // Update session with validated cart
            req.session.cart = validatedCart;

            res.json({
                success: true,
                data: validatedCart
            });
        } catch (error) {
            this.logger.error('Get cart controller error:', error);
            next(error);
        }
    }

    async addToCart(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { productId, quantity = 1 } = req.body;

            // Validate input
            if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
                throw ValidationError.missingFields(['productId', 'quantity']);
            }

            // Get product details
            const { rows: products } = await this.db.query(
                'SELECT id, title, price_value, stock_quantity, requires_prescription, images, main_image_index, manufacturer, category, status FROM products WHERE id = $1 AND status = $2',
                [productId, 'active']
            );

            if (products.length === 0) {
                throw NotFoundError.product(productId);
            }

            const product = products[0];

            // Check stock availability
            if (product.stock_quantity < quantity) {
                throw BusinessLogicError.invalidOperation(
                    'add to cart',
                    `Insufficient stock. Available: ${product.stock_quantity}, Requested: ${quantity}`
                );
            }

            // Initialize cart if not exists
            if (!req.session.cart) {
                req.session.cart = { items: [], totalAmount: 0, totalItems: 0 };
            }

            const cart = req.session.cart;
            
            // Check if item already exists in cart
            const existingItemIndex = cart.items.findIndex(item => item.id === productId);
            
            if (existingItemIndex > -1) {
                // Update existing item
                const existingItem = cart.items[existingItemIndex];
                const newQuantity = existingItem.quantity + quantity;
                
                // Check total quantity against stock
                if (newQuantity > product.stock_quantity) {
                    throw BusinessLogicError.invalidOperation(
                        'add to cart',
                        `Cannot add ${quantity} more items. Current cart: ${existingItem.quantity}, Available: ${product.stock_quantity}`
                    );
                }
                
                existingItem.quantity = newQuantity;
                existingItem.updatedAt = new Date().toISOString();
            } else {
                // Add new item
                const cartItem = {
                    id: product.id,
                    title: product.title,
                    priceValue: parseFloat(product.price_value),
                    quantity: quantity,
                    stockQuantity: product.stock_quantity,
                    requiresPrescription: product.requires_prescription,
                    image: product.images && product.images.length > 0 
                        ? product.images[product.main_image_index || 0] 
                        : '/img/products/placeholder-product.jpg',
                    manufacturer: product.manufacturer,
                    category: product.category,
                    addedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                cart.items.push(cartItem);
            }

            // Recalculate totals
            this.recalculateCartTotals(cart);

            // Save cart to session
            req.session.cart = cart;

            this.logger.info(`Product added to cart - User: ${req.session.userId}, Product: ${productId}, Quantity: ${quantity}`);

            res.json({
                success: true,
                message: 'Product added to cart successfully',
                data: {
                    cart: cart,
                    addedItem: cart.items.find(item => item.id === productId)
                }
            });

        } catch (error) {
            this.logger.error('Add to cart controller error:', error);
            next(error);
        }
    }

    async updateCartItem(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { productId } = req.params;
            const { quantity } = req.body;

            // Validate input
            if (!productId || !Number.isInteger(quantity) || quantity < 0) {
                throw ValidationError.invalidFormat('quantity', 'positive integer');
            }

            // Initialize cart if not exists
            if (!req.session.cart) {
                req.session.cart = { items: [], totalAmount: 0, totalItems: 0 };
            }

            const cart = req.session.cart;
            const itemIndex = cart.items.findIndex(item => item.id === parseInt(productId));

            if (itemIndex === -1) {
                throw NotFoundError.product(productId);
            }

            if (quantity === 0) {
                // Remove item from cart
                cart.items.splice(itemIndex, 1);
            } else {
                // Update quantity
                const item = cart.items[itemIndex];
                
                // Check stock availability
                const { rows: products } = await this.db.query(
                    'SELECT stock_quantity, status FROM products WHERE id = $1 AND status = $2',
                    [productId, 'active']
                );

                if (products.length === 0) {
                    throw NotFoundError.product(productId);
                }

                const currentStock = products[0].stock_quantity;
                if (quantity > currentStock) {
                    throw BusinessLogicError.invalidOperation(
                        'update cart',
                        `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`
                    );
                }

                item.quantity = quantity;
                item.updatedAt = new Date().toISOString();
            }

            // Recalculate totals
            this.recalculateCartTotals(cart);

            // Save cart to session
            req.session.cart = cart;

            this.logger.info(`Cart item updated - User: ${req.session.userId}, Product: ${productId}, Quantity: ${quantity}`);

            res.json({
                success: true,
                message: 'Cart item updated successfully',
                data: cart
            });

        } catch (error) {
            this.logger.error('Update cart item controller error:', error);
            next(error);
        }
    }

    async removeFromCart(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { productId } = req.params;

            // Initialize cart if not exists
            if (!req.session.cart) {
                req.session.cart = { items: [], totalAmount: 0, totalItems: 0 };
            }

            const cart = req.session.cart;
            const itemIndex = cart.items.findIndex(item => item.id === parseInt(productId));

            if (itemIndex === -1) {
                throw NotFoundError.product(productId);
            }

            const removedItem = cart.items[itemIndex];
            cart.items.splice(itemIndex, 1);

            // Recalculate totals
            this.recalculateCartTotals(cart);

            // Save cart to session
            req.session.cart = cart;

            this.logger.info(`Product removed from cart - User: ${req.session.userId}, Product: ${productId}`);

            res.json({
                success: true,
                message: 'Product removed from cart successfully',
                data: {
                    cart: cart,
                    removedItem: removedItem
                }
            });

        } catch (error) {
            this.logger.error('Remove from cart controller error:', error);
            next(error);
        }
    }

    async clearCart(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            // Clear cart
            req.session.cart = { items: [], totalAmount: 0, totalItems: 0 };

            this.logger.info(`Cart cleared - User: ${req.session.userId}`);

            res.json({
                success: true,
                message: 'Cart cleared successfully',
                data: req.session.cart
            });

        } catch (error) {
            this.logger.error('Clear cart controller error:', error);
            next(error);
        }
    }

    async validateCartItems(cart) {
        try {
            if (!cart.items || cart.items.length === 0) {
                return { items: [], totalAmount: 0, totalItems: 0 };
            }

            const validatedItems = [];
            
            for (const item of cart.items) {
                // Get current product data
                const { rows: products } = await this.db.query(
                    'SELECT id, title, price_value, stock_quantity, requires_prescription, images, main_image_index, manufacturer, category, status FROM products WHERE id = $1',
                    [item.id]
                );

                if (products.length === 0 || products[0].status !== 'active') {
                    // Product no longer exists or is inactive - skip it
                    this.logger.warn(`Product ${item.id} no longer available or inactive, removing from cart`);
                    continue;
                }

                const product = products[0];
                
                // Update item with current product data
                const validatedItem = {
                    ...item,
                    title: product.title,
                    priceValue: parseFloat(product.price_value),
                    stockQuantity: product.stock_quantity,
                    requiresPrescription: product.requires_prescription,
                    image: product.images && product.images.length > 0 
                        ? product.images[product.main_image_index || 0] 
                        : '/img/products/placeholder-product.jpg',
                    manufacturer: product.manufacturer,
                    category: product.category,
                    // Adjust quantity if exceeds current stock
                    quantity: Math.min(item.quantity, product.stock_quantity)
                };

                validatedItems.push(validatedItem);
            }

            const validatedCart = {
                items: validatedItems,
                totalAmount: 0,
                totalItems: 0
            };

            this.recalculateCartTotals(validatedCart);
            
            return validatedCart;

        } catch (error) {
            this.logger.error('Validate cart items error:', error);
            // Return empty cart on validation error
            return { items: [], totalAmount: 0, totalItems: 0 };
        }
    }

    recalculateCartTotals(cart) {
        cart.totalAmount = cart.items.reduce((total, item) => {
            return total + (item.priceValue * item.quantity);
        }, 0);
        
        cart.totalItems = cart.items.reduce((total, item) => {
            return total + item.quantity;
        }, 0);
    }

    async syncCartWithLocalStorage(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { localCartItems } = req.body;

            if (!Array.isArray(localCartItems)) {
                throw ValidationError.invalidFormat('localCartItems', 'array');
            }

            // Initialize session cart if not exists
            if (!req.session.cart) {
                req.session.cart = { items: [], totalAmount: 0, totalItems: 0 };
            }

            const sessionCart = req.session.cart;

            // Merge local cart items with session cart
            for (const localItem of localCartItems) {
                if (!localItem.id || !localItem.quantity) continue;

                // Check if item exists in session cart
                const existingItemIndex = sessionCart.items.findIndex(item => item.id === localItem.id);
                
                if (existingItemIndex > -1) {
                    // Use the higher quantity
                    const existingItem = sessionCart.items[existingItemIndex];
                    existingItem.quantity = Math.max(existingItem.quantity, localItem.quantity);
                    existingItem.updatedAt = new Date().toISOString();
                } else {
                    // Add new item from local storage
                    sessionCart.items.push({
                        ...localItem,
                        addedAt: localItem.addedAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            // Validate and update cart
            const validatedCart = await this.validateCartItems(sessionCart);
            req.session.cart = validatedCart;

            this.logger.info(`Cart synced with local storage - User: ${req.session.userId}, Items: ${validatedCart.items.length}`);

            res.json({
                success: true,
                message: 'Cart synced successfully',
                data: validatedCart
            });

        } catch (error) {
            this.logger.error('Sync cart controller error:', error);
            next(error);
        }
    }
}

module.exports = CartController;