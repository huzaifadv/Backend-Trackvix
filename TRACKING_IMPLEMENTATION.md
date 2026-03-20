# Webtrackly - Implementation Guide

## Overview

This tracking system monitors visitor behavior without requiring any browser permissions. All tracking is done passively using standard web APIs.

---

## 📊 What We Track

### 1. Visitors
- **Total Visitors**: Every pageview
- **Unique Visitors**: Based on localStorage visitor ID
- **New vs Returning**: Determined by localStorage presence
- **Timestamp**: ISO 8601 format for each visit

### 2. Location (IP-Based from Backend)
- **Country**: Detected from IP address
- **City**: Detected from IP address

### 3. Device Type (User Agent Detection)
Returns ONLY one of:
- `desktop`
- `mobile`
- `tablet`

### 4. Traffic Source (Referrer-Based)
Classified into ONLY:
- `Google`
- `Facebook`
- `Instagram`
- `YouTube`
- `Direct` (no referrer)
- `Other` (all other sources)

### 5. Lead Tracking Events

**ONLY these events are tracked:**

| Event Type | Description | Trigger |
|------------|-------------|---------|
| `pageview` | Page visit | Automatic on load |
| `tel_click` | Phone link clicked | `<a href="tel:...">` |
| `whatsapp_click` | WhatsApp link clicked | `<a href="...wa.me...">` |
| `cta_click` | CTA button clicked | Elements with `.track-cta` class |
| `form_submit` | Form submitted | Any `<form>` submission |

---

## 🔧 Implementation Details

### New vs Returning Visitor Logic

**Location:** `tracker.js` lines 31-44

```javascript
function getVisitorId() {
  const VISITOR_KEY = '_wt_visitor_id';
  let visitorId = localStorage.getItem(VISITOR_KEY);
  let isNewVisitor = false;

  if (!visitorId) {
    // Generate unique visitor ID
    visitorId = 'wt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(VISITOR_KEY, visitorId);
    isNewVisitor = true;
  }

  return { visitorId, isNewVisitor };
}
```

**How it works:**
1. Check localStorage for `_wt_visitor_id`
2. If not found → New Visitor → Generate and store ID
3. If found → Returning Visitor → Use existing ID

**Visitor ID Format:** `wt_[timestamp]_[random9chars]`

Example: `wt_1709326400000_x7k2p9qm1`

---

## 📤 Example Payload Structure

### Pageview Event

```json
{
  "apiKey": "e661af8acf2698081f4a18b57ba0c4838b7b70c052e251736d771aadf02b36f8",
  "eventType": "pageview",
  "url": "https://example.com/page",
  "referrer": "https://google.com",
  "device": "desktop",
  "source": "Google",
  "visitorId": "wt_1709326400000_x7k2p9qm1",
  "isNewVisitor": false,
  "timestamp": "2026-03-01T18:45:30.123Z"
}
```

### Tel Click Event

```json
{
  "apiKey": "...",
  "eventType": "tel_click",
  "url": "https://example.com/contact",
  "referrer": "",
  "device": "mobile",
  "source": "Direct",
  "visitorId": "wt_1709326400000_x7k2p9qm1",
  "isNewVisitor": false,
  "timestamp": "2026-03-01T18:46:15.456Z",
  "phoneNumber": "+1234567890"
}
```

### WhatsApp Click Event

```json
{
  "apiKey": "...",
  "eventType": "whatsapp_click",
  "url": "https://example.com/support",
  "referrer": "https://facebook.com",
  "device": "tablet",
  "source": "Facebook",
  "visitorId": "wt_1709326500000_a3b2c1d4e",
  "isNewVisitor": true,
  "timestamp": "2026-03-01T18:47:00.789Z",
  "phoneNumber": "1234567890"
}
```

### CTA Click Event

```json
{
  "apiKey": "...",
  "eventType": "cta_click",
  "url": "https://example.com/pricing",
  "referrer": "https://youtube.com",
  "device": "desktop",
  "source": "YouTube",
  "visitorId": "wt_1709326600000_z9y8x7w6v",
  "isNewVisitor": false,
  "timestamp": "2026-03-01T18:48:45.012Z",
  "ctaId": "get-started-btn",
  "ctaText": "Get Started"
}
```

### Form Submit Event

