/**
 * Production-Ready MongoDB Indexing Strategy
 * Optimized for 50,000+ users and millions of events
 *
 * Multi-tenant isolation and scalability focused
 * Run this script ONCE during deployment or maintenance window
 *
 * Usage: node scripts/setup-production-indexes.js
 */

const mongoose = require('mongoose');
const config = require('../config/environment');
const logger = require('../config/logger');

// Import models to ensure schemas are registered
require('../models/Event');
require('../models/UniqueVisitor');
require('../models/TrafficDailyStats');
require('../models/LeadsDailyStats');
require('../models/Website');
require('../models/User');

/**
 * MongoDB Index Commands for All Collections
 * Each index is designed for specific query patterns and multi-tenant isolation
 */
const indexCommands = {
  events: [
    // Single field indexes (already exist in schema)
    { keys: { websiteId: 1 }, options: { background: true } },
    { keys: { type: 1 }, options: { background: true } },
    { keys: { visitorId: 1 }, options: { background: true } },
    { keys: { country: 1 }, options: { background: true } },

    // Compound indexes for multi-tenant queries (CRITICAL)
    { keys: { websiteId: 1, createdAt: -1 }, options: { background: true } },
    { keys: { websiteId: 1, type: 1, createdAt: -1 }, options: { background: true } },
    { keys: { websiteId: 1, visitorId: 1 }, options: { background: true } },

    // Additional compound indexes for analytics queries
    { keys: { websiteId: 1, country: 1, createdAt: -1 }, options: { background: true } },
    { keys: { websiteId: 1, device: 1, createdAt: -1 }, options: { background: true } },

    // Time-series index for cleanup/archival
    { keys: { createdAt: -1 }, options: { background: true } },
  ],

  uniquevisitors: [
    // Compound unique index (already exists)
    { keys: { websiteId: 1, visitorHash: 1 }, options: { unique: true, background: true } },

    // TTL index for automatic cleanup (already exists)
    { keys: { lastSeen: 1 }, options: { expireAfterSeconds: 2592000, background: true } },

    // Additional indexes for queries
    { keys: { websiteId: 1, lastSeen: -1 }, options: { background: true } },
    { keys: { websiteId: 1, firstSeen: -1 }, options: { background: true } },
  ],

  trafficdailystats: [
    // Compound unique index (already exists)
    { keys: { websiteId: 1, date: 1 }, options: { unique: true, background: true } },

    // Time-series index
    { keys: { date: -1 }, options: { background: true } },

    // Individual field index (already exists)
    { keys: { websiteId: 1 }, options: { background: true } },
  ],

  leadsdailystats: [
    // Compound unique index (already exists)
    { keys: { websiteId: 1, date: 1 }, options: { unique: true, background: true } },

    // Time-series index
    { keys: { date: -1 }, options: { background: true } },

    // Individual field index (already exists)
    { keys: { websiteId: 1 }, options: { background: true } },
  ],

  websites: [
    // Unique API key index (already exists)
    { keys: { apiKey: 1 }, options: { unique: true, background: true } },

    // User isolation index (already exists)
    { keys: { userId: 1 }, options: { background: true } },

    // Compound unique index (already exists)
    { keys: { userId: 1, domain: 1 }, options: { unique: true, background: true } },

    // Time-series index (already exists)
    { keys: { createdAt: -1 }, options: { background: true } },

    // Status-based queries
    { keys: { status: 1 }, options: { background: true } },
    { keys: { userId: 1, status: 1 }, options: { background: true } },
  ],

  users: [
    // Unique email index (created automatically by schema)
    { keys: { email: 1 }, options: { unique: true, background: true } },

    // Time-series index (already exists)
    { keys: { createdAt: -1 }, options: { background: true } },

    // Stripe customer index (already exists)
    { keys: { stripeCustomerId: 1 }, options: { background: true } },

    // Plan and subscription queries
    { keys: { currentPlan: 1 }, options: { background: true } },
    { keys: { subscriptionStatus: 1 }, options: { background: true } },
    { keys: { currentPlan: 1, subscriptionStatus: 1 }, options: { background: true } },

    // Admin queries
    { keys: { role: 1 }, options: { background: true } },
    { keys: { isSuspended: 1 }, options: { background: true } },
    { keys: { isEmailVerified: 1 }, options: { background: true } },
  ],
};

/**
 * Create indexes for a single collection
 */
async function createIndexesForCollection(collectionName, indexes) {
  try {
    const collection = mongoose.connection.collection(collectionName);

    logger.info(`Creating indexes for ${collectionName}...`);

    for (const indexDef of indexes) {
      try {
        await collection.createIndex(indexDef.keys, indexDef.options);
        logger.info(`✓ Created index on ${collectionName}: ${JSON.stringify(indexDef.keys)}`);
      } catch (error) {
        // Index might already exist - this is OK
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          logger.warn(`Index already exists on ${collectionName}: ${JSON.stringify(indexDef.keys)}`);
        } else if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
          logger.warn(`Index key already exists on ${collectionName}: ${JSON.stringify(indexDef.keys)}`);
        } else {
          throw error;
        }
      }
    }

    logger.info(`✓ Completed indexes for ${collectionName}\n`);
  } catch (error) {
    logger.error(`Error creating indexes for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Main function to create all indexes
 */
async function setupProductionIndexes() {
  try {
    logger.info('========================================');
    logger.info('Starting Production Index Setup');
    logger.info('Optimized for 50,000+ users');
    logger.info('========================================\n');

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('Connected to MongoDB\n');

    // Create indexes for each collection
    for (const [collectionName, indexes] of Object.entries(indexCommands)) {
      await createIndexesForCollection(collectionName, indexes);
    }

    // List all indexes for verification
    logger.info('========================================');
    logger.info('Verifying Indexes');
    logger.info('========================================\n');

    for (const collectionName of Object.keys(indexCommands)) {
      const collection = mongoose.connection.collection(collectionName);
      const indexes = await collection.indexes();
      logger.info(`${collectionName} indexes:`);
      indexes.forEach((index) => {
        logger.info(`  - ${JSON.stringify(index.key)} ${index.unique ? '[UNIQUE]' : ''}`);
      });
      logger.info('');
    }

    logger.info('========================================');
    logger.info('✓ Index Setup Complete!');
    logger.info('========================================');

  } catch (error) {
    logger.error('Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

// Run if executed directly
if (require.main === module) {
  setupProductionIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupProductionIndexes;
