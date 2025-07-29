const AutomationServer = require('./src/server');
const { logger } = require('./src/utils');

console.log('🚀 Starting Automation Connections Server...');

// Add timeout protection
const startupTimeout = setTimeout(() => {
  console.error('❌ Server startup timed out after 30 seconds');
  process.exit(1);
}, 30000);

try {
  // Create and start the server
  const server = new AutomationServer();
  
  // Clear the timeout since server was created successfully
  clearTimeout(startupTimeout);
  
  server.start();
  
  console.log('✅ Server started successfully');
} catch (error) {
  clearTimeout(startupTimeout);
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});