const {Order, Product, PromoCode} = require("../models");
const StoreSettings = require("../models/SiteSettings");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const {ApiResponse, ApiError} = require("../utils/ApiResponse");
const emailService = require("../services/emailService");

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({createdAt: -1});
  res.json(orders);
});

/**
 * @desc    Search orders with filters
 * @route   GET /api/orders/search
 * @access  Private/Admin
 */
const searchOrders = asyncHandler(async (req, res) => {
  const {query, status, dateFrom, dateTo} = req.query;

  let filter = {};

  if (query && query.trim()) {
    const searchTerm = query.trim();
    const cleanQuery = searchTerm.startsWith("#")
      ? searchTerm.slice(1)
      : searchTerm;

    if (
      searchTerm.startsWith("#") ||
      searchTerm.toLowerCase().startsWith("ord")
    ) {
      filter.$or = [
        {orderId: {$regex: cleanQuery, $options: "i"}},
        {_id: cleanQuery.length === 24 ? cleanQuery : undefined},
      ].filter(Boolean);
    } else if (/^[\+0-9]/.test(searchTerm)) {
      filter.contact = {$regex: searchTerm, $options: "i"};
    } else {
      filter.name = {$regex: searchTerm, $options: "i"};
    }
  }

  if (status && status !== "all") {
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

  const orders = await Order.find(filter).sort({createdAt: -1}).limit(100);
  res.json({success: true, count: orders.length, orders});
});

/**
 * @desc    Get orders by email
 * @route   GET /api/orders/user/:email
 * @access  Private/Admin
 */
const getOrdersByEmail = asyncHandler(async (req, res) => {
  const orders = await Order.find({email: req.params.email}).sort({
    createdAt: -1,
  });
  res.json(orders);
});

/**
 * @desc    Get order by ID (MongoDB _id or custom orderId)
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  let order;

  // Check if it's a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
    order = await Order.findById(id);
  } else {
    // Search by custom orderId (e.g., ORD202601120001)
    order = await Order.findOne({orderId: id});
  }

  if (!order) throw new ApiError(404, "Order not found");
  res.json(order);
});

/**
 * Generate Custom Order ID
 * Format: ORDYYYYMMDDXXXX (e.g., ORD202410050001)
 */
const generateOrderId = async () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const todayPrefix = `ORD${yyyy}${mm}${dd}`;

  const lastOrder = await Order.findOne({
    orderId: {$regex: new RegExp(`^${todayPrefix}`)},
  }).sort({createdAt: -1});

  let nextNum = 1;
  if (lastOrder && lastOrder.orderId) {
    const currentStr = lastOrder.orderId.replace(todayPrefix, "");
    const currentNum = parseInt(currentStr, 10);
    if (!isNaN(currentNum)) nextNum = currentNum + 1;
  }

  const suffix = String(nextNum).padStart(4, "0");
  return `${todayPrefix}${suffix}`;
};

/**
 * @desc    Create new order (Harden with Server-Side Validation)
 * @route   POST /api/orders
 * @access  Public
 */
