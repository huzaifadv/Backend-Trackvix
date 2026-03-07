# CORS and Tracking Fixes - Summary

This document summarizes the fixes applied to resolve CORS issues and improve event tracking stability.

## Changes Made

### 1. CORS Configuration (`middlewares/security.middleware.js`)
**Problem:** CORS was blocking requests from external websites during development.

**Solution:**
- In **development mode** (`NODE_ENV=development`): Allows ALL origins automatically
- In **production mode**: Uses environment-based whitelist from `CORS_ORIGIN`
- Added `X-API-Key` to allowed headers
- Added proper preflight handling with `optionsSuccessStatus: 204`

**Code changes:**
```javascript
// Now allows all origins in development
if (config.env === 'development') {
  return callback(null, true);
}
```

### 2. Event Logging Endpoint (`controllers/tracking.controller.js`)
**Problem:** Event tracking could fail and break client-side scripts.

**Solution:**
- Endpoint always returns **200 status** (even on errors)
- Added explicit API key validation
- Returns structured JSON responses
- Logs errors server-side without exposing them to clients
- Shows error details only in development mode

**Endpoint:** `POST /api/v1/events/log`

**Response format:**
```json
{
  "success": true,
  "message": "Event tracked successfully",
  "data": {...}
}
```

### 3. Tracker Script Console Logging (`public/tracker.js`)
**Problem:** No visibility into whether tracking was working.

**Solution:**
- Added: `"Tracker script loaded successfully"` on script load
- Added: `"Event sent successfully"` after successful POST
- Prefixed all logs with `[WebTracker]` for easy identification

### 4. Middleware Order Verification (`app.js`)
**Already correct:** CORS middleware is applied before routes (line 31)

### 5. Production Deployment Setup
**New files:**
- `render.yaml` - Render.com deployment configuration
- `DEPLOYMENT.md` - Complete deployment guide with environment variables

## Testing the Fixes

### 1. Test CORS in Development
```bash
# Set NODE_ENV to development
NODE_ENV=development npm run dev

# CORS will allow any origin
```

### 2. Test Event Logging
```bash
# From any website, include the tracker script:
<script
  src="http://localhost:5000/tracker.js"
  data-api-key="your-64-char-api-key"
  data-endpoint="http://localhost:5000/api/v1/events/log">
</script>

# Check browser console for:
# [WebTracker] Tracker script loaded successfully
# [WebTracker] Event sent successfully
```

### 3. Test Manual Event POST
```bash
curl -X POST http://localhost:5000/api/v1/events/log \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-64-char-api-key",
    "eventType": "pageview",
    "url": "https://example.com",
    "device": "desktop"
  }'
```

## Environment Variables for Deployment

### Development (allows all origins)
```env
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Production (whitelist specific domains)
```env
NODE_ENV=production
CORS_ORIGIN=https://mysite.com,https://www.mysite.com
```

## API Endpoint Details

### POST /api/v1/events/log

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "apiKey": "64-character-hex-api-key",
  "eventType": "pageview|call_click|form_submit|cta_click|whatsapp_click",
  "url": "https://example.com/page",
  "referrer": "https://google.com",
  "device": "mobile|tablet|desktop",
  "browser": "Chrome|Firefox|Safari|Edge|Other",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "spring_sale"
}
```

**Response (Always 200):**
```json
{
  "success": true,
  "message": "Event tracked successfully",
  "data": {
    "eventId": "...",
    "websiteId": "..."
  }
}
```

**Error Response (Still 200):**
```json
{
  "success": false,
  "message": "Event tracking failed",
  "error": "API key required" // Only in development
}
```

## Browser Console Messages

When tracking is working correctly, you'll see:
```
[WebTracker] Tracker script loaded successfully
[WebTracker] Event sent successfully
[WebTracker] Event sent successfully
...
```

When there's an error:
```
[WebTracker] API key not found
```

## Middleware Flow

```
Request → Helmet Security
       → CORS Middleware (allows all in dev)
       → Rate Limiter
       → Input Sanitization
       → Body Parser (express.json)
       → Public CORS (on /events/log route)
       → Event Collection Limiter
       → Validation
       → Controller (always returns 200)
       → Response
```

## Key Features

✅ **Development:** CORS allows all origins automatically
✅ **Production:** CORS uses environment whitelist
✅ **Stability:** Endpoint always returns 200 (never crashes client scripts)
✅ **Visibility:** Console logs show tracking status
✅ **Security:** Errors logged server-side, not exposed to clients
✅ **Preflight:** OPTIONS requests handled properly

## Troubleshooting

### CORS Error: "Not allowed by CORS"
**Solution:** Set `NODE_ENV=development` or add your domain to `CORS_ORIGIN`

### Events Not Tracking
**Check:**
1. Browser console for `[WebTracker]` messages
2. API key is 64 characters (hex format)
3. Endpoint is `/api/v1/events/log` (not `/collect`)
4. Network tab shows 200 response

### Preflight (OPTIONS) Failing
**Solution:** Already fixed - OPTIONS requests handled by `publicCorsConfig`

## Next Steps

1. ✅ Test event tracking from external website
2. ✅ Deploy to Render.com using `DEPLOYMENT.md`
3. ✅ Set production environment variables
4. ✅ Update `CORS_ORIGIN` with your frontend domain(s)
