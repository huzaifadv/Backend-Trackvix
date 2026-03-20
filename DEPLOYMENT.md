# Deployment Guide - Webtrakly Backend

## Deploying to Render.com

### Prerequisites
1. GitHub repository with your code
2. MongoDB Atlas account (or MongoDB instance)
3. Stripe account (for payment processing)

### Step 1: Prepare MongoDB
1. Create MongoDB Atlas cluster at https://cloud.mongodb.com
2. Create a database user with read/write permissions
3. Whitelist Render's IP addresses (or allow from anywhere: 0.0.0.0/0)
4. Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/database`)

### Step 2: Deploy to Render
1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name:** webtrakly-backend
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free or Starter

### Step 3: Set Environment Variables
In Render Dashboard → Environment, add:

**Required:**
```
NODE_ENV=production
PORT=5000
API_VERSION=v1
MONGODB_URI_PROD=mongodb+srv://user:pass@cluster.mongodb.net/webtrakly
JWT_SECRET=<generate-32-char-random-string>
JWT_REFRESH_SECRET=<generate-32-char-random-string>
CORS_ORIGIN=https://your-frontend-domain.com
```

**Optional (for payments):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Optional (for email):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yoursite.com
```

### Step 4: Generate Strong Secrets
Run these commands to generate secure secrets:
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT Refresh Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Update CORS Origins
Set `CORS_ORIGIN` to your frontend domain(s):
```
CORS_ORIGIN=https://yoursite.com,https://www.yoursite.com
```

### Step 6: Initialize Database
After deployment, run these commands once:
```bash
# SSH into Render instance or use their shell
npm run setup-indexes
npm run init-plans
```

### Step 7: Test the Deployment
1. Check health endpoint: `https://your-app.onrender.com/ping`
2. Check API root: `https://your-app.onrender.com/api/v1`

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| NODE_ENV | Environment mode | Yes | production |
| PORT | Server port | Yes | 5000 |
| MONGODB_URI_PROD | Production MongoDB URI | Yes | mongodb+srv://... |
| JWT_SECRET | JWT signing secret (32+ chars) | Yes | abc123...xyz |
| JWT_REFRESH_SECRET | Refresh token secret (32+ chars) | Yes | def456...uvw |
| CORS_ORIGIN | Allowed frontend domains | Yes | https://mysite.com |
| STRIPE_SECRET_KEY | Stripe secret key | No | sk_live_... |
| SMTP_HOST | Email server host | No | smtp.gmail.com |

## CORS Configuration

### Development Mode
In development (`NODE_ENV=development`), CORS allows **all origins** automatically.

### Production Mode
In production (`NODE_ENV=production`), only domains listed in `CORS_ORIGIN` are allowed.

**Format:**
```
# Single domain
CORS_ORIGIN=https://mysite.com

# Multiple domains (comma-separated)
CORS_ORIGIN=https://mysite.com,https://www.mysite.com,https://app.mysite.com
```

## Security Checklist

- [ ] Strong JWT secrets (32+ characters)
- [ ] CORS_ORIGIN set to specific domains (not *)
- [ ] MongoDB connection uses authentication
- [ ] Environment variables stored securely in Render
- [ ] HTTPS enabled (automatic on Render)
- [ ] Rate limiting enabled (default: 100 req/15min)

## Monitoring & Logs

### View Logs
Render Dashboard → Logs tab

### Health Check
Monitor the `/ping` endpoint for uptime

### Error Tracking
Check `logs/error-*.log` files (if persistent storage enabled)

## Troubleshooting

### CORS Errors
1. Verify `CORS_ORIGIN` includes your frontend domain
2. Check that requests include proper headers
3. Ensure preflight OPTIONS requests are handled

### Database Connection Issues
1. Verify MongoDB URI is correct
2. Check MongoDB Atlas whitelist includes Render IPs
3. Ensure database user has proper permissions

### Event Tracking Not Working
1. Check API key is valid (64-char hex)
2. Verify endpoint is `/api/v1/events/log`
3. Check browser console for CORS errors
4. Ensure `X-API-Key` header or `apiKey` in body

## Scaling

Render auto-scales based on traffic. For heavy loads:
1. Upgrade to paid tier for more resources
2. Enable MongoDB connection pooling (already configured)
3. Consider CDN for tracker.js script
4. Add Redis for session management (if needed)

## Support

For issues:
1. Check Render logs
2. Monitor MongoDB Atlas metrics
3. Test with `/ping` and `/api/v1` endpoints
