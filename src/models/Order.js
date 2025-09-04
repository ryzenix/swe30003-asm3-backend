const Database = require('../core/Database');
const Logger = require('../core/Logger');
const Validator = require('../core/Validator');
const { 
    ValidationError, 
    NotFoundError, 
    ConflictError, 
    AuthenticationError,
    BusinessLogicError 
} = require('../core/errors');

class Order {
    constructor() {
        this.db = new Database();
        this.logger = new Logger();
        this.validator = new Validator();
    }

    async create(orderData, userId) {
        try {
            this.validator.clearErrors();

            // Validate required fields
            const requiredFields = ['items', 'totalAmount', 'shippingAddress'];
            if (!this.validator.validateRequired(orderData, requiredFields)) {
                const missingFields = requiredFields.filter(field => 
                    orderData[field] === undefined || orderData[field] === null || orderData[field] === ''
                );
                throw ValidationError.missingFields(missingFields);
            }

            // Validate items array
            if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
                throw ValidationError.invalidFormat('items', 'non-empty array');
            }

            // Validate total amount
            if (!this.validator.validateNumber('totalAmount', orderData.totalAmount, 0)) {
                throw ValidationError.invalidNumber('totalAmount', orderData.totalAmount, 0);
            }

            // Validate order status
            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
            const status = orderData.status || 'pending';
            if (!this.validator.validateEnum('status', status, validStatuses)) {
                throw ValidationError.invalidEnum('status', status, validStatuses);
            }

            // Validate payment method
            const validPaymentMethods = ['cash_on_delivery', 'bank_transfer', 'credit_card', 'e_wallet'];
            const paymentMethod = orderData.paymentMethod || 'cash_on_delivery';
            if (!this.validator.validateEnum('paymentMethod', paymentMethod, validPaymentMethods)) {
                throw ValidationError.invalidEnum('paymentMethod', paymentMethod, validPaymentMethods);
            }

            // Validate shipping method
            const validShippingMethods = ['standard', 'express', 'same_day'];
            const shippingMethod = orderData.shippingMethod || 'standard';
            if (!this.validator.validateEnum('shippingMethod', shippingMethod, validShippingMethods)) {
                throw ValidationError.invalidEnum('shippingMethod', shippingMethod, validShippingMethods);
            }

            // Start transaction
            const client = await this.db.getClient();
            
            try {
                await client.query('BEGIN');

                // Create order
                const { rows: newOrder } = await client.query(
                    `INSERT INTO orders (
                        user_id, status, total_amount, shipping_address, billing_address,
                        payment_method, payment_status, shipping_method, shipping_cost,
                        notes, estimated_delivery_date, prescription_required, prescription_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING id, created_at`,
                    [
                        userId,
                        status,
                        orderData.totalAmount,
                        JSON.stringify(orderData.shippingAddress),
                        JSON.stringify(orderData.billingAddress || orderData.shippingAddress),
                        paymentMethod,
                        orderData.paymentStatus || 'pending',
                        shippingMethod,
                        orderData.shippingCost || 0,
                        orderData.notes || null,
                        orderData.estimatedDeliveryDate || null,
                        orderData.prescriptionRequired || false,
                        orderData.prescriptionId || null
                    ]
                );

                const orderId = newOrder[0].id;
                const orderCreatedAt = newOrder[0].created_at;

                // Create order items
                const orderItems = [];
                console.log(orderData.items);
                for (const item of orderData.items) {
                    // Validate item structure
                    if (!item.productId || !item.quantity || !item.unitPrice) {
                        throw ValidationError.missingFields(['productId', 'quantity', 'unitPrice']);
                    }

                    // Verify product exists and get current data
                    const { rows: product } = await client.query(
                        'SELECT id, title, price_value, stock_quantity, requires_prescription FROM products WHERE id = $1',
                        [item.productId]
                    );

                    if (product.length === 0) {
                        throw NotFoundError.product(item.productId);
                    }

                    const productData = product[0];

                    // Check stock availability
                    if (productData.stock_quantity < item.quantity) {
                        throw BusinessLogicError.invalidOperation(
                            'add product to order',
                            `Insufficient stock for product ${productData.title}. Available: ${productData.stock_quantity}, Requested: ${item.quantity}`
                        );
                    }

                    // Insert order item
                    const { rows: orderItem } = await client.query(
                        `INSERT INTO order_items (
                            order_id, product_id, quantity, unit_price, total_price,
                            product_title, product_sku, requires_prescription
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        RETURNING id`,
                        [
                            orderId,
                            item.productId,
                            item.quantity,
                            item.unitPrice,
                            item.quantity * item.unitPrice,
                            productData.title,
                            item.productSku || null,
                            productData.requires_prescription
                        ]
                    );

                    // Update product stock
                    await client.query(
                        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                        [item.quantity, item.productId]
                    );

                    orderItems.push({
                        id: orderItem[0].id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                        productTitle: productData.title,
                        requiresPrescription: productData.requires_prescription
                    });
                }

                await client.query('COMMIT');

                this.logger.info(`Order created successfully - ID: ${orderId}, User: ${userId}, Total: ${orderData.totalAmount}`);

                return {
                    success: true,
                    message: 'Order created successfully',
                    data: {
                        id: orderId,
                        userId: userId,
                        status: status,
                        totalAmount: orderData.totalAmount,
                        paymentMethod: paymentMethod,
                        paymentStatus: orderData.paymentStatus || 'pending',
                        shippingAddress: orderData.shippingAddress,
                        items: orderItems,
                        createdAt: orderCreatedAt,
                        prescriptionRequired: orderData.prescriptionRequired || false
                    }
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            this.logger.error('Create order error:', error);
            throw error;
        }
    }

    async getById(orderId, userId = null) {
        try {
            if (!orderId) {
                throw ValidationError.missingFields(['orderId']);
            }

            // Build query with optional user filter
            let query = `
                SELECT 
                    o.id, o.user_id, o.status, o.total_amount, o.shipping_address, o.billing_address,
                    o.payment_method, o.payment_status, o.shipping_method, o.shipping_cost,
                    o.notes, o.estimated_delivery_date, o.prescription_required, o.prescription_id, o.cancellation_reason_code, o.created_at, o.updated_at,
                    u.email as user_email, u.full_name as user_name, u.phone as user_phone
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.user_id
                WHERE o.id = $1
            `;
            
            const queryParams = [orderId];
            
            if (userId) {
                query += ' AND o.user_id = $2';
                queryParams.push(userId);
            }

            const { rows: orders } = await this.db.query(query, queryParams);

            if (orders.length === 0) {
                throw NotFoundError.product(orderId); // Reusing product error for order
            }

            const order = orders[0];

            // Get order items
            const { rows: items } = await this.db.query(
                `SELECT 
                    oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
                    oi.product_title, oi.product_sku, oi.requires_prescription,
                    p.images, p.main_image_index
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
                ORDER BY oi.id`,
                [orderId]
            );

                            return {
                success: true,
                data: {
                    id: order.id,
                    userId: order.user_id,
                    status: order.status,
                    totalAmount: order.total_amount,
                    shippingAddress: order.shipping_address,
                    billingAddress: order.billing_address,
                    paymentMethod: order.payment_method,
                    paymentStatus: order.payment_status,
                    shippingMethod: order.shipping_method,
                    shippingCost: order.shipping_cost,
                    notes: order.notes,
                    estimatedDeliveryDate: order.estimated_delivery_date,
                    prescriptionRequired: order.prescription_required,
                    prescriptionId: order.prescription_id,
                    cancellationReasonCode: order.cancellation_reason_code,
                    createdAt: order.created_at,
                    updatedAt: order.updated_at,
                    user: {
                        email: order.user_email,
                        name: order.user_name,
                        phone: order.user_phone
                    },
                    items: items.map(item => ({
                        id: item.id,
                        productId: item.product_id,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        totalPrice: item.total_price,
                        productTitle: item.product_title,
                        productSku: item.product_sku,
                        requiresPrescription: item.requires_prescription,
                        productImages: item.images || [],
                        mainImageIndex: item.main_image_index || 0
                    }))
                }
            };

        } catch (error) {
            this.logger.error('Get order error:', error);
            throw error;
        }
    }

    async list(filters = {}, userId = null) {
        try {
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const status = filters.status || '';
            const paymentStatus = filters.paymentStatus || '';
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
                whereConditions.push(`o.user_id = $${paramCount}`);
                queryParams.push(userId);
            }

            // Status filter
            if (status) {
                paramCount++;
                whereConditions.push(`o.status = $${paramCount}`);
                queryParams.push(status);
            }

            // Payment status filter
            if (paymentStatus) {
                paramCount++;
                whereConditions.push(`o.payment_status = $${paramCount}`);
                queryParams.push(paymentStatus);
            }

            // Date range filter
            if (startDate) {
                paramCount++;
                whereConditions.push(`o.created_at >= $${paramCount}`);
                queryParams.push(startDate);
            }

            if (endDate) {
                paramCount++;
                whereConditions.push(`o.created_at <= $${paramCount}`);
                queryParams.push(endDate + ' 23:59:59');
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Count total records
            const countQuery = `
                SELECT COUNT(*) as total
                FROM orders o
                ${whereClause}
            `;

            const { rows: countResult } = await this.db.query(countQuery, queryParams);
            const totalRecords = parseInt(countResult[0].total);
            const totalPages = Math.ceil(totalRecords / limit);

            // Fetch orders with pagination
            const ordersQuery = `
                SELECT 
                    o.id, o.user_id, o.status, o.total_amount, o.payment_method, o.payment_status,
                    o.shipping_method, o.prescription_required, o.prescription_id, o.created_at, o.updated_at,
                    u.email as user_email, u.full_name as user_name, u.phone as user_phone,
                    COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.user_id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                ${whereClause}
                GROUP BY o.id, u.email, u.full_name, u.phone
                ORDER BY o.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            queryParams.push(limit, offset);

            const { rows: orders } = await this.db.query(ordersQuery, queryParams);

            // Format response
            const formattedOrders = orders.map(order => ({
                id: order.id,
                userId: order.user_id,
                status: order.status,
                totalAmount: order.total_amount,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                shippingMethod: order.shipping_method,
                prescriptionRequired: order.prescription_required,
                prescriptionId: order.prescription_id,
                itemCount: parseInt(order.item_count),
                createdAt: order.created_at,
                updatedAt: order.updated_at,
                user: {
                    email: order.user_email,
                    name: order.user_name,
                    phone: order.user_phone
                }
            }));

            return {
                success: true,
                data: {
                    orders: formattedOrders,
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
                        paymentStatus,
                        startDate,
                        endDate
                    }
                }
            };

        } catch (error) {
            this.logger.error('List orders error:', error);
            throw error;
        }
    }

    async updateStatus(orderId, newStatus, userId = null) {
        try {
            this.validator.clearErrors();

            if (!orderId || !newStatus) {
                throw ValidationError.missingFields(['orderId', 'status']);
            }

            // Validate status
            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (!this.validator.validateEnum('status', newStatus, validStatuses)) {
                throw ValidationError.invalidEnum('status', newStatus, validStatuses);
            }

            // Build query with optional user filter
            let query = 'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2';
            const queryParams = [newStatus, orderId];
            
            if (userId) {
                query += ' AND user_id = $3';
                queryParams.push(userId);
            }
            
            query += ' RETURNING id, status, updated_at';

            const { rows: updatedOrder } = await this.db.query(query, queryParams);

            if (updatedOrder.length === 0) {
                throw NotFoundError.product(orderId); // Reusing product error for order
            }

            this.logger.info(`Order status updated - ID: ${orderId}, New Status: ${newStatus}`);

            return {
                success: true,
                message: 'Order status updated successfully',
                data: {
                    id: updatedOrder[0].id,
                    status: updatedOrder[0].status,
                    updatedAt: updatedOrder[0].updated_at
                }
            };

        } catch (error) {
            this.logger.error('Update order status error:', error);
            throw error;
        }
    }

    async cancel(orderId, userId, reason, reasonCode, isStaffOrSuperuser = false) {
        try {
            if (!orderId) {
                throw ValidationError.missingFields(['orderId']);
            }



            // Validate reasonCode if provided
            const validReasonCodes = [
                'changed_mind',
                'wrong_order', 
                'found_better_price',
                'delivery_too_long',
                'payment_issue',
                'no_longer_needed',
                'duplicate_order',
                'prescription_invalid', // Đơn thuốc không hợp lệ
                'quality_issue', // Vấn đề chất lượng sản phẩm
                'pharmacy_closure', // Nhà thuốc tạm đóng cửa
                'regulatory_issue', // Vấn đề quy định pháp lý
                'address_unreachable', // Không thể giao đến địa chỉ
                'other'
            ];

            if (reasonCode && !this.validator.validateEnum('reasonCode', reasonCode, validReasonCodes)) {
                throw ValidationError.invalidEnum('reasonCode', reasonCode, validReasonCodes);
            }

            // If reasonCode is 'other', reason text is required
            if (reasonCode === 'other' && (!reason || reason.trim() === '')) {
                throw ValidationError.missingFields(['reason']);
            }

            // Start transaction to restore stock
            const client = await this.db.getClient();
            
            try {
                await client.query('BEGIN');

                // Get order details - different query based on user permissions
                let orders;
                if (isStaffOrSuperuser) {
                    // Staff/superuser can cancel any order
                    const { rows } = await client.query(
                        'SELECT id, status, user_id FROM orders WHERE id = $1',
                        [orderId]
                    );
                    orders = rows;
                } else {
                    // Regular users can only cancel their own orders
                    const { rows } = await client.query(
                        'SELECT id, status, user_id FROM orders WHERE id = $1 AND user_id = $2',
                        [orderId, userId]
                    );
                    orders = rows;
                }

                if (orders.length === 0) {
                    throw NotFoundError.product(orderId);
                }

                const order = orders[0];

                // Check if order can be cancelled
                const cancellableStatuses = ['pending', 'confirmed'];
                if (!cancellableStatuses.includes(order.status)) {
                    throw BusinessLogicError.invalidOperation(
                        'cancel order',
                        `Order with status '${order.status}' cannot be cancelled`
                    );
                }

                // Get order items to restore stock
                const { rows: items } = await client.query(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                    [orderId]
                );

                // Restore stock for each item
                for (const item of items) {
                    await client.query(
                        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                        [item.quantity, item.product_id]
                    );
                }

                // Prepare cancellation notes
                const cancellationNotes = reason || 'Cancelled by customer';
                const cancellationReasonCode = reasonCode || 'other';

                // Update order status with both reason and reasonCode
                await client.query(
                    `UPDATE orders SET 
                        status = $1, 
                        notes = $2, 
                        cancellation_reason_code = $3,
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $4`,
                    ['cancelled', cancellationNotes, cancellationReasonCode, orderId]
                );

                await client.query('COMMIT');

                const cancelledBy = isStaffOrSuperuser ? `staff/superuser (${userId})` : `customer (${userId})`;
                this.logger.info(`Order cancelled - ID: ${orderId}, Cancelled by: ${cancelledBy}, Reason: ${reason}, ReasonCode: ${reasonCode}`);

                return {
                    success: true,
                    message: 'Order cancelled successfully',
                    data: {
                        id: orderId,
                        status: 'cancelled',
                        reason: cancellationNotes,
                        reasonCode: cancellationReasonCode
                    }
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            this.logger.error('Cancel order error:', error);
            throw error;
        }
    }
}

module.exports = Order;