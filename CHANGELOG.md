# Transcoding Service Updates

## Recent Changes

### ✨ Added Thumbnail Generation

The transcoding service now automatically generates video thumbnail previews during the transcoding process.

#### Changes Made:

**1. `src/transcoder.js`**
   - Added `generateThumbnails()` function
   - Added `getVideoDuration()` helper function
   - Added `generateThumbnailVTT()` function to create WebVTT metadata
   - Added `formatVTTTime()` helper function
   - Integrated thumbnail generation into `transcodeToHLS()` workflow

**2. `src/index.js`**
   - Updated R2 upload logic to include thumbnails
   - Uploads `thumbnails.vtt` file
   - Uploads all thumbnail JPEG images

#### How It Works:

1. **During Transcoding:**
   - Video is analyzed to get duration
   - Thumbnails extracted every 5 seconds at 160x90 resolution
   - WebVTT file created to map timestamps to thumbnails

2. **Thumbnail Generation:**
   ```javascript
   // Extracts 1 frame every 5 seconds
   ffmpeg -i input.mp4 -vf "fps=1/5,scale=160:90" -q:v 2 thumbnails/thumb%04d.jpg
   ```

3. **Files Generated:**
   ```
   output/
   ├── master.m3u8
   ├── thumbnails.vtt
   ├── thumbnails/
   │   ├── thumb0001.jpg
   │   ├── thumb0002.jpg
   │   ├── thumb0003.jpg
   │   └── ...
   ├── 360p/
   ├── 480p/
   ├── 720p/
   └── 1080p/
   ```

4. **R2 Upload Structure:**
   ```
   hls/{videoId}/
   ├── master.m3u8
   ├── thumbnails.vtt           # WebVTT metadata
   ├── thumbnails/               # Thumbnail images
   │   └── thumb*.jpg
   ├── 360p/
   ├── 480p/
   ├── 720p/
   └── 1080p/
   ```

#### Configuration:

- **Thumbnail Interval:** 5 seconds (configurable in `generateThumbnails()`)
- **Thumbnail Size:** 160x90 pixels (16:9 aspect ratio)
- **Format:** JPEG with high quality (q:v 2)
- **Naming:** `thumb0001.jpg`, `thumb0002.jpg`, etc.

#### Benefits:

✅ Users can preview video content by hovering over the progress bar
✅ Improves user experience with visual seek preview
✅ Automatic generation - no manual intervention needed
✅ Optimized file sizes for fast loading

#### Example VTT Output:

```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
thumbnails/thumb0001.jpg

00:00:05.000 --> 00:00:10.000
thumbnails/thumb0002.jpg

00:00:10.000 --> 00:00:15.000
thumbnails/thumb0003.jpg
```

#### Storage Impact:

For a typical video:
- Thumbnail size: ~5KB per image
- 5-second interval: ~12 thumbnails per minute
- 1-hour video: ~720 thumbnails = ~3.6MB total
- Plus VTT file: ~10-20KB

#### Testing:

1. Upload a video through the frontend
2. Check transcoding service logs for thumbnail generation
3. Verify R2 contains:
   - `hls/{videoId}/thumbnails.vtt`
   - `hls/{videoId}/thumbnails/thumb*.jpg`
4. Play video in frontend and hover over progress bar
5. Thumbnails should appear on hover

#### Troubleshooting:

**Thumbnails not generating:**
- Check FFmpeg is installed with image support
- Verify sufficient disk space in `/tmp`
- Check logs for FFmpeg errors

**VTT file incorrect:**
- Verify video duration is being read correctly
- Check thumbnail count matches actual generated files

**Upload failures:**
- Verify R2 credentials are correct
- Check network connectivity
- Review R2 upload logs

## Compatibility

- ✅ Works with existing video player (Plyr integration)
- ✅ Compatible with all video formats supported by FFmpeg
- ✅ No breaking changes to API

## Future Improvements

- [ ] Configurable thumbnail interval via API
- [ ] Support for sprite sheets (combine thumbnails into one image)
- [ ] Thumbnail quality settings
- [ ] Progressive thumbnail generation (low-res first)
- [ ] Thumbnail caching on CDN
