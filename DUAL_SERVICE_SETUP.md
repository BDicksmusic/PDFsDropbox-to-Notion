# Dual-Service Setup Guide: Google Drive + Dropbox

This guide will help you set up the automation system to use **Google Drive for audio files** and **Dropbox for documents**.

## 🎯 Why This Approach?

- **Google Drive**: Better for audio files, free API, simpler webhooks
- **Dropbox**: Your 10-year workflow, excellent for documents and PDFs
- **Clean Separation**: No more confusion between audio and document processing
- **Cost Effective**: Google Drive API is free, Dropbox API is reliable

## 📋 Prerequisites

- Node.js 18+ installed
- Google Drive account
- Dropbox account (you already have this)
- Notion account
- OpenAI API key
- Railway account (for hosting)

## 🔧 Step 1: Google Drive Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (for local testing)
   - `https://your-railway-app.railway.app/auth/google/callback` (for production)
5. Note down your **Client ID** and **Client Secret**

### 1.3 Generate Access Token

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the settings icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. Close settings
6. In the left panel, find "Google Drive API v3"
7. Select "https://www.googleapis.com/auth/drive"
8. Click "Authorize APIs"
9. Sign in with your Google account
10. Click "Exchange authorization code for tokens"
11. Copy the **Refresh Token** and **Access Token**

### 1.4 Create Audio Folder

