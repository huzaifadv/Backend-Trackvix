const mongoose = require('mongoose');
require('dotenv').config();

const apiKey = 'e661af8acf2698081f4a18b57ba0c4838b7b70c052e251736d771aadf02b36f8';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB\n');

    const Website = require('./models/Website');

    console.log('🔍 Checking API key:', apiKey.substring(0, 20) + '...');

    const website = await Website.findOne({ apiKey });

    if (website) {
      console.log('\n✅ Website Found:');
      console.log('   Domain:', website.domain);
      console.log('   Status:', website.status);
      console.log('   User ID:', website.userId);
      console.log('   Total Events:', website.metadata.totalEvents || 0);
      console.log('   Last Event:', website.metadata.lastEventAt || 'Never');
    } else {
      console.log('\n❌ No website found with this API key!');
      console.log('\n📋 All websites in database:');
      const allWebsites = await Website.find().limit(5);
      allWebsites.forEach(w => {
        console.log(`\n   Domain: ${w.domain}`);
        console.log(`   API Key: ${w.apiKey.substring(0, 20)}...`);
        console.log(`   Status: ${w.status}`);
      });
    }

    // Check stats
    const TrafficDailyStats = require('./models/TrafficDailyStats');
    const LeadsDailyStats = require('./models/LeadsDailyStats');

    console.log('\n📊 Stats Summary:');
    console.log('   Traffic Stats Records:', await TrafficDailyStats.countDocuments());
    console.log('   Leads Stats Records:', await LeadsDailyStats.countDocuments());

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
