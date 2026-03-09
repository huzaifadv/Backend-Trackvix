const app = require('./app');
const database = require('./config/database');
const config = require('./config/environment');
const logger = require('./config/logger');

/**
 * Server Entry Point
 * Starts the Express application and connects to database
 */

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Start Server
 */
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();

    // Start listening
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Website Tracker API Server                           ║
║                                                            ║
║   Environment:  ${config.env.padEnd(42)}║
║   Port:         ${PORT.toString().padEnd(42)}║
║   API Version:  ${config.apiVersion.padEnd(42)}║
║   Database:     Connected                                 ║
║                                                            ║
║   API Endpoint: http://localhost:${PORT}/api/${config.apiVersion.padEnd(15)}║
║   Health Check: http://localhost:${PORT}/ping${' '.repeat(23)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close database connection
        await database.disconnect();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
