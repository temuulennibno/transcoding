# Quick Deployment Guide

Follow these steps to deploy the transcoding service to your VPS.

## Step 1: Prepare Your VPS

SSH into your VPS:

```bash
ssh cloudmn@103.50.205.48
```

## Step 2: Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js LTS (currently v20)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install ffmpeg -y

# Verify installations
node --version
npm --version
ffmpeg -version
```

## Step 3: Upload Service Code

From your local machine, upload the transcoding-service directory:

```bash
# Option 1: Using SCP
scp -r transcoding-service cloudmn@103.50.205.48:~/

# Option 2: Using rsync
rsync -avz transcoding-service/ cloudmn@103.50.205.48:~/transcoding-service/

# Option 3: Use Git (if you pushed to a repository)
ssh cloudmn@103.50.205.48
git clone https://github.com/yourusername/video-streamer.git
cd video-streamer/transcoding-service
```

The service will be located at: `/home/cloudmn/transcoding-service`

## Step 4: Get R2 API Credentials

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com
2. Navigate to R2 > Manage R2 API Tokens
3. Click "Create API Token"
4. Name: "transcoding-service"
5. Permissions: Object Read & Write
6. Copy the Access Key ID and Secret Access Key

## Step 5: Configure Environment

On your VPS:

```bash
cd ~/transcoding-service
cp .env.example .env
```

Generate an API secret:

```bash
openssl rand -hex 32
```

**IMPORTANT**: Copy the output - you'll need it in Step 8!

Now edit the .env file:

```bash
nano .env
```

Replace the `API_SECRET` line with your generated secret:

```env
PORT=3000
API_SECRET=paste-your-generated-secret-here

# R2 credentials are already filled in
R2_ACCOUNT_ID=2bb98d59cb5e0bc8e0def85db4ae70e0
R2_ACCESS_KEY_ID=9b13647ab524ce5d0b43c840a8ede081
R2_SECRET_ACCESS_KEY=8bd9a9d92e36994d4468e47c210345eb522917f030b0315004788a481abf0e4c
R2_BUCKET_NAME=video-streamer-bucket
BACKEND_URL=https://video-streamer-backend.shagai.workers.dev
```

Save the file (Ctrl+X, Y, Enter).

## Step 6: Install and Start Service

```bash
# Install dependencies
npm install

# Install PM2 for process management
sudo npm install -g pm2

# Start the service
pm2 start src/index.js --name video-transcoding

# Save PM2 configuration
pm2 save

# Enable auto-start on boot
pm2 startup
# Follow the command it shows (usually requires sudo)

# Check status
pm2 status
pm2 logs video-transcoding
```

## Step 7: Configure Firewall

```bash
# Allow port 3000
sudo ufw allow 3000/tcp
sudo ufw status
```

## Step 8: Update Backend

On your local machine, update the backend configuration.

Edit `backend/wrangler.toml` and add at the end:

```toml
[vars]
TRANSCODING_SERVICE_URL = "http://103.50.205.48:3000"
TRANSCODING_SECRET = "paste-your-api-secret-from-step-5"
```

**Replace** `paste-your-api-secret-from-step-5` with the API_SECRET you generated in Step 5

Then deploy the backend:

```bash
cd backend
wrangler deploy
```

## Step 9: Test Everything

### Test transcoding service

```bash
curl http://103.50.205.48:3000/health
```

Expected: `{"status":"ok","service":"video-transcoding-service"}`

### Test full flow

1. Go to your frontend: `http://localhost:3001`
2. Upload a video
3. Watch the transcoding service logs on VPS:

   ```bash
   pm2 logs video-transcoding
   ```

4. After a few minutes, the video status should change to "completed"
5. Click "Play" to watch with adaptive quality

## Monitoring

```bash
# View logs
pm2 logs video-transcoding

# Monitor CPU/Memory
pm2 monit

# Check disk space
df -h

# Restart if needed
pm2 restart video-transcoding
```

## Troubleshooting

### Service won't start

```bash
pm2 logs video-transcoding --lines 100
```

### Can't connect to R2

- Verify R2 credentials in `.env`
- Check if R2 API token is active in Cloudflare dashboard
- Ensure account ID is correct

### Backend not triggering transcoding

- Check backend logs in Cloudflare dashboard
- Verify `TRANSCODING_SERVICE_URL` and `TRANSCODING_SECRET` are set
- Redeploy backend: `wrangler deploy`

### FFmpeg errors

```bash
ffmpeg -version
sudo apt install ffmpeg -y
```

## Using Docker (Alternative)

If you prefer Docker:

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Production Recommendations

1. **Use HTTPS**: Set up Nginx reverse proxy with SSL
2. **Monitor**: Set up monitoring (Grafana, Prometheus)
3. **Backups**: Regular backups of configuration
4. **Updates**: Keep Node.js and FFmpeg updated
5. **Scaling**: Add more VPS nodes behind a load balancer for high volume

## Done

Your video transcoding pipeline is now complete:

1. ✅ Frontend uploads video
2. ✅ Backend saves to R2
3. ✅ Backend triggers VPS transcoding
4. ✅ VPS transcodes to HLS (4 qualities)
5. ✅ VPS uploads segments to R2
6. ✅ Frontend plays with adaptive quality

Congratulations!
