#!/usr/bin/env node

/**
 * Dropbox OAuth Setup Script
 * 
 * This script helps you get initial OAuth tokens for your Dropbox app.
 * Run this once to set up automatic token refresh.
 * 
 * Usage: node scripts/setup-dropbox-oauth.js
 */

const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🔧 Dropbox OAuth Setup Script');
  console.log('================================\n');
  
  console.log('This script will help you set up OAuth tokens for automatic Dropbox authentication.');
  console.log('You\'ll need your Dropbox app credentials from https://www.dropbox.com/developers/apps\n');

  try {
    // Get app credentials
    const appKey = await askQuestion('📝 Enter your Dropbox App Key: ');
    const appSecret = await askQuestion('🔐 Enter your Dropbox App Secret: ');
    
    if (!appKey || !appSecret) {
      console.error('❌ App Key and App Secret are required!');
      process.exit(1);
    }

    // Generate authorization URL
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline`;
    
    console.log('\n🌐 Step 1: Authorize your app');
    console.log('Open this URL in your browser:');
    console.log(`\n${authUrl}\n`);
    console.log('After authorizing, you\'ll be redirected to a URL like:');
    console.log('http://localhost/?code=AUTHORIZATION_CODE&state=...');
    console.log('Copy the AUTHORIZATION_CODE from the URL.');
    
    const authCode = await askQuestion('\n📋 Enter the authorization code: ');
    
    if (!authCode) {
      console.error('❌ Authorization code is required!');
      process.exit(1);
    }

    console.log('\n🔄 Step 2: Exchanging code for tokens...');

    // Exchange code for tokens
    const response = await axios({
      method: 'POST',
      url: 'https://api.dropboxapi.com/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        code: authCode,
        grant_type: 'authorization_code',
        client_id: appKey,
        client_secret: appSecret
      })
    });

    const { access_token, refresh_token } = response.data;

    console.log('\n✅ Success! Here are your tokens:');
    console.log('=====================================\n');
    
    console.log('Add these to your .env file:');
    console.log(`DROPBOX_ACCESS_TOKEN=${access_token}`);
    console.log(`DROPBOX_REFRESH_TOKEN=${refresh_token}`);
    console.log(`DROPBOX_APP_KEY=${appKey}`);
    console.log(`DROPBOX_APP_SECRET=${appSecret}`);
    
    console.log('\n🎉 Setup complete!');
    console.log('Your service will now automatically refresh tokens when they expire.');
    console.log('\n📋 Next steps:');
    console.log('1. Update your .env file with the tokens above');
    console.log('2. Restart your service');
    console.log('3. Test with: curl http://localhost:3000/status');

  } catch (error) {
    console.error('\n❌ Error setting up OAuth:');
    
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Double-check your App Key and App Secret');
    console.log('2. Make sure you copied the full authorization code');
    console.log('3. Ensure your Dropbox app has the correct permissions');
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main }; 