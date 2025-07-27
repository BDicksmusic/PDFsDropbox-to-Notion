# Dropbox Authentication Guide

## Problem
Your automation service is receiving a **401 Unauthorized** error when trying to access Dropbox files. This typically means your access token has expired.

## Quick Fix (Immediate Solution)

### Option 1: Generate a New Long-lived Access Token

1. Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Navigate to the "Settings" tab
4. Under "OAuth 2", click **"Generate access token"**
5. Copy the generated token
6. Update your environment variable:
   ```bash
   DROPBOX_ACCESS_TOKEN=your_new_token_here
   ```
7. Restart your application

## Better Solution (Automatic Token Refresh)

### Set Up OAuth 2.0 with Refresh Tokens

Your service now supports automatic token refresh! Here's how to set it up:

#### 1. Get Your App Credentials
From your Dropbox App Console:
- **App Key**: Found on the Settings tab
- **App Secret**: Found on the Settings tab (click "Show")

#### 2. Generate Initial Tokens
You'll need to implement a one-time OAuth flow to get initial tokens:

```javascript
// One-time setup script (run this once)
const axios = require('axios');

async function getInitialTokens() {
  // Step 1: Get authorization code
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${YOUR_APP_KEY}&response_type=code&token_access_type=offline`;
  console.log('Visit this URL and authorize your app:', authUrl);
  console.log('Copy the authorization code from the redirect URL');
  
  const authCode = 'PASTE_AUTH_CODE_HERE';
  
  // Step 2: Exchange code for tokens
  const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
    code: authCode,
    grant_type: 'authorization_code',
    client_id: YOUR_APP_KEY,
    client_secret: YOUR_APP_SECRET
  });
  
  console.log('Access Token:', response.data.access_token);
  console.log('Refresh Token:', response.data.refresh_token);
}
```

#### 3. Update Environment Variables
Add these to your `.env` file:
```bash
DROPBOX_ACCESS_TOKEN=your_access_token
DROPBOX_REFRESH_TOKEN=your_refresh_token
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
```

#### 4. How It Works
- When a request fails with 401, the service automatically:
  1. Uses the refresh token to get a new access token
  2. Retries the original request
  3. Continues working without interruption

## Error Messages Explained

### 401 Unauthorized
- **Cause**: Expired or invalid access token
- **Solution**: Generate new token or set up refresh tokens

### 400 Bad Request (invalid_grant)
- **Cause**: Refresh token is invalid or expired
- **Solution**: Re-authorize the app to get new tokens

## Testing Your Setup

Run this endpoint to check your Dropbox connection:
```bash
curl http://localhost:3000/status
```

Look for:
```json
{
  "services": {
    "dropbox": "connected"
  }
}
```

## Troubleshooting

### Token Still Expiring?
- Make sure you're using `token_access_type=offline` in the OAuth flow
- Verify your app has the correct permissions
- Check that refresh tokens are being saved properly

### 403 Forbidden
- Check your app's permission settings
- Ensure the folder path exists and is accessible

### Rate Limiting
- Dropbox has rate limits (typically 300 requests per minute)
- The service includes automatic retries with backoff

## Security Notes

- **Never commit tokens to version control**
- Store tokens securely in environment variables
- Refresh tokens are long-lived but can be revoked
- Monitor your app's usage in the Dropbox console

## Need Help?

1. Check the app logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test the connection using the `/status` endpoint
4. Ensure your Dropbox app has the necessary permissions

---

*This guide was generated after fixing authentication issues in your automation service.* 