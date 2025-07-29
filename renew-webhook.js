const { setupGoogleDriveWebhook } = require('./google-drive-webhook-setup');

async function renewWebhook() {
  try {
    console.log('🔄 Renewing Google Drive webhook...');
    const result = await setupGoogleDriveWebhook();
    console.log('✅ Webhook renewed successfully!');
    console.log('New expiration:', result.expiration);
    return result;
  } catch (error) {
    console.error('❌ Failed to renew webhook:', error);
    throw error;
  }
}

// Run renewal
if (require.main === module) {
  renewWebhook()
    .then(() => {
      console.log('Renewal completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Renewal failed:', error);
      process.exit(1);
    });
}

module.exports = { renewWebhook };