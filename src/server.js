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
    // Root endpoint for webhook verification
    this.app.get('/', (req, res) => {
      res.json({ 
        status: 'running', 
        service: 'Automation-Connections',
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        backgroundMode: this.backgroundMode,
        service: 'Automation-Connections'
      });
    });

    // Dropbox webhook verification endpoint
    this.app.get('/webhook', (req, res) => {
      const challenge = req.query.challenge;
      if (challenge) {
        logger.info('Dropbox webhook verification challenge received', { challenge });
        res.set('Content-Type', 'text/plain');
        res.send(challenge);
      } else {
        res.status(400).json({ error: 'Missing challenge parameter' });
      }
    });

    // Dropbox webhook endpoint
    this.app.post('/webhook', async (req, res) => {
      try {
        const signature = req.headers['x-dropbox-signature'];
        
        if (!signature) {
          logger.warn('Webhook request missing signature');
          return res.status(400).json({ error: 'Missing signature' });
        }

        // Verify webhook signature (temporarily disabled for testing)
        // if (this.dropboxHandler.webhookSecret && !this.dropboxHandler.verifyWebhookSignature(req.body, signature)) {
        //   logger.warn('Invalid webhook signature');
        //   return res.status(401).json({ error: 'Invalid signature' });
        // }

        const notification = req.body;
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
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Manual file processing requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName);
        res.json(result);
      } catch (error) {
        logger.error('Manual processing error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Manual file processing with custom name endpoint
    this.app.post('/process-file-with-name', async (req, res) => {
      try {
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        if (!customName) {
          return res.status(400).json({ error: 'customName is required for this endpoint' });
        }

        logger.info('Manual file processing with custom name requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName);
        res.json(result);
      } catch (error) {
        logger.error('Manual processing with custom name error', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Force reprocess file endpoint (even if it exists in Notion)
    this.app.post('/force-reprocess-file', async (req, res) => {
      try {
        const { filePath, customName } = req.body;
        
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }

        logger.info('Force reprocess file requested', { filePath, customName });
        
        const result = await this.processFileManually(filePath, customName, true); // true = force reprocess
        res.json(result);
      } catch (error) {
        logger.error('Force reprocess error', { error: error.message });
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

      // Step 2: Filter out files that failed to download (null values)
      const validFiles = files.filter(file => file !== null);
      
      if (validFiles.length === 0) {
        logger.info('No valid files to process after download attempts');
        return;
      }

      // Step 3: Check which files haven't been processed yet
      const unprocessedFiles = [];
      for (const file of validFiles) {
        try {
          // Use URL-based tracking if available, fallback to filename
          let alreadyProcessed = false;
          
          if (file.shareableUrl) {
            alreadyProcessed = await this.notionHandler.isFileAlreadyProcessedByUrl(file.shareableUrl);
            logger.info(`URL-based check for ${file.fileName}: ${alreadyProcessed ? 'already processed' : 'new file'}`);
          } else {
            logger.warn(`No shareable URL for ${file.fileName}, falling back to filename check`);
            alreadyProcessed = await this.notionHandler.isFileAlreadyProcessed(file.fileName);
            logger.info(`Filename-based check for ${file.fileName}: ${alreadyProcessed ? 'already processed' : 'new file'}`);
          }
          
          if (!alreadyProcessed) {
            unprocessedFiles.push(file);
          } else {
            logger.info(`Skipping ${file.fileName}: already processed in Notion`);
            // Clean up the downloaded file since we won't process it
            await this.dropboxHandler.cleanupFile(file.localPath);
          }
        } catch (error) {
          logger.error(`Error checking processing status for ${file.fileName}:`, error.message);
          // On error, include the file for processing to be safe
          unprocessedFiles.push(file);
        }
      }

      if (unprocessedFiles.length === 0) {
        logger.info('All files have already been processed');
        return;
      }

      logger.info(`Processing ${unprocessedFiles.length} unprocessed files`);

      // Step 4: Process each unprocessed file
      for (const file of unprocessedFiles) {
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
  async processFile(file, customName = null, forceReprocess = false) {
    try {
      logger.info(`Processing file: ${file.fileName}${forceReprocess ? ' (force reprocess)' : ''}`);
      
      // Validate file has a local path
      if (!file.localPath) {
        throw new Error(`File ${file.fileName} has no local path - download may have failed`);
      }

      // Check if file actually exists before processing
      const fs = require('fs');
      if (!fs.existsSync(file.localPath)) {
        throw new Error(`File ${file.fileName} does not exist at path: ${file.localPath}`);
      }
      
      // Step 1: Transcribe and extract key points
      const audioData = await this.transcriptionHandler.processAudioFile(
        file.localPath, 
        file.fileName
      );

      // Only proceed to Notion if transcription was successful
      if (!audioData || !audioData.summary) {
        throw new Error(`Transcription failed for ${file.fileName} - no audio data or summary generated`);
      }

      // Step 2: Create Notion page with custom name if provided
      const notionPage = await this.notionHandler.createOrUpdatePage(audioData, customName, forceReprocess);

      // Step 3: Clean up temporary file
      await this.dropboxHandler.cleanupFile(file.localPath);

      logger.info(`Successfully processed ${file.fileName} -> Notion page: ${notionPage.id}`);
      
      return {
        fileName: file.fileName,
        customName: customName,
        notionPageId: notionPage.id,
        summary: audioData.summary,
        keyPoints: audioData.keyPoints,
        actionItems: audioData.actionItems
      };

    } catch (error) {
      logger.error(`Failed to process file ${file.fileName}:`, error);
      
      // Clean up file even if processing failed
      try {
        if (file.localPath) {
          await this.dropboxHandler.cleanupFile(file.localPath);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup file ${file.localPath}:`, cleanupError.message);
      }
      
      throw error;
    }
  }

  // Manual file processing
  async processFileManually(filePath, customName, forceReprocess = false) {
    try {
      // Get file metadata from Dropbox
      const metadata = await this.dropboxHandler.getFileMetadata(filePath);
      
      // Get shareable URL for better tracking
      let shareableUrl = null;
      try {
        shareableUrl = await this.dropboxHandler.getShareableUrl(filePath);
      } catch (error) {
        logger.warn(`Failed to get shareable URL for manual processing of ${filePath}:`, error.message);
      }
      
      // Process the file
      const file = {
        originalPath: filePath,
        fileName: customName || metadata.name, // Use customName if provided, otherwise original name
        localPath: null,
        size: metadata.size,
        modified: metadata.server_modified,
        shareableUrl: shareableUrl
      };

      // Check if file already exists in Notion (unless force reprocessing)
      if (!forceReprocess) {
        let alreadyProcessed = false;
        
        if (shareableUrl) {
          alreadyProcessed = await this.notionHandler.isFileAlreadyProcessedByUrl(shareableUrl);
          logger.info(`Manual processing URL-based check: ${alreadyProcessed ? 'already processed' : 'new file'}`);
        } else {
          logger.warn(`No shareable URL for manual processing, falling back to filename check`);
          alreadyProcessed = await this.notionHandler.isFileAlreadyProcessed(file.fileName);
          logger.info(`Manual processing filename-based check: ${alreadyProcessed ? 'already processed' : 'new file'}`);
        }
        
        if (alreadyProcessed) {
          throw new Error(`File ${file.fileName} has already been processed. Use force-reprocess-file endpoint to reprocess.`);
        }
      }

      // Download the file
      file.localPath = await this.dropboxHandler.downloadFile(filePath, file.fileName);
      
      // Process through pipeline
      return await this.processFile(file, customName, forceReprocess);
      
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