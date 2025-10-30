import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

const QUALITY_CONFIGS = [
  {
    quality: '360p',
    resolution: '640x360',
    videoBitrate: '800k',
    audioBitrate: '96k',
  },
  {
    quality: '480p',
    resolution: '854x480',
    videoBitrate: '1400k',
    audioBitrate: '128k',
  },
  {
    quality: '720p',
    resolution: '1280x720',
    videoBitrate: '2800k',
    audioBitrate: '128k',
  },
  {
    quality: '1080p',
    resolution: '1920x1080',
    videoBitrate: '5000k',
    audioBitrate: '192k',
  },
];

export async function transcodeToHLS(inputPath, outputDir, videoId) {
  console.log(`Starting transcoding for video ${videoId}`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  // Transcode each quality variant
  for (const config of QUALITY_CONFIGS) {
    console.log(`Transcoding ${config.quality}...`);

    const qualityDir = path.join(outputDir, config.quality);
    if (!fs.existsSync(qualityDir)) {
      fs.mkdirSync(qualityDir, { recursive: true });
    }

    const playlistPath = path.join(qualityDir, 'playlist.m3u8');
    const segmentPattern = path.join(qualityDir, 'segment%03d.ts');

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-vf scale=${config.resolution}`,
          `-c:v libx264`,
          `-b:v ${config.videoBitrate}`,
          `-c:a aac`,
          `-b:a ${config.audioBitrate}`,
          `-hls_time 10`,
          `-hls_list_size 0`,
          `-hls_segment_filename ${segmentPattern}`,
          `-f hls`,
        ])
        .output(playlistPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`${config.quality}: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log(`${config.quality} transcoding completed`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`${config.quality} transcoding error:`, err);
          reject(err);
        })
        .run();
    });

    results.push({
      quality: config.quality,
      resolution: config.resolution,
      playlistPath,
      qualityDir,
    });
  }

  // Generate thumbnails
  console.log('Generating thumbnails...');
  const thumbnailsData = await generateThumbnails(inputPath, outputDir);
  console.log(`Generated ${thumbnailsData.count} thumbnails`);

  // Create master playlist
  const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
  const masterPlaylist = generateMasterPlaylist(QUALITY_CONFIGS, videoId);
  fs.writeFileSync(masterPlaylistPath, masterPlaylist);

  console.log('Master playlist created');

  return {
    masterPlaylistPath,
    variants: results,
    thumbnails: thumbnailsData,
  };
}

function generateMasterPlaylist(configs, videoId) {
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  for (const config of configs) {
    const bandwidth = parseInt(config.videoBitrate) * 1000 + parseInt(config.audioBitrate) * 1000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${config.resolution}\n`;
    content += `${config.quality}/playlist.m3u8\n\n`;
  }

  return content;
}

/**
 * Generate thumbnail images every 5 seconds
 */
export async function generateThumbnails(inputPath, outputDir) {
  const thumbnailsDir = path.join(outputDir, 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  // Get video duration first
  const duration = await getVideoDuration(inputPath);
  const interval = 5; // seconds
  const thumbnailCount = Math.ceil(duration / interval);

  console.log(`Video duration: ${duration}s, generating ${thumbnailCount} thumbnails`);

  // Generate thumbnails using FFmpeg
  const thumbnailPattern = path.join(thumbnailsDir, 'thumb%04d.jpg');

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf fps=1/${interval},scale=160:90`,
        '-q:v 2', // High quality JPEG
      ])
      .output(thumbnailPattern)
      .on('start', (commandLine) => {
        console.log('Thumbnail FFmpeg command:', commandLine);
      })
      .on('end', () => {
        console.log('Thumbnail generation completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err);
        reject(err);
      })
      .run();
  });

  // Generate WebVTT file
  const vttPath = path.join(outputDir, 'thumbnails.vtt');
  const vttContent = generateThumbnailVTT(thumbnailCount, interval);
  fs.writeFileSync(vttPath, vttContent);

  return {
    count: thumbnailCount,
    directory: thumbnailsDir,
    vttPath,
    interval,
  };
}

/**
 * Get video duration in seconds
 */
function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

/**
 * Generate WebVTT file for thumbnail previews
 */
function generateThumbnailVTT(thumbnailCount, interval) {
  let vtt = 'WEBVTT\n\n';

  for (let i = 0; i < thumbnailCount; i++) {
    const startTime = i * interval;
    const endTime = (i + 1) * interval;
    const thumbnailNum = String(i + 1).padStart(4, '0');

    vtt += `${formatVTTTime(startTime)} --> ${formatVTTTime(endTime)}\n`;
    vtt += `thumbnails/thumb${thumbnailNum}.jpg\n\n`;
  }

  return vtt;
}

/**
 * Format seconds to VTT timestamp (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function cleanupFiles(directory) {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
    console.log(`Cleaned up directory: ${directory}`);
  }
}
