# Setup Guide for PDF to Notion Automation

This guide will walk you through setting up the complete PDF and image processing automation system step by step.

## Prerequisites

- Node.js 18+ installed
- A Dropbox account
- A Notion account
- An OpenAI API key
- A Railway account (for hosting)

## Step 1: Project Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env
   ```

## Step 2: Dropbox Configuration

### 2.1 Create Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox" access
5. Name your app (e.g., "PDF Automation")
6. Note down your **App Key** and **App Secret**

### 2.2 Generate Access Token

1. In your app settings, go to "Permissions" tab
2. Enable these permissions:
   - `files.metadata.read`
   - `files.content.read`
   - `files.content.write`
3. Go to "Settings" tab
4. Click "Generate" under "OAuth 2"
5. Copy the **Generated access token**

### 2.3 Create Webhook

1. In your app settings, go to "Webhooks" tab
2. Click "Add webhook"
3. Set the URL to: `https://your-railway-app.railway.app/webhook/dropbox`
4. Copy the **Webhook secret**

### 2.4 Create PDF Folder

1. In your Dropbox, create a folder called "PDFs" (or use existing)
2. Note the path (e.g., `/Apps/PDFs`)

## Step 3: Notion Configuration

### 3.1 Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name it (e.g., "PDF Automation")
4. Select your workspace
5. Copy the **Internal Integration Token**

### 3.2 Create Database

1. Create a new page in Notion
2. Add a database to the page
3. Add these properties to your database:

| Property Name | Type | Description |
|---------------|------|-------------|
| Name | Title | Auto-filled with filename |
| Main Entry | Text | AI-generated summary |
| URL | URL | Dropbox shareable link |
| Files & media | Files | Uploaded document |
| Status | Select | Processing status |

4. Share the database with your integration
5. Copy the **Database ID** from the URL

## Step 4: OpenAI Configuration

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the **API Key**

## Step 5: Environment Configuration

Update your `.env` file with all the values:

```env
# Dropbox Configuration
DROPBOX_ACCESS_TOKEN=your_dropbox_access_token_here
DROPBOX_WEBHOOK_SECRET=your_webhook_secret_here
DROPBOX_PDF_FOLDER_PATH=/Apps/PDFs

# Notion Configuration
NOTION_API_KEY=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000
RAILWAY_URL=https://your-app-name.railway.app

# Processing Configuration
MAX_FILE_SIZE_MB=50
SUPPORTED_DOCUMENT_FORMATS=pdf,jpg,jpeg,png,bmp,tiff,tif,webp,docx,doc
TEMPORARY_FOLDER=./temp

# Logging
LOG_LEVEL=info
```

## Step 6: Railway Deployment

### 6.1 Deploy to Railway

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
   railway variables set NOTION_API_KEY=your_key
   railway variables set NOTION_DATABASE_ID=your_id
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

### 6.2 Update Dropbox Webhook

1. Go back to your Dropbox app settings
2. Update the webhook URL with your Railway domain:
   ```
   https://your-app-name.railway.app/webhook/dropbox
   ```

## Step 7: Testing

### 7.1 Test Health Check

Visit: `https://your-app-name.railway.app/health`

Should return: `{"status":"healthy","timestamp":"...","service":"PDF-Automation"}`

### 7.2 Test with PDF File

1. Upload a PDF file to your Dropbox "PDFs" folder
2. Check the logs in Railway dashboard
3. Verify a new page appears in your Notion database

## Step 8: Cost Optimization

### 8.1 OpenAI Costs

- **GPT-4 Vision**: ~$0.01-0.03 per image/PDF page
- **GPT-3.5-turbo**: ~$0.002 per 1K tokens

**Estimated monthly costs:**
- 100 PDF pages: ~$1.00-3.00 (Vision) + ~$2.00 (GPT) = ~$3.00-5.00
- 500 PDF pages: ~$5.00-15.00 (Vision) + ~$10.00 (GPT) = ~$15.00-25.00

### 8.2 Railway Costs

- Free tier: $5/month credit
- Pay-as-you-go: ~$0.50-2.00/month for this app

### 8.3 Cost Reduction Tips

1. **Compress PDF files** before uploading
2. **Use smaller images** when possible
3. **Batch process** multiple files
4. **Monitor usage** in OpenAI dashboard

## Troubleshooting

### Common Issues

1. **Webhook not triggering:**
   - Check Railway logs
   - Verify webhook URL is correct
   - Ensure Dropbox app has correct permissions

2. **PDF processing failing:**
   - Check OpenAI API key
   - Verify PDF file format is supported
   - Check file size limits

3. **Notion page not created:**
   - Verify database ID is correct
   - Check integration has access to database
   - Ensure all required properties exist

4. **High costs:**
   - Monitor OpenAI usage dashboard
   - Consider compressing PDF files
   - Set up usage alerts

### Debug Commands

```bash
# Check logs
railway logs

# Test locally
npm run dev

# Check environment variables
railway variables list
```

## Support

If you encounter issues:

1. Check the Railway logs first
2. Verify all environment variables are set correctly
3. Test each service individually using the `/health` endpoint
4. Check the troubleshooting section above

## Next Steps

Once everything is working:

1. **Monitor usage** and costs
2. **Customize the Notion database** structure
3. **Add more document formats** if needed
4. **Implement additional features** like:
   - Email notifications
   - Slack integration
   - Custom processing prompts 