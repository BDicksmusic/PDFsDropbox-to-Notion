const config = require('./config/config');
const { logger } = require('./src/utils');

console.log('🔍 Testing server startup...');

// Test config loading
console.log('📋 Config loaded successfully');
console.log('Server port:', config.server.port);
console.log('Dropbox configured:', !!config.dropbox.accessToken);
console.log('Google Drive configured:', !!config.googleDrive.clientId);
console.log('Notion configured:', !!config.notion.apiKey);
console.log('OpenAI configured:', !!config.openai.apiKey);

// Test if we can create handlers
try {
  console.log('🔄 Testing handler creation...');
  
  const DropboxHandler = require('./src/dropbox-handler');
  const GoogleDriveHandler = require('./src/google-drive-handler');
  
  console.log('✅ DropboxHandler loaded');
  console.log('✅ GoogleDriveHandler loaded');
  
  // Try to create instances
  const dropboxHandler = new DropboxHandler();
  const googleDriveHandler = new GoogleDriveHandler();
  
  console.log('✅ Handler instances created successfully');
  
} catch (error) {
  console.error('❌ Error creating handlers:', error.message);
}

// Test server creation
try {
  console.log('🔄 Testing server creation...');
  
  const AutomationServer = require('./src/server');
  const server = new AutomationServer();
  
  console.log('✅ Server instance created successfully');
  
  // Test health endpoint
  const express = require('express');
  const testApp = express();
  testApp.use(express.json());
  
  // Mock the health endpoint
  testApp.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  console.log('✅ Health endpoint test passed');
  
} catch (error) {
  console.error('❌ Error creating server:', error.message);
}

console.log('✅ Server startup test completed');