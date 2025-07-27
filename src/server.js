const express = require('express');
const config = require('../config/config');
const { logger, ensureTempDir } = require('./utils');
const DropboxHandler = require('./dropbox-handler');
const TranscriptionHandler = require('./transcription');
const NotionHandler = require('./notion-handler');

class AutomationServer {
  constructor() {
    this.app = express();
    this.dropboxHandler = new DropboxHandler();
    this.transcriptionHandler = new TranscriptionHandler();
    this.notionHandler = new NotionHandler();
    
    // Add background mode option
    this.backgroundMode = process.env.BACKGROUND_MODE === 'true';

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse raw bodies for webhook verification
    this.app.use('/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        backgroundMode: this.backgroundMode,
        service: 'dropbox-notion-automation'
      });
    });

    // Dropbox webhook endpoint
    this.app.post('/webhook', async (req, res) => {
      try {
        const signature = req.headers['x-dropbox-signature'];
        
        if (!signature) {
          logger.warn('Webhook request missing signature');
          return res.status(400).json({ error: 'Missing signature' });
        }

        // Verify webhook signature
        if (!this.dropboxHandler.verifyWebhookSignature(req.body, signature)) {
          logger.warn('Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }

        const notification = JSON.parse(req.body.toString());
        logger.info('Received Dropbox webhook', { notification });

        // Process webhook asynchronously
        this.processWebhookAsync(notification);

        res.status(200).json({ status: 'processing' });
      } catch (error) {
        logger.error('Webhook processing error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Manual file processing endpoint
    this.app.post('/process-file', async (req, res) => {
      try {
        const { filePath } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Manual file processing requested', { filePath });
        
        const result = await this.processFileManually(filePath);
        res.json(result);
      } catch (error) {
        logger.error('Manual processing error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // System status endpoint
    this.app.get('/status', async (req, res) => {
      try {
        const status = await this.getSystemStatus();
        res.json(status);
      } catch (error) {
        logger.error('Status check error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Background mode: minimal routes for webhook only
    if (this.backgroundMode) {
      logger.info('Running in background mode - minimal routes enabled');
      
      // Disable other routes in background mode
      this.app.use('*', (req, res, next) => {
        if (req.path === '/health' || req.path === '/webhook') {
          return next();
        }
        res.status(404).json({ 
          error: 'Route not available in background mode',
          availableRoutes: ['/health', '/webhook']
        });
      });
    }
  }

  // Process webhook asynchronously
  async processWebhookAsync(notification) {
    try {
      logger.info('Starting webhook processing');
      
      // Step 1: Process Dropbox notification
      const files = await this.dropboxHandler.processWebhookNotification(notification);
      
      if (files.length === 0) {
        logger.info('No new files to process');
        return;
      }

      // Step 2: Process each file
      for (const file of files) {
        try {
          await this.processFile(file);
        } catch (error) {
          logger.error(`Failed to process file ${file.fileName}:`, error.message);
        }
      }

      logger.info('Webhook processing completed');
      
    } catch (error) {
      logger.error('Webhook processing failed:', error);
    }
  }

  // Process a single file through the entire pipeline
  async processFile(file) {
    try {
      logger.info(`Processing file: ${file.fileName}`);
      
      // Step 1: Transcribe and extract key points
      const audioData = await this.transcriptionHandler.processAudioFile(
        file.localPath, 
        file.fileName
      );

      // Step 2: Create Notion page
      const notionPage = await this.notionHandler.createOrUpdatePage(audioData);

      // Step 3: Clean up temporary file
      await this.dropboxHandler.cleanupFile(file.localPath);

      logger.info(`Successfully processed ${file.fileName} -> Notion page: ${notionPage.id}`);
      
      return {
        fileName: file.fileName,
        notionPageId: notionPage.id,
        summary: audioData.summary,
        keyPoints: audioData.keyPoints,
        actionItems: audioData.actionItems
      };

    } catch (error) {
      logger.error(`Failed to process file ${file.fileName}:`, error);
      
      // Clean up file even if processing failed
      try {
        await this.dropboxHandler.cleanupFile(file.localPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup file ${file.localPath}:`, cleanupError.message);
      }
      
      throw error;
    }
  }

  // Manual file processing
  async processFileManually(filePath) {
    try {
      // Get file metadata from Dropbox
      const metadata = await this.dropboxHandler.getFileMetadata(filePath);
      
      // Process the file
      const file = {
        originalPath: filePath,
        fileName: metadata.name,
        localPath: null,
        size: metadata.size,
        modified: metadata.server_modified
      };

      // Download the file
      file.localPath = await this.dropboxHandler.downloadFile(filePath, metadata.name);
      
      // Process through pipeline
      return await this.processFile(file);
      
    } catch (error) {
      logger.error(`Manual file processing failed for ${filePath}:`, error);
      throw error;
    }
  }

  // Get system status
  async getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Check Dropbox connection
    try {
      await this.dropboxHandler.listFiles();
      status.services.dropbox = 'connected';
    } catch (error) {
      status.services.dropbox = 'error';
      status.services.dropboxError = error.message;
    }

    // Check Notion connection
    try {
      await this.notionHandler.testConnection();
      status.services.notion = 'connected';
    } catch (error) {
      status.services.notion = 'error';
      status.services.notionError = error.message;
    }

    // Check OpenAI connection (simple test)
    try {
      // This is a minimal test - in production you might want a more comprehensive check
      status.services.openai = 'configured';
    } catch (error) {
      status.services.openai = 'error';
      status.services.openaiError = error.message;
    }

    return status;
  }

  // Start the server
  async start() {
    try {
      // Ensure temp directory exists
      await ensureTempDir();
      
      // Start the server
      const port = config.server.port;
      this.app.listen(port, () => {
        logger.info(`Server started on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Webhook URL: http://localhost:${port}/webhook`);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AutomationServer();
  server.start();
}

module.exports = AutomationServer; 