const createOrder = asyncHandler(async (req, res) => {
  const {items, amount, promoCode, discountAmount, ...otherOrderData} = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Order items are required");
  }

  // 1. Server-Side Price & Stock Validation (Source of Truth)
  let validatedTotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw new ApiError(
        404,
        `Product not found: ${item.name || item.productId}`
      );
    }

    // Ensure product has variants
    if (!product.variants || product.variants.length === 0) {
      throw new ApiError(
        400,
        `Product ${product.name} has no variants configured`
      );
    }

    // Find specific variant
    // Handle "default" variantId by using the first variant
    let variant;
    if (item.variantId === "default" || !item.variantId) {
      variant = product.variants[0];
    } else {
      variant = product.variants.find(
        (v) => v._id.toString() === item.variantId
      );
    }

    if (!variant) {
      throw new ApiError(404, `Variant not found for product ${product.name}`);
    }

    // Check stock
    if (variant.stock < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${product.name} (${variant.sku || ""})`
      );
    }

    const unitPrice =
      variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;
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
      cat: product.category?.toString() || product.category,
      subCat: product.subCategory?.toString() || product.subCategory,
    });
  }

  // 2. Validate Final Amount (Prevention of Price Injection)
  // Fetch dynamic shipping rates
  const settings = await StoreSettings.getSettings();
  const rates = settings.shipping || { dhaka_in: 60, dhaka_out: 120 };
  
  const shippingZone = otherOrderData.shippingZone || 'dhaka_in';
  
  // Validate shipping zone
  if (!['dhaka_in', 'dhaka_out'].includes(shippingZone)) {
    throw new ApiError(400, 'Invalid shipping zone');
  }
  
  const deliveryCharge = rates[shippingZone];
  
  // 2.5. Handle Promo Code Validation & Application
  let serverDiscountAmount = 0;
  let validatedPromoCode = null;
  let promo = null;
  
  if (promoCode) {
    const now = new Date();
    
    // Atomic increment with validation - prevents race conditions
    // This operation checks availability and increments in a single atomic DB operation
    promo = await PromoCode.findOneAndUpdate(
      {
        code: promoCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        // Atomically check if usage limit allows one more use
        $expr: {
          $or: [
            { $eq: ['$usageLimit', null] }, // No limit
            { $lt: ['$usedCount', '$usageLimit'] } // Under limit
          ]
        }
      },
      {
        $inc: { usedCount: 1 } // Atomic increment
      },
      {
        new: true, // Return updated document
        runValidators: true
      }
    );
    
    if (!promo) {
      // Check why it failed - provide helpful error message
      const existingPromo = await PromoCode.findOne({ code: promoCode.toUpperCase() });
      
      if (!existingPromo) {
        throw new ApiError(400, 'Invalid promo code');
      }
      if (!existingPromo.isActive) {
        throw new ApiError(400, 'This promo code is no longer active');
      }
      if (now < existingPromo.validFrom) {
        throw new ApiError(400, 'This promo code is not yet valid');
      }
      if (now > existingPromo.validUntil) {
        throw new ApiError(400, 'This promo code has expired');
      }
      if (existingPromo.usageLimit !== null && existingPromo.usedCount >= existingPromo.usageLimit) {
        throw new ApiError(400, 'This promo code has reached its usage limit');
      }
      
      // Fallback error
      throw new ApiError(400, 'Promo code is not available');
    }
    
    
    // NEW: Validate minimum item quantity
    if (promo.minItemQuantity && validatedItems.length < promo.minItemQuantity) {
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
      throw new ApiError(400, `Add ${promo.minItemQuantity - validatedItems.length} more item(s) to use this code`);
    }
    
    // NEW: Check per-user usage limit
    if (promo.perUserLimit) {
      const PromoCodeUsage = require('../models/PromoCodeUsage');
      const userIdentifier = req.user?._id || otherOrderData.email;
      
      if (userIdentifier) {
        const userUsageCount = await PromoCodeUsage.countDocuments({
          promoCodeId: promo._id,
          $or: [
            { userId: req.user?._id },
            { email: otherOrderData.email }
          ]
        });
        
        if (userUsageCount >= promo.perUserLimit) {
          await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
          throw new ApiError(400, 'You have already used this promo code the maximum number of times');
        }
      }
    }
    
    // NEW: Category/Product-specific discount calculation
    let eligibleTotal = validatedTotal;
    
    if (promo.applicableCategories && promo.applicableCategories.length > 0) {
      // Calculate total of only eligible category items (check both cat and subCat)
      eligibleTotal = validatedItems
        .filter(item => 
          (item.cat && promo.applicableCategories.includes(item.cat.toString())) || 
          (item.subCat && promo.applicableCategories.includes(item.subCat.toString()))
        )
        .reduce((sum, item) => sum + item.totalPrice, 0);
      
      if (eligibleTotal === 0) {
        await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
        throw new ApiError(400, 'No eligible items in cart for this promo code');
      }
    }
    
    if (promo.applicableProducts && promo.applicableProducts.length > 0) {
      // Calculate total of only eligible product items
      eligibleTotal = validatedItems
        .filter(item => promo.applicableProducts.some(p => p.toString() === item.productId.toString()))
        .reduce((sum, item) => sum + item.totalPrice, 0);
      
      if (eligibleTotal === 0) {
        await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
        throw new ApiError(400, 'No eligible products in cart for this promo code');
      }
    }
    
    // Validate minimum order amount (on eligible items)
    if (promo.minOrderAmount && eligibleTotal < promo.minOrderAmount) {
      // Rollback the increment since validation failed
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
      throw new ApiError(400, `Minimum order amount is ৳${promo.minOrderAmount}`);
    }
    
    
    // Calculate server-side discount (on eligible items only)
    serverDiscountAmount = promo.calculateDiscount(eligibleTotal);
    
    // Verify client-provided discount matches (prevent manipulation)
    if (discountAmount && Math.abs(discountAmount - serverDiscountAmount) > 0.01) {
      // Rollback the increment since validation failed
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
      throw new ApiError(400, 'Discount amount mismatch. Please refresh and try again.');
    }
    
    validatedPromoCode = promoCode.toUpperCase();
  }
  
  const finalAmount = validatedTotal + deliveryCharge - serverDiscountAmount;

  // Check if client-provided amount matches (optional, but good for UX sync check)
  // We strictly use finalAmount for the actual DB record if it varies.

  // 3. Generate Custom Order ID
  const orderId = await generateOrderId();

  // 4. Create Order Record (with Rollback Safety)
  let order;
  try {
    order = await Order.create({
      ...otherOrderData,
      orderId,
      items: validatedItems,
      itemsTotal: validatedTotal,
      deliveryCharge,
      shippingZone,
      promoCode: validatedPromoCode,
      discountAmount: serverDiscountAmount,
      amount: finalAmount, // Use server-calculated amount with discount applied
      orderStatus: "pending",
      statusHistory: [
        {
          status: "pending",
          timestamp: new Date(),
          note: "Order placed",
        },
      ],
    });

    // 4.5. Record Promo Code Usage (if applied)
    if (validatedPromoCode && promo) {
      const PromoCodeUsage = require('../models/PromoCodeUsage');
      await PromoCodeUsage.create({
        promoCodeId: promo._id,
        orderId: order._id,
        code: validatedPromoCode,
        discountAmount: serverDiscountAmount,
        orderTotal: validatedTotal,
        userId: req.user?._id || null,
        email: otherOrderData.email || null,
        sessionId: req.headers['x-session-id'] || null,
        ipAddress: req.ip || req.connection.remoteAddress,
      });
    }
  } catch (error) {
    // CRITICAL: Rollback promo usage if order creation fails
    if (validatedPromoCode && promo) {
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { usedCount: -1 } });
      console.error('Order creation failed, rolled back promo usage:', validatedPromoCode);
    }
    throw error;
  }


  // 5. Atomic Stock Update (Decrement Variants)
  for (const item of validatedItems) {
    try {
      await Product.updateOne(
        {_id: item.productId, "variants._id": item.variantId},
        {
          $inc: {
            "variants.$.stock": -item.quantity,
            "variants.$.sells": item.quantity,
          },
        }
      );
    } catch (err) {
      console.error(
        `Failed to update stock for variant ${item.variantId}:`,
        err
      );
    }
  }

  // 6. Send Order Confirmation (Non-blocking)
  if (order.email) {
    const emailData = {
      email: order.email,
      name: order.name || "Customer",
      orderId: order.orderId,
      contact: order.contact, // Add contact for tracking URL
      items: order.items,
      total: order.amount, // Now in BDT
      currency: "BDT",
      address: order.address,
      city: order.city,
    };

    emailService
      .sendOrderConfirmation(emailData)
      .catch((err) => console.error("Email error:", err));
  }

  res.status(201).json(order);
});

/**
 * @desc    Update order status (shipment)
 * @route   PUT /api/orders/status
 * @access  Private/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const {ids, status} = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, "Please provide order IDs");
  }

  // Update status and push to history
  const result = await Order.updateMany(
    {_id: {$in: ids}},
    {
      orderStatus: status,
      $push: {
        statusHistory: {
          status: status,
          timestamp: new Date(),
          note: `Status changed to ${status}`,
        },
      },
    }
  );

  // Send shipping update emails (non-blocking)
  if (result.modifiedCount > 0) {
    Order.find({_id: {$in: ids}})
      .then((orders) => {
        orders.forEach((order) => {
          if (order.email) {
            emailService
              .sendShippingUpdate({
                email: order.email,
                name: order.name || "Customer",
                orderId:
                  order.orderId || order._id.toString().slice(-8).toUpperCase(),
                status: status,
              })
              .catch((err) =>
                console.error("Shipping update email error:", err)
              );
          }
        });
      })
      .catch((err) => console.error("Find orders error:", err));
  }

  res.json({modifiedCount: result.modifiedCount});
});

/**
 * @desc    Cancel orders
 * @route   PUT /api/orders/cancel
 * @access  Private/Admin
 */
const cancelOrders = asyncHandler(async (req, res) => {
  const {ids} = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, "Please provide order IDs");
  }

  const result = await Order.updateMany(
    {_id: {$in: ids}},
    {orderStatus: false}
  );

  res.json({modifiedCount: result.modifiedCount});
});

/**
 * @desc    Delete orders
 * @route   DELETE /api/orders
 * @access  Private/Admin
 */
const deleteOrders = asyncHandler(async (req, res) => {
  const {ids} = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, "Please provide order IDs to delete");
  }

  const result = await Order.deleteMany({_id: {$in: ids}});

  res.json({deletedCount: result.deletedCount});
});

/**
 * @desc    Get orders by phone number (for public tracking)
 * @route   GET /api/orders/track/:phone
 * @access  Public
 */
const getOrdersByPhone = asyncHandler(async (req, res) => {
  const phone = req.params.phone;

  if (!phone || phone.length < 10) {
    throw new ApiError(400, "Please provide a valid phone number");
  }

  const orders = await Order.find({contact: phone})
    .select(
      "orderId orderStatus statusHistory items amount date courierInfo createdAt"
    )
    .sort({createdAt: -1});

  res.json({
    success: true,
    count: orders.length,
    orders,
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
