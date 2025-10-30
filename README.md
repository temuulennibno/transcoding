# Video Transcoding Service

FFmpeg-based video transcoding service that converts uploaded videos to HLS format with multiple quality variants (360p, 480p, 720p, 1080p).

## Overview

This service runs on your VPS and:
1. Receives webhook requests from the Cloudflare Workers backend
2. Downloads videos from R2
3. Transcodes them to HLS with FFmpeg
4. Uploads HLS segments back to R2
5. Updates video status in the backend

## Prerequisites

- Ubuntu/Debian VPS (or any Linux server)
- Node.js 18+ installed
- FFmpeg installed
- Access to Cloudflare R2 (S3-compatible API)

## Installation

### 1. Install FFmpeg

```bash
sudo apt update
sudo apt install ffmpeg -y
ffmpeg -version
```

### 2. Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

### 3. Clone/Upload the Service

Upload this `transcoding-service` directory to your VPS, or clone your repository:

```bash
cd /opt
# Upload or clone your code here
cd transcoding-service
```

### 4. Install Dependencies

```bash
npm install
```

## Configuration

### 1. Create R2 API Tokens

Go to Cloudflare Dashboard:
1. Navigate to R2 > Manage R2 API Tokens
2. Click "Create API Token"
3. Give it a name (e.g., "transcoding-service")
4. Permissions: Read & Write on your bucket
5. Copy the Access Key ID and Secret Access Key

### 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Update the following:

```env
# Server Configuration
PORT=3000
API_SECRET=your-strong-random-secret-here  # Generate with: openssl rand -hex 32

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=2bb98d59cb5e0bc8e0def85db4ae70e0  # Your Cloudflare account ID
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=video-streamer-bucket

# Cloudflare Workers Backend
BACKEND_URL=https://video-streamer-backend.shagai.workers.dev
```

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Using PM2 (Recommended for Production)

Install PM2:
```bash
sudo npm install -g pm2
```

Start the service:
```bash
pm2 start src/index.js --name video-transcoding
pm2 save
pm2 startup  # Follow the instructions to enable auto-start on boot
```

Monitor logs:
```bash
pm2 logs video-transcoding
```

## Updating the Backend

After deploying the transcoding service, update your Cloudflare Workers backend with environment variables.

### Add Environment Variables to wrangler.toml

Edit `backend/wrangler.toml` and add:

```toml
[vars]
TRANSCODING_SERVICE_URL = "http://your-vps-ip:3000"
TRANSCODING_SECRET = "your-api-secret-here"
```

Or add as secrets (more secure):

```bash
cd backend
wrangler secret put TRANSCODING_SECRET
# Enter your API secret when prompted

wrangler secret put TRANSCODING_SERVICE_URL
# Enter your VPS URL when prompted
```

Then redeploy:

```bash
wrangler deploy
```

## Firewall Configuration

If using a firewall (UFW):

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

For production, consider using Nginx as a reverse proxy with HTTPS.

## Using Nginx Reverse Proxy (Optional but Recommended)

### 1. Install Nginx

```bash
sudo apt install nginx -y
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/transcoding
```

Add:

```nginx
server {
    listen 80;
    server_name transcode.yourdomain.com;  # Or use your VPS IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for long-running transcoding
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/transcoding /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Add SSL with Let's Encrypt (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d transcode.yourdomain.com
```

## Testing the Service

### 1. Check Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","service":"video-transcoding-service"}
```

### 2. Test Transcoding (Manual)

```bash
curl -X POST http://localhost:3000/transcode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-secret" \
  -d '{
    "videoId": "test-123",
    "filename": "test.mp4",
    "originalKey": "originals/test-123/test.mp4"
  }'
```

## How It Works

1. **Upload** - User uploads video via frontend
2. **Backend** - Cloudflare Worker saves to R2 and triggers transcoding service
3. **Webhook** - Transcoding service receives POST request with video details
4. **Download** - Service downloads video from R2
5. **Transcode** - FFmpeg creates 4 quality variants (360p, 480p, 720p, 1080p)
6. **Upload** - All HLS segments uploaded back to R2
7. **Update** - Service notifies backend that transcoding is complete
8. **Stream** - Frontend can now play the video with adaptive quality

## Monitoring

### Check Logs

```bash
# With PM2
pm2 logs video-transcoding

# Direct logs
npm start 2>&1 | tee transcoding.log
```

### Disk Space

Transcoding uses `/tmp` directory. Monitor disk space:

```bash
df -h /tmp
```

### Process Monitoring

```bash
pm2 status
pm2 monit
```

## Troubleshooting

### FFmpeg Not Found

```bash
which ffmpeg
sudo apt install ffmpeg -y
```

### Permission Errors

```bash
sudo chown -R $USER:$USER /opt/transcoding-service
```

### Port Already in Use

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### R2 Access Denied

- Verify your R2 API tokens have read/write permissions
- Check that the bucket name is correct
- Ensure account ID is correct

## Security Best Practices

1. **Use strong API secrets** - Generate with `openssl rand -hex 32`
2. **Firewall** - Only allow necessary ports
3. **HTTPS** - Use Nginx with SSL certificates
4. **Keep updated** - Regularly update Node.js and dependencies
5. **Monitor logs** - Watch for unauthorized access attempts
6. **IP Whitelist** - Consider restricting access to Cloudflare IPs only

## Performance Optimization

- Use SSD storage for `/tmp` directory
- Increase server resources for faster transcoding
- Use multiple worker instances with a load balancer for high volume
- Consider separate storage for temp files if `/tmp` is limited

## Scaling

For high-volume transcoding:
1. Deploy multiple transcoding servers
2. Use a load balancer (Nginx, HAProxy)
3. Implement a job queue (Redis, RabbitMQ)
4. Use dedicated transcoding nodes per quality level

## Support

For issues or questions:
- Check FFmpeg installation: `ffmpeg -version`
- Review logs: `pm2 logs video-transcoding`
- Test R2 connectivity with AWS CLI tools
