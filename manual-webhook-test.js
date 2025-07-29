const config = require('./config/config');
const { logger } = require('./src/utils');
const GoogleDriveHandler = require('./src/google-drive-handler');

async function simulateWebhook() {
  try {
    console.log('🔄 Simulating Google Drive webhook...');
    
    // Create Google Drive handler
    const googleDriveHandler = new GoogleDriveHandler();
    
    if (!googleDriveHandler.isConfigured()) {
      console.error('❌ Google Drive handler not configured');
      return;
    }
    
    // Simulate webhook notification
    const mockNotification = {
      resourceId: config.googleDrive.audioFolderId,
      resourceUri: `https://www.googleapis.com/drive/v3/files?q='${config.googleDrive.audioFolderId}'+in+parents`,
      state: 'sync',
      timestamp: new Date().toISOString()
    };
    
    console.log('📡 Processing webhook notification...');
    console.log('Notification:', JSON.stringify(mockNotification, null, 2));
    
    // Process the webhook notification
    const processedFiles = await googleDriveHandler.processWebhookNotification(mockNotification);
    
    console.log(`✅ Webhook processed ${processedFiles.length} files`);
    
    if (processedFiles.length === 0) {
      console.log('⚠️ No files were processed. This could mean:');
      console.log('   - No files were modified in the last 5 minutes');
      console.log('   - Files are not in the correct folder');
      console.log('   - Files are not audio format');
      console.log('   - Files were already processed');
    } else {
      console.log('📁 Processed files:');
      processedFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.fileName} (${file.size} bytes)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Webhook simulation failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the simulation
if (require.main === module) {
  simulateWebhook()
    .then(() => {
      console.log('\n✅ Webhook simulation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Webhook simulation failed:', error);
      process.exit(1);
    });
}

module.exports = { simulateWebhook };