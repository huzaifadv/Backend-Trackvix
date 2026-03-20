# Nginx Configuration for IP Forwarding

## Problem
Backend ko real client IP nahi mil raha - sirf localhost/private IP aa raha hai.

## Solution

### EC2 pe Nginx config update karein:

```bash
sudo nano /etc/nginx/sites-available/webtrackly
```

### Add these headers in the location block:

```nginx
server {
    listen 80;
    server_name api.addwatch.site;

    location / {
        proxy_pass http://localhost:5000;

        # IMPORTANT: Forward real client IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;

        # For WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## For Cloudflare Users

If using Cloudflare, Cloudflare automatically adds `CF-Connecting-IP` header.
Make sure Cloudflare is in "Full" SSL mode (not "Flexible").

## Verify

After updating, check logs:
```bash
pm2 logs webtrackly-backend
```

You should see real IPs in logs, not `127.0.0.1`.
