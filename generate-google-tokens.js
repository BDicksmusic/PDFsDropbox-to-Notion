const readline = require('readline');
const axios = require('axios');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function generateTokens() {
  console.log('🔑 Google Drive OAuth Token Generator\n');
  
  // Get client credentials
  const clientId = await askQuestion('Enter your Google Drive Client ID: ');
  const clientSecret = await askQuestion('Enter your Google Drive Client Secret: ');
  
  console.log('\n📋 Step 1: Authorization URL');
  console.log('Copy and paste this URL into your browser:');
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=urn:ietf:wg:oauth:2.0:oob&` +
    `scope=https://www.googleapis.com/auth/drive.readonly&` +
    `response_type=code&` +
    `access_type=offline`);
  
  console.log('\n📋 Step 2: Get Authorization Code');
  console.log('After authorizing, you\'ll get a code. Paste it here:');
  const authCode = await askQuestion('Authorization Code: ');
  
  console.log('\n🔄 Step 3: Exchanging for Tokens...');
  
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob'
    });
    
    console.log('\n✅ Success! Here are your tokens:');
    console.log('\n📝 Add these to your .env file:');
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${response.data.refresh_token}`);
    console.log(`GOOGLE_DRIVE_ACCESS_TOKEN=${response.data.access_token}`);
    
    console.log('\n📁 Next steps:');
    console.log('1. Add these to your .env file');
    console.log('2. Get your Google Drive folder ID (see DUAL_SERVICE_SETUP.md)');
    console.log('3. Update your Railway environment variables');
    
  } catch (error) {
    console.error('❌ Error generating tokens:', error.response?.data || error.message);
  }
  
  rl.close();
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

generateTokens().catch(console.error);