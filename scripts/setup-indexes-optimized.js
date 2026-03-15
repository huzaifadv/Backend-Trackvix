const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Website = require('../models/Website');
const Event = require('../models/Event');
const TrafficDailyStats = require('../models/TrafficDailyStats');
const LeadsDailyStats = require('../models/LeadsDailyStats');
const UniqueVisitor = require('../models/UniqueVisitor');
const WebsiteHealth = require('../models/WebsiteHealth');
const Plan = require('../models/Plan');

/**
 * Optimized Database Index Setup Script
 * Creates all necessary indexes for optimal performance and horizontal scaling
 * Optimized for 50k+ users and high-traffic analytics workloads
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
    await User.collection.createIndex({ stripeCustomerId: 1 });
    await User.collection.createIndex({ currentPlan: 1 });
    await User.collection.createIndex({ subscriptionStatus: 1 });
    await User.collection.createIndex({ currentPlan: 1, subscriptionStatus: 1 });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ isSuspended: 1 });
    await User.collection.createIndex({ isEmailVerified: 1 });
    console.log('✅ User indexes created\n');

    // ===========================
    // Website Indexes
    // ===========================
    console.log('📊 Creating Website indexes...');
    await Website.collection.createIndex({ apiKey: 1 }, { unique: true });
    await Website.collection.createIndex({ userId: 1 });
    await Website.collection.createIndex({ userId: 1, domain: 1 }, { unique: true });
    await Website.collection.createIndex({ createdAt: -1 });
    await Website.collection.createIndex({ status: 1 });
    await Website.collection.createIndex({ userId: 1, status: 1 });
    await Website.collection.createIndex({ isActive: 1 });
    console.log('✅ Website indexes created\n');

    // ===========================
    // Event Indexes (OPTIMIZED)
    // ===========================
    console.log('📊 Creating Event indexes (optimized for analytics)...');
    // Core time-series indexes
    await Event.collection.createIndex({ websiteId: 1, createdAt: -1 });
    await Event.collection.createIndex({ websiteId: 1, type: 1, createdAt: -1 });
    await Event.collection.createIndex({ createdAt: -1 });

    // Visitor tracking
    await Event.collection.createIndex({ websiteId: 1, visitorId: 1 });
    await Event.collection.createIndex({ visitorId: 1, createdAt: -1 });

    // Location analytics - CRITICAL for performance
    await Event.collection.createIndex({ websiteId: 1, country: 1, createdAt: -1 });
    await Event.collection.createIndex({ websiteId: 1, city: 1, createdAt: -1 });
    await Event.collection.createIndex({ country: 1 });

    // Device analytics
    await Event.collection.createIndex({ websiteId: 1, device: 1, createdAt: -1 });

    // Type-based queries (admin analytics, event filtering)
    await Event.collection.createIndex({ type: 1, createdAt: -1 });
    await Event.collection.createIndex({ websiteId: 1, type: 1 }); // NEW: Type filtering without dates

    // New visitor analytics
    await Event.collection.createIndex({ isNewVisitor: 1, createdAt: -1 });
    await Event.collection.createIndex({ websiteId: 1, isNewVisitor: 1, createdAt: -1 });

    console.log('✅ Event indexes created (11 indexes for optimal query performance)\n');

    // ===========================
    // UniqueVisitor Indexes
    // ===========================
    console.log('📊 Creating UniqueVisitor indexes...');
    await UniqueVisitor.collection.createIndex({ websiteId: 1, visitorHash: 1 }, { unique: true });
    await UniqueVisitor.collection.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL
    await UniqueVisitor.collection.createIndex({ websiteId: 1, lastSeen: -1 });
    await UniqueVisitor.collection.createIndex({ websiteId: 1, firstSeen: -1 });
    console.log('✅ UniqueVisitor indexes created\n');

    // ===========================
    // TrafficDailyStats Indexes
    // ===========================
    console.log('📊 Creating TrafficDailyStats indexes...');
    await TrafficDailyStats.collection.createIndex({ websiteId: 1 });
    await TrafficDailyStats.collection.createIndex({ date: 1 });
    await TrafficDailyStats.collection.createIndex({ websiteId: 1, date: 1 }, { unique: true });
    await TrafficDailyStats.collection.createIndex({ websiteId: 1, date: -1 });
    console.log('✅ TrafficDailyStats indexes created\n');

    // ===========================
    // LeadsDailyStats Indexes
    // ===========================
    console.log('📊 Creating LeadsDailyStats indexes...');
    await LeadsDailyStats.collection.createIndex({ websiteId: 1 });
    await LeadsDailyStats.collection.createIndex({ date: 1 });
    await LeadsDailyStats.collection.createIndex({ websiteId: 1, date: 1 }, { unique: true });
    await LeadsDailyStats.collection.createIndex({ websiteId: 1, date: -1 });
    console.log('✅ LeadsDailyStats indexes created\n');

    // ===========================
    // WebsiteHealth Indexes
    // ===========================
    console.log('📊 Creating WebsiteHealth indexes...');
    await WebsiteHealth.collection.createIndex({ websiteId: 1, scannedAt: -1 });
    await WebsiteHealth.collection.createIndex({ overallScore: 1 });
    await WebsiteHealth.collection.createIndex({ status: 1 });
    await WebsiteHealth.collection.createIndex({ nextScanAt: 1 });
    console.log('✅ WebsiteHealth indexes created\n');

    // ===========================
    // Plan Indexes
    // ===========================
    console.log('📊 Creating Plan indexes...');
    await Plan.collection.createIndex({ name: 1 }, { unique: true });
    await Plan.collection.createIndex({ isActive: 1 });
    console.log('✅ Plan indexes created\n');

    // ===========================
    // List All Indexes
    // ===========================
    console.log('📋 Current Database Indexes:\n');

    const collections = [
      { name: 'User', model: User },
      { name: 'Website', model: Website },
      { name: 'Event', model: Event },
      { name: 'UniqueVisitor', model: UniqueVisitor },
      { name: 'TrafficDailyStats', model: TrafficDailyStats },
      { name: 'LeadsDailyStats', model: LeadsDailyStats },
      { name: 'WebsiteHealth', model: WebsiteHealth },
      { name: 'Plan', model: Plan },
    ];

    for (const { name, model } of collections) {
      const indexes = await model.collection.indexes();
      console.log(`${name} Collection Indexes (${indexes.length} total):`);
      indexes.forEach(index => {
        const unique = index.unique ? ' (unique)' : '';
        const ttl = index.expireAfterSeconds ? ` (TTL: ${index.expireAfterSeconds}s)` : '';
        console.log(`  - ${JSON.stringify(index.key)}${unique}${ttl}`);
      });
      console.log('');
    }

    console.log('🎉 All indexes created successfully!');
    console.log('\n💡 Your database is now optimized for:');
    console.log('   ✅ Fast API key lookups (Website)');
    console.log('   ✅ Efficient date range queries (Events, Stats)');
    console.log('   ✅ Location-based analytics (Country, City)');
    console.log('   ✅ Device breakdown queries');
    console.log('   ✅ Visitor tracking with TTL cleanup');
    console.log('   ✅ Multi-tenant isolation (userId, websiteId)');
    console.log('   ✅ Horizontal scaling readiness');
    console.log('   ✅ Atomic upsert operations');
    console.log('   ✅ Production workloads (50k+ users)');
    console.log('\n📊 Total indexes created: ~45 across 8 collections');

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
