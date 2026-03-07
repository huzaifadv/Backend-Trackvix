# Testing Guide: Visitor & Event Tracking

## ✅ Backend Logic (VERIFIED WORKING)

The tracking system now correctly separates:
- **Visitors** = Unique visitors (localStorage-based, counted once per browser)
- **Pageviews** = Page loads (tracked in TrafficDailyStats)
- **Events** = Button clicks + Form submits (tracked in LeadsDailyStats)

### Key Rules:
1. **Visitors are ONLY recorded on pageview when `isNewVisitor === true`**
2. **Button clicks (tel, WhatsApp, CTA, form) do NOT create visitors**
3. **Pageviews do NOT increment totalEvents counter**
4. **Only button clicks increment totalEvents counter**

## 🧪 How to Test

### Step 1: Reset Stats
```bash
cd backend
node reset-website-stats.js
```

### Step 2: Clear Browser Data
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Delete `_wt_visitor_id` key (or clear all localStorage)

### Step 3: Test Visitor Tracking
1. Open http://localhost:5000/example.html
2. Check console: Should see "🆕 New visitor detected"
3. Run check script:
   ```bash
   node check-all-stats.js
   ```
   **Expected:** Unique Visitors = 1

4. Refresh page 10 times
5. Run check script again:
   ```bash
   node check-all-stats.js
   ```
   **Expected:** Unique Visitors = 1 (still!)

### Step 4: Test Event Tracking
1. Click "Call Now" button 3 times
2. Click "WhatsApp" button 2 times
3. Run check script:
   ```bash
   node check-all-stats.js
   ```
   **Expected:**
   - Unique Visitors = 1 (no change!)
   - Total Events = 5 (3 tel + 2 whatsapp)
   - Call Clicks = 3
   - WhatsApp Clicks = 2

### Step 5: Test Multiple Visitors
1. Open **Incognito/Private window**
2. Open http://localhost:5000/example.html
3. Check console: Should see "🆕 New visitor detected" again
4. Run check script:
   ```bash
   node check-all-stats.js
   ```
   **Expected:** Unique Visitors = 2

## 📊 Understanding the Output

When you run `node check-all-stats.js`, you'll see:

```
👥 Unique Visitors: 1          ← Unique browsers (localStorage-based)
📈 TrafficDailyStats:
   Total Visits: 15            ← Total pageviews (refreshes included)
📞 LeadsDailyStats:
   Call Clicks: 3              ← Tel button clicks
   WhatsApp Clicks: 2          ← WhatsApp button clicks
   Total Leads/Events: 5       ← Sum of all button clicks

📊 Website Metadata:
   Total Events: 5             ← Should match Total Leads/Events
```

## ⚠️ Common Confusion

### "Visitor count is increasing on button clicks!"
**Check this:**
- Are you looking at **Unique Visitors** (correct) or **Total Visits** (pageviews)?
- Total Visits = number of pageviews (includes refreshes)
- Unique Visitors = number of unique browsers

### "Events increasing on page refresh!"
**This was fixed:**
- Pageviews are now tracked separately in TrafficDailyStats
- Website metadata `totalEvents` counter is ONLY for button clicks
- Run `node check-all-stats.js` to see the separation

## 🔍 Debugging

### Check what's in the database:
```bash
# See all stats
node check-all-stats.js

# Test the tracking logic
node test-tracking.js
```

### Check frontend localStorage:
1. Open DevTools (F12)
2. Go to Application → Local Storage → http://localhost:5000
3. Check for `_wt_visitor_id` key
4. Value should start with `wt_` (e.g., `wt_1234567890_abc123`)

### Check backend logs:
Look for:
```
Geo detection: {
  ip: '::1',
  visitorId: 'wt_1234567890_abc123',
  isNewVisitor: true  ← Only true on first visit
}
```

## 📝 Test Results Template

Use this to document your test:

```
✅ Test Date: _______
✅ Backend Reset: Yes/No
✅ Browser localStorage Cleared: Yes/No

Test 1: Fresh Visitor
- Loaded example.html
- Unique Visitors: ____ (expected: 1)

Test 2: Multiple Refreshes (10x)
- Refreshed 10 times
- Unique Visitors: ____ (expected: 1)
- Total Visits: ____ (expected: 11 = 1 initial + 10 refreshes)

Test 3: Button Clicks
- Clicked Tel: 3 times
- Clicked WhatsApp: 2 times
- Unique Visitors: ____ (expected: 1, no change!)
- Total Events: ____ (expected: 5)
- Call Clicks: ____ (expected: 3)
- WhatsApp Clicks: ____ (expected: 2)

Test 4: Incognito Window
- Opened in incognito
- Unique Visitors: ____ (expected: 2)
```

## 🎯 Success Criteria

✅ One browser = 1 visitor (even after 100 refreshes)
✅ Button clicks = Events (increments totalEvents)
✅ Page refreshes = Pageviews (tracked separately, NOT in totalEvents)
✅ Incognito/Different browser = New visitor
✅ Same browser, clear localStorage = New visitor
