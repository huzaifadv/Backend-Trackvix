const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const Plan = require('../models/Plan');

/**
 * Initialize Subscription Plans
 * Sets up Basic and Pro plans in database
 */

async function initializePlans() {
  try {
    console.log('🔌 Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Initializing subscription plans...');

    const plans = await Plan.initializePlans();

    console.log('\n✅ Plans initialized successfully!\n');

    plans.forEach(plan => {
      console.log(`Plan: ${plan.displayName}`);
      console.log(`  - Name: ${plan.name}`);
      console.log(`  - Price: $${plan.price}/month`);
      console.log(`  - Website Limit: ${plan.websiteLimit}`);
      console.log(`  - Features: ${plan.features.length}`);
      console.log('');
    });

    console.log('💡 Plans are ready for use!');

  } catch (error) {
    console.error('❌ Error initializing plans:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run initialization
initializePlans();
