# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for your automation server.

## Prerequisites

1. A Google Cloud Platform account
2. Node.js and npm installed
3. Your automation server running

## Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" → "Library"
4. Search for "Google Drive API"
5. Click on it and press "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Desktop application" as the application type
4. Give it a name (e.g., "Automation Server")
5. Click "Create"
6. Download the JSON file or note the Client ID and Client Secret

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "Automation Server"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
5. Add test users (your email address)
6. Save and continue

## Step 4: Generate Tokens

### Option A: Use the Automated Script

Run the token regeneration script:

```bash
node regenerate-google-tokens.js
```

Follow the interactive prompts to generate your tokens.

### Option B: Manual Token Generation

1. Open this URL in your browser (replace `YOUR_CLIENT_ID`):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code
   ```

2. Authorize the application and copy the authorization code

3. Exchange the code for tokens:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=urn:ietf:wg:oauth:2.0:oob"
   ```

## Step 5: Configure Environment Variables

Add these variables to your `.env` file:

```env
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_DRIVE_ACCESS_TOKEN=your_access_token_here
GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_folder_id_here
GOOGLE_DRIVE_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 6: Set Up Google Drive Folder

1. Create a folder in Google Drive for audio files
2. Copy the folder ID from the URL (the long string after `/folders/`)
3. Add it to your `.env` file as `GOOGLE_DRIVE_AUDIO_FOLDER_ID`

## Step 7: Generate Webhook Secret

Run this command to generate a secure webhook secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to your `.env` file as `GOOGLE_DRIVE_WEBHOOK_SECRET`.

## Step 8: Set Up Google Apps Script Webhook

1. Go to [Google Apps Script](https://script.google.com/)
2. Create a new project
3. Replace the code with the contents of `google-drive-webhook.gs`
4. Update the configuration variables:
   - `WEBHOOK_URL`: Your server's webhook URL
   - `FOLDER_ID`: Your audio folder ID
   - `WEBHOOK_SECRET`: Your webhook secret
5. Save and deploy the script
6. Set up a trigger to run the script periodically

## Step 9: Test the Integration

1. Restart your server
2. Check the health endpoint: `GET /health`
3. Upload an audio file to your Google Drive folder
4. Check the server logs for webhook processing

## Troubleshooting

### Common Issues

#### 1. "Google Drive API not enabled"
- **Solution**: Enable the Google Drive API in Google Cloud Console

#### 2. "Invalid OAuth credentials"
- **Solution**: Regenerate tokens using `node regenerate-google-tokens.js`

#### 3. "Access token expired"
- **Solution**: The server automatically refreshes tokens. If it fails, regenerate tokens.

#### 4. "Webhook signature verification failed"
- **Solution**: Ensure the webhook secret in your `.env` file matches the one in your Google Apps Script.

#### 5. "Folder not found"
- **Solution**: Verify the folder ID is correct and the folder exists.

### Health Check

The server provides a comprehensive health check at `GET /health` that shows:

```json
{
  "status": "healthy",
  "services": {
    "googleDrive": {
      "available": true,
      "configured": true,
      "status": "operational"
    }
  }
}
```

### Logs

Check the server logs for detailed information about:
- Token refresh attempts
- Webhook processing
- File downloads
- Error messages

### Manual Testing

You can test the Google Drive integration manually:

```bash
curl -X POST http://localhost:3000/process-file \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "your_file_id_here",
    "source": "google-drive",
    "customName": "test-audio.mp3"
  }'
```

## Long-term Maintenance

### Token Refresh

The server automatically refreshes access tokens when they expire. If you encounter persistent token issues:

1. Run `node regenerate-google-tokens.js`
2. Update your `.env` file with the new tokens
3. Restart the server

### Monitoring

- Check the health endpoint regularly
- Monitor server logs for errors
- Set up alerts for webhook failures

### Security

- Keep your OAuth credentials secure
- Rotate webhook secrets periodically
- Use HTTPS in production
- Monitor for unauthorized access

## Support

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test the Google Drive API directly using the Google Cloud Console
4. Ensure your Google Apps Script is running and configured correctly