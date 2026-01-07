/**
 * Configuration Module Aggregator
 * Centralizes all configuration exports
 */
const { connectDB, closeDB } = require('./database');

module.exports = {
    connectDB,
    closeDB,
};
