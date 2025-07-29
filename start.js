const AutomationServer = require('./src/server');
const { logger } = require('./src/utils');

console.log('🚀 Starting Automation Connections Server...');

try {
  // Create and start the server
  const server = new AutomationServer();
  server.start();
  
  console.log('✅ Server started successfully');
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});