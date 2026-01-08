const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const poolMax = parseInt(process.env.DB_POOL_MAX) || 10;
        const poolMin = parseInt(process.env.DB_POOL_MIN) || 5;

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: poolMax,
            minPoolSize: poolMin,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host} (Pool: ${poolMin}-${poolMax})`);

        mongoose.connection.on('error', (err) => {
            console.error(`MongoDB connection error: ${err}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });

        return conn;
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

const closeDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error(`Error closing MongoDB connection: ${error.message}`);
    }
};

module.exports = { connectDB, closeDB };

