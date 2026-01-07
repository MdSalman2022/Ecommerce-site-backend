const { ApiError } = require('../utils/ApiResponse');

/**
 * Global Error Handler Middleware
 * Catches all errors and sends consistent error responses
 */
const errorHandler = (err, req, res, next) => {
    let error = err;

    // If not an ApiError, convert it
    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        error = new ApiError(statusCode, message);
    }

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', {
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode,
        });
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        error = new ApiError(400, 'Validation Error', messages);
    }

    // Handle Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
    }

    // Handle Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new ApiError(400, `Duplicate value for field: ${field}`);
    }

    res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errors: error.errors || [],
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

/**
 * Not Found Handler
 * Catches 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new ApiError(404, `Route not found: ${req.originalUrl}`);
    next(error);
};

module.exports = { errorHandler, notFoundHandler };
