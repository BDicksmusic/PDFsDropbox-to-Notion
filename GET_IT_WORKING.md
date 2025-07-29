# Get Your Webhook Processing Working

This guide will help you get your Google Drive to Notion automation working end-to-end.

## Step 1: Test Your Current Setup

Run this test to see if your basic configuration is working:

```bash
node test-webhook-flow.js
```

This will test:
- ✅ Google Drive connection
- ✅ File listing
- ✅ File download
- ✅ Transcription
- ✅ Notion page creation

## Step 2: Test Webhook Processing

Run this to simulate a webhook and see what files get processed:

```bash
node manual-webhook-test.js
```

This will show you:
- How many files are found
- Which files are considered "recent"
- Whether files are being processed

## Step 3: Deploy to Railway

If the tests work locally, deploy to Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Step 4: Set Up Google Drive Webhook

Once deployed, set up the webhook:

```bash
npm run setup-webhook
```

## Step 5: Test the Full Flow

1. Upload a new audio file to your Google Drive folder
2. Check Railway logs to see if webhook is received
3. Check your Notion database for the new page

## Troubleshooting

### If no files are processed:

1. **Check file age**: Files must be modified within the last 30 minutes
2. **Check folder ID**: Ensure `GOOGLE_DRIVE_AUDIO_FOLDER_ID` is correct
3. **Check file format**: Only audio files (mp3, wav, m4a, flac, aac, ogg) are processed

### If webhook isn't received:

1. **Check Railway URL**: Ensure it's publicly accessible
2. **Check webhook setup**: Run `npm run setup-webhook` again
3. **Check logs**: Look for webhook signature verification errors

### If transcription fails:

1. **Check OpenAI API key**: Ensure it's valid and has credits
2. **Check file size**: Files must be under 50MB
3. **Check file format**: Ensure it's a supported audio format

## Quick Fixes

### Extend the time window (if files are too old):
Edit `src/google-drive-handler.js` line 200:
```javascript
const thirtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
```

### Process all files (ignore time filter):
Edit `src/google-drive-handler.js` line 201-207:
```javascript
const recentFiles = audioFiles; // Process all files
```

### Test with a specific file:
Use the manual processing endpoint:
```bash
curl -X POST https://your-app.railway.app/process-file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "your_file_id_here",
    "source": "google-drive"
  }'
```

## Expected Flow

1. **File uploaded** to Google Drive folder
2. **Webhook triggered** (within 1-2 minutes)
3. **File downloaded** to server
4. **Audio transcribed** using OpenAI Whisper
5. **Content analyzed** using GPT-3.5-turbo
6. **Notion page created** with all the AI-generated content
7. **File cleaned up** from server

## Success Indicators

✅ You'll see logs like:
```
Processing Google Drive webhook notification
Found 1 audio files to process
Processing audio file: My recording 262.m4a
Starting complete audio processing for: My recording 262.m4a
Transcription completed successfully
Audio processing completed successfully for: My recording 262.m4a
Creating Notion page for: My recording 262.m4a
Successfully created Notion page: abc123-def456
```

✅ Your Notion database will have a new page with:
- AI-generated title
- Summary of the recording
- Key points extracted
- Action items identified
- Topics covered
- Sentiment analysis
- Full transcript (in a toggle)

## Next Steps

Once this is working:
1. Set up automatic webhook renewal
2. Monitor logs for any issues
3. Scale up as needed

The automation should now work end-to-end! 🎉