```json
{
  "apiKey": "...",
  "eventType": "form_submit",
  "url": "https://example.com/contact",
  "referrer": "https://instagram.com",
  "device": "mobile",
  "source": "Instagram",
  "visitorId": "wt_1709326700000_m5n4o3p2q",
  "isNewVisitor": true,
  "timestamp": "2026-03-01T18:49:30.345Z",
  "formId": "contact-form"
}
```

---

## 🎯 Console Messages

### Success Messages

```
Tracking script loaded successfully
Event tracked successfully
Event tracked successfully
...
```

### Error Messages

```
Tracking error
```

---

## 📝 Files Modified

### 1. tracker.js (Complete Rewrite)
**Path:** `/backend/public/tracker.js`

**Key Changes:**
- Removed: sendBeacon (now uses fetch only)
- Removed: Browser detection, UTM params, debouncing
- Added: `getVisitorId()` - New vs returning logic
- Added: `getTrafficSource()` - Referrer classification
- Updated: `getDeviceType()` - User agent based
- Updated: Event types to exact 5 types
- Updated: Console messages to exact format
- Updated: Real-time fetch API calls

### 2. tracking.validator.js
**Path:** `/backend/validators/tracking.validator.js`

**Changes:**
- Updated event types: `call_click` → `tel_click`
- Added validation for `source` field (6 allowed values)
- Added validation for `visitorId` (optional string)
- Added validation for `isNewVisitor` (optional boolean)

### 3. tracking.service.js
**Path:** `/backend/services/tracking.service.js`

**Changes:**
- Updated event types in validation
- Renamed: `processCallClick()` → `processTelClick()`
- Updated switch statement to handle new event types

### 4. example.html
**Path:** `/backend/public/example.html`

**Changes:**
- Updated event type names in documentation
- Added explanation of new vs returning visitors
- Added device, source, location tracking info

---

## 🚀 Testing

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Open Example Page
```
http://localhost:5000/example.html
```

### 3. Check Console
You should see:
```
Tracking script loaded successfully
Event tracked successfully
```

### 4. Test New vs Returning

**First visit:**
```json
{
  "visitorId": "wt_1709326400000_x7k2p9qm1",
  "isNewVisitor": true
}
```

**Refresh page:**
```json
{
  "visitorId": "wt_1709326400000_x7k2p9qm1",
  "isNewVisitor": false
}
```

**Clear localStorage and refresh:**
```javascript
// In console:
localStorage.clear();
// Refresh page → isNewVisitor: true again
```

### 5. Test Device Detection

**Desktop (width >= 1024px):**
```json
{ "device": "desktop" }
```

**Tablet (768px <= width < 1024px):**
```json
{ "device": "tablet" }
```

**Mobile (width < 768px):**
```json
{ "device": "mobile" }
```

### 6. Test Traffic Source

**Open from Google search:**
```json
{ "source": "Google" }
```

**Direct (type URL in browser):**
```json
{ "source": "Direct" }
```

---

## 🔒 No Refactoring Done

### What Was NOT Changed:
- ❌ Database structure
- ❌ Architecture patterns
- ❌ Model schemas
- ❌ Controller structure
- ❌ Service patterns
- ❌ Middleware logic
- ❌ API endpoints

### What WAS Changed (Minimal):
- ✅ Updated tracker.js to exact specs
- ✅ Updated validation rules for new event types
- ✅ Renamed one function (`processCallClick` → `processTelClick`)
- ✅ Updated event type constants

---

## 📊 Data Flow

```
Browser
  ↓
tracker.js
  ↓ (generates visitorId, detects device, source)
fetch POST to /api/v1/events/log
  ↓
Security Middleware (CORS, sanitization)
  ↓
Validation Middleware (tracking.validator.js)
  ↓
Controller (tracking.controller.js)
  ↓
Service (tracking.service.js)
  ↓ (detects country, city from IP)
Models (TrafficDailyStats, LeadsDailyStats)
  ↓
MongoDB
```

---

## ✅ Success Criteria

- [x] Tracks ONLY 5 event types
- [x] Detects new vs returning visitors (localStorage)
- [x] Detects device type (desktop/mobile/tablet)
- [x] Classifies traffic source (6 categories)
- [x] Location detected from IP (backend)
- [x] Console messages match exact format
- [x] Uses fetch API for real-time tracking
- [x] No refactoring of existing code
- [x] No extra features added

---

## 🎉 Complete!

All requested features implemented exactly as specified.
No refactoring. No extra features. Only the exact 5 tracking categories.
