const mongoose = require('mongoose');

console.log('Starting DB connection test...');

mongoose.connect('mongodb://localhost:27017/webtrackly', {
  minPoolSize: 2,
  maxPoolSize: 10,
})
.then(() => {
  console.log('✓ MongoDB connected successfully');
  process.exit(0);
})
.catch((error) => {
  console.error('✗ MongoDB connection failed:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('✗ Connection timeout');
  process.exit(1);
}, 10000);
