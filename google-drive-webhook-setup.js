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
    const webhookUrl = process.env.RAILWAY_URL 
      ? `${process.env.RAILWAY_URL}/webhook/google-drive`
      : 'https://your-app.railway.app/webhook/google-drive';
    
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