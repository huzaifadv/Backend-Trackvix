const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Database Connection Configuration
 * Implements connection pooling and production-ready settings
 */
class Database {
  constructor() {
    this.connection = null;
  }

  /**
   * Connect to MongoDB with retry logic and optimized settings
   */
  async connect() {
    try {
      const mongoUri = process.env.NODE_ENV === 'production'
        ? process.env.MONGODB_URI_PROD
        : process.env.MONGODB_URI;

      const options = {
        maxPoolSize: 10, // Connection pool size for horizontal scaling
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        family: 4, // Use IPv4, skip trying IPv6
      };

      this.connection = await mongoose.connect(mongoUri, options);

      logger.info(`MongoDB Connected: ${this.connection.connection.host}`);

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Database connection failed:', error);
      // Retry connection after 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }

  /**
   * Gracefully disconnect from MongoDB
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new Database();
