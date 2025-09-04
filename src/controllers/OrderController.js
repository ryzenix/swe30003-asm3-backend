const Order = require('../models/Order');
const Logger = require('../core/Logger');

class OrderController {
    constructor() {
        this.orderModel = new Order();
        this.logger = new Logger();
    }

    async createOrder(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const result = await this.orderModel.create(req.body, req.session.userId);
            res.status(201).json(result);
        } catch (error) {
            this.logger.error('Create order controller error:', error);
            next(error);
        }
    }

    async getOrder(req, res, next) {
        try {
            const { id } = req.params;
            
            // For regular users, filter by their user ID
            // For superusers/pharmacists, allow access to all orders
            let userId = null;
            if (req.session.authenticated && req.session.userId) {
                // Check if user is superuser or pharmacist
                const { rows: superuser } = await this.orderModel.db.query(
                    'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                    [req.session.userId]
                );

                const { rows: pharmacist } = await this.orderModel.db.query(
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

            const result = await this.orderModel.getById(id, userId);
            res.json(result);
        } catch (error) {
            this.logger.error('Get order controller error:', error);
            next(error);
        }
    }

    async listOrders(req, res, next) {
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
                paymentStatus: req.query.payment_status,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            };

            // For regular users, filter by their user ID
            // For superusers/pharmacists, allow access to all orders
            let userId = null;
            
            // Check if user is superuser or pharmacist
            const { rows: superuser } = await this.orderModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.orderModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // If not superuser or pharmacist, filter by user ID
            if (superuser.length === 0 && pharmacist.length === 0) {
                userId = req.session.userId;
            }

            const result = await this.orderModel.list(filters, userId);
            res.json(result);
        } catch (error) {
            this.logger.error('List orders controller error:', error);
            next(error);
        }
    }

    async updateOrderStatus(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { id } = req.params;
            const { status } = req.body;

            // Check if user has permission to update order status
            const { rows: superuser } = await this.orderModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.orderModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // Only superusers and pharmacists can update order status
            if (superuser.length === 0 && pharmacist.length === 0) {
                const { AuthorizationError } = require('../core/errors');
                throw AuthorizationError.insufficientPermissions('update order status');
            }

            const result = await this.orderModel.updateStatus(id, status);
            res.json(result);
        } catch (error) {
            this.logger.error('Update order status controller error:', error);
            next(error);
        }
    }

    async cancelOrder(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const { id } = req.params;
            const { reason: reasonText, reasonCode } = req.body;

            // Check if user is superuser or pharmacist
            let isStaffOrSuperuser = false;
            
            try {
                // Check if user is a superuser
                const { rows: superuser } = await this.orderModel.db.query(
                    'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                    [req.session.userId]
                );

                if (superuser.length > 0) {
                    isStaffOrSuperuser = true;
                } else {
                    // Check if user is a pharmacist
                    const { rows: pharmacist } = await this.orderModel.db.query(
                        'SELECT user_id, role FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                        [req.session.userId, 'pharmacist']
                    );

                    if (pharmacist.length > 0) {
                        isStaffOrSuperuser = true;
                    }
                }
            } catch (roleCheckError) {
                this.logger.warn('Role check error during order cancellation:', roleCheckError);
                // Continue with regular user permissions if role check fails
            }

            const result = await this.orderModel.cancel(id, req.session.userId, reasonText, reasonCode, isStaffOrSuperuser);
            res.json(result);
        } catch (error) {
            this.logger.error('Cancel order controller error:', error);
            next(error);
        }
    }

    async getOrderStatistics(req, res, next) {
        try {
            // Check if user is authenticated and has permission
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            // Check if user is superuser or pharmacist
            const { rows: superuser } = await this.orderModel.db.query(
                'SELECT user_id FROM superusers WHERE user_id = $1 AND is_active = TRUE',
                [req.session.userId]
            );

            const { rows: pharmacist } = await this.orderModel.db.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND role = $2 AND is_active = TRUE',
                [req.session.userId, 'pharmacist']
            );

            // Only superusers and pharmacists can view statistics
            if (superuser.length === 0 && pharmacist.length === 0) {
                const { AuthorizationError } = require('../core/errors');
                throw AuthorizationError.insufficientPermissions('view order statistics');
            }

            // Get order statistics
            const { rows: statusStats } = await this.orderModel.db.query(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(total_amount) as total_amount
                FROM orders 
                GROUP BY status
                ORDER BY status
            `);

            const { rows: dailyStats } = await this.orderModel.db.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as order_count,
                    SUM(total_amount) as daily_revenue
                FROM orders 
                WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `);

            const { rows: monthlyStats } = await this.orderModel.db.query(`
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as order_count,
                    SUM(total_amount) as monthly_revenue
                FROM orders 
                WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month DESC
            `);

            const { rows: topProducts } = await this.orderModel.db.query(`
                SELECT 
                    oi.product_title,
                    SUM(oi.quantity) as total_quantity,
                    SUM(oi.total_price) as total_revenue,
                    COUNT(DISTINCT oi.order_id) as order_count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY oi.product_title
                ORDER BY total_quantity DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    statusStatistics: statusStats.map(stat => ({
                        status: stat.status,
                        count: parseInt(stat.count),
                        totalAmount: parseFloat(stat.total_amount) || 0
                    })),
                    dailyStatistics: dailyStats.map(stat => ({
                        date: stat.date,
                        orderCount: parseInt(stat.order_count),
                        revenue: parseFloat(stat.daily_revenue) || 0
                    })),
                    monthlyStatistics: monthlyStats.map(stat => ({
                        month: stat.month,
                        orderCount: parseInt(stat.order_count),
                        revenue: parseFloat(stat.monthly_revenue) || 0
                    })),
                    topProducts: topProducts.map(product => ({
                        productTitle: product.product_title,
                        totalQuantity: parseInt(product.total_quantity),
                        totalRevenue: parseFloat(product.total_revenue) || 0,
                        orderCount: parseInt(product.order_count)
                    }))
                }
            });
        } catch (error) {
            this.logger.error('Get order statistics controller error:', error);
            next(error);
        }
    }

    async getUserOrderSummary(req, res, next) {
        try {
            // Check if user is authenticated
            if (!req.session.authenticated || !req.session.userId) {
                const { AuthenticationError } = require('../core/errors');
                throw AuthenticationError.sessionRequired();
            }

            const userId = req.session.userId;

            // Get user's order summary
            const { rows: summary } = await this.orderModel.db.query(`
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
                    COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
                    COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                    SUM(total_amount) as total_spent,
                    AVG(total_amount) as average_order_value
                FROM orders 
                WHERE user_id = $1
            `, [userId]);

            // Get recent orders
            const { rows: recentOrders } = await this.orderModel.db.query(`
                SELECT 
                    id, status, total_amount, created_at,
                    COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = $1
                GROUP BY o.id, o.status, o.total_amount, o.created_at
                ORDER BY o.created_at DESC
                LIMIT 5
            `, [userId]);

            res.json({
                success: true,
                data: {
                    summary: {
                        totalOrders: parseInt(summary[0].total_orders),
                        pendingOrders: parseInt(summary[0].pending_orders),
                        confirmedOrders: parseInt(summary[0].confirmed_orders),
                        processingOrders: parseInt(summary[0].processing_orders),
                        shippedOrders: parseInt(summary[0].shipped_orders),
                        deliveredOrders: parseInt(summary[0].delivered_orders),
                        cancelledOrders: parseInt(summary[0].cancelled_orders),
                        totalSpent: parseFloat(summary[0].total_spent) || 0,
                        averageOrderValue: parseFloat(summary[0].average_order_value) || 0
                    },
                    recentOrders: recentOrders.map(order => ({
                        id: order.id,
                        status: order.status,
                        totalAmount: parseFloat(order.total_amount),
                        itemCount: parseInt(order.item_count),
                        createdAt: order.created_at
                    }))
                }
            });
        } catch (error) {
            this.logger.error('Get user order summary controller error:', error);
            next(error);
        }
    }
}

module.exports = OrderController;