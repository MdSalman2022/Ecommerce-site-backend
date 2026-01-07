/**
 * API Response Helper Classes
 * Provides consistent response formatting across all endpoints
 */

class ApiResponse {
    constructor(statusCode, data, message = 'Success') {
        this.success = statusCode < 400;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
    }

    /**
     * Send the response
     * @param {Response} res - Express response object
     */
    send(res) {
        return res.status(this.statusCode).json({
            success: this.success,
            message: this.message,
            data: this.data,
        });
    }
}

class ApiError extends Error {
    constructor(statusCode, message = 'Something went wrong', errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.errors = errors;
        this.success = false;
    }
}

module.exports = { ApiResponse, ApiError };
