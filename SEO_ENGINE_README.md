# SEO & Website Health Engine

Production-grade SEO analysis, performance monitoring, and AI-powered recommendations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│          API Endpoint (POST /websites/:id/scan)     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              Async Job Queue (MongoDB)              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │ Pending │→ │Process  │→ │Complete │  │ Failed │ │
│  └─────────┘  └─────────┘  └─────────┘  └────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            Scan Orchestration Service               │
└───┬──────────┬──────────┬──────────┬────────────────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌────────────┐
│Crawler │ │ PSI  │ │ Health  │ │ AI Recs    │
│Service │ │ API  │ │ Scoring │ │ Generator  │
└────────┘ └──────┘ └─────────┘ └────────────┘
    │          │          │          │
    └──────────┴──────────┴──────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  WebsiteHealth   │
        │   (MongoDB)      │
        └──────────────────┘
```

## Features

### 1. **SEO Crawler** (`services/crawler.service.js`)

**Safe HTML crawling with SSRF protection:**

- ✅ Validates domains (blocks localhost, private IPs)
- ✅ 15-second timeout protection
- ✅ 5MB file size limit
- ✅ Max 3 redirects
- ✅ Bot user-agent identification

**Extracts:**
- Title, meta description, canonical
- H1/H2 headings
- Open Graph tags
- Images (with alt attribute check)
- Internal/external links
- Robots meta

**Detects Issues:**
- Missing title/meta description
- Multiple/missing H1 tags
- Images without alt text
- Long title/description
- Missing canonical
- Broken links (sample check)

### 2. **PageSpeed Insights** (`services/pagespeed.service.js`)

**Google PageSpeed API integration:**

- ✅ Mobile & Desktop analysis
- ✅ Retry logic (exponential backoff)
- ✅ 60-second timeout
- ✅ Rate limit handling

**Metrics Extracted:**
- Performance score (0-100)
- Accessibility score
- SEO score
- Best Practices score
- Core Web Vitals:
  - LCP (Largest Contentful Paint)
  - CLS (Cumulative Layout Shift)
  - FCP (First Contentful Paint)
  - TBT (Total Blocking Time)

**Performance Opportunities:**
- Top 10 improvements ranked by impact
- Estimated time savings

### 3. **Health Score Engine** (`services/health-score.service.js`)

**Weighted scoring system:**

| Category    | Weight | Factors |
|-------------|--------|---------|
| Performance | 30%    | PageSpeed score, LCP, CLS |
| SEO         | 30%    | Title, meta, H1, canonical, PageSpeed SEO |
| Structure   | 20%    | Headings, images, links, Open Graph |
| Technical   | 20%    | Accessibility, best practices |

**Status Levels:**
- Excellent: 90-100
- Good: 80-89
- Fair: 60-79
- Poor: 40-59
- Critical: 0-39

### 4. **AI Recommendations** (`services/ai-recommendation.service.js`)

**Structured AI prompts (token-efficient):**

- ✅ Sends structured data (NOT raw HTML)
- ✅ Fallback recommendations if API fails
- ✅ Simple, non-technical language
- ✅ Business impact explanations
- ✅ Priority ranking (High/Medium/Low)

**Recommendation Categories:**
- Performance optimization
- SEO improvements
- Content structure
- Technical fixes

### 5. **Async Job Queue** (`models/ScanQueue.js`)

**Production-ready queue system:**

- ✅ Stateless (MongoDB-backed)
- ✅ Priority support (low/normal/high)
- ✅ Retry logic (max 3 attempts)
- ✅ Status tracking (pending/processing/completed/failed)
- ✅ FIFO processing with priority override
- ✅ Prevents duplicate scans
- ✅ Ready for Redis migration

**Queue Operations:**
```javascript
// Enqueue
ScanQueue.enqueue(websiteId, url, 'high');

// Dequeue (worker)
const job = await ScanQueue.dequeue();

// Complete
await job.markCompleted(result);

// Fail with retry
await job.markFailed(error);
```

### 6. **Data Models**

#### WebsiteHealth (`models/WebsiteHealth.js`)

Stores complete scan results:

```javascript
{
  websiteId: ObjectId,
  overallScore: 85,
  status: "good",
  scores: {
    performance: 80,
    seo: 90,
    structure: 85,
    technical: 85
  },
  issueCount: 5,
  criticalCount: 0,
  warningCount: 5,
  issues: [...],
  priorityIssues: [...],
  aiRecommendations: [...],
  seoData: {...},
  pageSpeed: {
    mobile: {...},
    desktop: {...}
  },
  scanDuration: 12500,
  scannedAt: ISODate,
  nextScanAt: ISODate
}
```

**Indexes:**
- `{ websiteId: 1, scannedAt: -1 }`
- `{ overallScore: 1 }`
- `{ status: 1 }`
- `{ nextScanAt: 1 }`

**Methods:**
- `getLatest(websiteId)` - Latest scan results
- `getHistory(websiteId, limit)` - Historical scores
- `needsRescan()` - Check if 7 days passed

## API Endpoints

### Initiate Scan
```http
POST /api/v1/websites/:id/scan
Authorization: Bearer <JWT>

{
  "priority": "normal" // optional: low|normal|high
}

Response (202):
{
  "success": true,
  "message": "Scan initiated",
  "data": {
    "jobId": "...",
    "status": "enqueued"
  }
}
```

### Get Scan Status
```http
GET /api/v1/scans/:jobId/status
Authorization: Bearer <JWT>

