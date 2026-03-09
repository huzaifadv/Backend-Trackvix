const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Database Connection Configuration
 * Implements connection pooling and production-ready settings
 */
class Database {
  constructor() {
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.isConnecting = false;
  }

  /**
   * Connect to MongoDB with retry logic and optimized settings
   */
  async connect(retryAttempt = 0) {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      logger.debug('Connection attempt already in progress, skipping...');
      return Promise.resolve();
    }

    this.isConnecting = true;

    try {
      const mongoUri = process.env.NODE_ENV === 'production'
        ? process.env.MONGODB_URI_PROD
        : process.env.MONGODB_URI;

      const options = {
        maxPoolSize: 10, // Connection pool size for horizontal scaling
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 10000, // Increased from 5s to 10s
        family: 4, // Use IPv4, skip trying IPv6
        retryWrites: true,
        retryReads: true,
      };

      if (retryAttempt > 0) {
        logger.info(`MongoDB connection attempt ${retryAttempt + 1}/${this.maxRetries}...`);
      }

      this.connection = await mongoose.connect(mongoUri, options);
      this.retryCount = 0; // Reset retry count on successful connection
      this.isConnecting = false;

      logger.info('Database connection established');

      // Handle connection events (only set up once)
      if (!this.eventsAttached) {
        this.setupConnectionEvents();
        this.eventsAttached = true;
      }

      return Promise.resolve();

    } catch (error) {
      this.isConnecting = false;

      // Only log as error if it's not a DNS issue
      if (error.code === 'ESERVFAIL' || error.syscall === 'queryTxt') {
        logger.warn(`DNS resolution issue for MongoDB Atlas (attempt ${retryAttempt + 1}/${this.maxRetries})`);
      } else {
        logger.error('Database connection failed:', {
          message: error.message,
          code: error.code,
          attempt: retryAttempt + 1
        });
      }

      // Retry logic with exponential backoff
      if (retryAttempt < this.maxRetries - 1) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryAttempt), 30000); // Max 30 seconds
        logger.info(`Retrying connection in ${retryDelay / 1000} seconds...`);

        // Return a promise that resolves after the retry
        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              await this.connect(retryAttempt + 1);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, retryDelay);
        });
      } else {
        const errorMsg = `Failed to connect to MongoDB after ${this.maxRetries} attempts. Please check your connection.`;
        logger.error(errorMsg);

        // Don't exit process in development, but throw error
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        }

        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Set up connection event handlers
   */
  setupConnectionEvents() {
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      this.isConnecting = false;
      this.connect();
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
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
