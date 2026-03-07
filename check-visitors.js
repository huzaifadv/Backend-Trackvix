/**
 * Quick script to check visitor tracking
 * Run: node check-visitors.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const UniqueVisitor = require('./models/UniqueVisitor');
const Event = require('./models/Event');

async function checkVisitorTracking() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get your website ID (replace with actual ID)
    const websiteId = '675fd9ca74f0c06e3bbaa59e'; // Update this!

    // Count unique visitors
    const uniqueVisitors = await UniqueVisitor.countDocuments({ websiteId });
    console.log(`👥 Unique Visitors: ${uniqueVisitors}`);

    // Count total events
    const totalEvents = await Event.countDocuments({ websiteId });
    console.log(`📊 Total Events: ${totalEvents}`);

    // Count pageview events
    const pageviews = await Event.countDocuments({ websiteId, type: 'pageview' });
    console.log(`📄 Pageviews: ${pageviews}\n`);

    // Show visitor details
    console.log('👥 Visitor Details:');
    const visitors = await UniqueVisitor.find({ websiteId }).limit(5);
    visitors.forEach((visitor, index) => {
      console.log(`\nVisitor ${index + 1}:`);
      console.log(`  ID: ${visitor.visitorHash.substring(0, 20)}...`);
      console.log(`  First Seen: ${visitor.firstSeen}`);
      console.log(`  Last Seen: ${visitor.lastSeen}`);
      console.log(`  Visit Count: ${visitor.visitCount}`);
      console.log(`  Device: ${visitor.device}`);
      console.log(`  Country: ${visitor.country}`);
    });

    // Show recent events with visitor info
    console.log('\n\n📊 Recent Events:');
    const recentEvents = await Event.find({ websiteId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentEvents.forEach((event, index) => {
      console.log(`\nEvent ${index + 1}:`);
      console.log(`  Type: ${event.type}`);
      console.log(`  Visitor ID: ${event.visitorId ? event.visitorId.substring(0, 20) + '...' : 'N/A'}`);
      console.log(`  Is New Visitor: ${event.isNewVisitor}`);
      console.log(`  Device: ${event.device}`);
      console.log(`  Time: ${event.createdAt}`);
    });

    console.log('\n\n✅ Test Complete!');
    console.log('\n💡 Expected Behavior:');
    console.log('   - Unique Visitors = 1 (even after multiple page refreshes)');
    console.log('   - Total Events = Number of page refreshes');
    console.log('   - First event: isNewVisitor = true');
    console.log('   - Subsequent events: isNewVisitor = false');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkVisitorTracking();
