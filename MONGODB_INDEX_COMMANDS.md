# MongoDB Index Commands - Quick Reference

## Run All Indexes Automatically

```bash
cd backend
node scripts/setup-production-indexes.js
```

---

## Manual Index Creation (MongoDB Shell)

If you prefer to create indexes manually via MongoDB shell:

### 1. Events Collection

```javascript
db.events.createIndex({ websiteId: 1 }, { background: true })
db.events.createIndex({ type: 1 }, { background: true })
db.events.createIndex({ visitorId: 1 }, { background: true })
db.events.createIndex({ country: 1 }, { background: true })
db.events.createIndex({ websiteId: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ websiteId: 1, type: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ websiteId: 1, visitorId: 1 }, { background: true })
db.events.createIndex({ websiteId: 1, country: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ websiteId: 1, device: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ createdAt: -1 }, { background: true })
```

### 2. UniqueVisitors Collection

```javascript
db.uniquevisitors.createIndex({ websiteId: 1, visitorHash: 1 }, { unique: true, background: true })
db.uniquevisitors.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 2592000, background: true })
db.uniquevisitors.createIndex({ websiteId: 1, lastSeen: -1 }, { background: true })
db.uniquevisitors.createIndex({ websiteId: 1, firstSeen: -1 }, { background: true })
```

### 3. TrafficDailyStats Collection

```javascript
db.trafficdailystats.createIndex({ websiteId: 1, date: 1 }, { unique: true, background: true })
db.trafficdailystats.createIndex({ date: -1 }, { background: true })
db.trafficdailystats.createIndex({ websiteId: 1 }, { background: true })
```

### 4. LeadsDailyStats Collection

```javascript
db.leadsdailystats.createIndex({ websiteId: 1, date: 1 }, { unique: true, background: true })
db.leadsdailystats.createIndex({ date: -1 }, { background: true })
db.leadsdailystats.createIndex({ websiteId: 1 }, { background: true })
```

### 5. Websites Collection

```javascript
db.websites.createIndex({ apiKey: 1 }, { unique: true, background: true })
db.websites.createIndex({ userId: 1 }, { background: true })
db.websites.createIndex({ userId: 1, domain: 1 }, { unique: true, background: true })
db.websites.createIndex({ createdAt: -1 }, { background: true })
db.websites.createIndex({ status: 1 }, { background: true })
db.websites.createIndex({ userId: 1, status: 1 }, { background: true })
```

### 6. Users Collection

```javascript
db.users.createIndex({ email: 1 }, { unique: true, background: true })
db.users.createIndex({ createdAt: -1 }, { background: true })
db.users.createIndex({ stripeCustomerId: 1 }, { background: true })
db.users.createIndex({ currentPlan: 1 }, { background: true })
db.users.createIndex({ subscriptionStatus: 1 }, { background: true })
db.users.createIndex({ currentPlan: 1, subscriptionStatus: 1 }, { background: true })
db.users.createIndex({ role: 1 }, { background: true })
db.users.createIndex({ isSuspended: 1 }, { background: true })
db.users.createIndex({ isEmailVerified: 1 }, { background: true })
```

---

## Verify Indexes

```javascript
// List all indexes for each collection
db.events.getIndexes()
db.uniquevisitors.getIndexes()
db.trafficdailystats.getIndexes()
db.leadsdailystats.getIndexes()
db.websites.getIndexes()
db.users.getIndexes()
```

---

## Monitor Index Creation Progress

```javascript
// Check if indexes are being built
db.currentOp({
  $or: [
    { "command.createIndexes": { $exists: true } },
    { "msg": /^Index Build/ }
  ]
})
```

---

## Check Index Usage

```javascript
// See which indexes are being used
db.events.aggregate([{ $indexStats: {} }])
db.uniquevisitors.aggregate([{ $indexStats: {} }])
db.trafficdailystats.aggregate([{ $indexStats: {} }])
db.leadsdailystats.aggregate([{ $indexStats: {} }])
db.websites.aggregate([{ $indexStats: {} }])
db.users.aggregate([{ $indexStats: {} }])
```

---

## Drop All Indexes (Emergency Only)

**⚠️ WARNING: This will slow down queries significantly!**

```javascript
// Drop all indexes except _id (DANGEROUS)
db.events.dropIndexes()
db.uniquevisitors.dropIndexes()
db.trafficdailystats.dropIndexes()
db.leadsdailystats.dropIndexes()
db.websites.dropIndexes()
db.users.dropIndexes()
```

---

## Index Size Report

```javascript
// Check index sizes
db.events.stats().indexSizes
db.uniquevisitors.stats().indexSizes
db.trafficdailystats.stats().indexSizes
db.leadsdailystats.stats().indexSizes
db.websites.stats().indexSizes
db.users.stats().indexSizes
```

---

## Recommended: Use the Setup Script

Instead of running these manually, use:

```bash
node scripts/setup-production-indexes.js
```

This script:
- Creates all indexes automatically
- Handles errors gracefully
- Verifies index creation
- Provides detailed logging
- Safe to run multiple times
