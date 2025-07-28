#!/usr/bin/env node

/**
 * Debug OAuth Setup
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('🔧 Debug OAuth Setup');
  console.log('=====================\n');

  try {
    // Get app credentials
    const appKey = await askQuestion('📝 Enter your Dropbox App Key: ');
    console.log(`App Key length: ${appKey.length}`);
    console.log(`App Key: "${appKey}"`);
    
    const appSecret = await askQuestion('🔐 Enter your Dropbox App Secret: ');
    console.log(`App Secret length: ${appSecret.length}`);
    console.log(`App Secret: "${appSecret}"`);
    
    if (!appKey || !appSecret) {
      console.error('❌ App Key and App Secret are required!');
      process.exit(1);
    }

    // Generate authorization URL
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline`;
    
    console.log('\n🌐 Authorization URL:');
    console.log(authUrl);
    console.log('\n📋 Please:');
    console.log('1. Copy and paste this URL into your browser');
    console.log('2. Authorize the app');
    console.log('3. Copy the authorization code from the redirect URL');
    
    const authCode = await askQuestion('\n📋 Enter the authorization code: ');
    console.log(`Auth Code: "${authCode}"`);
    
    if (!authCode) {
      console.error('❌ Authorization code is required!');
      process.exit(1);
    }

    console.log('\n🔄 Testing token exchange...');

    // Exchange code for tokens
    const axios = require('axios');
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
    
    console.log('Access Token length:', access_token.length);
    console.log('Access Token starts with:', access_token.substring(0, 10) + '...');
    console.log('Refresh Token length:', refresh_token.length);
    
    console.log('\nAdd these to your .env file:');
    console.log(`DROPBOX_ACCESS_TOKEN=${access_token}`);
    console.log(`DROPBOX_REFRESH_TOKEN=${refresh_token}`);
    console.log(`DROPBOX_APP_KEY=${appKey}`);
    console.log(`DROPBOX_APP_SECRET=${appSecret}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    rl.close();
  }
}

main(); 