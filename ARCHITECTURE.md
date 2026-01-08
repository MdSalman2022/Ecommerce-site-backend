# BestDeal Backend Structure Reference

> **Created**: 2026-01-08  
> **Purpose**: Snapshot of current backend architecture for rollback reference

---

## Directory Structure

```
backend/
├── index.js                 # Entry point - starts server
├── package.json            # Dependencies
├── .env                    # Environment variables
└── src/
    ├── app.js              # Express app configuration
    ├── config/
    │   ├── database.js     # MongoDB connection
    │   └── index.js        # Config exports
    ├── constants/
    │   ├── http.constants.js
    │   └── index.js
    ├── controllers/        # Request handlers
    │   ├── aiController.js
    │   ├── orderController.js
    │   ├── paymentController.js
    │   ├── productController.js
    │   ├── promoController.js
    │   ├── reviewController.js
    │   ├── uploadController.js
    │   ├── userController.js
    │   ├── wishlistController.js
    │   └── index.js
    ├── middleware/
    │   ├── cacheMiddleware.js  # NodeCache for API responses
    │   ├── errorHandler.js
    │   └── index.js
    ├── models/             # Mongoose schemas
    │   ├── Product.js      → productCollection
    │   ├── User.js         → userCollection
    │   ├── Order.js        → OrderHistory
    │   ├── Review.js       → reviewCollection
    │   ├── Wishlist.js     → wishlistCollection
    │   ├── PromoCode.js    → promoCodeCollection
    │   └── index.js
    ├── routes/
    │   ├── aiRoutes.js
    │   ├── orderRoutes.js
    │   ├── paymentRoutes.js
    │   ├── productRoutes.js
    │   ├── promoRoutes.js
    │   ├── reviewRoutes.js
    │   ├── uploadRoutes.js
    │   ├── userRoutes.js
    │   ├── wishlistRoutes.js
    │   └── index.js        # Route aggregator + legacy routes
    ├── services/
    │   ├── aiService.js      # Groq/Gemini AI integration
    │   ├── cloudinaryService.js
    │   └── emailService.js   # Resend integration
    └── utils/
        ├── ApiResponse.js
        ├── asyncHandler.js
        └── index.js
```

---

## API Route Structure

### RESTful Routes (prefix: `/api`)

| Route           | Controller         |
| --------------- | ------------------ |
| `/api/products` | productController  |
| `/api/users`    | userController     |
| `/api/orders`   | orderController    |
| `/api/reviews`  | reviewController   |
| `/api/payments` | paymentController  |
| `/api/upload`   | uploadController   |
| `/api/wishlist` | wishlistController |
| `/api/ai`       | aiController       |
| `/api/promo`    | promoController    |

### Legacy Routes (root level)

Maintained for backward compatibility:

- `/products`, `/product/:id`
- `/featured`, `/latest`, `/bestseller`, `/special`
- `/getusers`, `/adduser`, `/userdata`, `/deliveryInfo`
- `/orderhistory`, `/orderstatus`, `/orderCancel`
- `/get-review`, `/post-review`
- `/create-payment-intent`

---

## Database Schemas

### Product

```javascript
{
  name, cat, subcat, brand, manufacturer, capacity,
  image, images[], spec[], price, rating,
  featured, latest, bestseller, sells,
  special, specialprice, discount, date, stock,
  variants: [{ color, size, price, stock, sku, image }]
}
// Collection: productCollection
```

### User

```javascript
{
  name, email, orderName, address, city, contact, cardnumber, date;
}
// Collection: userCollection
```

### Order

```javascript
{
  name, address, contact, city, email,
  transactionId, amount, items[], date,
  orderStatus, shipment, promoCode, discountAmount
}
// Collection: OrderHistory
```

### Review

```javascript
{
  name, email, rating, review, productId, date, isVerified;
}
// Collection: reviewCollection
```

### Wishlist

```javascript
{
  email, productId (ref: Product), addedAt
}
// Collection: wishlistCollection
```

### PromoCode

```javascript
{
  code, description, discountType, discountValue,
  minOrderAmount, maxDiscount, usageLimit, usedCount,
  validFrom, validUntil, isActive, applicableCategories[], createdBy
}
// Collection: promoCodeCollection
```

---

## Middleware Stack

1. **Helmet** - Security headers
2. **Rate Limiter** - 100 req/15min per IP on `/api`
3. **JSON Parser** - 10MB limit
4. **CORS** - Configurable origin
5. **Cache Middleware** - NodeCache for products

---

## External Services

| Service    | Purpose       | File                               |
| ---------- | ------------- | ---------------------------------- |
| MongoDB    | Database      | `config/database.js`               |
| Stripe     | Payments      | `controllers/paymentController.js` |
| Cloudinary | Image uploads | `services/cloudinaryService.js`    |
| Resend     | Emails        | `services/emailService.js`         |
| Groq AI    | Text AI       | `services/aiService.js`            |
| Gemini AI  | Vision AI     | `services/aiService.js`            |

---

## Environment Variables

```env
PORT=5000
MONGODB_URI=
CORS_ORIGIN=
STRIPE_SECRET_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```
