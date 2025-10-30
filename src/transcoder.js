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

  // Create master playlist
  const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
  const masterPlaylist = generateMasterPlaylist(QUALITY_CONFIGS, videoId);
  fs.writeFileSync(masterPlaylistPath, masterPlaylist);

  console.log('Master playlist created');

  return {
    masterPlaylistPath,
    variants: results,
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

export function cleanupFiles(directory) {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
    console.log(`Cleaned up directory: ${directory}`);
  }
}
