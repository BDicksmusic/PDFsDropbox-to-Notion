const express = require('express');

console.log('🚀 Starting minimal test server...');

const app = express();

app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Minimal test server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    service: 'Minimal Test Server',
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`✅ Minimal test server started on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});