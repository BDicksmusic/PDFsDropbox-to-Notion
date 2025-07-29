# Google Drive API Webhook Setup Guide

This guide will help you set up proper Google Drive API webhooks for real-time file processing.

## Overview

Instead of using Google Apps Script to poll for changes every minute, we'll set up proper Google Drive API webhooks that trigger immediately when files are added to your monitored folder.

## Prerequisites

1. Google Cloud Platform project with Google Drive API enabled
2. OAuth 2.0 credentials configured
3. Your automation server deployed to Railway or similar hosting service
4. A publicly accessible HTTPS endpoint

## Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" → "Library"
4. Search for "Google Drive API"
5. Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application" as the application type
4. Add your Railway URL to authorized redirect URIs
5. Note your Client ID and Client Secret

## Step 3: Generate Access Tokens

Run the token generation script:

```bash
node regenerate-google-tokens.js
```

Follow the prompts to generate your access and refresh tokens.

## Step 4: Set Up Environment Variables

Add these to your `.env` file:

```env
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_DRIVE_ACCESS_TOKEN=your_access_token_here
GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_folder_id_here
GOOGLE_DRIVE_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 5: Generate Webhook Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add it to your environment variables.

## Step 6: Create Google Drive Webhook

Now we'll create a script to set up the Google Drive API webhook:

```javascript
// google-drive-webhook-setup.js
const { google } = require('googleapis');
const config = require('./config/config');

async function setupGoogleDriveWebhook() {
  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.googleDrive.clientId,
      config.googleDrive.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: config.googleDrive.accessToken,
      refresh_token: config.googleDrive.refreshToken
    });

    // Create Drive API client
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Your webhook URL (replace with your actual Railway URL)
    const webhookUrl = 'https://your-app.railway.app/webhook/google-drive';
    
    // Your Google Drive folder ID
    const folderId = config.googleDrive.audioFolderId;

    console.log('Setting up Google Drive webhook...');
    console.log('Webhook URL:', webhookUrl);
    console.log('Folder ID:', folderId);

    // Create webhook
    const response = await drive.changes.watch({
      requestBody: {
        id: 'automation-webhook-' + Date.now(),
        type: 'web_hook',
        address: webhookUrl,
        token: config.googleDrive.webhookSecret,
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }
    });

    console.log('✅ Google Drive webhook created successfully!');
    console.log('Webhook ID:', response.data.id);
    console.log('Resource ID:', response.data.resourceId);
    console.log('Expiration:', response.data.expiration);

    return response.data;

  } catch (error) {
    console.error('❌ Failed to create Google Drive webhook:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// Run the setup
if (require.main === module) {
  setupGoogleDriveWebhook()
    .then(() => {
      console.log('Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupGoogleDriveWebhook };
```

## Step 7: Deploy Your Application

1. Deploy your application to Railway:
   ```bash
   railway login
   railway init
   railway up
   ```

2. Get your Railway URL (e.g., `https://your-app.railway.app`)

3. Update the webhook URL in the setup script with your actual Railway URL

## Step 8: Run the Webhook Setup

1. Install the Google APIs library:
   ```bash
   npm install googleapis
   ```

2. Run the webhook setup:
   ```bash
   node google-drive-webhook-setup.js
   ```

## Step 9: Test the Webhook

1. Upload an audio file to your Google Drive folder
2. Check your Railway logs to see if the webhook is received
3. Check your Notion database to see if a page was created

## Step 10: Set Up Webhook Renewal

Google Drive webhooks expire after 24 hours. You'll need to renew them periodically. Create a renewal script:

```javascript
// renew-webhook.js
const { setupGoogleDriveWebhook } = require('./google-drive-webhook-setup');

async function renewWebhook() {
  try {
    console.log('Renewing Google Drive webhook...');
    await setupGoogleDriveWebhook();
    console.log('Webhook renewed successfully!');
  } catch (error) {
    console.error('Failed to renew webhook:', error);
  }
}

// Run renewal
renewWebhook();
```

## Step 11: Set Up Automatic Renewal

Add this to your Railway environment to automatically renew the webhook:

```bash
# Add to your package.json scripts
"renew-webhook": "node renew-webhook.js"

# Set up a cron job or use Railway's scheduled tasks
```

## Troubleshooting

### Common Issues

1. **"Invalid webhook URL"**
   - Ensure your Railway URL is publicly accessible
   - Check that the webhook endpoint is working

2. **"Authentication failed"**
   - Regenerate your OAuth tokens
   - Ensure all environment variables are set correctly

3. **"Webhook not receiving notifications"**
   - Check that the folder ID is correct
   - Verify the webhook hasn't expired
   - Check Railway logs for errors

4. **"Webhook signature verification failed"**
   - Ensure the webhook secret matches in your environment variables

## Benefits of This Approach

✅ **Real-time processing**: Webhooks trigger immediately when files are added
✅ **No polling**: No need to check for changes every minute
✅ **More efficient**: Uses less resources than Apps Script polling
✅ **More reliable**: Direct API integration instead of script-based polling
✅ **Better error handling**: Proper API error responses and retry logic

## Next Steps

1. Deploy your application to Railway
2. Run the webhook setup script
3. Test with a sample audio file
4. Set up automatic webhook renewal
5. Monitor logs for any issues

This approach is much more robust and efficient than the Apps Script polling method!