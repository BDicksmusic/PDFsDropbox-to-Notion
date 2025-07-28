#!/usr/bin/env node

/**
 * Dropbox Credentials Verification Script
 * 
 * This script helps verify your Dropbox app credentials and test the connection.
 * 
 * Usage: node scripts/verify-dropbox-credentials.js
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

async function testCredentials(appKey, appSecret) {
  console.log('\n🔍 Testing OAuth credentials...');
  
  try {
    // Test OAuth credentials by trying to exchange a test authorization code
    // This will verify the app key and secret are valid
    const response = await axios({
      method: 'POST',
      url: 'https://api.dropboxapi.com/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'test_code', // This will fail, but we can check the error type
        client_id: appKey,
        client_secret: appSecret
      })
    });
    
    console.log('✅ App credentials appear to be valid');
    return true;
  } catch (error) {
    // If we get an "invalid_grant" error, it means the credentials are valid
    // but the authorization code is invalid (which is expected)
    if (error.response?.data?.error === 'invalid_grant') {
      console.log('✅ App credentials are valid (invalid_grant is expected for test code)');
      return true;
    }
    
    // If we get an "invalid_client" error, the credentials are invalid
    if (error.response?.data?.error === 'invalid_client') {
      console.log('❌ App credentials are invalid');
      return false;
    }
    
    console.log('❌ App credentials test failed:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Dropbox Credentials Verification');
  console.log('==================================\n');
  
  console.log('This script will help you verify your Dropbox app credentials.');
  console.log('You\'ll need your Dropbox app credentials from https://www.dropbox.com/developers/apps\n');

  try {
    // Get app credentials
    const appKey = await askQuestion('📝 Enter your Dropbox App Key: ');
    const appSecret = await askQuestion('🔐 Enter your Dropbox App Secret: ');
    
    if (!appKey || !appSecret) {
      console.error('❌ App Key and App Secret are required!');
      process.exit(1);
    }

    console.log('\n📋 Your App Credentials:');
    console.log(`App Key: ${appKey}`);
    console.log(`App Secret: ${appSecret.substring(0, 4)}...${appSecret.substring(appSecret.length - 4)}`);
    
    // Test the credentials
    const isValid = await testCredentials(appKey, appSecret);
    
    if (isValid) {
      console.log('\n✅ Credentials appear valid!');
      console.log('\n📋 Next steps:');
      console.log('1. Use these credentials in the OAuth setup script');
      console.log('2. Run: node scripts/setup-dropbox-oauth.js');
      console.log('3. Follow the authorization flow');
    } else {
      console.log('\n❌ Credentials appear invalid.');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Double-check your App Key and App Secret');
      console.log('2. Make sure you\'re using the correct app');
      console.log('3. Verify the app has the correct permissions');
      console.log('4. Ensure the app is enabled in your Dropbox developer console');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
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