Response (200):
{
  "success": true,
  "data": {
    "jobId": "...",
    "status": "completed",
    "result": {
      "overallScore": 85,
      "issueCount": 5
    }
  }
}
```

### Get Latest Health
```http
GET /api/v1/websites/:id/health
Authorization: Bearer <JWT>

Response (200):
{
  "success": true,
  "data": {
    "overallScore": 85,
    "status": "good",
    "scores": {...},
    "issues": [...],
    "aiRecommendations": [...]
  }
}
```

### Get Health History
```http
GET /api/v1/websites/:id/health/history?limit=10
Authorization: Bearer <JWT>

Response (200):
{
  "success": true,
  "data": [
    {
      "overallScore": 85,
      "scores": {...},
      "scannedAt": "2024-01-15T...",
      "status": "good"
    },
    ...
  ]
}
```

### Check Rescan Status
```http
GET /api/v1/websites/:id/needs-scan
Authorization: Bearer <JWT>

Response (200):
{
  "success": true,
  "data": {
    "websiteId": "...",
    "needsScan": false
  }
}
```

## Security Features

### SSRF Protection (`crawler.service.js`)

**Blocked Patterns:**
- `localhost`
- `127.x.x.x`
- `10.x.x.x`
- `172.16-31.x.x`
- `192.168.x.x`
- `169.254.x.x`
- IPv6 private ranges

**URL Validation:**
- Only HTTP/HTTPS allowed
- Domain format validation
- URL parsing before fetch

### Request Limits

**Crawler:**
- Timeout: 15 seconds
- Max file size: 5MB
- Max redirects: 3
- Max links checked: 10

**PageSpeed:**
- Timeout: 60 seconds
- Retry attempts: 2
- Exponential backoff

**AI API:**
- Timeout: 30 seconds
- Retry attempts: 2
- Fallback recommendations

## Setup & Configuration

### 1. Install Dependencies

```bash
npm install
```

New dependencies added:
- `axios` - HTTP client
- `cheerio` - HTML parsing

### 2. Environment Variables

Add to `.env`:

```bash
# PageSpeed API (optional)
PAGESPEED_API_KEY=your-google-api-key

# AI API (optional)
OPENAI_API_KEY=your-openai-key
AI_MODEL=gpt-3.5-turbo
AI_API_URL=https://api.openai.com/v1/chat/completions
```

**Note:** Both are optional. System uses fallback if not configured.

### 3. Database Indexes

```bash
npm run setup-indexes
```

### 4. Start Server

```bash
npm run dev
```

## Usage Example

### 1. Add Website
```http
POST /api/v1/websites
{
  "domain": "example.com"
}
```

### 2. Initiate Scan
```http
POST /api/v1/websites/6419.../scan
{
  "priority": "high"
}
```

### 3. Check Results
```http
GET /api/v1/websites/6419.../health
```

## Background Worker (Optional)

For production, run dedicated worker process:

```javascript
// worker.js
const ScanService = require('./services/scan.service');

async function processQueue() {
  while (true) {
    await ScanService.processQueue();
    await sleep(5000); // Wait 5 seconds
  }
}

processQueue();
```

## Scaling Considerations

### Current (MVP)
- MongoDB-based queue
- Single-process worker
- Good for <100 scans/hour

### Future Scaling
1. **Redis Queue** (Bull/BullMQ)
   - Distributed workers
   - Better performance
   - Advanced features

2. **Separate Worker Servers**
   - Dedicated scan workers
   - Horizontal scaling
   - Load balancing

3. **Caching**
   - Cache PageSpeed results (24h)
   - Cache AI recommendations
   - Reduce API costs

## Cost Optimization

### PageSpeed API
- **Free tier:** 25,000 requests/day
- **Cost:** Monitor usage in Google Cloud Console

### OpenAI API
- **Token usage:** ~300-500 tokens/scan
- **Cost:** $0.0015-0.0025 per scan (GPT-3.5)
- **Optimization:** Structured prompts (no raw HTML)
- **Fallback:** Free recommendations if API unavailable

## Monitoring

### Queue Health
```javascript
// Check pending jobs
await ScanQueue.countDocuments({ status: 'pending' });

// Check failed jobs
await ScanQueue.countDocuments({ status: 'failed' });
```

### Cleanup Old Jobs
```javascript
// Delete jobs older than 30 days
await ScanQueue.cleanup(30);
```

## Error Handling

All services have built-in error handling:

1. **Crawler** - Returns `success: false` with error
2. **PageSpeed** - Returns `null` on failure
3. **AI** - Falls back to predefined recommendations
4. **Queue** - Retries failed jobs (max 3 attempts)

## Production Checklist

- [ ] Configure PageSpeed API key
- [ ] Configure AI API key (optional)
- [ ] Run database indexes setup
- [ ] Setup monitoring for queue depth
- [ ] Configure queue cleanup cron job
- [ ] Test SSRF protection
- [ ] Review timeout values
- [ ] Setup error alerts
- [ ] Monitor API costs
- [ ] Consider dedicated worker server

## Files Created

```
backend/
├── services/
│   ├── crawler.service.js          # SEO crawler with SSRF protection
│   ├── pagespeed.service.js        # PageSpeed Insights integration
│   ├── health-score.service.js     # Scoring engine
│   ├── ai-recommendation.service.js # AI recommendations
│   └── scan.service.js             # Orchestration service
├── models/
│   ├── WebsiteHealth.js            # Health data storage
│   └── ScanQueue.js                # Async job queue
├── controllers/
│   └── scan.controller.js          # API endpoints
├── routes/
│   └── scan.routes.js              # Route definitions
└── .env.example                    # Updated with new vars
```
