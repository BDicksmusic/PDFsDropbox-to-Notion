# Railway Deployment Guide

This guide will help you deploy your Automation-Connections app to Railway so it can receive Dropbox webhooks.

## Prerequisites

1. **GitHub Account**: Your code must be pushed to a GitHub repository
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **Dropbox App**: Your Dropbox app must be configured with webhook support

## Step 1: Prepare Your Repository

Make sure your code is pushed to GitHub with these files:
- `package.json` ✅ (already exists)
- `railway.json` ✅ (already exists)
- `src/server.js` ✅ (already exists)
- All your source files ✅

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign in with your GitHub account
3. Click "New Project"
4. Choose "Deploy from GitHub repo"
5. Select your `Automation-Connections` repository
6. Railway will automatically detect it's a Node.js project

## Step 3: Configure Environment Variables

In your Railway project dashboard, go to the "Variables" tab and add these environment variables:

### Required Variables

```bash
# Dropbox Configuration
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token
DROPBOX_REFRESH_TOKEN=your_dropbox_refresh_token
DROPBOX_APP_KEY=your_dropbox_app_key
DROPBOX_APP_SECRET=your_dropbox_app_secret
DROPBOX_WEBHOOK_SECRET=your_dropbox_webhook_secret
DROPBOX_FOLDER_PATH=/Apps/Easy Voice Recorder
DROPBOX_PDF_FOLDER_PATH=/Apps/PDFs

# Notion Configuration
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_audio_database_id
NOTION_PDF_DATABASE_ID=10c8cc9f36f1802bad3eceae9dafc044

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Document Processing
SUPPORT_DOCUMENT_FORMATS=pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc
OCR_LANGUAGE=eng
OCR_CONFIDENCE_THRESHOLD=0.7
ENABLE_IMAGE_PREPROCESSING=true
UPLOAD_FILES_TO_NOTION=true

# URL Monitoring
ENABLE_URL_MONITORING=true
URL_CHECK_INTERVAL=1800000
BULLETIN_URL=https://tricityministries.org/bskpdf/bulletin/
BULLETIN_CUSTOM_NAME=Tricity Ministries Bulletin

# Logging
LOG_LEVEL=info
```

### Optional Variables (for Notion Relations)

```bash
# Notion Relation IDs (optional)
NOTION_IMPORTED_DOC_RELATION_ID=your_imported_doc_page_id
NOTION_PICTURES_RELATION_ID=your_pictures_page_id
```

## Step 4: Deploy

1. Railway will automatically start building your project
2. Monitor the build logs for any errors
3. Once deployed, you'll get a public URL like `https://your-app-name.railway.app`

## Step 5: Update Dropbox Webhook

1. Go to your [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Go to "Webhooks" section
4. Update the webhook URL to: `https://your-app-name.railway.app/webhook`
5. Save the changes

## Step 6: Test the Deployment

### Test Health Check
```bash
curl https://your-app-name.railway.app/health
```

### Test URL Monitoring
```bash
curl -X POST https://your-app-name.railway.app/monitor/bulletin
```

### Test Manual File Processing
```bash
curl -X POST https://your-app-name.railway.app/process-file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "/Apps/PDFs/test.pdf", "customName": "Test File"}'
```

## Step 7: Monitor Logs

In Railway dashboard:
1. Go to your project
2. Click on your service
3. Go to "Logs" tab to monitor application logs
4. Check for any errors or webhook notifications

## Troubleshooting

### Common Issues

1. **Build Fails**: Check that all dependencies are in `package.json`
2. **Environment Variables Missing**: Ensure all required variables are set in Railway
3. **Webhook Not Working**: Verify the webhook URL is correct in Dropbox app settings
4. **File Processing Fails**: Check that the Dropbox folders exist and contain files

### Debug Commands

Test your Railway deployment:
```bash
# Health check
curl https://your-app-name.railway.app/health

# System status
curl https://your-app-name.railway.app/status

# URL monitoring status
curl https://your-app-name.railway.app/monitor/status
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DROPBOX_ACCESS_TOKEN` | Dropbox API access token | Yes |
| `DROPBOX_REFRESH_TOKEN` | Dropbox refresh token for auto-renewal | Yes |
| `DROPBOX_APP_KEY` | Dropbox app key | Yes |
| `DROPBOX_APP_SECRET` | Dropbox app secret | Yes |
| `DROPBOX_WEBHOOK_SECRET` | Webhook verification secret | Yes |
| `DROPBOX_FOLDER_PATH` | Audio files folder path | Yes |
| `DROPBOX_PDF_FOLDER_PATH` | PDF files folder path | Yes |
| `NOTION_API_KEY` | Notion API key | Yes |
| `NOTION_DATABASE_ID` | Audio database ID | Yes |
| `NOTION_PDF_DATABASE_ID` | PDF database ID | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ENABLE_URL_MONITORING` | Enable URL monitoring | No (default: false) |
| `LOG_LEVEL` | Logging level | No (default: info) |

## Next Steps

After deployment:
1. Upload test files to your Dropbox folders
2. Monitor the Railway logs for processing activity
3. Check your Notion databases for new entries
4. Test the URL monitoring with the bulletin URL

Your app should now be able to receive webhooks from Dropbox and process files automatically! 