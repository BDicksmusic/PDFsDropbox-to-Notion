const crypto = require('crypto');

// Generate a random webhook secret
const webhookSecret = crypto.randomBytes(32).toString('hex');

console.log('🔐 Generated Webhook Secret:');
console.log(webhookSecret);
console.log('\n📝 Add this to your .env file:');
console.log(`GOOGLE_DRIVE_WEBHOOK_SECRET=${webhookSecret}`);
console.log('\n💡 Note: This is for testing. For production, you might want to use a more secure method.');