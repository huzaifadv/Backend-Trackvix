const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Website = require('../models/Website');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');

/**
 * Database Index Setup Script
 * Creates all necessary indexes for optimal performance and horizontal scaling
 */

async function setupIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB\n');

    // ===========================
    // User Indexes
    // ===========================
    console.log('📊 Creating User indexes...');
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ createdAt: -1 });
    console.log('✅ User indexes created\n');

    // ===========================
    // Website Indexes
    // ===========================
    console.log('📊 Creating Website indexes...');
    await Website.collection.createIndex({ apiKey: 1 }, { unique: true });
    await Website.collection.createIndex({ userId: 1 });
    await Website.collection.createIndex({ userId: 1, domain: 1 }, { unique: true });
    await Website.collection.createIndex({ createdAt: -1 });
    await Website.collection.createIndex({ isActive: 1 });
    console.log('✅ Website indexes created\n');

    // ===========================
    // TrafficDailyStats Indexes
    // ===========================
    console.log('📊 Creating TrafficDailyStats indexes...');
    await TrafficDailyStats.collection.createIndex({ websiteId: 1 });
    await TrafficDailyStats.collection.createIndex({ date: 1 });
    await TrafficDailyStats.collection.createIndex(
      { websiteId: 1, date: 1 },
      { unique: true }
    );
    await TrafficDailyStats.collection.createIndex({ websiteId: 1, date: -1 });
    console.log('✅ TrafficDailyStats indexes created\n');

    // ===========================
    // LeadsDailyStats Indexes
    // ===========================
    console.log('📊 Creating LeadsDailyStats indexes...');
    await LeadsDailyStats.collection.createIndex({ websiteId: 1 });
    await LeadsDailyStats.collection.createIndex({ date: 1 });
    await LeadsDailyStats.collection.createIndex(
      { websiteId: 1, date: 1 },
      { unique: true }
    );
    await LeadsDailyStats.collection.createIndex({ websiteId: 1, date: -1 });
    console.log('✅ LeadsDailyStats indexes created\n');

    // ===========================
    // List All Indexes
    // ===========================
    console.log('📋 Current Database Indexes:\n');

    const collections = [
      { name: 'User', model: User },
      { name: 'Website', model: Website },
      { name: 'TrafficDailyStats', model: TrafficDailyStats },
      { name: 'LeadsDailyStats', model: LeadsDailyStats },
    ];

    for (const { name, model } of collections) {
      const indexes = await model.collection.indexes();
      console.log(`${name} Collection Indexes:`);
      indexes.forEach(index => {
        console.log(`  - ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
      });
      console.log('');
    }

    console.log('🎉 All indexes created successfully!');
    console.log('\n💡 Your database is now optimized for:');
    console.log('   - Fast API key lookups');
    console.log('   - Efficient date range queries');
    console.log('   - Horizontal scaling readiness');
    console.log('   - Atomic upsert operations');

  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run setup
setupIndexes();
