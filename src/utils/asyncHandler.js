/**
 * Async Handler Utility
 * Wraps async route handlers to automatically catch errors
 * and pass them to the error handling middleware
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
