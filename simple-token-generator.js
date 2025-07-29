const axios = require('axios');

console.log('🔄 Simple Google Drive Token Generator');
console.log('=====================================\n');

console.log('Step 1: Get your OAuth credentials from Google Cloud Console');
console.log('1. Go to https://console.cloud.google.com/');
console.log('2. Select your project');
console.log('3. Go to "APIs & Services" → "Credentials"');
console.log('4. Find your OAuth 2.0 Client ID (Desktop application)');
console.log('5. Copy the Client ID and Client Secret\n');

console.log('Step 2: Generate authorization URL');
console.log('Replace YOUR_CLIENT_ID with your actual Client ID in this URL:');
console.log('https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code\n');

console.log('Step 3: Get authorization code');
console.log('1. Open the URL above in your browser');
console.log('2. Sign in with your Google account');
console.log('3. Grant permissions to the app');
console.log('4. Copy the authorization code from the page\n');

console.log('Step 4: Exchange for tokens');
console.log('Run this curl command (replace the placeholders):');
console.log(`
curl -X POST https://oauth2.googleapis.com/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code&code=YOUR_AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=urn:ietf:wg:oauth:2.0:oob"
`);

console.log('\nStep 5: Update your .env file');
console.log('Add these to your .env file:');
console.log('GOOGLE_DRIVE_CLIENT_ID=your_client_id');
console.log('GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret');
console.log('GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token');
console.log('GOOGLE_DRIVE_ACCESS_TOKEN=your_access_token');

console.log('\nStep 6: Get your folder ID');
console.log('1. Go to Google Drive');
console.log('2. Create a folder for audio files');
console.log('3. Open the folder and copy the ID from the URL');
console.log('4. Add to .env: GOOGLE_DRIVE_AUDIO_FOLDER_ID=your_folder_id');

console.log('\nStep 7: Generate webhook secret');
console.log('Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
console.log('Add to .env: GOOGLE_DRIVE_WEBHOOK_SECRET=your_webhook_secret');

console.log('\n🎉 After completing these steps, restart your server!');