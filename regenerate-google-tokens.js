const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function regenerateGoogleTokens() {
  console.log('🔄 Google Drive Token Regeneration Tool');
  console.log('=====================================\n');
  
  try {
    // Step 1: Get OAuth credentials
    console.log('Step 1: OAuth Credentials');
    console.log('------------------------');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Select your project or create a new one');
    console.log('3. Enable the Google Drive API');
    console.log('4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"');
    console.log('5. Choose "Desktop application" as the application type');
    console.log('6. Download the JSON file\n');
    
    const clientId = await question('Enter your Client ID: ');
    const clientSecret = await question('Enter your Client Secret: ');
    
    if (!clientId || !clientSecret) {
      throw new Error('Client ID and Client Secret are required');
    }
    
    // Step 2: Get authorization code
    console.log('\nStep 2: Authorization Code');
    console.log('--------------------------');
    console.log('1. Open this URL in your browser:');
    console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code\n`);
    
    const authCode = await question('Enter the authorization code from the browser: ');
    
    if (!authCode) {
      throw new Error('Authorization code is required');
    }
    
    // Step 3: Exchange for tokens
    console.log('\nStep 3: Exchanging for Tokens');
    console.log('-------------------------------');
    
    const tokenResponse = await axios({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
      }).toString()
    });
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    if (!access_token || !refresh_token) {
      throw new Error('Failed to obtain access and refresh tokens');
    }
    
    console.log('✅ Successfully obtained tokens!');
    console.log('\nStep 4: Update Environment Variables');
    console.log('------------------------------------');
    console.log('Update your .env file with these values:\n');
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${refresh_token}`);
    console.log(`GOOGLE_DRIVE_ACCESS_TOKEN=${access_token}`);
    
    // Step 5: Test the tokens
    console.log('\nStep 5: Testing Tokens');
    console.log('----------------------');
    
    try {
      const testResponse = await axios({
        method: 'GET',
        url: 'https://www.googleapis.com/drive/v3/about',
        headers: {
          'Authorization': `Bearer ${access_token}`
        },
        params: {
          fields: 'user'
        }
      });
      
      console.log('✅ Token test successful!');
      console.log(`Connected as: ${testResponse.data.user.displayName} (${testResponse.data.user.emailAddress})`);
      
    } catch (error) {
      console.log('⚠️ Token test failed:', error.response?.data || error.message);
      console.log('This might be normal if the access token expires quickly.');
    }
    
    // Step 6: Get folder ID
    console.log('\nStep 6: Audio Folder ID');
    console.log('------------------------');
    console.log('1. Go to Google Drive');
    console.log('2. Create or navigate to the folder where you want to store audio files');
    console.log('3. Copy the folder ID from the URL (it\'s the long string after /folders/)');
    console.log('4. Add this to your .env file as GOOGLE_DRIVE_AUDIO_FOLDER_ID\n');
    
    const folderId = await question('Enter your audio folder ID (optional, can add later): ');
    
    if (folderId) {
      console.log(`GOOGLE_DRIVE_AUDIO_FOLDER_ID=${folderId}`);
    }
    
    console.log('\n🎉 Token regeneration complete!');
    console.log('\nNext steps:');
    console.log('1. Update your .env file with the values above');
    console.log('2. Restart your server');
    console.log('3. Test the webhook connection');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure Google Drive API is enabled in your Google Cloud Console');
    console.log('- Check that your OAuth consent screen is configured');
    console.log('- Verify your client ID and secret are correct');
    console.log('- Ensure you\'re using the correct authorization code');
  } finally {
    rl.close();
  }
}

// Run the script
regenerateGoogleTokens().catch(console.error);