# Transcoding Service - Updated Features

## 🎬 What's New

Your transcoding service now includes **automatic thumbnail generation** for video preview on hover!

## 🚀 Quick Summary

When you upload a video, the transcoding service now:

1. ✅ Generates HLS streams (360p, 480p, 720p, 1080p)
2. ✅ **NEW:** Extracts thumbnail images every 5 seconds
3. ✅ **NEW:** Creates WebVTT file for thumbnail timing
4. ✅ Uploads everything to R2
5. ✅ Updates video status in backend

## 📦 What Gets Generated

### Before (Old):
```
hls/{videoId}/
├── master.m3u8
├── 360p/
├── 480p/
├── 720p/
└── 1080p/
```

### After (New):
```
hls/{videoId}/
├── master.m3u8
├── thumbnails.vtt              ← NEW!
├── thumbnails/                 ← NEW!
│   ├── thumb0001.jpg
│   ├── thumb0002.jpg
│   ├── thumb0003.jpg
│   └── ...
├── 360p/
├── 480p/
├── 720p/
└── 1080p/
```

## 🎯 User Experience

When users hover over the video progress bar:

**Before:** Nothing happens

**After:** Thumbnail preview appears showing video content at that timestamp!

## 🔧 Technical Details

### Thumbnail Specifications:
- **Interval:** Every 5 seconds
- **Resolution:** 160x90 pixels (16:9 ratio)
- **Format:** JPEG, high quality
- **Naming:** Sequential (thumb0001.jpg, thumb0002.jpg, etc.)

### VTT Format:
```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
thumbnails/thumb0001.jpg

00:00:05.000 --> 00:00:10.000
thumbnails/thumb0002.jpg
```

## 📊 Performance Impact

### Processing Time:
- Thumbnail generation adds ~5-10% to total transcoding time
- Runs in parallel with HLS generation (minimal impact)

### Storage:
- ~5KB per thumbnail image
- ~12 thumbnails per minute of video
- Example: 10-minute video = ~600KB in thumbnails

### Upload Time:
- Thumbnails upload to R2 after HLS segments
- Small file sizes ensure fast uploads
- ~1-2 seconds for typical video

## 🛠️ No Configuration Needed

Everything works automatically! Just:

1. Deploy the updated transcoding service
2. Upload a video
3. Thumbnails are generated and uploaded automatically
4. Frontend player shows them automatically

## 🧪 Testing

### Test the Update:

1. **Upload a test video:**
   ```bash
   # Use frontend or API
   curl -X POST http://localhost:3000/upload \
     -F "video=@test-video.mp4"
   ```

2. **Check transcoding logs:**
   ```bash
   # You should see:
   # "Generating thumbnails..."
   # "Generated 24 thumbnails"
   # "Uploading thumbnails..."
   # "Uploaded 24 thumbnails"
   ```

3. **Verify R2 upload:**
   ```bash
   wrangler r2 object list video-streamer-bucket --prefix "hls/VIDEO_ID/thumbnails"
   ```

4. **Test in browser:**
   - Open video in frontend
   - Hover over progress bar
   - Should see thumbnail previews

## 🐛 Troubleshooting

### Issue: Thumbnails not generating

**Check:**
- FFmpeg is installed with image support
- Sufficient disk space in `/tmp`
- Video file is valid

**Solution:**
```bash
# Test FFmpeg thumbnail generation manually
ffmpeg -i test.mp4 -vf "fps=1/5,scale=160:90" -q:v 2 thumb%04d.jpg
```

### Issue: VTT file not found

**Check:**
- `thumbnails.vtt` exists in R2
- Path is `hls/{videoId}/thumbnails.vtt`
- Content-Type is `text/vtt`

**Solution:**
```bash
# Verify in R2
wrangler r2 object get video-streamer-bucket "hls/VIDEO_ID/thumbnails.vtt"
```

### Issue: Thumbnails not appearing in player

**Check:**
- Browser console for 404 errors
- CORS headers are set correctly
- Plyr previewThumbnails is enabled

**Solution:**
- Check frontend VideoPlayer.tsx has:
  ```typescript
  previewThumbnails: {
    enabled: true,
    src: thumbnailsUrl,
  }
  ```

## 📝 API Unchanged

No changes to the transcoding API:

```bash
POST https://video.pinebaatars.mn/api/transcode
Authorization: Bearer YOUR_SECRET

{
  "videoId": "video-123",
  "filename": "video.mp4",
  "originalKey": "uploads/video-123.mp4"
}
```

Response is the same - thumbnails are generated automatically.

## 🔄 Deployment

### Update Your VPS:

```bash
# 1. Pull latest code
cd transcoding-service
git pull

# 2. Restart service
docker-compose down
docker-compose up -d

# or if running directly
pm2 restart video-transcoder
```

### No Environment Changes Needed

All existing environment variables remain the same:
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `API_SECRET`
- `BACKEND_URL`

## ✅ Backwards Compatible

- Existing videos continue to work
- No database migrations needed
- Frontend gracefully handles missing thumbnails
- Old videos just won't have hover previews

## 📚 Related Documentation

- See `CHANGELOG.md` for technical implementation details
- See `THUMBNAILS.md` in project root for thumbnail guide
- See `CLEANUP_AND_VPS_SETUP.md` for complete setup

## 🎉 Benefits

✨ Better user experience with visual seek preview
✨ Professional video player interface
✨ Automatic generation - no manual work
✨ Standard WebVTT format
✨ Works with all video formats

Enjoy the improved video streaming experience!