1. Go to [Google Drive](https://drive.google.com/)
2. Create a new folder called "Audio Files" (or whatever you prefer)
3. Right-click the folder → "Share" → "Copy link"
4. Extract the folder ID from the URL:
   - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

## 🔧 Step 2: Dropbox Setup (Documents Only)

### 2.1 Update Dropbox App Permissions

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your existing app
3. Go to "Permissions" tab
4. Ensure these permissions are enabled:
   - `files.metadata.read`
   - `files.content.read`
   - `files.content.write`
5. Go to "Settings" tab
6. Update webhook URL to: `https://your-railway-app.railway.app/webhook/dropbox`

### 2.2 Create Documents Folder

1. In your Dropbox, ensure you have a folder for documents
2. Default path: `/Apps/PDFs` (already configured)
3. This folder will only process documents (PDFs, images, etc.)

## 🔧 Step 3: Notion Setup

### 3.1 Audio Database (Google Drive → Notion)

1. Create a new database in Notion for audio files
2. Add these properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| Title | Title | Auto-filled with filename |
| Summary | Text | AI-generated summary |
| Key Points | Text | Main points from recording |
| Action Items | Text | Tasks and follow-ups |
| Topics | Multi-select | Categories/themes |
| Sentiment | Select | Positive/Negative/Neutral/Mixed |
| Duration | Number | Audio duration in seconds |
| Word Count | Number | Number of words transcribed |
| Language | Select | Detected language |
| Processed Date | Date | When processed |
| File Name | Text | Original filename |
| Status | Select | Processing status |
| Google Drive Link | URL | Link to original file |

3. Share the database with your integration
4. Copy the **Database ID** from the URL

### 3.2 PDF Database (Dropbox → Notion)

1. Use your existing PDF database
2. Ensure it has these properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| Title | Title | Auto-filled with filename |
| Summary | Text | AI-generated summary |
| Key Points | Text | Main points from document |
| Action Items | Text | Tasks and follow-ups |
| Topics | Multi-select | Categories/themes |
| Sentiment | Select | Positive/Negative/Neutral/Mixed |
| Word Count | Number | Number of words extracted |
| Language | Select | Detected language |
| Processed Date | Date | When processed |
| File Name | Text | Original filename |
| Status | Select | Processing status |
| Dropbox Link | URL | Link to original file |

## 🔧 Step 4: Environment Configuration

Update your `.env` file with all the values:

```env
# Dropbox Configuration (for documents only)
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token_here
DROPBOX_REFRESH_TOKEN=your_dropbox_refresh_token_here
DROPBOX_APP_KEY=your_dropbox_app_key_here
DROPBOX_APP_SECRET=your_dropbox_app_secret_here
DROPBOX_WEBHOOK_SECRET=your_dropbox_webhook_secret_here
DROPBOX_PDF_FOLDER_PATH=/Apps/PDFs

# Google Drive Configuration (for audio files only)
GOOGLE_DRIVE_CLIENT_ID=your_google_drive_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_google_drive_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_google_drive_refresh_token_here
GOOGLE_DRIVE_ACCESS_TOKEN=your_google_drive_access_token_here
GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_google_drive_audio_folder_id_here
GOOGLE_DRIVE_WEBHOOK_SECRET=your_google_drive_webhook_secret_here

# Notion Configuration
NOTION_API_KEY=your_notion_integration_token_here
NOTION_DATABASE_ID=your_audio_database_id_here
NOTION_PDF_DATABASE_ID=your_pdf_database_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000
RAILWAY_URL=https://your-app-name.railway.app
BACKGROUND_MODE=false

# Processing Configuration
MAX_FILE_SIZE_MB=50
SUPPORTED_AUDIO_FORMATS=mp3,wav,m4a,flac
SUPPORTED_DOCUMENT_FORMATS=pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc
TEMPORARY_FOLDER=./temp

# API Rate Limiting
DAILY_API_LIMIT=1000
PERIODIC_SCAN_ENABLED=false
PERIODIC_SCAN_INTERVAL_MINUTES=30

# Logging
LOG_LEVEL=info
```

## 🔧 Step 5: Railway Deployment

### 5.1 Deploy to Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Initialize project:
   ```bash
   railway init
   ```

4. Add environment variables:
   ```bash
   railway variables set DROPBOX_ACCESS_TOKEN=your_token
   railway variables set GOOGLE_DRIVE_CLIENT_ID=your_client_id
   railway variables set GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
   railway variables set GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
   railway variables set GOOGLE_DRIVE_ACCESS_TOKEN=your_access_token
   railway variables set GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_folder_id
   railway variables set NOTION_API_KEY=your_key
   railway variables set NOTION_DATABASE_ID=your_audio_db_id
   railway variables set NOTION_PDF_DATABASE_ID=your_pdf_db_id
   railway variables set OPENAI_API_KEY=your_key
   # Add all other variables...
   ```

5. Deploy:
   ```bash
   railway up
   ```

6. Get your deployment URL:
   ```bash
   railway domain
   ```

### 5.2 Update Webhook URLs

1. **Google Drive Webhook** (if using Google Apps Script):
   - Update your Google Apps Script to call: `https://your-app-name.railway.app/webhook/google-drive`

2. **Dropbox Webhook**:
   - Go to your Dropbox app settings
   - Update webhook URL to: `https://your-app-name.railway.app/webhook/dropbox`

## 🔧 Step 6: Testing

### 6.1 Test Health Check

Visit: `https://your-app-name.railway.app/health`

Should return: `{"status":"healthy","timestamp":"...","service":"Automation-Connections"}`

### 6.2 Test Google Drive (Audio)

1. Upload an audio file to your Google Drive "Audio Files" folder
2. Check Railway logs for processing
3. Verify a new page appears in your Notion audio database

### 6.3 Test Dropbox (Documents)

1. Upload a PDF to your Dropbox `/Apps/PDFs` folder
2. Check Railway logs for processing
3. Verify a new page appears in your Notion PDF database

### 6.4 Test Force Scan

Visit: `https://your-app-name.railway.app/force-scan`

This will scan both services and process any new files.

## 🔧 Step 7: Google Drive Webhook Setup (Optional)

For real-time processing, you can set up Google Drive webhooks using Google Apps Script:

### 7.1 Create Google Apps Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Create a new project
3. Replace the code with:

```javascript
function onEdit(e) {
  const file = e.source;
  const fileId = file.getId();
  const fileName = file.getName();
  
  // Check if file is in the monitored folder
  const folderId = 'YOUR_AUDIO_FOLDER_ID';
  const parents = file.getParents();
  
  for (let i = 0; i < parents.length; i++) {
    if (parents[i].getId() === folderId) {
      // File is in monitored folder, send webhook
      sendWebhook(fileId, fileName);
      break;
    }
  }
}

function sendWebhook(fileId, fileName) {
  const webhookUrl = 'https://your-app-name.railway.app/webhook/google-drive';
  
  const payload = {
    resourceId: fileId,
    resourceUri: `https://www.googleapis.com/drive/v3/files/${fileId}`,
    fileName: fileName,
    timestamp: new Date().toISOString()
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    UrlFetchApp.fetch(webhookUrl, options);
    console.log(`Webhook sent for file: ${fileName}`);
  } catch (error) {
    console.error(`Failed to send webhook for ${fileName}:`, error);
  }
}
```

4. Replace `YOUR_AUDIO_FOLDER_ID` with your actual folder ID
5. Replace `your-app-name.railway.app` with your actual Railway domain
6. Save and run the script

## 🎯 Benefits of This Setup

### ✅ **Clean Separation**
- Audio files → Google Drive → Notion Audio DB
- Documents → Dropbox → Notion PDF DB
- No more confusion about which files go where

### ✅ **Cost Effective**
- Google Drive API: Free
- Dropbox API: Reliable and familiar
- Railway hosting: Minimal cost

### ✅ **Better Performance**
- Google Drive: Faster for media files
- Dropbox: Excellent for documents
- Each service optimized for its use case

### ✅ **Easier Management**
- Clear file organization
- Separate webhook endpoints
- Independent processing pipelines

## 🚨 Troubleshooting

### Google Drive Issues
- **"Invalid credentials"**: Regenerate access token
- **"Folder not found"**: Check folder ID in Google Drive
- **"Permission denied"**: Ensure OAuth scope includes drive access

### Dropbox Issues
- **"401 Unauthorized"**: Refresh access token
- **"Folder not found"**: Check folder path in Dropbox
- **"Webhook not triggering"**: Verify webhook URL in Dropbox app settings

### General Issues
- **"File not processed"**: Check file format and size limits
- **"Notion page not created"**: Verify database permissions
- **"Transcription failed"**: Check OpenAI API key and limits

## 📊 Monitoring

### Railway Logs
Monitor your Railway deployment logs for:
- Webhook processing
- File downloads
- Transcription progress
- Notion page creation

### API Usage
- Google Drive: Free tier (1,000 requests/day)
- Dropbox: Free tier (usually sufficient)
- OpenAI: Monitor usage in OpenAI dashboard

### Cost Tracking
- **Google Drive**: $0 (free API)
- **Dropbox**: $0 (free tier)
- **Railway**: ~$5-20/month
- **OpenAI**: ~$0.006/minute for Whisper + ~$0.002/1K tokens for GPT

This setup gives you the best of both worlds: Google Drive's excellent media handling for audio files and Dropbox's reliable document management for your existing workflow! 🎉