# Nginx Setup for video.pinebaatars.mn

This guide will set up Nginx as a reverse proxy for your transcoding service with SSL.

## Prerequisites

- Domain `video.pinebaatars.mn` must point to your VPS IP: `103.50.205.48`
- SSH access to your VPS

## Step 1: Verify DNS

First, verify your domain points to the correct IP:

```bash
# From your local machine
dig video.pinebaatars.mn +short
# Should return: 103.50.205.48

# Or use nslookup
nslookup video.pinebaatars.mn
```

If it doesn't return the correct IP, update your DNS A record to point to `103.50.205.48`.

## Step 2: Install Nginx

SSH into your VPS:

```bash
ssh cloudmn@103.50.205.48
```

Install Nginx:

```bash
sudo apt update
sudo apt install nginx -y
```

Start and enable Nginx:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

## Step 3: Create Nginx Configuration

Create the configuration file:

```bash
sudo nano /etc/nginx/sites-available/video-transcoding
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name video.pinebaatars.mn;

    # Increase body size for video uploads (if needed in future)
    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Pass headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable caching
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for long-running transcoding operations
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;
    }

    # Health check endpoint (optional logging)
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

Save and exit (Ctrl+X, Y, Enter).

## Step 4: Enable the Site

Create a symbolic link to enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/video-transcoding /etc/nginx/sites-enabled/
```

Remove default site (optional):

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Test Nginx configuration:

```bash
sudo nginx -t
```

If successful, reload Nginx:

```bash
sudo systemctl reload nginx
```

## Step 5: Configure Firewall

Allow HTTP and HTTPS through the firewall:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw status
```

## Step 6: Test HTTP Access

Test from your local machine:

```bash
curl http://video.pinebaatars.mn/health
```

Expected response: `{"status":"ok","service":"video-transcoding-service"}`

## Step 7: Install SSL Certificate with Let's Encrypt

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx -y
```

Obtain and install SSL certificate:

```bash
sudo certbot --nginx -d video.pinebaatars.mn
```

Follow the prompts:
1. Enter your email address
2. Agree to terms of service
3. Choose whether to share email (optional)
4. Certbot will automatically configure SSL

Test automatic renewal:

```bash
sudo certbot renew --dry-run
```

## Step 8: Verify HTTPS Access

Test from your local machine:

```bash
curl https://video.pinebaatars.mn/health
```

Expected response: `{"status":"ok","service":"video-transcoding-service"}`

## Step 9: Update Backend Configuration

Now update your Cloudflare Workers backend to use HTTPS.

On your local machine, edit `backend/wrangler.toml`:

```bash
cd /Users/temkanibno/Documents/video-streamer/backend
nano wrangler.toml
```

Update the transcoding service URL:

```toml
[vars]
TRANSCODING_SERVICE_URL = "https://video.pinebaatars.mn"
TRANSCODING_SECRET = "your-api-secret-here"
```

Deploy the backend:

```bash
wrangler deploy
```

## Final Nginx Configuration (After SSL)

After running Certbot, your Nginx config will look like this:

```nginx
server {
    server_name video.pinebaatars.mn;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/video.pinebaatars.mn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/video.pinebaatars.mn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = video.pinebaatars.mn) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name video.pinebaatars.mn;
    return 404;
}
```

## Monitoring

View Nginx logs:

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

Check Nginx status:

```bash
sudo systemctl status nginx
```

Restart Nginx if needed:

```bash
sudo systemctl restart nginx
```

## Troubleshooting

### Domain not resolving

Check DNS propagation:

```bash
dig video.pinebaatars.mn +short
```

Wait for DNS to propagate (can take up to 48 hours, usually minutes).

### Nginx won't start

Check configuration:

```bash
sudo nginx -t
```

Check logs:

```bash
sudo journalctl -u nginx -n 50
```

### SSL certificate issues

Check if port 80 is accessible (required for Let's Encrypt):

```bash
sudo ufw status
curl http://video.pinebaatars.mn
```

Renew certificate manually:

```bash
sudo certbot renew
```

### 502 Bad Gateway

Ensure transcoding service is running:

```bash
pm2 status
pm2 logs video-transcoding
```

Check if service is listening on port 3000:

```bash
sudo netstat -tulpn | grep 3000
```

## Security Best Practices

1. **Firewall**: Only allow necessary ports (80, 443, 22)
2. **SSL**: Always use HTTPS in production
3. **Rate Limiting**: Consider adding Nginx rate limiting
4. **Auth**: Ensure API_SECRET is strong
5. **Updates**: Keep Nginx and SSL certificates updated

## Auto-renewal

Let's Encrypt certificates are valid for 90 days. Certbot sets up automatic renewal. Verify:

```bash
sudo systemctl status certbot.timer
```

## Done

Your transcoding service is now accessible at:
- **HTTP**: http://video.pinebaatars.mn (redirects to HTTPS)
- **HTTPS**: https://video.pinebaatars.mn

The backend will now use the secure domain for triggering transcoding jobs!
