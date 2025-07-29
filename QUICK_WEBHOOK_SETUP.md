# Quick Google Drive Webhook Setup

This is a step-by-step guide to set up proper Google Drive API webhooks for real-time file processing.

## Step 1: Install Dependencies

```bash
npm install googleapis
```

## Step 2: Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (Web application type)
5. Note your Client ID and Client Secret

## Step 3: Generate Tokens

```bash
node regenerate-google-tokens.js
```

Follow the prompts to generate your access and refresh tokens.

## Step 4: Set Environment Variables

Add these to your `.env` file:

```env
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_DRIVE_ACCESS_TOKEN=your_access_token_here
GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_folder_id_here
GOOGLE_DRIVE_WEBHOOK_SECRET=your_webhook_secret_here
RAILWAY_URL=https://your-app.railway.app
```

## Step 5: Generate Webhook Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `GOOGLE_DRIVE_WEBHOOK_SECRET`.

## Step 6: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Step 7: Set Up Webhook

```bash
npm run setup-webhook
```

## Step 8: Test

1. Upload an audio file to your Google Drive folder
2. Check Railway logs for webhook processing
3. Check your Notion database for the new page

## Step 9: Set Up Auto-Renewal

Google Drive webhooks expire after 24 hours. Set up automatic renewal:

```bash
# Add to Railway environment variables
RAILWAY_CRON_SCHEDULE="0 */12 * * *"  # Renew every 12 hours
```

## Troubleshooting

### Common Issues:

1. **"Invalid webhook URL"**
   - Ensure your Railway URL is correct
   - Check that the webhook endpoint is accessible

2. **"Authentication failed"**
   - Regenerate tokens: `node regenerate-google-tokens.js`
   - Check all environment variables are set

3. **"Webhook not receiving notifications"**
   - Verify folder ID is correct
   - Check webhook hasn't expired
   - Run renewal: `npm run renew-webhook`

## Benefits Over Apps Script

✅ **Real-time**: Triggers immediately when files are added
✅ **No polling**: No need to check every minute
✅ **More efficient**: Uses less resources
✅ **More reliable**: Direct API integration
✅ **Better error handling**: Proper API responses

## Next Steps

1. Deploy your app to Railway
2. Run the webhook setup
3. Test with a sample file
4. Set up automatic renewal
5. Monitor logs for issues

This approach is much better than the Apps Script polling method!