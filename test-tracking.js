/**
 * Test tracking logic
 * Verifies that pageviews don't increment event count
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Website = require('./models/Website');
const UniqueVisitor = require('./models/UniqueVisitor');
const Event = require('./models/Event');

async function testTracking() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get your website (latest one)
    const website = await Website.findOne().sort({ createdAt: -1 });

    if (!website) {
      console.log('❌ No website found. Create one first!');
      process.exit(1);
    }

    console.log('🌐 Website:', website.domain);
    console.log('📊 Current Stats:');
    console.log('   Total Events (in metadata):', website.metadata.totalEvents || 0);
    console.log('');

    // Count events by type
    const pageviews = await Event.countDocuments({
      websiteId: website._id,
      type: 'pageview'
    });

    const telClicks = await Event.countDocuments({
      websiteId: website._id,
      type: 'tel_click'
    });

    const whatsappClicks = await Event.countDocuments({
      websiteId: website._id,
      type: 'whatsapp_click'
    });

    const ctaClicks = await Event.countDocuments({
      websiteId: website._id,
      type: 'cta_click'
    });

    const formSubmits = await Event.countDocuments({
      websiteId: website._id,
      type: 'form_submit'
    });

    const actualEvents = telClicks + whatsappClicks + ctaClicks + formSubmits;
    const uniqueVisitors = await UniqueVisitor.countDocuments({
      websiteId: website._id
    });

    console.log('📈 Database Stats:');
    console.log('   Unique Visitors:', uniqueVisitors);
    console.log('   Pageviews:', pageviews, '(NOT counted in events)');
    console.log('');
    console.log('   Actual Events:');
    console.log('   ├─ Tel Clicks:', telClicks);
    console.log('   ├─ WhatsApp Clicks:', whatsappClicks);
    console.log('   ├─ CTA Clicks:', ctaClicks);
    console.log('   ├─ Form Submits:', formSubmits);
    console.log('   └─ Total Events:', actualEvents);
    console.log('');

    // Verify logic
    console.log('✅ Verification:');
    const metadataEvents = website.metadata.totalEvents || 0;

    if (metadataEvents === actualEvents) {
      console.log('   ✅ Event count is CORRECT!');
      console.log(`   metadata.totalEvents (${metadataEvents}) = Actual Events (${actualEvents})`);
    } else {
      console.log('   ⚠️  Event count mismatch:');
      console.log(`   metadata.totalEvents = ${metadataEvents}`);
      console.log(`   Actual Events = ${actualEvents}`);
    }
    console.log('');

    // Show recent events
    console.log('📋 Recent Events (last 5):');
    const recentEvents = await Event.find({ websiteId: website._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentEvents.forEach((event, i) => {
      const visitorLabel = event.isNewVisitor ? '🆕 New' : '🔁 Returning';
      console.log(`${i + 1}. ${event.type.toUpperCase()} - ${visitorLabel} - ${event.createdAt.toLocaleString()}`);
    });

    console.log('\n\n💡 Expected Behavior:');
    console.log('   ✅ Unique Visitors = 1 (even after multiple refreshes)');
    console.log('   ✅ Pageviews = Number of page loads (tracked separately)');
    console.log('   ✅ Total Events = Only button clicks + form submits');
    console.log('   ✅ metadata.totalEvents should match actual events (NOT pageviews)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testTracking();
