const { Order, Product } = require('../models');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');
const emailService = require('../services/emailService');

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
});

/**
 * @desc    Search orders with filters
 * @route   GET /api/orders/search
 * @access  Private/Admin
 */
const searchOrders = asyncHandler(async (req, res) => {
    const { query, status, dateFrom, dateTo } = req.query;
    
    let filter = {};
    
    if (query && query.trim()) {
        const searchTerm = query.trim();
        const cleanQuery = searchTerm.startsWith('#') ? searchTerm.slice(1) : searchTerm;
        
        if (searchTerm.startsWith('#') || searchTerm.toLowerCase().startsWith('ord')) {
            filter.$or = [
                { orderId: { $regex: cleanQuery, $options: 'i' } },
                { _id: cleanQuery.length === 24 ? cleanQuery : undefined }
            ].filter(Boolean);
        } else if (/^[\+0-9]/.test(searchTerm)) {
            filter.contact = { $regex: searchTerm, $options: 'i' };
        } else {
            filter.name = { $regex: searchTerm, $options: 'i' };
        }
    }
    
    if (status && status !== 'all') {
        filter.orderStatus = status;
    }
    
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = endDate;
        }
    }
    
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, count: orders.length, orders });
});

/**
 * @desc    Get orders by email
 * @route   GET /api/orders/user/:email
 * @access  Private/Admin
 */
const getOrdersByEmail = asyncHandler(async (req, res) => {
    const orders = await Order.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    res.json(order);
});

/**
 * Generate Custom Order ID
 * Format: ORDYYYYMMDDXXXX (e.g., ORD202410050001)
 */
const generateOrderId = async () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const todayPrefix = `ORD${yyyy}${mm}${dd}`;

    const lastOrder = await Order.findOne({ 
        orderId: { $regex: new RegExp(`^${todayPrefix}`) } 
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (lastOrder && lastOrder.orderId) {
        const currentStr = lastOrder.orderId.replace(todayPrefix, '');
        const currentNum = parseInt(currentStr, 10);
        if (!isNaN(currentNum)) nextNum = currentNum + 1;
    }

    const suffix = String(nextNum).padStart(4, '0');
    return `${todayPrefix}${suffix}`;
};

/**
 * @desc    Create new order (Harden with Server-Side Validation)
 * @route   POST /api/orders
 * @access  Public
 */
const createOrder = asyncHandler(async (req, res) => {
    const { items, amount, ...otherOrderData } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'Order items are required');
    }

    // 1. Server-Side Price & Stock Validation (Source of Truth)
    let validatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
            throw new ApiError(404, `Product not found: ${item.name || item.productId}`);
        }

        // Find specific variant
        const variant = product.variants.find(v => v._id.toString() === item.variantId);
        if (!variant) {
            throw new ApiError(404, `Variant not found for product ${product.name}`);
        }

        // Check stock
        if (variant.stock < item.quantity) {
            throw new ApiError(400, `Insufficient stock for ${product.name} (${variant.sku || ''})`);
        }

        const unitPrice = variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;
        const itemTotal = unitPrice * item.quantity;
        validatedTotal += itemTotal;

        validatedItems.push({
            productId: product._id,
            variantId: variant._id,
            name: product.name,
            sku: variant.sku,
            image: variant.images?.[0] || product.images?.[0],
            price: unitPrice,
            quantity: item.quantity,
            totalPrice: itemTotal,
            // Keep legacy fields for compatibility if needed
            brand: product.brand,
            cat: product.category?.toString()
        });
    }

    // 2. Validate Final Amount (Prevention of Price Injection)
    // Here we could add shipping/discount logic
    const shipping = otherOrderData.shippingCost || 0; // Should also be validated server-side if dynamic
    const finalAmount = validatedTotal + shipping;

    // Check if client-provided amount matches (optional, but good for UX sync check)
    // We strictly use finalAmount for the actual DB record if it varies.
    
    // 3. Generate Custom Order ID
    const orderId = await generateOrderId();

    // 4. Create Order Record
    const order = await Order.create({
        ...otherOrderData,
        orderId,
        items: validatedItems,
        amount: finalAmount, // Use server-calculated amount
        orderStatus: 'pending',
        statusHistory: [{
            status: 'pending',
            timestamp: new Date(),
            note: 'Order placed'
        }]
    });
    
    // 5. Atomic Stock Update (Decrement Variants)
    for (const item of validatedItems) {
        try {
            await Product.updateOne(
                { _id: item.productId, 'variants._id': item.variantId },
                { 
                    $inc: { 
                        'variants.$.stock': -item.quantity,
                        'variants.$.sells': item.quantity
                    } 
                }
            );
        } catch (err) {
            console.error(`Failed to update stock for variant ${item.variantId}:`, err);
        }
    }
    
    // 6. Send Order Confirmation (Non-blocking)
    if (order.email) {
        const emailData = {
            email: order.email,
            name: order.name || 'Customer',
            orderId: order.orderId,
            items: order.items,
            total: order.amount, // Now in BDT
            currency: 'BDT',
            address: order.address,
            city: order.city,
        };
        
        emailService.sendOrderConfirmation(emailData)
            .catch(err => console.error('Email error:', err));
    }
    
    res.status(201).json(order);
});

/**
 * @desc    Update order status (shipment)
 * @route   PUT /api/orders/status
 * @access  Private/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs');
    }

    // Update status and push to history
    const result = await Order.updateMany(
        { _id: { $in: ids } },
        { 
            orderStatus: status,
            $push: { 
                statusHistory: {
                    status: status,
                    timestamp: new Date(),
                    note: `Status changed to ${status}`
                }
            }
        }
    );

    // Send shipping update emails (non-blocking)
    if (result.modifiedCount > 0) {
        Order.find({ _id: { $in: ids } })
            .then(orders => {
                orders.forEach(order => {
                    if (order.email) {
                        emailService.sendShippingUpdate({
                            email: order.email,
                            name: order.name || 'Customer',
                            orderId: order.orderId || order._id.toString().slice(-8).toUpperCase(),
                            status: status,
                        }).catch(err => console.error('Shipping update email error:', err));
                    }
                });
            })
            .catch(err => console.error('Find orders error:', err));
    }

    res.json({ modifiedCount: result.modifiedCount });
});

/**
 * @desc    Cancel orders
 * @route   PUT /api/orders/cancel
 * @access  Private/Admin
 */
const cancelOrders = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs');
    }

    const result = await Order.updateMany(
        { _id: { $in: ids } },
        { orderStatus: false }
    );

    res.json({ modifiedCount: result.modifiedCount });
});

/**
 * @desc    Delete orders
 * @route   DELETE /api/orders
 * @access  Private/Admin
 */
const deleteOrders = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs to delete');
    }

    const result = await Order.deleteMany({ _id: { $in: ids } });

    res.json({ deletedCount: result.deletedCount });
});

/**
 * @desc    Get orders by phone number (for public tracking)
 * @route   GET /api/orders/track/:phone
 * @access  Public
 */
const getOrdersByPhone = asyncHandler(async (req, res) => {
    const phone = req.params.phone;

    if (!phone || phone.length < 10) {
        throw new ApiError(400, 'Please provide a valid phone number');
    }

    const orders = await Order.find({ contact: phone })
        .select('orderId orderStatus statusHistory items amount date courierInfo createdAt')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        count: orders.length,
        orders
    });
});

module.exports = {
    getAllOrders,
    searchOrders,
    getOrdersByEmail,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrders,
    deleteOrders,
    getOrdersByPhone,
};
