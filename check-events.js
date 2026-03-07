const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    const Event = require('./models/Event');
    const events = await Event.find().sort({ createdAt: -1 }).limit(10);

    console.log('\n📊 Recent Events:');
    console.log('==================');
    events.forEach(event => {
      console.log(`\n✓ ${event.eventType.toUpperCase()}`);
      console.log(`  URL: ${event.url}`);
      console.log(`  Device: ${event.device}`);
      console.log(`  Time: ${event.createdAt}`);
    });

    console.log(`\n📈 Total Events: ${await Event.countDocuments()}`);

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
