/**
 * Check all tracking stats across all models
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Website = require('./models/Website');
const UniqueVisitor = require('./models/UniqueVisitor');
const Event = require('./models/Event');
const TrafficDailyStats = require('./models/TrafficDailyStats');
const LeadsDailyStats = require('./models/LeadsDailyStats');

async function checkAllStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get website
    const website = await Website.findOne().sort({ createdAt: -1 });

    if (!website) {
      console.log('❌ No website found');
      process.exit(1);
    }

    console.log('🌐 Website:', website.domain);
    console.log('📊 Website Metadata:');
    console.log('   Total Events:', website.metadata.totalEvents || 0);
    console.log('   Last Event:', website.metadata.lastEventAt || 'Never');
    console.log('');

    // Unique Visitors
    const uniqueVisitors = await UniqueVisitor.countDocuments({ websiteId: website._id });
    console.log('👥 Unique Visitors:', uniqueVisitors);

    const visitors = await UniqueVisitor.find({ websiteId: website._id }).limit(3);
    visitors.forEach((v, i) => {
      console.log(`   Visitor ${i + 1}:`);
      console.log(`      ID: ${v.visitorHash.substring(0, 30)}...`);
      console.log(`      Visits: ${v.visitCount}`);
      console.log(`      Device: ${v.device}`);
    });
    console.log('');

    // Event Model (new system with visitorId)
    const eventModelCount = await Event.countDocuments({ websiteId: website._id });
    console.log('📊 Event Model (New System):', eventModelCount);

    if (eventModelCount > 0) {
      const recentEvents = await Event.find({ websiteId: website._id })
        .sort({ createdAt: -1 })
        .limit(5);

      recentEvents.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.type} - ${e.isNewVisitor ? 'New' : 'Returning'}`);
      });
    }
    console.log('');

    // TrafficDailyStats
    const trafficStats = await TrafficDailyStats.find({ websiteId: website._id })
      .sort({ date: -1 })
      .limit(1);

    if (trafficStats.length > 0) {
      const stat = trafficStats[0];
      console.log('📈 TrafficDailyStats (Latest):');
      console.log('   Date:', stat.date.toDateString());
      console.log('   Total Visits:', stat.totalVisits);
      console.log('   Devices:', {
        desktop: stat.devices?.desktop || 0,
        mobile: stat.devices?.mobile || 0,
        tablet: stat.devices?.tablet || 0
      });
    } else {
      console.log('📈 TrafficDailyStats: Empty');
    }
    console.log('');

    // LeadsDailyStats
    const leadsStats = await LeadsDailyStats.find({ websiteId: website._id })
      .sort({ date: -1 })
      .limit(1);

    if (leadsStats.length > 0) {
      const stat = leadsStats[0];
      console.log('📞 LeadsDailyStats (Latest):');
      console.log('   Date:', stat.date.toDateString());
      console.log('   Call Clicks:', stat.callClicks || 0);
      console.log('   WhatsApp Clicks:', stat.whatsappClicks || 0);
      console.log('   CTA Clicks:', stat.ctaClicks || 0);
      console.log('   Form Submits:', stat.formSubmissions || 0);

      const totalLeads = (stat.callClicks || 0) +
                        (stat.whatsappClicks || 0) +
                        (stat.ctaClicks || 0) +
                        (stat.formSubmissions || 0);

      console.log('   Total Leads/Events:', totalLeads);
    } else {
      console.log('📞 LeadsDailyStats: Empty');
    }
    console.log('');

    console.log('✅ Summary:');
    console.log(`   Visitors: ${uniqueVisitors}`);
    console.log(`   Website metadata events: ${website.metadata.totalEvents || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllStats();
