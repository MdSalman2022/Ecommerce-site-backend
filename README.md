# BestDeal Backend API

Production-ready E-commerce Backend API built with Node.js, Express, and MongoDB following MVC architecture.

## Project Structure

```
src/
├── config/         # Configuration files (database, etc.)
├── constants/      # Constants and enums
├── controllers/    # Request handlers (business logic)
├── middleware/     # Express middleware
├── models/         # Mongoose schemas
├── routes/         # API route definitions
└── utils/          # Utility functions
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure your environment variables

3. Start development server:

   ```bash
   npm run dev
   ```

4. For production:
   ```bash
   npm start
   ```

## API Endpoints

### Products

- `GET /products` - Get all products
- `GET /product/:id` - Get product by ID
- `GET /featured` - Get featured products
- `GET /latest` - Get latest products
- `GET /bestseller` - Get bestseller products
- `POST /addproduct` - Create new product
- `PUT /update/:id` - Update product
- `DELETE /delete` - Delete products

### Users

- `GET /getusers` - Get all users
- `POST /adduser` - Create/register user
- `PUT /userdata` - Update card info
- `PUT /deliveryInfo` - Update delivery info

### Orders

- `GET /orderhistory` - Get all orders
- `POST /orderhistory` - Create order
- `PUT /orderstatus` - Update order status
- `PUT /orderCancel` - Cancel orders
- `DELETE /deleteOrder` - Delete orders

### Reviews

- `GET /get-review` - Get all reviews
- `POST /post-review` - Create review

### Payments

- `POST /create-payment-intent` - Create Stripe payment intent

## RESTful API Endpoints

All above endpoints are also available under `/api/` prefix with RESTful conventions:

- `/api/products`, `/api/users`, `/api/orders`, `/api/reviews`, `/api/payments`
