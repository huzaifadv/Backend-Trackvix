# Webtrackly Backend

Production-grade website tracking engine with event ingestion, analytics, and scalable architecture.

## Features

- **Lightweight Client Tracking** - 5KB tracker.js with bot detection
- **Event Collection** - Pageviews, call clicks, form submissions
- **Aggregated Stats** - Daily traffic & leads statistics
- **Horizontal Scaling** - Stateless API with atomic updates
- **Secure** - Rate limiting, API key validation, input sanitization
- **Country Detection** - IP-based geolocation
- **UTM Tracking** - Campaign and source attribution

## Architecture

```
backend/
├── controllers/      # Request handlers
├── services/         # Business logic
├── models/          # MongoDB schemas with indexes
├── routes/          # API endpoints
├── middlewares/     # Security, auth, validation
├── validators/      # Input validation rules
├── config/          # Environment & logger setup
├── utils/           # Helper functions
├── scripts/         # Database setup scripts
└── public/          # Static files (tracker.js)
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/webtrackly

# JWT Secrets (change these!)
JWT_SECRET=<64-char-hex-string>
JWT_REFRESH_SECRET=<64-char-hex-string>

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Setup Database Indexes

```bash
npm run setup-indexes
```

This creates optimized indexes for:
- API key lookups (O(1) performance)
- Date range queries (efficient aggregation)
- Compound indexes (websiteId + date)

### 4. Start Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## API Endpoints

### Public Endpoints

#### Collect Event
```
POST /api/v1/events/collect
```

**Body:**
```json
{
  "apiKey": "website-api-key",
  "eventType": "pageview",
  "url": "https://example.com/page",
  "referrer": "https://google.com",
  "device": "desktop",
  "browser": "Chrome",
  "utm_source": "google",
  "utm_campaign": "summer-sale"
}
```

#### Serve Tracker Script
```
GET /tracker.js
```

### Protected Endpoints (JWT Required)

#### Get Stats Summary
```
GET /api/v1/events/stats/:websiteId?days=30
```

#### Get Traffic Stats
```
GET /api/v1/events/traffic/:websiteId?startDate=2024-01-01&endDate=2024-12-31
```

#### Get Leads Stats
```
GET /api/v1/events/leads/:websiteId?startDate=2024-01-01&endDate=2024-12-31
```

## Client Integration

Add to any website:

```html
<script src="https://api.yourtracker.com/tracker.js" data-api-key="YOUR_API_KEY"></script>
```

### Custom Events

```javascript
// Track custom event
window.Webtrackly.track('custom_event', {
  category: 'engagement',
  action: 'video_play',
  label: 'homepage_video'
});
```

## Models

### TrafficDailyStats
Aggregated daily traffic statistics:
- Total visits
- Traffic sources (Google, Facebook, Direct, etc.)
- UTM campaigns
- Countries
- Devices (Desktop, Mobile, Tablet)
- Browsers

### LeadsDailyStats
Aggregated daily lead statistics:
- Call clicks
- Form submissions
- Device breakdown
- Form IDs

### Website
Website registration with API key:
- Domain
- API key (64-char hex)
- User ownership
- Event metadata

## Scalability Design

✅ **Stateless API** - No session storage, runs on any node
✅ **Atomic Updates** - Uses MongoDB `$inc` for race-condition-free aggregation
✅ **Compound Indexes** - Optimized queries for websiteId + date
✅ **Connection Pooling** - Configured for horizontal scaling
✅ **Rate Limiting** - Per-IP and per-website protection
✅ **No Raw Event Storage** - Only aggregated stats for efficiency

## Security

- Helmet.js for HTTP headers
- CORS configuration
- Rate limiting (100 req/min general, 5 req/15min auth)
- Input sanitization (NoSQL injection prevention)
- API key validation
- Bot detection in tracker.js

## Performance

- Lightweight tracker.js (~5KB)
- Non-blocking event collection
- `navigator.sendBeacon()` support
- Response compression
- Debounced event tracking
- Duplicate event prevention

## Database Indexes

Run `npm run setup-indexes` to create:

```javascript
// Website
{ apiKey: 1 } unique
{ userId: 1, domain: 1 } unique
{ createdAt: -1 }

// TrafficDailyStats
{ websiteId: 1, date: 1 } unique
{ websiteId: 1, date: -1 }

// LeadsDailyStats
{ websiteId: 1, date: 1 } unique
{ websiteId: 1, date: -1 }
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | required |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | required |
| `JWT_REFRESH_SECRET` | Refresh token secret | required |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | http://localhost:3000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `API_KEY_LENGTH` | API key length in bytes | 32 |

## Production Checklist

- [ ] Set strong JWT secrets (64+ characters)
- [ ] Configure MongoDB replica set
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm run setup-indexes`
- [ ] Configure reverse proxy (Nginx)
- [ ] Enable HTTPS
- [ ] Set proper CORS origins
- [ ] Configure log rotation
- [ ] Setup MongoDB backups
- [ ] Monitor rate limit thresholds

## License

ISC
