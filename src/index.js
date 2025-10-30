import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createR2Client, downloadFromR2, uploadToR2 } from './r2-client.js';
import { transcodeToHLS, cleanupFiles } from './transcoder.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET;

// Queue management
let isProcessing = false;
const queue = [];

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'video-transcoding-service' });
});

// Webhook endpoint to receive transcoding jobs
app.post('/transcode', async (req, res) => {
  // Verify API secret
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { videoId, filename, originalKey } = req.body;

  if (!videoId || !originalKey) {
    return res.status(400).json({ error: 'Missing required fields: videoId, originalKey' });
  }

  // Add to queue
  queue.push({ videoId, filename, originalKey });
  const position = queue.length;

  console.log(`Video ${videoId} added to queue at position ${position}`);

  // Update status to 'queued' in backend
  await updateVideoStatus(videoId, 'queued', null, position);

  // Respond immediately to acknowledge receipt
  res.json({
    success: true,
    message: `Transcoding job queued at position ${position}`,
    videoId,
    queuePosition: position,
  });

  // Start processing if not already processing
  if (!isProcessing) {
    processQueue();
  }
});

async function processQueue() {
  if (isProcessing || queue.length === 0) {
    return;
  }

  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    console.log(`Processing video ${job.videoId} (${queue.length} remaining in queue)`);

    // Update queue positions for remaining items
    for (let i = 0; i < queue.length; i++) {
      await updateVideoStatus(queue[i].videoId, 'queued', null, i + 1);
    }

    // Update status to 'processing'
    await updateVideoStatus(job.videoId, 'processing', null, null);

    // Process the transcoding
    await processTranscoding(job.videoId, job.filename, job.originalKey);
  }

  isProcessing = false;
}

async function processTranscoding(videoId, filename, originalKey) {
  const r2Client = createR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const workDir = path.join('/tmp', `transcode-${videoId}`);
  const inputPath = path.join(workDir, filename);
  const outputDir = path.join(workDir, 'output');

  try {
    console.log(`[${videoId}] Starting transcoding process`);

    // Create working directory
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    // Step 1: Download video from R2
    console.log(`[${videoId}] Downloading from R2: ${originalKey}`);
    await downloadFromR2(r2Client, bucket, originalKey, inputPath);
    console.log(`[${videoId}] Download complete`);

    // Step 2: Transcode video to HLS
    console.log(`[${videoId}] Starting transcoding`);
    const result = await transcodeToHLS(inputPath, outputDir, videoId);
    console.log(`[${videoId}] Transcoding complete`);

    // Step 3: Upload all HLS files to R2
    console.log(`[${videoId}] Uploading to R2`);

    // Upload master playlist
    await uploadToR2(
      r2Client,
      bucket,
      `hls/${videoId}/master.m3u8`,
      result.masterPlaylistPath,
      'application/vnd.apple.mpegurl'
    );

    // Upload each quality variant
    for (const variant of result.variants) {
      const qualityDir = variant.qualityDir;
      const files = fs.readdirSync(qualityDir);

      for (const file of files) {
        const filePath = path.join(qualityDir, file);
        const r2Key = `hls/${videoId}/${variant.quality}/${file}`;

        const contentType = file.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t';

        await uploadToR2(r2Client, bucket, r2Key, filePath, contentType);
        console.log(`[${videoId}] Uploaded ${r2Key}`);
      }
    }

    console.log(`[${videoId}] Upload complete`);

    // Step 4: Update video status in backend
    await updateVideoStatus(videoId, 'completed', `hls/${videoId}/master.m3u8`);

    // Step 5: Cleanup
    cleanupFiles(workDir);

    console.log(`[${videoId}] Transcoding process completed successfully`);
  } catch (error) {
    console.error(`[${videoId}] Transcoding failed:`, error);

    // Update status to failed
    await updateVideoStatus(videoId, 'failed', null);

    // Cleanup on error
    cleanupFiles(workDir);
  }
}

async function updateVideoStatus(videoId, status, masterPlaylistKey, queuePosition = null) {
  try {
    const backendUrl = process.env.BACKEND_URL;
    const response = await fetch(`${backendUrl}/api/videos/${videoId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`,
      },
      body: JSON.stringify({
        status,
        master_playlist_key: masterPlaylistKey,
        queue_position: queuePosition,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to update video status: ${response.statusText}`);
    } else {
      console.log(`Video ${videoId} status updated to: ${status}`);
    }
  } catch (error) {
    console.error('Error updating video status:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Transcoding service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
