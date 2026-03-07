/**
 * Reset website stats for fresh testing
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Website = require('./models/Website');
const UniqueVisitor = require('./models/UniqueVisitor');
const Event = require('./models/Event');
const TrafficDailyStats = require('./models/TrafficDailyStats');
const LeadsDailyStats = require('./models/LeadsDailyStats');

async function resetStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get your website
    const website = await Website.findOne().sort({ createdAt: -1 });

    if (!website) {
      console.log('❌ No website found');
      process.exit(1);
    }

    console.log('🌐 Resetting stats for:', website.domain);
    console.log('');

    // Delete all tracking data for this website
    await Promise.all([
      Event.deleteMany({ websiteId: website._id }),
      UniqueVisitor.deleteMany({ websiteId: website._id }),
      TrafficDailyStats.deleteMany({ websiteId: website._id }),
      LeadsDailyStats.deleteMany({ websiteId: website._id })
    ]);

    // Reset website metadata
    website.metadata.totalEvents = 0;
    website.metadata.lastEventAt = null;
    await website.save();

    console.log('✅ Reset Complete!');
    console.log('   ✅ All events deleted');
    console.log('   ✅ All unique visitors deleted');
    console.log('   ✅ All daily stats deleted');
    console.log('   ✅ Website metadata reset to 0');
    console.log('');
    console.log('💡 Now test on http://localhost:5000/example.html');
    console.log('   1. Refresh page 5 times → Visitors should stay 1');
    console.log('   2. Click buttons → Events should increment');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetStats();
